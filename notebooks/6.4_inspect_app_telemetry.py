# Databricks notebook source
# MAGIC %md
# MAGIC # Inspect App telemetry and agent feedback
# MAGIC
# MAGIC Explore the configured App's UC logs, HTTP metrics and MLflow feedback.
# MAGIC These are read-only queries. Logs can contain sensitive information;
# MAGIC review access before sharing output.

# COMMAND ----------

from pyspark.sql import SparkSession

from arxiv_curator.config import ProjectConfig, get_env

spark = SparkSession.builder.getOrCreate()
cfg = ProjectConfig.from_yaml("../project_config.yml", env=get_env(spark))
logs = f"`{cfg.catalog}`.`{cfg.schema}`.`app_otel_logs`"
metrics = f"`{cfg.catalog}`.`{cfg.schema}`.`app_otel_metrics`"
annotations = f"`{cfg.catalog}`.`{cfg.schema}`.`llmops_otel_annotations`"
params = {"app_name": cfg.agent_app_name}

# COMMAND ----------
# MAGIC %md
# MAGIC ## App and platform log entries
# MAGIC
# MAGIC Build, App-server and HTTP lines can share this table. Search by service
# MAGIC and time, and inspect the body to identify the source of each entry.

# COMMAND ----------

display(
    spark.sql(
        f"""
        SELECT time, severity_text, body
        FROM {logs}
        WHERE service_name = :app_name
        ORDER BY time DESC
        LIMIT 100
        """,
        args=params,
    )
)

# COMMAND ----------
# MAGIC %md
# MAGIC ## Requests to the agent
# MAGIC
# MAGIC Both App-server and proxy-format entries may describe the same request.
# MAGIC Use this query to inspect them, not to count unique requests.

# COMMAND ----------

display(
    spark.sql(
        f"""
        SELECT time, severity_text, body
        FROM {logs}
        WHERE service_name = :app_name
          AND try_cast(body AS STRING) LIKE '%POST /responses%'
        ORDER BY time DESC
        LIMIT 100
        """,
        args=params,
    )
)

# COMMAND ----------
# MAGIC %md
# MAGIC ## Recent error logs
# MAGIC
# MAGIC Severity is not an HTTP status. Some HTTP access lines have `UNKNOWN`
# MAGIC severity; inspect those separately below.

# COMMAND ----------

display(
    spark.sql(
        f"""
        SELECT time, severity_text, body
        FROM {logs}
        WHERE service_name = :app_name
          AND upper(severity_text) IN ('ERROR', 'FATAL')
        ORDER BY time DESC
        LIMIT 100
        """,
        args=params,
    )
)

# COMMAND ----------
# MAGIC %md
# MAGIC ## HTTP access lines with 5xx status
# MAGIC
# MAGIC This matches proxy-format log lines observed in our App. HTTP log entries
# MAGIC may be dropped under load; the count is not guaranteed to be complete.

# COMMAND ----------

display(
    spark.sql(
        f"""
        SELECT time, severity_text, body
        FROM {logs}
        WHERE service_name = :app_name
          AND try_cast(body AS STRING) RLIKE '^[0-9]'
          AND try_cast(body AS STRING) RLIKE 'HTTP/[0-9.]+" 5[0-9][0-9] '
        ORDER BY time DESC
        LIMIT 100
        """,
        args=params,
    )
)

# COMMAND ----------
# MAGIC %md
# MAGIC ## App-side HTTP metrics
# MAGIC
# MAGIC The App exports delta histograms: their counts are request totals and the
# MAGIC sum divided by count is mean duration. These only cover requests reaching
# MAGIC the App, not proxy rejections.

# COMMAND ----------

display(
    spark.sql(
        f"""
        SELECT try_cast(histogram.attributes:['http.route'] AS STRING) AS route,
          try_cast(histogram.attributes:['http.request.method'] AS STRING) AS method,
          try_cast(histogram.attributes:['http.response.status_code'] AS INT) AS status,
          SUM(histogram.count) AS requests,
          SUM(histogram.sum) / NULLIF(SUM(histogram.count), 0) AS avg_duration_seconds,
          MAX(time) AS latest
        FROM {metrics}
        WHERE service_name = :app_name AND name = 'app.http.request.duration'
        GROUP BY 1, 2, 3
        ORDER BY latest DESC
        """,
        args=params,
    )
)

# COMMAND ----------
# MAGIC %md
# MAGIC ## MLflow scorer feedback
# MAGIC
# MAGIC Feedback is stored separately from the App telemetry tables. This summary
# MAGIC covers the UC trace location, which may be shared by multiple experiments.

# COMMAND ----------

display(
    spark.sql(
        f"""
        SELECT name, COUNT(*) AS assessments, MAX(created_at) AS latest
        FROM {annotations}
        WHERE target_type = 'TRACE' AND annotation_type = 'FEEDBACK'
          AND deleted_at IS NULL
        GROUP BY name
        ORDER BY latest DESC
        """
    )
)
