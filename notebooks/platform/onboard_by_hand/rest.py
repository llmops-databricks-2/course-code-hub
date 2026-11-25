"""Onboard the mock student by hand with plain REST calls: create, show, delete.

    uv run python notebooks/platform/onboard_by_hand/rest.py create
    uv run python notebooks/platform/onboard_by_hand/rest.py show
    uv run python notebooks/platform/onboard_by_hand/rest.py delete

The same four objects as sdk.py, call for call, so the two read side by side. Every URL, body and
error is written by hand; only the sign-in is borrowed from the SDK (Config.authenticate() returns
the Authorization header for whatever the profile holds).
"""

import sys
import time

import mock_student as s
import requests
from databricks.sdk.core import Config

WS = Config(profile="course-express")
ACC = Config(profile="course-account")
ACCOUNT = f"{ACC.host}/api/2.0/accounts/{s.ACCOUNT_ID}"
SCIM_USER = "urn:ietf:params:scim:schemas:core:2.0:User"
SCIM_PATCH = "urn:ietf:params:scim:api:messages:2.0:PatchOp"


def call(config: Config, method: str, url: str, **kwargs) -> dict:
    """One request, signed in through the profile; raises on any HTTP error with its body."""
    response = requests.request(method, url, headers=config.authenticate(), timeout=60, **kwargs)
    if not response.ok:
        raise RuntimeError(f"{method} {url} -> {response.status_code} {response.text[:300]}")
    return response.json() if response.content else {}


def ws(method: str, path: str, **kwargs) -> dict:
    return call(WS, method, f"{WS.host}{path}", **kwargs)


def find_user() -> dict | None:
    """The user by the id create saved; a read may miss it for a moment after a change."""
    user_id = s.recall("rest").get("user_id")
    for _ in range(4):
        try:
            return ws("GET", f"/api/2.0/preview/scim/v2/Users/{user_id}") if user_id else None
        except RuntimeError:
            time.sleep(5)
    return None


def students_group_id() -> str:
    found = call(
        ACC,
        "GET",
        f"{ACCOUNT}/scim/v2/Groups",
        params={"filter": f'displayName eq "{s.STUDENTS_GROUP}"'},
    )
    return found["Resources"][0]["id"]


def find_policy() -> dict | None:
    url = f"{ACC.host}/api/2.1/accounts/{s.ACCOUNT_ID}/budget-policies"
    page = call(ACC, "GET", url)
    while True:
        for policy in page.get("policies", []):
            if policy["policy_name"] == s.POLICY:
                return policy
        if not page.get("next_page_token"):
            return None
        page = call(ACC, "GET", url, params={"page_token": page["next_page_token"]})


def find_warehouse() -> dict | None:
    warehouses = ws("GET", "/api/2.0/sql/warehouses").get("warehouses", [])
    return next((wh for wh in warehouses if wh["name"] == s.WAREHOUSE), None)


