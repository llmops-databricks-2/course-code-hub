# Databricks notebook source
"""Probe the App through its public endpoint, independently of App telemetry."""

import time

import requests
from databricks.sdk import WorkspaceClient

from arxiv_curator.config import ProjectConfig

env = dbutils.widgets.get("env")
cfg = ProjectConfig.from_yaml("../../project_config.yml", env=env)
w = WorkspaceClient()
app = w.apps.get(name=cfg.agent_app_name)
if not app.url or not app.oauth2_app_client_id:
    raise RuntimeError("App URL or OAuth client is missing")

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
    timeout=20,
)
token_response.raise_for_status()
started = time.perf_counter()
response = requests.get(
    f"{app.url}/health",
    headers={"Authorization": f"Bearer {token_response.json()['access_token']}"},
    timeout=20,
)
print(f"HTTP status: {response.status_code}; duration: {time.perf_counter() - started:.3f}s")
response.raise_for_status()
