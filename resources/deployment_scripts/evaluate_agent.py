# Databricks notebook source
"""Evaluate the candidate before allowing App deployment."""

import mlflow
from loguru import logger

from arxiv_curator.config import ProjectConfig
from arxiv_curator.evaluation import evaluate_agent


def workspace_bundle_root() -> str:
    """Find the workspace folder containing the deployed bundle."""
    notebook_path = (
        dbutils.notebook.entry_point.getDbutils()
        .notebook()
        .getContext()
        .notebookPath()
        .get()
    )
    bundle_root = notebook_path.rsplit("/resources/", 1)[0]
    return bundle_root if bundle_root.startswith("/Workspace/") else f"/Workspace{bundle_root}"


widgets = dbutils.widgets.getAll()
env = widgets.get("env", "dev")
genie_space_id = widgets.get("genie_space_id")
bundle_root = workspace_bundle_root()
cfg = ProjectConfig.from_yaml(f"{bundle_root}/project_config.yml", env=env)
cfg.genie_space_id = genie_space_id

mlflow.set_tracking_uri("databricks")
mlflow.set_experiment(cfg.experiment_name)
results = evaluate_agent(cfg, eval_inputs_path=f"{bundle_root}/eval_inputs.txt")
logger.info(f"Evaluation metrics: {results.metrics}")
