# Databricks notebook source
"""Evaluate the agent, grant App secret access, start, invoke, and stop the App."""

import os

import mlflow
import requests
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.apps import AppDeployment, ComputeState, EnvVar
from loguru import logger
from openai import OpenAI

from arxiv_curator.app_permissions import grant_app_secret_access, grant_runtime_trace_access
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
# Use the job identity to grant trace access and invoke the App.
runtime_spn_client_id = dbutils.secrets.get(
    catalog=cfg.catalog, schema=cfg.schema, key="databricks_client_id"
)
grant_runtime_trace_access(w, cfg.catalog, cfg.schema, runtime_spn_client_id)

try:
    # deploy_and_wait requires running compute; start stopped compute first.
    # Start + deploy follows the CLI bundle run lifecycle, with explicit config.
    if app.compute_status.state == ComputeState.STOPPED:
        w.apps.start_and_wait(name=cfg.agent_app_name)
    # Starting compute may resume a deployment; wait before submitting new code.
    app = w.apps.get(name=cfg.agent_app_name)
    if app.pending_deployment:
        w.apps.wait_get_deployment_app_succeeded(
            app_name=cfg.agent_app_name, deployment_id=app.pending_deployment.deployment_id
        )
    w.apps.deploy_and_wait(
        app_name=cfg.agent_app_name,
        app_deployment=AppDeployment(
            # A new App has no default source path; use the bundle's uploaded files.
            source_code_path=dbutils.widgets.get("source_code_path"),
            command=["uv", "run", "start-server"],
            env_vars=[
                EnvVar(name="ARXIV_ENV", value=env),
                EnvVar(name="GENIE_SPACE_ID", value=cfg.genie_space_id),
                EnvVar(name="MLFLOW_TRACKING_URI", value="databricks"),
                EnvVar(name="ENABLE_MLFLOW_TRACING", value="true"),
                EnvVar(name="GIT_SHA", value=dbutils.widgets.get("git_sha")),
                EnvVar(name="GIT_BRANCH", value=dbutils.widgets.get("git_branch")),
            ],
        ),
    )
    app = w.apps.get(name=cfg.agent_app_name)
    # Exchange the job runtime token for App OAuth, as in notebook 5.1.
    notebook_token = w.config.authenticate()["Authorization"].removeprefix("Bearer ")
    token_response = requests.post(
        f"{w.config.host}/oidc/v1/token",
        data={
            "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
            "subject_token": notebook_token,
            "subject_token_type": "urn:databricks:params:oauth:token-type:personal-access-token",
            "requested_token_type": "urn:ietf:params:oauth:token-type:access_token",
            "scope": "all-apis",
            "audience": app.oauth2_app_client_id,
        },
        timeout=30,
    )
    token_response.raise_for_status()
    token_data = token_response.json()
    oauth_token = token_data["access_token"]
    logger.info(f"App OAuth token valid for {token_data['expires_in']} seconds")
    client = OpenAI(api_key=oauth_token, base_url=app.url)
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