def create_user(wait_s: int = 180) -> dict:
    """POST the user. A user deleted minutes ago still answers 409 until the delete has reached
    every service, so the create is retried for a few minutes."""
    body = {
        "schemas": [SCIM_USER],
        "userName": s.EMAIL,
        "displayName": s.EMAIL,
        "entitlements": [{"value": e} for e in s.ENTITLEMENTS],
    }
    for _ in range(wait_s // 15):
        try:
            return ws("POST", "/api/2.0/preview/scim/v2/Users", json=body)
        except RuntimeError as error:
            if "-> 409" not in str(error):
                raise
            print("the user's earlier delete is still settling (409); retrying in 15 s")
            time.sleep(15)
    return ws("POST", "/api/2.0/preview/scim/v2/Users", json=body)


def create() -> None:
    # 1. The user in the workspace, then into the account group.
    user = create_user()
    call(
        ACC,
        "PATCH",
        f"{ACCOUNT}/scim/v2/Groups/{students_group_id()}",
        json={
            "schemas": [SCIM_PATCH],
            "Operations": [{"op": "add", "value": {"members": [{"value": user["id"]}]}}],
        },
    )
    s.remember("rest", user_id=user["id"])
    print(f"user {s.EMAIL}: {user['id']}, in {s.STUDENTS_GROUP}")

    # 2. The usage policy, then the student as its user in the policy's rule set.
    policy = call(
        ACC,
        "POST",
        f"{ACC.host}/api/2.1/accounts/{s.ACCOUNT_ID}/budget-policies",
        json={
            "policy": {
                "policy_name": s.POLICY,
                "custom_tags": [{"key": k, "value": v} for k, v in s.TAGS.items()],
                "binding_workspace_ids": [s.WORKSPACE_ID],
            }
        },
    )
    rule_set = f"accounts/{s.ACCOUNT_ID}/budgetPolicies/{policy['policy_id']}/ruleSets/default"
    rule_set_url = f"{ACC.host}/api/2.0/preview/accounts/{s.ACCOUNT_ID}/access-control/rule-sets"
    current = call(ACC, "GET", rule_set_url, params={"name": rule_set, "etag": ""})
    rules = [
        *current.get("grant_rules", []),
        {"role": s.POLICY_USER_ROLE, "principals": [f"users/{s.EMAIL}"]},
    ]
    call(
        ACC,
        "PUT",
        rule_set_url,
        json={
            "name": rule_set,
            "rule_set": {"name": rule_set, "etag": current["etag"], "grant_rules": rules},
        },
    )
    print(f"usage policy {s.POLICY}: {policy['policy_id']}")

    # 3. The schema, the student's grants, then the admins group its owner.
    ws(
        "POST",
        "/api/2.1/unity-catalog/schemas",
        json={
            "name": s.UC_NAME,
            "catalog_name": s.CATALOG,
            "comment": s.SCHEMA_COMMENT,
            "properties": s.TAGS,
        },
    )
    ws(
        "PATCH",
        f"/api/2.1/unity-catalog/permissions/schema/{s.SCHEMA}",
        json={"changes": [{"principal": s.EMAIL, "add": ["ALL_PRIVILEGES", "MANAGE"]}]},
    )
    ws("PATCH", f"/api/2.1/unity-catalog/schemas/{s.SCHEMA}", json={"owner": s.ADMINS_GROUP})
    print(f"schema {s.SCHEMA}, owned by {s.ADMINS_GROUP}")

    # 4. The warehouse, stopped at once, the student CAN USE.
    warehouse = ws(
        "POST",
        "/api/2.0/sql/warehouses",
        json={
            "name": s.WAREHOUSE,
            "cluster_size": "2X-Small",
            "warehouse_type": "PRO",
            "enable_serverless_compute": True,
            "auto_stop_mins": 10,
            "min_num_clusters": 1,
            "max_num_clusters": 1,
            "tags": {"custom_tags": [{"key": k, "value": v} for k, v in s.TAGS.items()]},
        },
    )
    ws("POST", f"/api/2.0/sql/warehouses/{warehouse['id']}/stop")
    ws(
        "PATCH",
        f"/api/2.0/permissions/warehouses/{warehouse['id']}",
        json={"access_control_list": [{"user_name": s.EMAIL, "permission_level": "CAN_USE"}]},
    )
    print(f"warehouse {s.WAREHOUSE}: {warehouse['id']}")


def show() -> None:
    user = find_user()
    print(
        "user:     ",
        user and f"{user['userName']} {[e['value'] for e in user.get('entitlements', [])]}",
    )
    policy = find_policy()
    print(
        "policy:   ",
        policy
        and f"{policy['policy_name']} {policy['policy_id']} tags {policy.get('custom_tags')}",
    )
    try:
        schema = ws("GET", f"/api/2.1/unity-catalog/schemas/{s.SCHEMA}")
        grants = ws("GET", f"/api/2.1/unity-catalog/permissions/schema/{s.SCHEMA}")
        print(
            "schema:   ",
            schema["full_name"],
            "owner",
            schema["owner"],
            grants.get("privilege_assignments"),
        )
    except RuntimeError as error:
        print("schema:   ", None, f"({str(error).split(' -> ')[1][:3]})")
    warehouse = find_warehouse()
    print("warehouse:", warehouse and f"{warehouse['name']} {warehouse['id']} {warehouse['state']}")


def delete() -> None:
    if warehouse := find_warehouse():
        ws("DELETE", f"/api/2.0/sql/warehouses/{warehouse['id']}")
    try:
        ws("DELETE", f"/api/2.1/unity-catalog/schemas/{s.SCHEMA}", params={"force": "true"})
    except RuntimeError as error:
        print("schema:", error)
    if policy := find_policy():
        call(
            ACC,
            "DELETE",
            f"{ACC.host}/api/2.1/accounts/{s.ACCOUNT_ID}/budget-policies/{policy['policy_id']}",
        )
    if user := find_user():
        call(
            ACC,
            "PATCH",
            f"{ACCOUNT}/scim/v2/Groups/{students_group_id()}",
            json={
                "schemas": [SCIM_PATCH],
                "Operations": [{"op": "remove", "path": f'members[value eq "{user["id"]}"]'}],
            },
        )
        call(ACC, "DELETE", f"{ACCOUNT}/scim/v2/Users/{user['id']}")
    s.forget("rest")
    print("deleted")


if __name__ == "__main__":
    {"create": create, "show": show, "delete": delete}[sys.argv[1]]()
