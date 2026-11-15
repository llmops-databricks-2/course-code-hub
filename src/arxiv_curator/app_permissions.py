"""Bootstrap permissions for a generated Databricks App identity."""

from urllib.parse import quote

from databricks.sdk import WorkspaceClient


def grant_app_secret_access(
    workspace: WorkspaceClient, catalog: str, schema: str, principal: str
) -> None:
    """Grant only parent usage and read access to the two SPN secrets."""
    grants = [
        ("catalog", catalog, "USE_CATALOG"),
        ("schema", f"{catalog}.{schema}", "USE_SCHEMA"),
        ("secret", f"{catalog}.{schema}.databricks_client_id", "READ_SECRET"),
        ("secret", f"{catalog}.{schema}.databricks_client_secret", "READ_SECRET"),
    ]
    for securable_type, full_name, privilege in grants:
        # READ_SECRET is not yet in the SDK's Privilege enum. Use its API client
        # because SQL secret grants are unavailable on the course compute.
        workspace.api_client.do(
            "PATCH",
            f"/api/2.1/unity-catalog/permissions/{securable_type}/{quote(full_name, safe='')}",
            body={"changes": [{"principal": principal, "add": [privilege]}]},
        )
