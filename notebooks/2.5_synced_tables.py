# Databricks notebook source
# MAGIC %md
# MAGIC # Lecture 2.5: Synced Tables and pgvector on Lakebase
# MAGIC
# MAGIC This notebook adds a managed synchronization path to the direct pgvector
# MAGIC solution from Notebook 2.4.
# MAGIC
# MAGIC ```text
# MAGIC arxiv_chunks_table (Unity Catalog Delta)
# MAGIC          │
# MAGIC          └── Synced Table (read-only Lakebase source)
# MAGIC                  │ read rows
# MAGIC                  ▼
# MAGIC          ai_query embeddings + upsert
# MAGIC                  ▼
# MAGIC          arxiv_chunk_embeddings (writable pgvector table)
# MAGIC ```
# MAGIC
# MAGIC A Synced Table is not itself a vector index. It is a managed, read-only
# MAGIC copy of a Unity Catalog table in Lakebase. This notebook reads that copy,
# MAGIC generates embeddings with `ai_query`, and maintains the writable
# MAGIC `arxiv_chunk_embeddings` pgvector table.

# COMMAND ----------

from loguru import logger
from pyspark.sql import SparkSession
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.postgres import Project, ProjectSpec

from arxiv_curator.config import get_env, load_config
from arxiv_curator.vector_search import LakebasePgVectorManager

# COMMAND ----------

spark = SparkSession.builder.getOrCreate()
env = get_env(spark)
cfg = load_config("../project_config.yml", env)
w = WorkspaceClient()

source_table = f"{cfg.catalog}.{cfg.schema}.arxiv_chunks_table"
synced_table = f"{cfg.catalog}.{cfg.schema}.arxiv_chunks_synced"
project_name = f"projects/{cfg.lakebase_project_id}"
postgres_branch = f"projects/{cfg.lakebase_project_id}/branches/production"

# Keep creation disabled until the source table and permissions have been checked.
RUN_CREATE_SYNC = False
RUN_INDEX_SYNCED_ROWS = False

