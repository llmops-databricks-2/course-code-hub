"""Onboard the mock student by hand with the Python SDK: create, show, delete.

    uv run python notebooks/platform/onboard_by_hand/sdk.py create
    uv run python notebooks/platform/onboard_by_hand/sdk.py show
    uv run python notebooks/platform/onboard_by_hand/sdk.py delete

Two clients, because identities and usage policies live in the account, the rest in the workspace.
The same calls the course's onboarding makes, without its lookups: run create twice and the second
run fails on the first object that exists. That is the gap the "ensure" pattern closes.
"""

import sys
import time

import mock_student as s
from databricks.sdk import AccountClient, WorkspaceClient
from databricks.sdk.errors import NotFound
from databricks.sdk.service.billing import BudgetPolicy
from databricks.sdk.service.catalog import PermissionsChange, Privilege
from databricks.sdk.service.compute import CustomPolicyTag
from databricks.sdk.service.iam import (
    ComplexValue,
    GrantRule,
    Patch,
    PatchOp,
    PatchSchema,
    RuleSetUpdateRequest,
)
from databricks.sdk.service.sql import (
    CreateWarehouseRequestWarehouseType,
    EndpointTagPair,
    EndpointTags,
    WarehouseAccessControlRequest,
    WarehousePermissionLevel,
)

w = WorkspaceClient(profile="course-express")
a = AccountClient(profile="course-account")
SCIM_PATCH = [PatchSchema.URN_IETF_PARAMS_SCIM_API_MESSAGES_2_0_PATCH_OP]


def find_user():
    """The user by the id create saved; a read may miss it for a moment after a change."""
    user_id = s.recall("sdk").get("user_id")
    for _ in range(4):
        try:
            return w.users.get(user_id) if user_id else None
        except NotFound:
            time.sleep(5)
    return None


def find_policy():
    return next((p for p in a.budget_policy.list() if p.policy_name == s.POLICY), None)


def find_warehouse():
    return next((wh for wh in w.warehouses.list() if wh.name == s.WAREHOUSE), None)


def students_group():
    return next(iter(a.groups.list(filter=f'displayName eq "{s.STUDENTS_GROUP}"')))


def create() -> None:
    # 1. The user, with explicit entitlements, then into the account group.
    user = w.users.create(
        user_name=s.EMAIL,
        display_name=s.EMAIL,
        entitlements=[ComplexValue(value=e) for e in s.ENTITLEMENTS],
    )
    join = Patch(op=PatchOp.ADD, value={"members": [{"value": user.id}]})
    a.groups.patch(id=students_group().id, operations=[join], schemas=SCIM_PATCH)
    s.remember("sdk", user_id=user.id)
    print(f"user {s.EMAIL}: {user.id}, in {s.STUDENTS_GROUP}")

    # 2. The usage policy, bound to the workspace, the student its user.
    policy = a.budget_policy.create(
        policy=BudgetPolicy(
            policy_name=s.POLICY,
            custom_tags=[CustomPolicyTag(key=k, value=v) for k, v in s.TAGS.items()],
            binding_workspace_ids=[s.WORKSPACE_ID],
        )
    )
    rule_set = f"accounts/{s.ACCOUNT_ID}/budgetPolicies/{policy.policy_id}/ruleSets/default"
    current = a.access_control.get_rule_set(name=rule_set, etag="")
    rules = [
        *(current.grant_rules or []),
        GrantRule(role=s.POLICY_USER_ROLE, principals=[f"users/{s.EMAIL}"]),
    ]
    a.access_control.update_rule_set(
        name=rule_set,
        rule_set=RuleSetUpdateRequest(name=rule_set, etag=current.etag or "", grant_rules=rules),
    )
    print(f"usage policy {s.POLICY}: {policy.policy_id}")

    # 3. The schema, the student's grants, then the admins group its owner.
    w.schemas.create(
        name=s.UC_NAME, catalog_name=s.CATALOG, comment=s.SCHEMA_COMMENT, properties=s.TAGS
    )
    w.grants.update(
        securable_type="schema",
        full_name=s.SCHEMA,
        changes=[
            PermissionsChange(principal=s.EMAIL, add=[Privilege.ALL_PRIVILEGES, Privilege.MANAGE])
        ],
    )
    w.schemas.update(full_name=s.SCHEMA, owner=s.ADMINS_GROUP)
    print(f"schema {s.SCHEMA}, owned by {s.ADMINS_GROUP}")

    # 4. The warehouse, stopped at once (creating starts it), the student CAN USE.
    warehouse = w.warehouses.create(
        name=s.WAREHOUSE,
        cluster_size="2X-Small",
        warehouse_type=CreateWarehouseRequestWarehouseType.PRO,
        enable_serverless_compute=True,
        auto_stop_mins=10,
        min_num_clusters=1,
        max_num_clusters=1,
        tags=EndpointTags(custom_tags=[EndpointTagPair(key=k, value=v) for k, v in s.TAGS.items()]),
    )
    w.warehouses.stop(id=warehouse.id)
    w.warehouses.update_permissions(
        warehouse_id=warehouse.id,
        access_control_list=[
            WarehouseAccessControlRequest(
                user_name=s.EMAIL, permission_level=WarehousePermissionLevel.CAN_USE
            )
        ],
    )
    print(f"warehouse {s.WAREHOUSE}: {warehouse.id}")


def show() -> None:
    user = find_user()
    print("user:     ", user and f"{user.user_name} {[e.value for e in user.entitlements or []]}")
    policy = find_policy()
    print(
        "policy:   ",
        policy
        and f"{policy.policy_name} {policy.policy_id} tags {[(t.key, t.value) for t in policy.custom_tags or []]}",
    )
    try:
        schema = w.schemas.get(s.SCHEMA)
        grants = w.grants.get(securable_type="schema", full_name=s.SCHEMA)
        held = [
            (g.principal, [str(p.value) for p in g.privileges or []])
            for g in grants.privilege_assignments or []
        ]
        print("schema:   ", schema.full_name, "owner", schema.owner, held)
    except Exception as error:  # NotFound once deleted
        print("schema:   ", None, f"({type(error).__name__})")
    warehouse = find_warehouse()
    print("warehouse:", warehouse and f"{warehouse.name} {warehouse.id} {warehouse.state}")


def delete() -> None:
    if warehouse := find_warehouse():
        w.warehouses.delete(id=warehouse.id)
    try:
        w.schemas.delete(s.SCHEMA, force=True)
    except Exception as error:
        print("schema:", type(error).__name__)
    if policy := find_policy():
        a.budget_policy.delete(policy_id=policy.policy_id)
    if user := find_user():
        leave = Patch(op=PatchOp.REMOVE, path=f'members[value eq "{user.id}"]')
        a.groups.patch(id=students_group().id, operations=[leave], schemas=SCIM_PATCH)
        a.users.delete(id=user.id)  # from the account, so from every workspace too
    s.forget("sdk")
    print("deleted")


if __name__ == "__main__":
    {"create": create, "show": show, "delete": delete}[sys.argv[1]]()
