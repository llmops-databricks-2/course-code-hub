# Databricks notebook source
# Platform lecture, demo 2: a tour of Unity Catalog from your own seat.
#
# Metastore -> catalog -> schema -> table / volume / model / function.
# Privileges are granted on any level and inherited downwards. This notebook
# reads what you can do in each environment's schema, and where each right comes from.
from databricks.sdk import WorkspaceClient
from loguru import logger
from pyspark.sql import SparkSession

from arxiv_curator.config import get_env, load_config

spark = SparkSession.builder.getOrCreate()
cfg = load_config("../../project_config.yml", get_env(spark))
# The same project in each environment: one catalog per environment, the same schema name.
configs = {env: load_config("../../project_config.yml", env) for env in ("dev", "acc", "prd")}

w = WorkspaceClient()
me = w.current_user.me().user_name

# COMMAND ----------

# One metastore per region; the workspace is attached to exactly one.
metastore = w.metastores.current()
logger.info(f"Metastore: {metastore.metastore_id}")
logger.info(f"Default catalog of this workspace: {metastore.default_catalog_name}")

# COMMAND ----------

# The course keeps one catalog per environment. A catalog in ISOLATED mode is
# reachable only from the workspaces it is bound to; OPEN means every workspace
# attached to the metastore.
for env_cfg in configs.values():
    info = w.catalogs.get(env_cfg.catalog)
    logger.info(f"{info.name}: owner {info.owner}, isolation {info.isolation_mode}")

# COMMAND ----------

# Effective privileges: yours on your schema in each environment, and where each one
# is inherited from. Expect write rights in dev and read-only rights in acc and prd:
# there, only your deploy service principal writes.
for env_cfg in configs.values():
    full_name = f"{env_cfg.catalog}.{env_cfg.db_schema}"
    effective = w.grants.get_effective("schema", full_name, principal=me)
    for assignment in effective.privilege_assignments or []:
        for privilege in assignment.privileges or []:
            source = privilege.inherited_from_name or "granted here"
            logger.info(f"{full_name}: {privilege.privilege} ({source})")

# COMMAND ----------

# The same question in SQL. SHOW GRANTS lists what is granted on the object itself,
# to anyone; the effective call above adds what you inherit through groups and parents.
display(spark.sql(f"SHOW GRANTS ON SCHEMA {cfg.catalog}.{cfg.db_schema}"))
