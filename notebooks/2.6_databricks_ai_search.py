# Databricks notebook source
# MAGIC %md
# MAGIC # Lecture 2.6: Databricks AI Search
# MAGIC
# MAGIC Databricks AI Search, formerly Databricks Vector Search, is Databricks'
# MAGIC managed vector retrieval service. This notebook demonstrates the alternative
# MAGIC architecture separately from the Lakebase pgvector path used in Lectures
# MAGIC 2.4, 2.5, and the later application lectures.
# MAGIC
# MAGIC ```text
# MAGIC arxiv_chunks_table (Unity Catalog Delta)
# MAGIC          │
# MAGIC          ▼
# MAGIC Databricks AI Search endpoint + Delta Sync index
# MAGIC          │
# MAGIC          ▼
# MAGIC similarity_search(query_text=...)
# MAGIC ```
# MAGIC
# MAGIC AI Search owns the index and synchronization. We do not create or query the
# MAGIC `arxiv_chunk_embeddings` PostgreSQL table in this notebook.

# COMMAND ----------

from loguru import logger
from pyspark.sql import SparkSession

from arxiv_curator.config import get_env, load_config

# COMMAND ----------

spark = SparkSession.builder.getOrCreate()
env = get_env(spark)
cfg = load_config("../project_config.yml", env)

source_table = f"{cfg.catalog}.{cfg.schema}.arxiv_chunks_table"
ai_search_endpoint = f"{env}-arxiv-ai-search"
ai_search_index = f"{cfg.catalog}.{cfg.schema}.arxiv_chunks_ai_search"

# Provisioning is intentionally opt-in. AI Search creates billable managed
# resources and is included only as a comparison for this lecture.
RUN_CREATE_ENDPOINT = False
RUN_CREATE_INDEX = False
RUN_QUERY = False

logger.info(f"Environment: {env}")
logger.info(f"Source table: {source_table}")
logger.info(f"AI Search endpoint: {ai_search_endpoint}")
logger.info(f"AI Search index: {ai_search_index}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 1. Prepare the Delta source
# MAGIC
# MAGIC A Delta Sync index reads from a Unity Catalog table. The source needs a
# MAGIC stable primary key. Change Data Feed is required for standard incremental
# MAGIC synchronization. The `id` column is created by our chunking pipeline.

# COMMAND ----------

source_columns = {field.name for field in spark.table(source_table).schema.fields}
if "id" not in source_columns:
    raise ValueError(f"{source_table} must contain an 'id' primary-key column.")

spark.sql(
    f"ALTER TABLE {source_table} "
    "SET TBLPROPERTIES (delta.enableChangeDataFeed = true)"
)
logger.info(f"Validated AI Search source: {source_table}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. Create or reuse an AI Search endpoint
# MAGIC
# MAGIC The Python client still exposes the historical `VectorSearchClient` name;
# MAGIC the managed product is now called Databricks AI Search. This is an API naming
# MAGIC compatibility detail, not a different retrieval architecture.

# COMMAND ----------

from databricks.vector_search.client import VectorSearchClient

ai_search = VectorSearchClient()

if RUN_CREATE_ENDPOINT:
    try:
        ai_search.get_endpoint(name=ai_search_endpoint)
        logger.info(f"AI Search endpoint already exists: {ai_search_endpoint}")
    except Exception:
        ai_search.create_endpoint(
            name=ai_search_endpoint,
            endpoint_type="STANDARD",
        )
        logger.info(f"Created AI Search endpoint: {ai_search_endpoint}")
else:
    logger.info(
        "Endpoint creation skipped. Set RUN_CREATE_ENDPOINT=True only when "
        "you want to provision AI Search resources."
    )

# COMMAND ----------

# MAGIC %md
# MAGIC ## 3. Create a Delta Sync index
# MAGIC
# MAGIC This example uses Databricks-managed embeddings. AI Search reads the `text`
# MAGIC column, generates embeddings, and keeps the index synchronized with the
# MAGIC Delta source. This is different from Lecture 2.5, where we explicitly read
# MAGIC a Lakebase Synced Table and write vectors into PostgreSQL ourselves.

# COMMAND ----------

if RUN_CREATE_INDEX:
    try:
        index = ai_search.get_index(index_name=ai_search_index)
        logger.info(f"AI Search index already exists: {ai_search_index}")
    except Exception:
        index = ai_search.create_delta_sync_index(
            endpoint_name=ai_search_endpoint,
            source_table_name=source_table,
            index_name=ai_search_index,
            pipeline_type="TRIGGERED",
            primary_key="id",
            embedding_source_column="text",
            embedding_model_endpoint_name="databricks-gte-large-en",
        )
        logger.info(f"Created AI Search index: {ai_search_index}")
else:
    logger.info(
        "Index creation skipped. Set RUN_CREATE_INDEX=True after the endpoint "
        "is ready."
    )

# COMMAND ----------

# MAGIC %md
# MAGIC ## 4. Query the AI Search index
# MAGIC
# MAGIC After the index is online and synchronized, AI Search can perform semantic
# MAGIC or hybrid retrieval. The result contains source-table columns, so the
# MAGIC application can pass the retrieved chunks to an LLM.

# COMMAND ----------

if RUN_QUERY:
    index = ai_search.get_index(index_name=ai_search_index)
    results = index.similarity_search(
        query_text="transformer attention mechanisms",
        columns=["id", "arxiv_id", "title", "text"],
        num_results=5,
    )
    logger.info(results)
else:
    logger.info("Query skipped. Set RUN_QUERY=True after the index is online.")

# COMMAND ----------

# MAGIC %md
# MAGIC ## AI Search versus our pgvector path
# MAGIC
# MAGIC | Concern | Databricks AI Search | Lakebase pgvector |
# MAGIC |---|---|---|
# MAGIC | Index owner | Databricks managed service | Our PostgreSQL table and indexes |
# MAGIC | Source sync | Delta Sync index | Lakebase Synced Table in Lecture 2.5 |
# MAGIC | Embeddings | Managed by AI Search in this example | Generated with `ai_query` |
# MAGIC | Query API | `similarity_search` / AI Search APIs | PostgreSQL SQL through `psycopg` |
# MAGIC | Custom SQL and joins | Limited to index query capabilities | Native PostgreSQL |
# MAGIC | Course default | Comparison only | Used by the remaining lectures |
# MAGIC
# MAGIC Both are valid RAG retrieval architectures. The course continues with
# MAGIC Lakebase and pgvector because it teaches the storage, indexing, SQL, and
# MAGIC synchronization mechanics directly.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Cleanup reminder
# MAGIC
# MAGIC AI Search endpoints and indexes are managed resources. Delete them from the
# MAGIC Databricks UI or with the AI Search client when the comparison is complete.
# MAGIC Do not delete `arxiv_chunk_embeddings`; that table belongs to the pgvector
# MAGIC path used by the rest of the course.
