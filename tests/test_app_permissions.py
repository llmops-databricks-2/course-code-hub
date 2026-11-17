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
