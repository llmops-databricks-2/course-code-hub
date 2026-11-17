# Databricks notebook source
"""Run agent evaluation without model registration or App deployment."""

import os

import mlflow
from databricks.sdk.runtime import dbutils
from loguru import logger

from arxiv_curator.config import ProjectConfig
from arxiv_curator.evaluation import evaluate_agent

dbutils.widgets.dropdown("env", "dev", ["dev", "acc", "prd"])
dbutils.widgets.text("genie_space_id", "")
env = dbutils.widgets.get("env")
cfg = ProjectConfig.from_yaml("../../project_config.yml", env=env)
cfg.genie_space_id = dbutils.widgets.get("genie_space_id")
os.environ["MLFLOW_TRACING_SQL_WAREHOUSE_ID"] = cfg.warehouse_id
mlflow.set_experiment(cfg.experiment_name)

# COMMAND ----------
results = evaluate_agent(cfg, eval_inputs_path="../../eval_inputs.txt")
logger.info(f"Evaluation run: {results.run_id}")
logger.info(f"Evaluation metrics: {results.metrics}")
