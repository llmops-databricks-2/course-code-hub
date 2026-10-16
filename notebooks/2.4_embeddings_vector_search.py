# Databricks notebook source
# MAGIC %md
# MAGIC # Lecture 2.4: Embeddings and pgvector on Lakebase
# MAGIC
# MAGIC This notebook uses a PostgreSQL retrieval layer running in Lakebase.
# MAGIC Chunk text remains in the Delta table; embeddings, metadata, and PostgreSQL
# MAGIC full-text search state are stored in Lakebase.
# MAGIC
# MAGIC ```text
# MAGIC arxiv_chunks_table (Delta)
# MAGIC       │  ai_query(..., ARRAY<FLOAT>)
# MAGIC       ▼
# MAGIC Lakebase Postgres + pgvector
# MAGIC       ├── HNSW cosine index
# MAGIC       ├── metadata filters
# MAGIC       └── PostgreSQL full-text ranking

# MAGIC ```
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

logger.info(f"Environment: {env}")
logger.info(f"Source table: {cfg.catalog}.{cfg.schema}.arxiv_chunks_table")
logger.info(f"Lakebase project: {cfg.lakebase_project_id}")
logger.info(f"Embedding endpoint: {cfg.embedding_endpoint}")
logger.info(
    f"Batch embedding model: {getattr(cfg, 'batch_embedding_model', 'databricks-gte-large-en')}"
)

# COMMAND ----------

# Create the Lakebase project once, or reuse it on subsequent runs.
w = WorkspaceClient()
lakebase_project_name = f"projects/{cfg.lakebase_project_id}"

try:
    existing = w.postgres.get_project(name=lakebase_project_name)
    logger.info(f"Lakebase project already exists: {existing.name}")
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

# The manager obtains a short-lived Lakebase database credential through the
# Databricks SDK. It does not store a password in the notebook.
pgvector = LakebasePgVectorManager(config=cfg, spark=spark)
pgvector.ensure_schema()

logger.info(f"Lakebase table: {pgvector.table_name}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 1. Create the pgvector schema
# MAGIC
# MAGIC `ensure_schema()` enables the `vector` extension, creates the embedding
# MAGIC table, and creates:
# MAGIC
# MAGIC - an HNSW index using cosine distance (`<=>`)
# MAGIC - a GIN index over PostgreSQL `tsvector` data for keyword search

# COMMAND ----------

# MAGIC %sql
# MAGIC -- The Python manager ran the equivalent DDL on Lakebase.
# MAGIC -- Run this only if you want to inspect the resulting table from a SQL editor:
# MAGIC -- SELECT * FROM arxiv_chunk_embeddings LIMIT 1;

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. Generate and load embeddings
# MAGIC
# MAGIC Embeddings are generated in batch by Databricks ai_query and inserted into
# MAGIC Lakebase with an idempotent upsert. By default, only chunk IDs not already in
# MAGIC Lakebase are embedded. Set refresh=True when changing embedding models.

# COMMAND ----------

indexed_count = pgvector.index_delta_chunks(refresh=False)
logger.info(f"New or updated chunks indexed: {indexed_count}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 3. Semantic search
# MAGIC
# MAGIC The query is embedded with the same endpoint as the documents. PostgreSQL
# MAGIC ranks rows by cosine distance and returns the highest-scoring chunks.

# COMMAND ----------

query = "What are the latest techniques in machine learning?"
results = pgvector.search(query=query, num_results=5)

logger.info(f"Query: {query}")
for position, row in enumerate(results, 1):
    logger.info(
        f"{position}. {row.get('title', 'N/A')} | "
        f"arXiv: {row.get('arxiv_id', 'N/A')} | "
        f"score={float(row['score']):.4f}"
    )
    logger.info(f"   {row.get('text', '')[:250]}...")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 4. Semantic search with metadata filtering

# COMMAND ----------

query = "neural networks and deep learning"
year = 2026
filtered_results = pgvector.search(query=query, num_results=3, year=year)

logger.info(f"Query: {query} | year={year}")
for position, row in enumerate(filtered_results, 1):
    logger.info(
        f"{position}. {row.get('title', 'N/A')} | "
        f"year={row.get('year', 'N/A')} | score={float(row['score']):.4f}"
    )

# COMMAND ----------

# MAGIC %md
# MAGIC ## 5. Hybrid search: vector similarity + full-text ranking
# MAGIC
# MAGIC Hybrid search combines semantic similarity with PostgreSQL's
# MAGIC `ts_rank_cd()` full-text score. This helps with exact terms, acronyms, and
# MAGIC model names that semantic search alone can underweight.

# COMMAND ----------

query = "transformer architecture attention mechanism"
hybrid_results = pgvector.hybrid_search(query=query, num_results=5)

logger.info(f"Hybrid query: {query}")
for position, row in enumerate(hybrid_results, 1):
    logger.info(
        f"{position}. {row.get('title', 'N/A')} | "
        f"score={float(row['score']):.4f} | "
        f"vector={float(row['vector_score']):.4f} | "
        f"text={float(row['text_score']):.4f}"
    )

# COMMAND ----------

# MAGIC %md
# MAGIC ## 6. Inspect the Lakebase index

# COMMAND ----------

with pgvector.connection() as conn:
    table_count = conn.execute(f"SELECT count(*) FROM {pgvector.table_name}").fetchone()[0]
    indexes = conn.execute(
        """
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = %s
        ORDER BY indexname
        """,
        (pgvector.table_name,),
    ).fetchall()

logger.info(f"Indexed rows: {table_count}")
for index_name, definition in indexes:
    logger.info(f"{index_name}: {definition}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Summary
# MAGIC
# MAGIC We now have a Lakebase-native retrieval layer:
# MAGIC
# MAGIC 1. Read chunks from the Delta arxiv_chunks_table.
# MAGIC 2. Generate 1024-dimensional embeddings with Databricks ai_query.
# MAGIC 3. Upsert chunks and vectors into Lakebase Postgres.
# MAGIC 4. Use an HNSW cosine index for semantic retrieval.
# MAGIC 5. Combine vector, metadata, and full-text ranking in SQL.
# MAGIC
# MAGIC For a new embedding model, rerun
# MAGIC `index_delta_chunks(refresh=True)` and ensure its dimension matches the
# MAGIC `VECTOR(1024)` column definition.
