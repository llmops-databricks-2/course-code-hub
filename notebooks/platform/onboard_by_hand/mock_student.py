"""The mock student of the platform lecture, named exactly as the onboarding names a real one.

The onboarding derives every name from the address (course-assistant, contract/naming.py):
victor.kuznetsov@aarini.com -> uc_name victor_kuznetsov, kebab victor-kuznetsov. The values of
the cohort (account, workspace, groups, warehouse shape) come from cohorts/llmops-2/cohort.yml.
"""

import json
from pathlib import Path

EMAIL = "victor.kuznetsov@aarini.com"
UC_NAME = "victor_kuznetsov"
KEBAB = "victor-kuznetsov"

COHORT = "llmops-2"
ACCOUNT_ID = "c9f4b02f-fbae-4f55-ab1d-2cecd954b603"
WORKSPACE_ID = 7474650248888668

STUDENTS_GROUP = "grp-students-llmops"
ADMINS_GROUP = "grp-admins-llmops"
ENTITLEMENTS = ["workspace-access", "databricks-sql-access"]

CATALOG = "llmops_dev"
SCHEMA = f"{CATALOG}.{UC_NAME}"
SCHEMA_COMMENT = (
    f"The development schema of student {UC_NAME}: the student manages it and works in it."
)
POLICY = f"pol-llmops-{KEBAB}"
WAREHOUSE = f"wh-llmops-{KEBAB}"
TAGS = {"student": UC_NAME, "cohort": COHORT}

POLICY_USER_ROLE = "roles/budgetPolicy.user"


# What the hand-made scripts created, by id: a hand-made "state file". Identity search lags a create
# or a delete by a minute or two, so finding the user again by name is unreliable; remembering its
# id is what Terraform's state does for every object.
def state_file(tool: str) -> Path:
    return Path(__file__).with_name(f".state-{tool}.json")


def remember(tool: str, **ids: str) -> None:
    state_file(tool).write_text(json.dumps({**recall(tool), **ids}, indent=2))


def recall(tool: str) -> dict[str, str]:
    path = state_file(tool)
    return json.loads(path.read_text()) if path.exists() else {}


def forget(tool: str) -> None:
    state_file(tool).unlink(missing_ok=True)
