# Databricks notebook source
# Verify notebook 5.1's token exchange without starting the App.
import json

import requests
from databricks.sdk import WorkspaceClient

w = WorkspaceClient()
app = w.apps.get(name="agent-arxiv-curator-dev")
print(f"Caller: {w.current_user.me().user_name}; auth type: {w.config.auth_type}")
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
token_data = token_response.json()
result = {
    "http_status": token_response.status_code,
    "access_token_returned": bool(token_data.get("access_token")),
    "expires_in": token_data.get("expires_in"),
}
print(json.dumps(result))
assert token_response.status_code == 200 and result["access_token_returned"], result
del notebook_token, token_data, token_response
