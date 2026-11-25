# Make a volume with the Databricks Terraform provider.
#
#   cd notebooks/platform/four_ways/terraform
#   terraform init
#   terraform plan  -var profile=<profile> -var schema=<your schema>
#   terraform apply -var profile=<profile> -var schema=<your schema>
#   terraform destroy -var profile=<profile> -var schema=<your schema>
#
# Declarative like a bundle, and it reaches the account level too (workspaces,
# metastores, service principals, groups). The state file is yours to keep safe.

terraform {
  required_providers {
    databricks = {
      source = "databricks/databricks"
    }
  }
}

variable "profile" {
  type = string
}

variable "catalog" {
  type    = string
  default = "llmops_dev"
}

variable "schema" {
  type = string
}

# The same unified auth as the SDK and the CLI: a profile, environment variables or OIDC.
provider "databricks" {
  profile = var.profile
}

resource "databricks_volume" "platform_demo" {
  catalog_name = var.catalog
  schema_name  = var.schema
  name         = "platform_demo_tf"
  volume_type  = "MANAGED"
  comment      = "Platform lecture: made with Terraform"
}

output "volume" {
  value = databricks_volume.platform_demo.id
}
