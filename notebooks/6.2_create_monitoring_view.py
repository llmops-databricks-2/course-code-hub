# Databricks notebook source
# MAGIC %md
# MAGIC # Lecture 6: Create the live monitoring view
# MAGIC
# MAGIC Run this notebook after provisioning the UC trace tables. The view reads
# MAGIC current spans and feedback; creating it does not evaluate traces.

# COMMAND ----------

from loguru import logger
from pyspark.sql import SparkSession

from arxiv_curator.config import ProjectConfig, get_env

spark = SparkSession.builder.getOrCreate()
cfg = ProjectConfig.from_yaml("../project_config.yml", env=get_env(spark))
spans = f"`{cfg.catalog}`.`{cfg.schema}`.`llmops_otel_spans`"
annotations = f"`{cfg.catalog}`.`{cfg.schema}`.`llmops_otel_annotations`"

# COMMAND ----------
# MAGIC %md
# MAGIC ## Live monitoring view
# MAGIC
# MAGIC The view has one row per App trace. It reads the latest non-deleted feedback
# MAGIC for each scorer and joins it to aggregated spans. `NULL` means no successful
# MAGIC assessment; scores are 1 for true/yes/Pass and 0 for false/no/Fail. The view uses
# MAGIC a new name so existing monitoring tables are not replaced or deleted.
# MAGIC LLM call counts are NULL when no `call_llm` spans are recorded; the current
# MAGIC agent does not instrument those calls individually.

# COMMAND ----------

catalog = cfg.catalog
schema = cfg.schema
view_name = f"`{catalog}`.`{schema}`.`arxiv_agent_monitoring_live`"
app_name = cfg.agent_app_name

spark.sql(
    f"""
    CREATE OR REPLACE VIEW {view_name} AS
    WITH app_traces AS (
        SELECT DISTINCT target_id AS trace_id
        FROM {annotations}
        WHERE target_type = 'TRACE' AND annotation_type = 'TAG'
          AND name = 'deployment_name'
          AND try_cast(value AS STRING) = '{app_name}'
          AND deleted_at IS NULL
    ),
    span_metrics AS (
        SELECT s.trace_id, MIN(s.time) AS request_time,
            (MAX(s.end_time_unix_nano) - MIN(s.start_time_unix_nano)) / 1000000000.0
                AS latency_seconds,
            COUNT(*) AS span_count,
            NULLIF(SUM(CASE WHEN s.name = 'call_llm' THEN 1 ELSE 0 END), 0) AS llm_call_count,
            SUM(CASE WHEN s.name = 'execute_tool' THEN 1 ELSE 0 END) AS tool_call_count,
            MAX(CASE WHEN s.status.code IN ('ERROR', 'STATUS_CODE_ERROR') THEN 1 ELSE 0 END) AS has_error,
            FIRST(s.service_name, true) AS service_name
        FROM {spans} s INNER JOIN app_traces a ON s.trace_id = a.trace_id
        GROUP BY s.trace_id
    ),
    ranked_feedback AS (
        SELECT target_id AS trace_id, name, try_cast(value AS STRING) AS score,
            ROW_NUMBER() OVER (
                PARTITION BY target_id, name
                ORDER BY updated_at DESC NULLS LAST, created_at DESC, annotation_id DESC
            ) AS rn
        FROM {annotations}
        WHERE target_type = 'TRACE' AND annotation_type = 'FEEDBACK'
          AND name IN ('word_count_check', 'polite_tone', 'hook_in_post')
          AND deleted_at IS NULL
          AND coalesce(try_cast(metadata:['mlflow.valid'] AS BOOLEAN), true)
    ),
    scores AS (
        SELECT trace_id,
            MAX(CASE WHEN name = 'word_count_check' THEN
                CASE lower(score) WHEN 'true' THEN 1 WHEN 'pass' THEN 1 WHEN 'yes' THEN 1
                    WHEN 'false' THEN 0 WHEN 'fail' THEN 0 WHEN 'no' THEN 0 END END) AS word_count_check,
            MAX(CASE WHEN name = 'polite_tone' THEN
                CASE lower(score) WHEN 'true' THEN 1 WHEN 'pass' THEN 1 WHEN 'yes' THEN 1
                    WHEN 'false' THEN 0 WHEN 'fail' THEN 0 WHEN 'no' THEN 0 END END) AS polite_tone,
            MAX(CASE WHEN name = 'hook_in_post' THEN
                CASE lower(score) WHEN 'true' THEN 1 WHEN 'pass' THEN 1 WHEN 'yes' THEN 1
                    WHEN 'false' THEN 0 WHEN 'fail' THEN 0 WHEN 'no' THEN 0 END END) AS hook_in_post
        FROM ranked_feedback WHERE rn = 1 GROUP BY trace_id
    )
    SELECT s.*, f.word_count_check, f.polite_tone, f.hook_in_post
    FROM span_metrics s LEFT JOIN scores f ON s.trace_id = f.trace_id
    """
)
logger.info(f"Created live monitoring view: {view_name}")
display(spark.sql(f"SELECT * FROM {view_name} ORDER BY request_time DESC LIMIT 20"))
