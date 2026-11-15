# Databricks notebook source
"""Grant the generated App principal access to its UC bootstrap secrets."""

from databricks.sdk import WorkspaceClient
from loguru import logger

from arxiv_curator.config import ProjectConfig
from arxiv_curator.app_permissions import grant_app_secret_access


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
bundle_root = workspace_bundle_root()
cfg = ProjectConfig.from_yaml(f"{bundle_root}/project_config.yml", env=env)

w = WorkspaceClient()
app = w.apps.get(name=cfg.agent_app_name)
principal = app.service_principal_client_id
if not principal:
    raise RuntimeError("App SPN is missing; deploy bundle resources before running this job")

grant_app_secret_access(w, cfg.catalog, cfg.schema, principal)
logger.info(f"Granted UC bootstrap secret access to App principal {principal}")
