# Onboard the mock student by hand with Terraform: the same four objects as sdk.py and rest.py.
#
#   cd notebooks/platform/onboard_by_hand/terraform
#   terraform init
#   terraform plan       # what would change: 9 to add
#   terraform apply      # create; run it again and it says "No changes"
#   terraform show       # what Terraform believes exists, from its state file
#   terraform destroy    # remove exactly what it made
#
# Declarative: you describe the end state and Terraform works out the calls. It remembers every id
# in terraform.tfstate (kept locally here; a team keeps it in a shared, locked backend).

terraform {
  required_providers {
    databricks = {
      source  = "databricks/databricks"
      version = "~> 1.144"
    }
  }
}

# Two providers, because users, groups and usage policies live in the account, the rest in the
# workspace. Both sign in through the same CLI profiles as everything else (unified auth).
provider "databricks" {
  alias   = "account"
  profile = "course-account"
}

provider "databricks" {
  alias   = "workspace"
  profile = "course-express"
}

locals {
  email     = "victor.kuznetsov@aarini.com"
  uc_name   = "victor_kuznetsov"
  kebab     = "victor-kuznetsov"
  cohort    = "llmops-2"
  account   = "c9f4b02f-fbae-4f55-ab1d-2cecd954b603"
  workspace = 7474650248888668
  tags      = { student = local.uc_name, cohort = local.cohort }
}

# 1. The user: an account identity, assigned to the workspace, with its entitlements, in the
#    students group.
resource "databricks_user" "student" {
  provider                 = databricks.account
  user_name                = local.email
  display_name             = local.email
  disable_as_user_deletion = false # destroy deletes the user, not only deactivates it
}

resource "databricks_mws_permission_assignment" "student" {
  provider     = databricks.account
  workspace_id = local.workspace
  principal_id = databricks_user.student.id
  permissions  = ["USER"]
}

resource "databricks_entitlements" "student" {
  provider              = databricks.workspace
  user_id               = databricks_user.student.id
  workspace_access      = true
  databricks_sql_access = true
  depends_on            = [databricks_mws_permission_assignment.student]
}

data "databricks_group" "students" {
  provider     = databricks.account
  display_name = "grp-students-llmops"
}

resource "databricks_group_member" "student" {
  provider  = databricks.account
  group_id  = data.databricks_group.students.id
  member_id = databricks_user.student.id
}

# 2. The usage policy, bound to the workspace, the student its user.
resource "databricks_budget_policy" "student" {
  provider              = databricks.account
  policy_name           = "pol-llmops-${local.kebab}"
  binding_workspace_ids = [local.workspace]
  custom_tags           = [for k, v in local.tags : { key = k, value = v }]
}

resource "databricks_access_control_rule_set" "policy_user" {
  provider = databricks.account
  name     = "accounts/${local.account}/budgetPolicies/${databricks_budget_policy.student.policy_id}/ruleSets/default"
  grant_rules {
    principals = [databricks_user.student.acl_principal_id]
    role       = "roles/budgetPolicy.user"
  }
}

# 3. The schema, owned by the admins group, the student's grants on it.
resource "databricks_schema" "student" {
  provider      = databricks.workspace
  catalog_name  = "llmops_dev"
  name          = local.uc_name
  comment       = "The development schema of student ${local.uc_name}: the student manages it and works in it."
  properties    = local.tags
  owner         = "grp-admins-llmops"
  force_destroy = true
}

resource "databricks_grant" "student_schema" {
  provider   = databricks.workspace
  schema     = databricks_schema.student.id
  principal  = local.email
  privileges = ["ALL_PRIVILEGES", "MANAGE"]
  depends_on = [databricks_mws_permission_assignment.student]
}

# 4. The warehouse and the student's CAN_USE. Terraform cannot stop it after the create; the
#    10-minute auto-stop does.
resource "databricks_sql_endpoint" "student" {
  provider                  = databricks.workspace
  name                      = "wh-llmops-${local.kebab}"
  cluster_size              = "2X-Small"
  warehouse_type            = "PRO"
  enable_serverless_compute = true
  auto_stop_mins            = 10
  min_num_clusters          = 1
  max_num_clusters          = 1
  tags {
    dynamic "custom_tags" {
      for_each = local.tags
      content {
        key   = custom_tags.key
        value = custom_tags.value
      }
    }
  }
}

resource "databricks_permissions" "student_warehouse" {
  provider        = databricks.workspace
  sql_endpoint_id = databricks_sql_endpoint.student.id
  access_control {
    user_name        = local.email
    permission_level = "CAN_USE"
  }
  depends_on = [databricks_entitlements.student]
}

output "ids" {
  value = {
    user      = databricks_user.student.id
    policy    = databricks_budget_policy.student.policy_id
    schema    = databricks_schema.student.id
    warehouse = databricks_sql_endpoint.student.id
  }
}
