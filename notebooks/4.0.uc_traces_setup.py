# Databricks notebook source
# MAGIC %md
# MAGIC # Lecture 4.0: Set Up Unity Catalog Traces
# MAGIC
# MAGIC Run this notebook before 4.1. It creates or selects the configured experiment,
# MAGIC checks its Unity Catalog binding, and grants the service principal access
# MAGIC to the trace tables and views. The catalog and schema must already exist.

# COMMAND ----------

import os

import mlflow
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.catalog import TableType
from loguru import logger
from mlflow.entities.trace_location import UnityCatalog
from pyspark.sql import SparkSession

from arxiv_curator.config import get_env, load_config

spark = SparkSession.builder.getOrCreate()
env = get_env(spark)
cfg = load_config("../project_config.yml", env)

# COMMAND ----------

# Use the experiment configured for this environment in project_config.yml.
# The experiment is the UI entry point; its traces are stored in Unity Catalog.
experiment_name = cfg.experiment_name
os.environ["MLFLOW_TRACING_SQL_WAREHOUSE_ID"] = cfg.warehouse_id
trace_location = UnityCatalog(
    catalog_name=cfg.catalog,
    schema_name=cfg.schema,
    table_prefix="llmops",
)
existing_experiment = mlflow.get_experiment_by_name(experiment_name)

if existing_experiment is None:
    experiment = mlflow.set_experiment(
        experiment_name=experiment_name,
        trace_location=trace_location,
    )
    logger.info(f"Created experiment: {experiment.name} (id={experiment.experiment_id})")
else:
    existing_location = existing_experiment.trace_location
    if not isinstance(existing_location, UnityCatalog) or (
        existing_location.catalog_name,
        existing_location.schema_name,
        existing_location.table_prefix,
    ) != (cfg.catalog, cfg.schema, "llmops"):
        raise ValueError(
            f"Experiment {experiment_name} already exists with a different trace location. "
            "Configure a new experiment_path in project_config.yml to create a UC-backed experiment."
        )
    experiment = mlflow.set_experiment(experiment_id=existing_experiment.experiment_id)
    logger.info(f"Using existing experiment: {experiment.name} (id={experiment.experiment_id})")

logger.info(f"Trace table: {experiment.trace_location.full_otel_spans_table_name}")

# Grant access after the experiment and its UC trace objects exist.
principal = dbutils.secrets.get(catalog=cfg.catalog, schema=cfg.schema, key="databricks_client_id")
workspace = WorkspaceClient()
for table in workspace.tables.list(catalog_name=cfg.catalog, schema_name=cfg.schema):
    if table.name.startswith("llmops_"):
        privileges = "SELECT" if table.table_type == TableType.VIEW else "SELECT, MODIFY"
        spark.sql(
            f"GRANT {privileges} ON TABLE {cfg.catalog}.{cfg.schema}.`{table.name}` "
            f"TO `{principal}`"
        )
