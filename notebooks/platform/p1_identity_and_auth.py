# Databricks notebook source
# Platform lecture, demo 1: who am I, and where does that come from?
#
# Every call to Databricks is made by an identity: a user, or a service principal.
# The identity lives in the account; the workspace only gets an assignment of it,
# with entitlements. This notebook reads both from the identity that runs it.
from databricks.sdk import WorkspaceClient
from loguru import logger

w = WorkspaceClient()

# COMMAND ----------

# Unified client authentication: the same WorkspaceClient() works in a notebook,
# on your laptop (a profile in ~/.databrickscfg), in a job and in GitHub Actions
# (DATABRICKS_AUTH_TYPE=github-oidc). Only the way it finds a credential changes.
logger.info(f"Host: {w.config.host}")
logger.info(f"Auth type: {w.config.auth_type}")

# COMMAND ----------

me = w.current_user.me()
logger.info(f"User name: {me.user_name}")
logger.info(f"Display name: {me.display_name}")
logger.info(f"Workspace id of this identity: {me.id}")

# Entitlements decide what you may do in this workspace at all:
# workspace-access (the UI), databricks-sql-access (warehouses, dashboards, Genie),
# allow-cluster-create. Since September 2026 nobody gets one implicitly.
for entitlement in me.entitlements or []:
    logger.info(f"Entitlement: {entitlement.value}")

# COMMAND ----------

# Groups carry the grants. Account groups (created in the account, assigned to the
# workspace) can hold Unity Catalog privileges; workspace-local groups cannot.
for group in me.groups or []:
    logger.info(f"Group: {group.display}")

# COMMAND ----------

# The same identity from your laptop, with the CLI:
#
#   databricks auth describe --profile <your profile>
#   databricks current-user me --profile <your profile>
#
# And from GitHub Actions, as your deploy service principal: see
# .github/workflows/whoami.yml, which prints the claims GitHub signs and
# the identity Databricks maps them to.
