# Databricks notebook source
# MAGIC %md
# MAGIC # Sync chunks to Lakebase
# MAGIC
# MAGIC Sync the existing chunks table without downloading or processing papers.

# COMMAND ----------

import time

from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound
from databricks.sdk.service.pipelines import UpdateInfoState
from databricks.sdk.service.postgres import (
    NewPipelineSpec,
    SyncedTable,
    SyncedTableState,
    SyncedTableSyncedTableSpec,
    SyncedTableSyncedTableSpecPgSpecificType,
    SyncedTableSyncedTableSpecSyncedTableSchedulingPolicy,
    SyncedTableSyncedTableSpecTypeOverride,
)
from loguru import logger
from pyspark.sql import SparkSession

from arxiv_curator.config import get_env, load_config
from arxiv_curator.vector_search import LakebasePgVectorManager

# COMMAND ----------

spark = SparkSession.builder.getOrCreate()
env = get_env(spark)
cfg = load_config("../../project_config.yml", env=env)

logger.info(f"Environment: {env}; catalog: {cfg.catalog}; schema: {cfg.schema}")

# COMMAND ----------

workspace = WorkspaceClient()
source_table = f"{cfg.catalog}.{cfg.schema}.arxiv_chunks_table"
synced_table_id = f"{cfg.catalog}.{cfg.schema}.arxiv_chunks_synced"
synced_table_name = f"synced_tables/{synced_table_id}"
update_id = None

try:
    synced_table = workspace.postgres.get_synced_table(name=synced_table_name)
except NotFound:
    # The embedding type override requires the vector extension before creation.
    pgvector = LakebasePgVectorManager(config=cfg, workspace=workspace)
    pgvector.ensure_extension()
    workspace.postgres.create_synced_table(
        synced_table=SyncedTable(
            spec=SyncedTableSyncedTableSpec(
                source_table_full_name=source_table,
                branch=f"projects/{cfg.lakebase_project_id}/branches/production",
                postgres_database="databricks_postgres",
                primary_key_columns=["id"],
                scheduling_policy=SyncedTableSyncedTableSpecSyncedTableSchedulingPolicy.TRIGGERED,
                create_database_objects_if_missing=True,
                new_pipeline_spec=NewPipelineSpec(
                    budget_policy_id=cfg.usage_policy_id,
                    storage_catalog=cfg.catalog,
                    storage_schema=cfg.schema,
                ),
                type_overrides=[
                    SyncedTableSyncedTableSpecTypeOverride(
                        column_name="embedding",
                        pg_type=SyncedTableSyncedTableSpecPgSpecificType.PG_SPECIFIC_TYPE_VECTOR,
                        size=1024,
                    )
                ],
            )
        ),
        synced_table_id=synced_table_id,
    ).wait()
    logger.info(f"Created Synced Table: {synced_table_id}; waiting for initial sync")
else:
    if not synced_table.status or not synced_table.status.pipeline_id:
        raise RuntimeError(f"No sync pipeline found for {synced_table_name}.")
    pipeline_id = synced_table.status.pipeline_id
    update_id = workspace.pipelines.start_update(pipeline_id=pipeline_id).update_id
    if not update_id:
        raise RuntimeError(f"Lakebase sync did not return an update ID for {pipeline_id}.")
    logger.info(f"Lakebase sync started: pipeline {pipeline_id}, update {update_id}")

online_states = {
    SyncedTableState.SYNCED_TABLE_ONLINE,
    SyncedTableState.SYNCED_TABLE_ONLINE_NO_PENDING_UPDATE,
}
failed_states = {
    SyncedTableState.SYNCED_TABLE_OFFLINE_FAILED,
    SyncedTableState.SYNCED_TABLE_ONLINE_PIPELINE_FAILED,
}
deadline = time.monotonic() + 30 * 60
while time.monotonic() < deadline:
    if update_id:
        update = workspace.pipelines.get_update(pipeline_id=pipeline_id, update_id=update_id).update
        if update and update.state == UpdateInfoState.COMPLETED:
            break
        if update and update.state in {UpdateInfoState.FAILED, UpdateInfoState.CANCELED}:
            raise RuntimeError(f"Lakebase sync {update_id} ended in state {update.state}.")
        logger.info(
            f"Waiting for Lakebase sync {update_id}: {update.state if update else 'pending'}"
        )
    else:
        status = workspace.postgres.get_synced_table(name=synced_table_name).status
        if status and status.detailed_state in online_states:
            break
        if status and status.detailed_state in failed_states:
            raise RuntimeError(
                f"Initial Lakebase sync failed: {status.detailed_state} | {status.message}"
            )
        logger.info(
            f"Waiting for initial Lakebase sync: {status.detailed_state if status else 'pending'}"
        )
    time.sleep(30)
else:
    raise TimeoutError(f"Lakebase sync for {synced_table_name} did not complete within 30 minutes.")

logger.info("Lakebase sync complete.")
