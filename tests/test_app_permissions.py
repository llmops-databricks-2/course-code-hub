from unittest.mock import MagicMock, call

from arxiv_curator.app_permissions import grant_app_secret_access


def test_bootstrap_grants_are_additive_and_limited_to_two_secrets():
    workspace = MagicMock()
    grant_app_secret_access(workspace, "catalog", "schema", "app-id")
    assert workspace.api_client.do.call_args_list == [
        call(
            "PATCH",
            f"/api/2.1/unity-catalog/permissions/{kind}/{name}",
            body={"changes": [{"principal": "app-id", "add": [privilege]}]},
        )
        for kind, name, privilege in [
            ("catalog", "catalog", "USE_CATALOG"),
            ("schema", "catalog.schema", "USE_SCHEMA"),
            ("secret", "catalog.schema.databricks_client_id", "READ_SECRET"),
            ("secret", "catalog.schema.databricks_client_secret", "READ_SECRET"),
        ]
    ]


def test_runtime_trace_grants_exclude_unrelated_tables_and_view_modification():
    from types import SimpleNamespace

    from databricks.sdk.service.catalog import Privilege, TableType

    from arxiv_curator.app_permissions import grant_runtime_trace_access

    workspace = MagicMock()
    workspace.tables.list.return_value = [
        SimpleNamespace(name="llmops_otel_spans", table_type=TableType.MANAGED),
        SimpleNamespace(name="llmops_traces", table_type=TableType.VIEW),
        SimpleNamespace(name="papers", table_type=TableType.MANAGED),
    ]
    grant_runtime_trace_access(workspace, "catalog", "schema", "runtime-id")
    grants = [call.kwargs for call in workspace.grants.update.call_args_list]
    assert [grant["full_name"] for grant in grants] == [
        "catalog.schema.llmops_otel_spans",
        "catalog.schema.llmops_traces",
    ]
    assert grants[0]["changes"][0].add == [Privilege.SELECT, Privilege.MODIFY]
    assert grants[1]["changes"][0].add == [Privilege.SELECT]
    assert all(grant["changes"][0].principal == "runtime-id" for grant in grants)
