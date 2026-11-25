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
from mlflow.entities.trace_location import UnityCatalog
from pyspark.sql import SparkSession

from arxiv_curator.config import ProjectConfig, get_env, get_widget
from arxiv_curator.evaluation import (
    hook_in_post_guideline,
    polite_tone_guideline,
    word_count_check,
)

spark = SparkSession.builder.getOrCreate()
env = get_env(spark)
max_traces = int(get_widget(spark, "max_traces", "1000"))
if max_traces < 1:
    raise ValueError("max_traces must be positive")
cfg = ProjectConfig.from_yaml("../project_config.yml", env=env)
os.environ["MLFLOW_TRACING_SQL_WAREHOUSE_ID"] = cfg.warehouse_id
mlflow.set_tracking_uri("databricks")
experiment = mlflow.get_experiment_by_name(cfg.experiment_name)
if experiment is None:
    raise ValueError(f"Experiment does not exist: {cfg.experiment_name}")
location = experiment.trace_location
if not isinstance(location, UnityCatalog) or (
    location.catalog_name,
    location.schema_name,
    location.table_prefix,
) != (cfg.catalog, cfg.schema, "llmops"):
    raise ValueError(f"Experiment {cfg.experiment_name} is not bound to the expected UC tables")
mlflow.set_experiment(experiment_id=experiment.experiment_id)

# COMMAND ----------
# MAGIC %md
# MAGIC ## Evaluate existing traces
# MAGIC
# MAGIC Query the UC spans and annotations for successful App traces missing each
# MAGIC scorer. MLflow retrieves each full trace by ID and logs feedback on the
# MAGIC original trace. Successful scores are skipped on later runs;
# MAGIC missing or failed scores can be retried. The limit applies per scorer and
# MAGIC prevents a scheduled job from processing an unbounded backlog in one run.
# MAGIC Selection is scoped by UC location and App deployment tag. If multiple
# MAGIC experiments share both, their traces cannot be distinguished by this query.

# COMMAND ----------

scorers = [word_count_check, polite_tone_guideline, hook_in_post_guideline]
spans = f"`{cfg.catalog}`.`{cfg.schema}`.`llmops_otel_spans`"
annotations = f"`{cfg.catalog}`.`{cfg.schema}`.`llmops_otel_annotations`"
for scorer in scorers:
    candidates = spark.sql(
        f"""
        SELECT root.trace_id
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
        LIMIT {max_traces}
        """,
        args={"app_name": cfg.agent_app_name, "scorer_name": scorer.name},
    ).collect()
    if not candidates:
        logger.info(f"No App traces awaiting {scorer.name}")
        continue
    # MLflow qualifies each UC trace ID using the active experiment's trace location.
    traces = [mlflow.get_trace(row.trace_id) for row in candidates]
    if any(trace is None for trace in traces):
        raise RuntimeError(f"Could not load all traces selected for {scorer.name}")
    logger.info(f"Evaluating {len(traces)} existing App traces with {scorer.name}")
    result = mlflow.genai.evaluate(data=traces, scorers=[scorer])
    logger.info(f"Evaluation complete for {scorer.name}: {result.metrics}")
