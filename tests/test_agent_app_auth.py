"""Exercise App credential bootstrap independently of MLflow initialization."""

import os
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from agent_server.auth import setup_auth

CFG = SimpleNamespace(catalog="llmops_dev", schema="arxiv")


@pytest.fixture
def workspace(monkeypatch):
    monkeypatch.setattr(
        os,
        "environ",
        {
            "DATABRICKS_CLIENT_ID": "app-spn",
            "DATABRICKS_CLIENT_SECRET": "app-secret",
            "DATABRICKS_TOKEN": "competing-token",
            "MLFLOW_TRACKING_TOKEN": "competing-token",
            "LAKEBASE_SP_CLIENT_ID": "other-spn",
        },
    )
    client = MagicMock()
    client.config.host = "https://workspace.example"
    client.secrets_uc.get_secret.side_effect = [
        SimpleNamespace(effective_value="existing-spn"),
        SimpleNamespace(effective_value="existing-secret"),
    ]
    monkeypatch.setattr("agent_server.auth.WorkspaceClient", MagicMock(return_value=client))
    return client


def test_reads_uc_secrets_then_sets_credentials_and_workspace_host(workspace):
    setup_auth(CFG)
    calls = workspace.secrets_uc.get_secret.call_args_list
    assert len(calls) == 2
    assert calls[0].kwargs == {
        "full_name": "llmops_dev.arxiv.databricks_client_id",
        "include_value": True,
    }
    assert calls[1].kwargs == {
        "full_name": "llmops_dev.arxiv.databricks_client_secret",
        "include_value": True,
    }
    assert os.environ["DATABRICKS_CLIENT_ID"] == "existing-spn"
    assert os.environ["DATABRICKS_CLIENT_SECRET"] == "existing-secret"
    assert os.environ["DATABRICKS_HOST"] == "https://workspace.example"


def test_sdk_read_error_propagates(workspace):
    from databricks.sdk.errors import PermissionDenied

    sdk_error = PermissionDenied("Secret access denied")
    workspace.secrets_uc.get_secret.side_effect = sdk_error
    with pytest.raises(PermissionDenied) as error:
        setup_auth(CFG)
    assert error.value is sdk_error
