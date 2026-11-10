# Databricks notebook source
"""Lecture 5 evaluation gate and App deployment step."""

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.apps import AppDeployment
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
mode = widgets.get("mode", "evaluate")
bundle_root = workspace_bundle_root()
cfg = ProjectConfig.from_yaml(f"{bundle_root}/project_config.yml", env=env)
cfg.genie_space_id = genie_space_id

if mode == "evaluate":
    results = evaluate_agent(cfg, eval_inputs_path=f"{bundle_root}/eval_inputs.txt")
    logger.info(f"Evaluation metrics: {results.metrics}")
    logger.info("Evaluation succeeded")
    dbutils.notebook.exit("evaluation_succeeded")

if mode != "deploy":
    raise ValueError(f"Unsupported deployment mode: {mode}")

logger.info("Evaluation already succeeded; deploying the App")

# If evaluation raises an exception, the task fails and this deployment step is not reached.
w = WorkspaceClient()
app = w.apps.get(name=cfg.agent_app_name)
compute_state = (
    str(getattr(app.compute_status.state, "value", app.compute_status.state))
    if app.compute_status
    else "UNKNOWN"
)
if compute_state.upper() not in {"ACTIVE", "RUNNING"}:
    logger.info(f"App compute state is {compute_state}; starting the App before deployment")
    w.apps.start_and_wait(name=cfg.agent_app_name)
else:
    logger.info(f"App compute is already active ({compute_state}); deploying directly")
deployment = w.apps.deploy_and_wait(
    app_name=cfg.agent_app_name,
    app_deployment=AppDeployment(source_code_path=bundle_root),
)
logger.info(f"App redeployed successfully: {deployment.deployment_id}")
