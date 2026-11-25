# Databricks notebook source
# MAGIC %md
# MAGIC # Lecture 4.0: Set Up Unity Catalog Traces
# MAGIC
# MAGIC Run this notebook before 4.1. It creates or checks the configured experiment
# MAGIC for each environment and grants its runtime service principal access to the
# MAGIC trace tables and views. All catalogs, schemas, and client ID secrets must exist.
# MAGIC The caller needs permissions to create experiments and grant UC privileges in
# MAGIC every environment. Existing experiments and their traces are not migrated.

# COMMAND ----------

import os

import mlflow
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.catalog import TableType
from loguru import logger
from mlflow.entities.trace_location import UnityCatalog
from pyspark.sql import SparkSession

from arxiv_curator.config import load_config

spark = SparkSession.builder.getOrCreate()
workspace = WorkspaceClient()

# COMMAND ----------


def setup_environment(env):
    cfg = load_config("../project_config.yml", env)
    os.environ["MLFLOW_TRACING_SQL_WAREHOUSE_ID"] = cfg.warehouse_id
    trace_location = UnityCatalog(cfg.catalog, cfg.schema, "llmops")
    existing = mlflow.get_experiment_by_name(cfg.experiment_name)

    if existing is None:
        experiment = mlflow.set_experiment(
            experiment_name=cfg.experiment_name, trace_location=trace_location
        )
    else:
        location = existing.trace_location
        if not isinstance(location, UnityCatalog) or (
            location.catalog_name,
            location.schema_name,
            location.table_prefix,
        ) != (cfg.catalog, cfg.schema, "llmops"):
            raise ValueError(
                f"Experiment {cfg.experiment_name} already exists with a different trace location. "
                "Configure a new experiment_path in project_config.yml."
            )
        experiment = mlflow.set_experiment(experiment_id=existing.experiment_id)

    logger.info(f"{env}: experiment {experiment.name} (id={experiment.experiment_id})")
    principal = dbutils.secrets.get(
        catalog=cfg.catalog, schema=cfg.schema, key="databricks_client_id"
    )
    spark.sql(f"GRANT USE CATALOG ON CATALOG `{cfg.catalog}` TO `{principal}`")
    spark.sql(f"GRANT USE SCHEMA ON SCHEMA `{cfg.catalog}`.`{cfg.schema}` TO `{principal}`")
    for table in workspace.tables.list(catalog_name=cfg.catalog, schema_name=cfg.schema):
        if table.name.startswith("llmops_otel_"):
            privileges = "SELECT" if table.table_type == TableType.VIEW else "SELECT, MODIFY"
            spark.sql(
                f"GRANT {privileges} ON TABLE `{cfg.catalog}`.`{cfg.schema}`.`{table.name}` "
                f"TO `{principal}`"
            )


failures = []
for env in ("dev", "acc", "prd"):
    try:
        setup_environment(env)
    except Exception as exc:
        logger.exception(f"{env}: trace setup failed")
        failures.append(f"{env}: {exc}")

if failures:
    raise RuntimeError("Trace setup failed: " + "; ".join(failures))
