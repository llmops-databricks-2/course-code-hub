# Databricks notebook source
# MAGIC %md
# MAGIC # Lecture 6: Evaluate production traces in Unity Catalog
# MAGIC
# MAGIC Evaluate existing App traces in the configured experiment. MLflow writes
# MAGIC scorer feedback to the original traces. A SQL view reads the live OTEL
# MAGIC spans and annotations; it does not run evaluation or copy trace data.
# MAGIC Rerun this notebook (or schedule the job) to evaluate new traces. LLM judges
# MAGIC incur model usage. This notebook does not generate requests to the App.

# COMMAND ----------

import os

import mlflow
from loguru import logger
from pyspark.sql import SparkSession

from arxiv_curator.config import ProjectConfig, get_env, get_widget
from arxiv_curator.evaluation import (
    hook_in_post_guideline,
    polite_tone_guideline,
    word_count_check,
)

spark = SparkSession.builder.getOrCreate()
env = get_env(spark)
llm_sample_rate = float(get_widget(spark, "llm_sample_rate", "0.1"))
if not 0 <= llm_sample_rate <= 1:
    raise ValueError("llm_sample_rate must be between 0 and 1")
cfg = ProjectConfig.from_yaml("../project_config.yml", env=env)
os.environ["MLFLOW_TRACING_SQL_WAREHOUSE_ID"] = cfg.warehouse_id
mlflow.set_tracking_uri("databricks")
mlflow.set_experiment(cfg.experiment_name)

# COMMAND ----------
# MAGIC %md
# MAGIC ## Evaluate existing traces
# MAGIC
# MAGIC Select successful App traces missing valid
# MAGIC word-count feedback. A stable trace-ID hash chooses the LLM sample from
# MAGIC that same batch. Evaluate the sample first, then the word-count scorer on
# MAGIC the full batch; MLflow records feedback on the original traces.
# MAGIC Selection is scoped by UC
# MAGIC location and App deployment tag, not by experiment ID.

# COMMAND ----------

spans = f"`{cfg.catalog}`.`{cfg.schema}`.`llmops_otel_spans`"
annotations = f"`{cfg.catalog}`.`{cfg.schema}`.`llmops_otel_annotations`"
candidates = spark.sql(
    f"""
    SELECT root.trace_id,
           pmod(xxhash64(root.trace_id), 10000) < :sample_threshold AS llm_sample
    FROM {spans} root
    WHERE root.parent_span_id IS NULL
      AND root.status.code IN ('OK', 'STATUS_CODE_OK')
      AND EXISTS (
          SELECT 1 FROM {annotations} tag
          WHERE tag.target_type = 'TRACE' AND tag.target_id = root.trace_id
            AND tag.annotation_type = 'TAG' AND tag.name = 'deployment_name'
            AND try_cast(tag.value AS STRING) = :app_name AND tag.deleted_at IS NULL
      )
      AND NOT EXISTS (
          SELECT 1 FROM {annotations} feedback
          WHERE feedback.target_type = 'TRACE' AND feedback.target_id = root.trace_id
            AND feedback.annotation_type = 'FEEDBACK' AND feedback.name = :scorer_name
            AND feedback.deleted_at IS NULL AND feedback.value IS NOT NULL
            AND coalesce(try_cast(feedback.metadata:['mlflow.valid'] AS BOOLEAN), true)
      )
    ORDER BY root.time ASC, root.trace_id ASC
    """,
    args={
        "app_name": cfg.agent_app_name,
        "scorer_name": word_count_check.name,
        "sample_threshold": int(llm_sample_rate * 10000),
    },
).collect()
if candidates:
    # MLflow qualifies each UC trace ID using the active experiment's trace location.
    traces = [mlflow.get_trace(row.trace_id) for row in candidates]
    if any(trace is None for trace in traces):
        raise RuntimeError("Could not load all selected traces")
    sampled_traces = [trace for row, trace in zip(candidates, traces) if row.llm_sample]
    if sampled_traces:
        result = mlflow.genai.evaluate(
            data=sampled_traces, scorers=[polite_tone_guideline, hook_in_post_guideline]
        )
        logger.info(f"LLM evaluation complete: {result.metrics}")
    result = mlflow.genai.evaluate(data=traces, scorers=[word_count_check])
    logger.info(f"Word-count evaluation complete: {result.metrics}")
else:
    logger.info("No App traces awaiting word-count feedback")
