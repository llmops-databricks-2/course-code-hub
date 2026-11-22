# Databricks notebook source
# MAGIC %md
# MAGIC # Lecture 6. Generate traces and build monitoring tables
# MAGIC
# MAGIC This notebook sends representative requests to the deployed App, reads the
# MAGIC current Unity Catalog OTEL trace tables, and creates a dashboard-ready
# MAGIC monitoring table. In the current schema, `llmops_otel_spans` is the source
# MAGIC for trace-level operational metrics and `llmops_otel_annotations` contains
# MAGIC trace or span assessments.

# COMMAND ----------

import logging
import os
import time
from datetime import datetime, timezone

import mlflow
import pandas as pd
import requests
from databricks.sdk import WorkspaceClient
from loguru import logger
from openai import OpenAI
from pyspark.sql import functions as F
from pyspark.sql import SparkSession

from arxiv_curator.config import ProjectConfig
from arxiv_curator.evaluation import (
    hook_in_post_guideline,
    polite_tone_guideline,
    word_count_check,
)

dbutils.widgets.dropdown("env", "dev", ["dev", "acc", "prd"])
env = dbutils.widgets.get("env")
spark = SparkSession.builder.getOrCreate()
cfg = ProjectConfig.from_yaml("../project_config.yml", env=env)

catalog = cfg.catalog
schema = cfg.schema
spans_table = f"{catalog}.{schema}.llmops_otel_spans"
annotations_table = f"{catalog}.{schema}.llmops_otel_annotations"
monitoring_table = f"{catalog}.{schema}.arxiv_agent_monitoring"
evaluation_table = f"{catalog}.{schema}.arxiv_agent_evaluations"

logger.info(f"Environment: {env}; source: {spans_table}")

# COMMAND ----------
# MAGIC %md
# MAGIC ## 1. Generate fresh production-style traces
# MAGIC
# MAGIC The request is sent to the deployed App rather than calling the agent
# MAGIC directly. This exercises the same path used by an end user and creates
# MAGIC traces with the App's runtime identity and deployment metadata.

# COMMAND ----------

workspace = WorkspaceClient()
app = workspace.apps.get(name=cfg.agent_app_name)
if not app.url:
    raise RuntimeError(f"App {cfg.agent_app_name} has no URL")

notebook_token = workspace.config.authenticate()["Authorization"].removeprefix("Bearer ")
token_response = requests.post(
    f"{workspace.config.host}/oidc/v1/token",
    data={
        "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
        "subject_token": notebook_token,
        "subject_token_type": "urn:databricks:params:oauth:token-type:personal-access-token",
        "requested_token_type": "urn:ietf:params:oauth:token-type:access_token",
        "scope": "all-apis",
        "audience": app.oauth2_app_client_id,
    },
    timeout=30,
)
token_response.raise_for_status()
oauth_token = token_response.json()["access_token"]
client = OpenAI(api_key=oauth_token, base_url=app.url.rstrip("/"))

queries = [
    "What are recent research themes in retrieval augmented generation?",
    "Summarize recent work on transformer attention mechanisms.",
    "What challenges do papers report for multi-agent systems?",
]
evaluation_rows = []

for query in queries:
    response = client.responses.create(
        model=f"apps/{cfg.agent_app_name}",
        input=[{"role": "user", "content": query}],
    )
    logger.info(f"Generated trace for: {query}; response id: {response.id}")
    evaluation_rows.append(
        {
            "request_id": response.id,
            "query": query,
            "response": response.output_text or "",
            "evaluated_at": datetime.now(timezone.utc),
        }
    )
    time.sleep(2)

# Evaluate traces that already exist in the configured MLflow experiment. This
# path is independent of new trace creation and is useful when App trace export
# is temporarily unavailable.
os.environ["MLFLOW_TRACING_SQL_WAREHOUSE_ID"] = cfg.warehouse_id
mlflow.set_experiment(cfg.experiment_name)
existing_traces = mlflow.search_traces(
    max_results=100,
    order_by=["timestamp_ms DESC"],
)
logger.info(f"Existing traces available for evaluation: {len(existing_traces)}")

# Diagnostic: MLflow may list trace IDs while failing to download their full
# payloads from artifact storage. Enable DEBUG for one trace to expose the
# underlying authentication or network error.
logging.getLogger("mlflow.tracing.client").setLevel(logging.DEBUG)
if len(existing_traces) > 0 and "trace_id" in existing_traces:
    diagnostic_trace_id = existing_traces.iloc[0]["trace_id"]
    try:
        diagnostic_trace = mlflow.get_trace(diagnostic_trace_id)
        logger.info(f"Downloaded trace successfully: {diagnostic_trace_id}")
    except Exception:
        logger.exception(f"Trace download failed: {diagnostic_trace_id}")

