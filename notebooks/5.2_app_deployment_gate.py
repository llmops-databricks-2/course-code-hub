# Databricks notebook source
# MAGIC %md
# MAGIC # Lecture 5.2: Evaluation-Gated App Redeployment
# MAGIC
# MAGIC This notebook demonstrates the deployment gate used by the Lecture 5 job:
# MAGIC evaluate the current agent first, and only redeploy the Databricks App when
# MAGIC evaluation completes successfully. If evaluation raises an exception, the
# MAGIC job stops before the App deployment call.

# COMMAND ----------

# MAGIC %md
# MAGIC ## 1. Load the deployed bundle configuration
# MAGIC
# MAGIC The job runs from the bundle workspace directory, so we derive that directory
# MAGIC from the notebook path and load the environment-specific project settings.

# COMMAND ----------

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.apps import AppDeployment
from loguru import logger

from arxiv_curator.config import ProjectConfig
from arxiv_curator.evaluation import evaluate_agent


def workspace_bundle_root() -> str:
    """Find the workspace folder containing this deployed bundle."""
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
logger.info(f"Bundle root: {bundle_root}")
logger.info(f"App: {cfg.agent_app_name}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. Run evaluation before deployment
# MAGIC
# MAGIC This reuses the Lecture 4 evaluation function. The deployment step is not
# MAGIC reached when evaluation fails, so an unsuccessful candidate cannot replace
# MAGIC the running App.

# COMMAND ----------

results = evaluate_agent(
    cfg,
    eval_inputs_path=f"{bundle_root}/eval_inputs.txt",
)
logger.info(f"Evaluation metrics: {results.metrics}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 3. Redeploy the App with the Databricks SDK
# MAGIC
# MAGIC `deploy_and_wait` uploads the current bundle source to the existing App and
# MAGIC waits for the deployment operation to finish. This is the recent SDK-based
# MAGIC alternative to performing the redeployment manually in the UI.

# COMMAND ----------

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
logger.info(f"Deployment ID: {deployment.deployment_id}")
logger.info("Evaluation succeeded; App redeployment completed.")
