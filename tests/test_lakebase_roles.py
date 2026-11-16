"""Check database role selection independently of OAuth credential generation."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from urllib.parse import unquote, urlparse

import pytest

from arxiv_curator.memory import LakebaseMemory
from arxiv_curator.vector_search import LakebasePgVectorManager


@pytest.fixture
def lakebase(monkeypatch):
    for name in (
        "DATABRICKS_CLIENT_ID",
        "DATABRICKS_CLIENT_SECRET",
        "DATABRICKS_HOST",
        "LAKEBASE_SP_CLIENT_ID",
        "LAKEBASE_SP_CLIENT_SECRET",
        "LAKEBASE_SP_HOST",
        "LAKEBASE_ENDPOINT",
        "PGHOST",
        "PGDATABASE",
    ):
        monkeypatch.delenv(name, raising=False)
    lakebase = SimpleNamespace()
    lakebase.workspace = MagicMock()
    lakebase.workspace.config.client_id = None
    lakebase.workspace.current_user.me.return_value.user_name = "maria@example.com"
    lakebase.api = lakebase.workspace.postgres
    lakebase.api.list_branches.return_value = [
        SimpleNamespace(name="projects/test/branches/production")
    ]
    lakebase.api.list_endpoints.return_value = [
        SimpleNamespace(
            name="endpoint", status=SimpleNamespace(hosts=SimpleNamespace(host="db.example.com"))
        )
    ]
    lakebase.api.generate_database_credential.return_value.token = "test-token"
    return lakebase


def test_memory_uses_configured_group_with_current_user_credential(lakebase):
    with patch("arxiv_curator.memory.PostgresAPI", return_value=lakebase.api):
        memory = LakebaseMemory("test", workspace=lakebase.workspace, database_user="grp-teachers")
        url = urlparse(memory._get_connection_string())
    assert unquote(url.username) == "grp-teachers"
    assert url.password == "test-token"
    lakebase.workspace.current_user.me.assert_not_called()
    lakebase.api.generate_database_credential.assert_called_once_with(endpoint="endpoint")


def test_memory_defaults_to_individual_user(lakebase):
    with patch("arxiv_curator.memory.PostgresAPI", return_value=lakebase.api):
        url = urlparse(
            LakebaseMemory("test", workspace=lakebase.workspace)._get_connection_string()
        )
    assert unquote(url.username) == "maria@example.com"


def test_memory_preserves_service_principal_role(lakebase):
    lakebase.workspace.config.client_id = "sp-id"
    with (
        patch.dict(
            "os.environ",
            {
                "DATABRICKS_CLIENT_ID": "sp-id",
                "DATABRICKS_CLIENT_SECRET": "test-secret",
                "DATABRICKS_HOST": "https://workspace.example.com",
            },
        ),
        patch("arxiv_curator.memory.WorkspaceClient", return_value=lakebase.workspace),
        patch("arxiv_curator.memory.PostgresAPI", return_value=lakebase.api),
    ):
        url = urlparse(
            LakebaseMemory("test", database_user="grp-teachers")._get_connection_string()
        )
    assert url.username == "sp-id"


@pytest.mark.parametrize("client_id,expected", [(None, "grp-teachers"), ("sp-id", "sp-id")])
def test_search_uses_group_and_preserves_service_principal_override(lakebase, client_id, expected):
    cfg = SimpleNamespace(
        catalog="catalog",
        schema="schema",
        lakebase_project_id="test",
        embedding_endpoint="embed",
        lakebase_user="grp-teachers",
    )
    with patch.dict("os.environ", {"DATABRICKS_CLIENT_ID": client_id} if client_id else {}):
        manager = LakebasePgVectorManager(config=cfg, workspace=lakebase.workspace)
        url = urlparse(manager._get_connection_string())
        assert unquote(url.username) == expected
        assert url.password == "test-token"


@pytest.mark.parametrize("client_id,expected", [(None, "grp-teachers"), ("sp-id", "sp-id")])
def test_search_accepts_explicit_group_without_config(lakebase, client_id, expected):
    with patch.dict("os.environ", {"DATABRICKS_CLIENT_ID": client_id} if client_id else {}):
        manager = LakebasePgVectorManager(
            catalog="catalog",
            schema="schema",
            lakebase_project_id="test",
            embedding_model="embed",
            workspace=lakebase.workspace,
            database_user="grp-teachers",
        )
        assert unquote(urlparse(manager._get_connection_string()).username) == expected


def test_agent_passes_group_to_memory_and_search(lakebase):
    from arxiv_curator.agent import ArxivAgent

    with (
        patch("arxiv_curator.agent.WorkspaceClient", return_value=lakebase.workspace),
        patch("arxiv_curator.agent.OpenAI"),
        patch("arxiv_curator.agent.nest_asyncio.apply"),
        patch("arxiv_curator.agent.LakebaseMemory") as memory,
        patch("arxiv_curator.agent.LakebasePgVectorManager") as search,
    ):
        ArxivAgent(
            llm_endpoint="chat",
            system_prompt="test",
            catalog="catalog",
            schema="schema",
            lakebase_project_id="test",
            lakebase_user="grp-teachers",
        )
    assert memory.call_args.kwargs["database_user"] == "grp-teachers"
    assert search.call_args.kwargs["database_user"] == "grp-teachers"
