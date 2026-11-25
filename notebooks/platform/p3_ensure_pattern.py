# Databricks notebook source
# Platform lecture, demo 3: the "ensure" pattern behind the course's onboarding.
#
# The onboarding that made your user, schemas, warehouse, repo and deploy service
# principals runs every day for every student. It can only do that safely because each
# step is idempotent: look the object up by its deterministic name, create it only when
# it is missing, and report what it did. Run this notebook twice and compare.
from dataclasses import dataclass

from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound
from databricks.sdk.service.catalog import VolumeType
from loguru import logger
from pyspark.sql import SparkSession

from arxiv_curator.config import get_env, load_config

spark = SparkSession.builder.getOrCreate()
cfg = load_config("../../project_config.yml", get_env(spark))

w = WorkspaceClient()

# COMMAND ----------


@dataclass
class StepResult:
    """What one ensure step did: created, adopted (found as wanted) or updated."""

    status: str
    object_id: str


def ensure_volume(
    w: WorkspaceClient, catalog: str, schema: str, name: str, comment: str
) -> StepResult:
    """Make sure the volume exists with this comment, whatever state the workspace is in."""
    full_name = f"{catalog}.{schema}.{name}"
    try:
        volume = w.volumes.read(full_name)
    except NotFound:
        volume = w.volumes.create(
            catalog_name=catalog,
            schema_name=schema,
            name=name,
            volume_type=VolumeType.MANAGED,
            comment=comment,
        )
        return StepResult("created", volume.full_name)
    if volume.comment != comment:
        # Drift: someone changed it by hand. The code is the source of truth.
        w.volumes.update(full_name, comment=comment)
        return StepResult("updated", full_name)
    return StepResult("adopted", full_name)


# COMMAND ----------

# First run: created. Second run: adopted. Change the comment in Catalog Explorer
# and run again: updated.
result = ensure_volume(
    w, cfg.catalog, cfg.db_schema, "platform_demo_ensure", "Platform lecture: ensure"
)
logger.info(f"{result.status}: {result.object_id}")

# COMMAND ----------

# Clean up when you are done:
# w.volumes.delete(f"{cfg.catalog}.{cfg.db_schema}.platform_demo_ensure")
