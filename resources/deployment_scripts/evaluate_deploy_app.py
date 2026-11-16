# Databricks notebook source
"""Evaluate the agent, grant App secret access, start, invoke, and stop the App."""

import os

import mlflow
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.apps import AppDeployment, ComputeState, EnvVar
from loguru import logger
from openai import OpenAI

from arxiv_curator.app_permissions import grant_app_secret_access
from arxiv_curator.config import ProjectConfig
from arxiv_curator.evaluation import evaluate_agent

env = dbutils.widgets.get("env")
cfg = ProjectConfig.from_yaml("../../project_config.yml", env=env)
cfg.genie_space_id = dbutils.widgets.get("genie_space_id")

# COMMAND ----------
# Evaluate before starting the App.
os.environ["MLFLOW_TRACING_SQL_WAREHOUSE_ID"] = cfg.warehouse_id
mlflow.set_experiment(cfg.experiment_name)
results = evaluate_agent(cfg, eval_inputs_path="../../eval_inputs.txt")
logger.info(f"Evaluation metrics: {results.metrics}")

# COMMAND ----------
# Bundle deployment has already created the App and its service principal.
w = WorkspaceClient()
app = w.apps.get(name=cfg.agent_app_name)
principal = app.service_principal_client_id
if not principal:
    raise RuntimeError("App SPN is missing; deploy bundle resources before running this job")
grant_app_secret_access(w, cfg.catalog, cfg.schema, principal)

# COMMAND ----------
# Start and verify the App using an OAuth caller.
caller = WorkspaceClient(
    host=w.config.host,
    client_id=dbutils.secrets.get(
        catalog=cfg.catalog, schema=cfg.schema, key="databricks_client_id"
    ),
    client_secret=dbutils.secrets.get(
        catalog=cfg.catalog, schema=cfg.schema, key="databricks_client_secret"
    ),
    auth_type="oauth-m2m",
)

try:
    # deploy_and_wait requires running compute; start stopped compute first.
    # Start + deploy follows the CLI bundle run lifecycle, with explicit config.
    if app.compute_status.state == ComputeState.STOPPED:
        w.apps.start_and_wait(name=cfg.agent_app_name)
    w.apps.deploy_and_wait(
        app_name=cfg.agent_app_name,
        app_deployment=AppDeployment(
            source_code_path=app.default_source_code_path,
            command=["uv", "run", "start-server"],
            env_vars=[
                EnvVar(name="ARXIV_ENV", value=env),
                EnvVar(name="GENIE_SPACE_ID", value=cfg.genie_space_id),
            ],
        ),
    )
    app = w.apps.get(name=cfg.agent_app_name)
    client = OpenAI(api_key=caller.config.oauth_token().access_token, base_url=app.url)
    response = client.responses.with_raw_response.create(
        model=f"apps/{cfg.agent_app_name}",
        input=[{"role": "user", "content": "What are recent papers about LLMs and reasoning?"}],
    )
    print(f"HTTP status: {response.status_code}")
    if response.status_code != 200:
        raise RuntimeError(f"Expected HTTP 200, got {response.status_code}")
    print(response.parse().output_text)
finally:
    # Stop to avoid ongoing compute costs for the course. A normal production
    # deployment would leave the App running after successful validation.
    app = w.apps.get(name=cfg.agent_app_name)
    if app.compute_status.state != ComputeState.STOPPED:
        w.apps.stop_and_wait(name=cfg.agent_app_name)
        logger.info(f"Stopped App: {cfg.agent_app_name}")
