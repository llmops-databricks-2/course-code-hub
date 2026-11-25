# Databricks notebook source
# Platform lecture, demo 4: two places for a secret, side by side.
#
# A workspace secret scope (one workspace, access per scope) and a Unity Catalog secret
# (catalog.schema.secret, access per secret, every read audited). Both are made, read and deleted
# here. An Azure Key Vault-backed scope is the third kind; it exists only on Azure, so it is shown
# as code at the end and not run.
import uuid

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.catalog import Secret
from databricks.sdk.service.workspace import AclPermission
from loguru import logger
from pyspark.sql import SparkSession

from arxiv_curator.config import get_env, load_config

spark = SparkSession.builder.getOrCreate()
cfg = load_config("../../project_config.yml", get_env(spark))

w = WorkspaceClient()
me = w.current_user.me().user_name
demo_value = f"not-a-real-key-{uuid.uuid4().hex[:8]}"

# COMMAND ----------

# 1. A workspace secret scope. Its creator gets MANAGE; access is granted per scope, so whoever
#    can read one secret in it can read them all.
scope = f"platform-demo-{me.split('@')[0].replace('.', '-')}"
w.secrets.create_scope(scope=scope)
w.secrets.put_secret(scope=scope, key="api-key", string_value=demo_value)
for acl in w.secrets.list_acls(scope=scope):
    logger.info(f"scope {scope}: {acl.principal} {acl.permission}")

# COMMAND ----------

# Read it. The notebook output shows [REDACTED], never the value.
print(dbutils.secrets.get(scope=scope, key="api-key"))  # noqa: F821

# A scope can be referenced from configuration, which a Unity Catalog secret cannot:
#   compute environment variable  API_KEY={{secrets/<scope>/api-key}}
#   model serving environment variable, the same syntax
#   a Databricks App resource of type secret (scope + key)

# COMMAND ----------

# Grant another principal read on the whole scope (shown, not run):
# w.secrets.put_acl(scope=scope, principal="grp-teachers-llmops", permission=AclPermission.READ)
_ = AclPermission

# COMMAND ----------

# 2. A Unity Catalog secret in your dev schema: governed like a table, per secret.
secret = w.secrets_uc.create_secret(
    Secret(
        catalog_name=cfg.catalog,
        schema_name=cfg.db_schema,
        name="platform_demo_api_key",
        value=demo_value,
        comment="Platform lecture demo: delete me",
    )
)
logger.info(f"Unity Catalog secret {secret.full_name}")
# Who can read it, and through which group: the grants API takes "secret" like any securable.
# (SHOW GRANTS ON SECRET was refused on the course's SQL warehouse on 2026-11-22:
# UC_SECRETS_NOT_ENABLED, so the API is used here.)
effective = w.grants.get_effective("secret", secret.full_name)
for assignment in effective.privilege_assignments or []:
    logger.info(
        f"{assignment.principal}: {[str(p.privilege.value) for p in assignment.privileges or []]}"
    )

# COMMAND ----------

# Read it in code (serverless environment 4 or later). Also redacted in the output.
print(dbutils.secrets.get(catalog=cfg.catalog, schema=cfg.db_schema, key="platform_demo_api_key"))  # noqa: F821

# Every read is audited:
#   SELECT event_time, user_identity.email, action_name, request_params
#   FROM system.access.audit WHERE action_name = 'getSecret' ORDER BY event_time DESC LIMIT 10

# COMMAND ----------

# 3. Clean up both.
w.secrets_uc.delete_secret(secret.full_name)
w.secrets.delete_scope(scope=scope)
logger.info("deleted the scope and the Unity Catalog secret")

# COMMAND ----------

# 4. Azure only: a Key Vault-backed scope, a read-only window on a vault you manage in Azure.
#    Vault access policies, not RBAC; access to the scope is access to every secret in the vault.
#
# from databricks.sdk.service.workspace import AzureKeyVaultSecretScopeMetadata, ScopeBackendType
# w.secrets.create_scope(
#     scope="kv-demo",
#     scope_backend_type=ScopeBackendType.AZURE_KEYVAULT,
#     backend_azure_keyvault=AzureKeyVaultSecretScopeMetadata(
#         dns_name="https://<vault-name>.vault.azure.net/",
#         resource_id="/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.KeyVault/vaults/<vault-name>",
#     ),
# )