request_column = next(
    (column for column in ["request_preview", "request"] if column in existing_traces),
    None,
)
response_column = next(
    (column for column in ["response_preview", "response"] if column in existing_traces),
    None,
)
if request_column and response_column and len(existing_traces) > 0:
    stored_evaluation_pdf = pd.DataFrame(
        {
            "inputs": existing_traces[request_column].map(
                lambda value: {"question": str(value)}
            ),
            "outputs": existing_traces[response_column].map(str),
        }
    )
    stored_result = mlflow.genai.evaluate(
        data=stored_evaluation_pdf,
        scorers=[word_count_check, polite_tone_guideline, hook_in_post_guideline],
    )
    result_pdf = stored_result.result_df.reset_index(drop=True)
    trace_ids = existing_traces["trace_id"].reset_index(drop=True)

    def assessment_value(assessments, scorer_name):
        if not isinstance(assessments, list):
            return None
        for assessment in assessments:
            if assessment.get("assessment_name") == scorer_name:
                return assessment.get("feedback", {}).get("value")
        return None

    per_trace_rows = []
    for index, row in result_pdf.iterrows():
        assessments = row.get("assessments", [])
        values = {
            scorer_name: assessment_value(assessments, scorer_name)
            for scorer_name in ["word_count_check", "polite_tone", "hook_in_post"]
        }
        per_trace_rows.append(
            {
                "trace_id": trace_ids.iloc[index],
                "evaluated_at": datetime.now(timezone.utc),
                "source": "existing_mlflow_traces",
                **values,
            }
        )

    spark.createDataFrame(pd.DataFrame(per_trace_rows)).write.mode("append").option(
        "mergeSchema", "true"
    ).saveAsTable(evaluation_table)
    logger.info(
        f"Stored-trace evaluation results written to {evaluation_table}: "
        f"{len(per_trace_rows)} rows"
    )
else:
    logger.warning(
        "Existing traces do not expose request/response columns; "
        "stored-trace evaluation was skipped."
    )

# COMMAND ----------
# MAGIC %md
# MAGIC ## 2. Inspect the current OTEL source tables
# MAGIC
# MAGIC MLflow traces are stored in the current Unity Catalog OTEL tables. The spans
# MAGIC table contains one row per span, so we aggregate by `trace_id`. Annotations
# MAGIC are keyed by `target_id` and are joined after the operational aggregation.

# COMMAND ----------

otel_tables = [
    "llmops_otel_annotations",
    "llmops_otel_logs",
    "llmops_otel_metrics",
    "llmops_otel_spans",
    "llmops_otel_metadata",
    "llmops_otel_unified",
]
for table_name in otel_tables:
    full_name = f"{catalog}.{schema}.{table_name}"
    try:
        count = spark.table(full_name).limit(1).count()
        logger.info(f"{full_name}: available; has rows: {bool(count)}")
    except Exception as exc:
        logger.warning(f"{full_name}: not available ({exc})")

spans = spark.table(spans_table)
annotations = spark.table(annotations_table)
logger.info(f"Span columns: {spans.columns}")
logger.info(f"Annotation columns: {annotations.columns}")

# COMMAND ----------
# MAGIC %md
# MAGIC ## 3. Create a dashboard-ready monitoring table
# MAGIC
# MAGIC The table keeps one row per trace and exposes stable operational fields for
# MAGIC SQL dashboards: trace identity, first span time, latency, span counts,
# MAGIC status, and annotation counts. Span attributes are stored as `VARIANT`; the
# MAGIC first version keeps them available for drill-down rather than guessing a
# MAGIC provider-specific token attribute path.

# COMMAND ----------

span_metrics = spans.groupBy("trace_id").agg(
    F.min("time").alias("request_time"),
    (
        (F.max("end_time_unix_nano") - F.min("start_time_unix_nano")) / F.lit(1_000_000_000)
    ).alias("latency_seconds"),
    F.count("span_id").alias("span_count"),
    F.sum(F.when(F.col("name") == "call_llm", 1).otherwise(0)).alias("llm_call_count"),
    F.sum(F.when(F.col("name") == "execute_tool", 1).otherwise(0)).alias("tool_call_count"),
    F.max(F.when(F.col("status.code") == "ERROR", 1).otherwise(0)).alias("has_error"),
    F.first("service_name", ignorenulls=True).alias("service_name"),
)

annotation_metrics = annotations.filter(F.col("target_type") == "TRACE").groupBy("target_id").agg(
    F.count("annotation_id").alias("annotation_count"),
    F.collect_set("name").alias("annotation_names"),
)

monitoring = (
    span_metrics.join(annotation_metrics, span_metrics.trace_id == annotation_metrics.target_id, "left")
    .drop("target_id")
    .withColumn("monitoring_loaded_at", F.current_timestamp())
)

monitoring.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(monitoring_table)
logger.info(f"Monitoring table created: {monitoring_table}")

# COMMAND ----------
# MAGIC %md
# MAGIC ## 4. Query the monitoring table
# MAGIC
# MAGIC This final query is the starting point for the Lakeview dashboard. It can
# MAGIC be replaced with richer joins to spans, metrics, annotations, and metadata
# MAGIC once the exact OTEL columns for the workspace are confirmed.

# COMMAND ----------

display(
    spark.sql(
        f"""
        SELECT *
        FROM {monitoring_table}
        ORDER BY request_time DESC
        LIMIT 20
        """
    )
)