logger.info(f"Environment: {env}")
logger.info(f"Source table: {source_table}")
logger.info(f"Synced table: {synced_table}")
logger.info(f"Lakebase project: {cfg.lakebase_project_id}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 1. Validate the Delta source
# MAGIC
# MAGIC Synced Tables require a stable, non-null primary key. The chunk pipeline
# MAGIC creates `id` for every chunk, so it is used as the synchronization key.
# MAGIC Triggered and continuous synchronization also require Delta Change Data
# MAGIC Feed to be enabled on the source table.

# COMMAND ----------

source_columns = {field.name for field in spark.table(source_table).schema.fields}
if "id" not in source_columns:
    raise ValueError(f"{source_table} must contain an 'id' primary-key column.")

spark.sql(
    f"ALTER TABLE {source_table} "
    "SET TBLPROPERTIES (delta.enableChangeDataFeed = true)"
)

logger.info(f"Validated source table and enabled Change Data Feed: {source_table}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. Create or reuse the Lakebase project
# MAGIC
# MAGIC The project is created by the same SDK flow used in Notebook 2.4. If the
# MAGIC project already exists, this cell only verifies that it is reachable.

# COMMAND ----------

try:
    project = w.postgres.get_project(name=project_name)
    logger.info(f"Lakebase project already exists: {project.name}")
except Exception:
    logger.info(f"Creating Lakebase project: {cfg.lakebase_project_id}")
    operation = w.postgres.create_project(
        project=Project(
            spec=ProjectSpec(
                display_name=cfg.lakebase_project_id,
                pg_version=17,
            )
        ),
        project_id=cfg.lakebase_project_id,
    )
    project = operation.wait()
    logger.info(f"Created Lakebase project: {project.name}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 3. Create the Synced Table
# MAGIC
# MAGIC The API call below uses the Lakebase Synced Tables API. The first run
# MAGIC provisions the target and performs an initial synchronization. Later runs
# MAGIC are idempotent: an existing synced table is inspected rather than created
# MAGIC again.
# MAGIC
# MAGIC `TRIGGERED` is useful for a classroom because changes are synchronized when
# MAGIC requested. Use `SNAPSHOT` when you want a complete replacement on each run,
# MAGIC or `CONTINUOUS` when the source should be replicated continuously.

# COMMAND ----------

sync_spec = {
    "source_table_full_name": source_table,
    "branch": postgres_branch,
    "primary_key_columns": ["id"],
    "scheduling_policy": "TRIGGERED",
    "postgres_database": "databricks_postgres",
    "create_database_objects_if_missing": True,
}

try:
        synced = w.api_client.do(
            "GET",
            f"/api/2.0/postgres/synced_tables/{synced_table}",
    )
    logger.info(f"Synced Table already exists: {synced_table}")
except Exception:
    if not RUN_CREATE_SYNC:
        logger.info(
            "Synced Table is not created. Set RUN_CREATE_SYNC=True and rerun "
            "this cell to provision it."
        )
    else:
        synced = w.api_client.do(
            "POST",
            "/api/2.0/postgres/synced_tables",
            query={"synced_table_id": synced_table},
            body={"name": synced_table, "spec": sync_spec},
        )
        logger.info(f"Created Synced Table: {synced_table}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 4. Check synchronization status
# MAGIC
# MAGIC Wait until the Synced Table is online before querying it. The destination
# MAGIC is read-only: write changes to `arxiv_chunks_table`, not to the Lakebase
# MAGIC copy. For a `TRIGGERED` table, use the Databricks UI or the corresponding
# MAGIC Databricks CLI command to start a later refresh after source changes.

# COMMAND ----------

try:
    synced_status = w.api_client.do(
        "GET",
        f"/api/2.0/postgres/synced_tables/{synced_table}",
    )
    logger.info(synced_status)
except Exception as error:
    logger.info(f"Synced Table status is not available yet: {error}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 5. Query the Lakebase mirror
# MAGIC
# MAGIC This table is in Lakebase Postgres, not in the Spark SQL catalog. Query it
# MAGIC through the Lakebase connection after it reaches `ONLINE`.

# COMMAND ----------

pgvector = LakebasePgVectorManager(config=cfg, spark=spark, workspace=w)
with pgvector.connection() as conn:
    rows = conn.execute(
        f'''SELECT id, arxiv_id, title, year, text
            FROM "{cfg.schema}"."arxiv_chunks_synced"
            LIMIT 10'''
    ).fetchall()

for row in rows:
    logger.info(row)

# COMMAND ----------

# MAGIC %md
# MAGIC ## 6. Feed the Synced Table into pgvector
# MAGIC
# MAGIC - The Synced Table provides a managed Lakebase source for low-latency reads.
# MAGIC - This notebook reads the Synced Table, generates embeddings with `ai_query`,
# MAGIC   and upserts them into the writable `arxiv_chunk_embeddings` table.
# MAGIC - `arxiv_chunk_embeddings` contains the `VECTOR(1024)` column and HNSW/GIN
# MAGIC   indexes used for retrieval.
# MAGIC - Do not add vectors or indexes to the read-only Synced Table.
# MAGIC
# MAGIC The two tables can therefore coexist: Synced Tables handle replication,
# MAGIC while pgvector handles similarity search. There is only one embedding path:
# MAGIC Synced Table → `ai_query` → `arxiv_chunk_embeddings`.

# COMMAND ----------

if RUN_INDEX_SYNCED_ROWS:
    indexed_count = pgvector.index_synced_chunks(
        synced_table=f'"{cfg.schema}"."arxiv_chunks_synced"',
        refresh=False,
    )
    logger.info(f"New Synced Table rows indexed: {indexed_count}")
else:
    logger.info(
        "Embedding load skipped. Set RUN_INDEX_SYNCED_ROWS=True after the "
        "Synced Table reaches ONLINE."
    )

# COMMAND ----------

# MAGIC %md
# MAGIC ## Summary
# MAGIC
# MAGIC 1. Keep `arxiv_chunks_table` as the source of truth.
# MAGIC 2. Use a Synced Table as the managed Lakebase source for embedding loads.
# MAGIC 3. Generate embeddings and write them to `arxiv_chunk_embeddings`.
# MAGIC 4. Refresh the Synced Table from the source; never write directly to it.
