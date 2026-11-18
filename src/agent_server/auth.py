"""Set agent credentials before importing MLflow or initializing agent clients."""

import os

from databricks.sdk import WorkspaceClient

from arxiv_curator.config import ProjectConfig


def setup_auth(cfg: ProjectConfig) -> None:
    """Read SPN credentials from UC secrets and configure the agent environment."""
    workspace = WorkspaceClient()

    os.environ["DATABRICKS_CLIENT_ID"] = workspace.secrets_uc.get_secret(
        full_name=f"{cfg.catalog}.{cfg.schema}.databricks_client_id", include_value=True
    ).effective_value
    os.environ["DATABRICKS_CLIENT_SECRET"] = workspace.secrets_uc.get_secret(
        full_name=f"{cfg.catalog}.{cfg.schema}.databricks_client_secret", include_value=True
    ).effective_value
    os.environ["DATABRICKS_HOST"] = workspace.config.host
