"""Lakebase pgvector search for arXiv chunks."""

from __future__ import annotations

import os
import urllib.parse
from collections.abc import Iterator
from typing import TYPE_CHECKING, Any

import psycopg
from databricks.sdk import WorkspaceClient
from loguru import logger
from arxiv_curator.config import ProjectConfig

if TYPE_CHECKING:
    from pyspark.sql import DataFrame, SparkSession


class LakebasePgVectorManager:
    """Store and search chunk embeddings in a Lakebase Postgres database."""

    table_name = "arxiv_chunk_embeddings"

    def __init__(
        self,
        config: ProjectConfig | None = None,
        spark: SparkSession | None = None,
        table_name: str | None = None,
        *,
        catalog: str | None = None,
        schema: str | None = None,
        lakebase_project_id: str | None = None,
        embedding_model: str | None = None,
        workspace: WorkspaceClient | None = None,
    ) -> None:
        self.config = config
        self.spark = spark
        self.catalog = config.catalog if config else catalog
        self.schema = config.schema if config else schema
        self.lakebase_project_id = (
            config.lakebase_project_id if config else lakebase_project_id
        )
        self.embedding_model = embedding_model or (
            config.embedding_endpoint if config else "databricks-gte-large-en"
        )
        self.batch_embedding_model = (
            getattr(config, "batch_embedding_model", "databricks-gte-large-en")
            if config
            else self.embedding_model
        )
        if not self.catalog or not self.schema or not self.lakebase_project_id:
            raise ValueError("catalog, schema, and lakebase_project_id are required")
        self.embedding_dimension = 1024
        self.table_name = table_name or self.table_name
        self._connection_string: str | None = None
        self.workspace = workspace

    def _get_connection_string(self) -> str:
        """Create a short-lived Lakebase connection string."""
        if self._connection_string:
            return self._connection_string

        workspace = self.workspace or WorkspaceClient()
        postgres_api = workspace.postgres
        endpoint_name = os.environ.get("LAKEBASE_ENDPOINT")
        if endpoint_name:
            host = os.environ.get("PGHOST")
            database = os.environ.get("PGDATABASE", "databricks_postgres")
        else:
            project_name = f"projects/{self.lakebase_project_id}"
            branch = next(iter(postgres_api.list_branches(parent=project_name)))
            endpoint = next(iter(postgres_api.list_endpoints(parent=branch.name)))
            endpoint_name = endpoint.name
            host = endpoint.status.hosts.host
            database = "databricks_postgres"
        credential = postgres_api.generate_database_credential(endpoint=endpoint_name)
        client_id = os.environ.get("DATABRICKS_CLIENT_ID")
        username = urllib.parse.quote_plus(
            client_id or workspace.current_user.me().user_name
        )

        self._connection_string = (
            f"postgresql://{username}:{credential.token}@{host}:5432/"
            f"{database}?sslmode=require"
        )
        return self._connection_string

    def connection(self) -> psycopg.Connection:
        """Open a Lakebase connection using a fresh workspace credential."""
        self._connection_string = None
        return psycopg.connect(self._get_connection_string())

    def ensure_schema(self) -> None:
        """Enable pgvector and create the embedding table and indexes."""
        with self.connection() as conn:
            conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
            conn.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {self.table_name} (
                    id TEXT PRIMARY KEY,
                    arxiv_id TEXT,
                    title TEXT,
                    summary TEXT,
                    authors TEXT,
                    year INTEGER,
                    month INTEGER,
                    day INTEGER,
                    text TEXT NOT NULL,
                    embedding VECTOR({self.embedding_dimension}) NOT NULL,
                    search_vector TSVECTOR GENERATED ALWAYS AS (
                        to_tsvector('english', coalesce(title, '') || ' ' || text)
                    ) STORED,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute(
                f"""
                CREATE INDEX IF NOT EXISTS {self.table_name}_embedding_hnsw
                ON {self.table_name}
                USING hnsw (embedding vector_cosine_ops)
                """
            )
            conn.execute(
                f"""
                CREATE INDEX IF NOT EXISTS {self.table_name}_search_gin
                ON {self.table_name} USING gin (search_vector)
                """
            )
        logger.info(f"Lakebase pgvector table ready: {self.table_name}")

    @staticmethod
    def _vector_literal(vector: list[float] | tuple[float, ...]) -> str:
        """Format a Python vector for PostgreSQL's vector input syntax."""
        return "[" + ",".join(str(float(value)) for value in vector) + "]"

    def _embed_dataframe(self, chunks: DataFrame) -> DataFrame:
        """Generate embeddings in Databricks using the configured endpoint."""
        if self.spark is None:
            raise ValueError("A SparkSession is required to embed a DataFrame")
        from pyspark.sql import functions as F

        # Some Databricks Runtime versions expose ai_query only as a SQL
        # function, not as pyspark.sql.functions.ai_query.
        endpoint = self.batch_embedding_model.replace("'", "''")
        return chunks.withColumn(
            "embedding",
            F.expr(f"CAST(ai_query('{endpoint}', text) AS ARRAY<FLOAT>)"),
        )

    @staticmethod
    def _rows_from_dataframe(chunks: DataFrame) -> Iterator[dict[str, Any]]:
        columns = [
            "id",
            "arxiv_id",
            "title",
            "summary",
            "authors",
            "year",
            "month",
            "day",
            "text",
            "embedding",
        ]
        for row in chunks.select(*columns).toLocalIterator():
            values = row.asDict(recursive=True)
            if values.get("id") and values.get("text") and values.get("embedding"):
                yield values

    def index_delta_chunks(self, refresh: bool = False) -> int:
        """Embed Delta chunks and upsert them into Lakebase."""
        if self.spark is None:
            raise ValueError("A SparkSession is required to index Delta chunks")
        self.ensure_schema()
        source_table = f"{self.catalog}.{self.schema}.arxiv_chunks_table"
        chunks = self.spark.table(source_table).select(
            "id", "arxiv_id", "title", "summary", "authors", "year", "month", "day", "text"
        )

        if not refresh:
            from pyspark.sql import functions as F

            with self.connection() as conn:
                existing_ids = {row[0] for row in conn.execute(f"SELECT id FROM {self.table_name}")}
            if existing_ids:
                chunks = chunks.where(~F.col("id").isin(existing_ids))

        embedded = self._embed_dataframe(chunks)
        insert_sql = f"""
            INSERT INTO {self.table_name}
                (id, arxiv_id, title, summary, authors, year, month, day, text, embedding)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::vector)
            ON CONFLICT (id) DO UPDATE SET
                arxiv_id = EXCLUDED.arxiv_id,
                title = EXCLUDED.title,
                summary = EXCLUDED.summary,
                authors = EXCLUDED.authors,
                year = EXCLUDED.year,
                month = EXCLUDED.month,
                day = EXCLUDED.day,
                text = EXCLUDED.text,
                embedding = EXCLUDED.embedding,
                updated_at = CURRENT_TIMESTAMP
        """
        count = 0
        with self.connection() as conn:
            with conn.cursor() as cursor:
                batch: list[tuple[Any, ...]] = []
                for row in self._rows_from_dataframe(embedded):
                    batch.append(
                        (
                            row["id"],
                            row.get("arxiv_id"),
                            row.get("title"),
                            row.get("summary"),
                            row.get("authors"),
                            row.get("year"),
                            row.get("month"),
                            row.get("day"),
                            row["text"],
                            self._vector_literal(row["embedding"]),
                        )
                    )
                    if len(batch) >= 100:
                        cursor.executemany(insert_sql, batch)
                        count += len(batch)
                        batch.clear()
                if batch:
                    cursor.executemany(insert_sql, batch)
                    count += len(batch)
        logger.info(f"Indexed {count} chunks in Lakebase")
        return count

    def index_synced_chunks(self, synced_table: str, refresh: bool = False) -> int:
        """Embed rows from a Lakebase Synced Table and upsert them into pgvector."""
        if self.spark is None:
            raise ValueError("A SparkSession is required to index Synced Table rows")
        self.ensure_schema()
        columns = "id, arxiv_id, title, summary, authors, year, month, day, text"
        with self.connection() as conn:
            rows = conn.execute(f"SELECT {columns} FROM {synced_table}").fetchall()
            existing_ids = set()
            if not refresh:
                existing_ids = {
                    row[0]
                    for row in conn.execute(f"SELECT id FROM {self.table_name}")
                }

        source_rows = [row for row in rows if refresh or row[0] not in existing_ids]
        if not source_rows:
            logger.info("No new Synced Table rows need embeddings")
            return 0

        chunks = self.spark.createDataFrame(
            source_rows, [column.strip() for column in columns.split(",")]
        )
        embedded = self._embed_dataframe(chunks)
        insert_sql = f"""
            INSERT INTO {self.table_name}
                (id, arxiv_id, title, summary, authors, year, month, day, text, embedding)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::vector)
            ON CONFLICT (id) DO UPDATE SET
                arxiv_id = EXCLUDED.arxiv_id, title = EXCLUDED.title,
                summary = EXCLUDED.summary, authors = EXCLUDED.authors,
                year = EXCLUDED.year, month = EXCLUDED.month, day = EXCLUDED.day,
                text = EXCLUDED.text, embedding = EXCLUDED.embedding,
                updated_at = CURRENT_TIMESTAMP
        """
        count = 0
        with self.connection() as conn:
            with conn.cursor() as cursor:
                batch: list[tuple[Any, ...]] = []
                for row in self._rows_from_dataframe(embedded):
                    batch.append(
                        (
                            row["id"], row.get("arxiv_id"), row.get("title"),
                            row.get("summary"), row.get("authors"), row.get("year"),
                            row.get("month"), row.get("day"), row["text"],
                            self._vector_literal(row["embedding"]),
                        )
                    )
                    if len(batch) >= 100:
                        cursor.executemany(insert_sql, batch)
                        count += len(batch)
                        batch.clear()
                if batch:
                    cursor.executemany(insert_sql, batch)
                    count += len(batch)
        logger.info(f"Indexed {count} Synced Table rows in Lakebase")
        return count

    def embed_query(self, query: str) -> list[float]:
        """Generate a query embedding with the same model used for documents."""
        if self.spark is not None:
            query_df = self.spark.createDataFrame([(query,)], ["text"])
            row = self._embed_dataframe(query_df).select("embedding").first()
            if not row or not row.embedding:
                raise ValueError("The embedding endpoint returned no vector")
            return list(row.embedding)

        workspace = self.workspace or WorkspaceClient()
        client = workspace.serving_endpoints.get_open_ai_client()
        response = client.embeddings.create(model=self.embedding_model, input=query)
        return list(response.data[0].embedding)

    def search(
        self,
        query: str,
        num_results: int = 5,
        year: int | None = None,
    ) -> list[dict[str, Any]]:
        """Run cosine-similarity search with an optional year filter."""
        query_vector = self._vector_literal(self.embed_query(query))
        where = ""
        params: list[Any] = [query_vector]
        if year is not None:
            where = "WHERE year = %s"
            params.append(year)
        params.extend([query_vector, num_results])
        sql = f"""
            SELECT id, arxiv_id, title, summary, authors, year, month, day, text,
                   1 - (embedding <=> %s::vector) AS score
            FROM {self.table_name}
            {where}
            ORDER BY embedding <=> %s::vector
            LIMIT %s
        """
        with self.connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(sql, params)
                rows = cursor.fetchall()
                columns = [description.name for description in cursor.description]
        return [dict(zip(columns, row)) for row in rows]

    def hybrid_search(
        self,
        query: str,
        num_results: int = 5,
        year: int | None = None,
        vector_weight: float = 0.7,
    ) -> list[dict[str, Any]]:
        """Combine cosine similarity and PostgreSQL full-text ranking."""
        query_vector = self._vector_literal(self.embed_query(query))
        text_weight = 1.0 - vector_weight
        where = ""
        params: list[Any] = [query_vector, query]
        if year is not None:
            where = "WHERE year = %s"
            params.append(year)
        params.extend([vector_weight, text_weight, num_results])
        sql = f"""
            WITH ranked AS (
                SELECT id, arxiv_id, title, summary, authors, year, month, day, text,
                       1 - (embedding <=> %s::vector) AS vector_score,
                       ts_rank_cd(search_vector, plainto_tsquery('english', %s)) AS text_score
                FROM {self.table_name}
                {where}
            )
            SELECT *, (%s * vector_score + %s * text_score) AS score
            FROM ranked
            ORDER BY score DESC
            LIMIT %s
        """
        with self.connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(sql, params)
                rows = cursor.fetchall()
                columns = [description.name for description in cursor.description]
        return [dict(zip(columns, row)) for row in rows]


PgVectorManager = LakebasePgVectorManager
