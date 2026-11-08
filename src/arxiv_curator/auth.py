"""Authentication helpers for Databricks AI Gateway clients."""

from __future__ import annotations

import base64
import json
import os
import urllib.parse
import urllib.request

from databricks.sdk import WorkspaceClient


def get_gateway_token(workspace: WorkspaceClient) -> str:
    """Return a token suitable for AI Gateway calls in notebooks and Apps."""
    token = os.getenv("DATABRICKS_TOKEN")
    if token:
        return token

    client_id = os.getenv("DATABRICKS_CLIENT_ID")
    client_secret = os.getenv("DATABRICKS_CLIENT_SECRET")
    if client_id and client_secret:
        host = workspace.config.host.rstrip("/")
        payload = urllib.parse.urlencode(
            {"grant_type": "client_credentials", "scope": "all-apis"}
        ).encode()
        credentials = f"{client_id}:{client_secret}".encode()
        request = urllib.request.Request(
            f"{host}/oidc/v1/token",
            data=payload,
            headers={
                "Authorization": "Basic "
                + base64.b64encode(credentials).decode(),
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            token = json.loads(response.read())["access_token"]
        return token

    try:
        from databricks.sdk.runtime import dbutils

        token = (
            dbutils.notebook.entry_point
            .getDbutils()
            .notebook()
            .getContext()
            .apiToken()
            .get()
        )
        if token:
            return token
    except Exception:
        pass

    return workspace.tokens.create(lifetime_seconds=1200).token_value
