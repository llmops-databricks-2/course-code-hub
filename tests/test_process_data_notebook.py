"""Run the deployment notebook with mocked Spark, Databricks, and Lakebase clients.

Run locally with: uv run pytest
No credentials, network calls, database writes, or real sleeps are required.
"""

import runpy
from contextlib import ExitStack
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from databricks.sdk.errors import NotFound, PermissionDenied
from databricks.sdk.service.pipelines import UpdateInfoState
from databricks.sdk.service.postgres import (
    SyncedTableState,
    SyncedTableSyncedTableSpecPgSpecificType,
    SyncedTableSyncedTableSpecSyncedTableSchedulingPolicy,
)

SCRIPTS = Path(__file__).resolve().parents[1] / "resources/deployment_scripts"


@pytest.fixture
def pipeline():
    with ExitStack() as patches:
        pipeline = SimpleNamespace()
        pipeline.workspace = MagicMock()
        pipeline.spark_class = patches.enter_context(patch("pyspark.sql.SparkSession"))
        patches.enter_context(
            patch("databricks.sdk.WorkspaceClient", return_value=pipeline.workspace)
        )
        pipeline.processor = patches.enter_context(
            patch("arxiv_curator.data_processor.DataProcessor")
        ).return_value
        pipeline.pgvector = patches.enter_context(
            patch("arxiv_curator.vector_search.LakebasePgVectorManager")
        ).return_value
        pipeline.cfg = SimpleNamespace(
            catalog="catalog",
            schema="schema",
            volume="arxiv_files",
            lakebase_project_id="project",
            usage_policy_id="policy",
        )
        patches.enter_context(patch("arxiv_curator.config.get_env", return_value="dev"))
        patches.enter_context(patch("arxiv_curator.config.load_config", return_value=pipeline.cfg))
        pipeline.sleep = patches.enter_context(patch("time.sleep"))
        pipeline.clock = patches.enter_context(patch("time.monotonic", return_value=0))
        pipeline.workspace.postgres.get_synced_table.return_value = table()
        pipeline.workspace.pipelines.start_update.return_value.update_id = "update-1"
        pipeline.workspace.pipelines.get_update.return_value.update.state = (
            UpdateInfoState.COMPLETED
        )
        yield pipeline


def table(state=SyncedTableState.SYNCED_TABLE_ONLINE, pipeline_id="pipeline-1"):
    return SimpleNamespace(
        status=SimpleNamespace(detailed_state=state, pipeline_id=pipeline_id, message="test")
    )


def run_notebook(name="sync_lakebase.py"):
    runpy.run_path(str(SCRIPTS / name))


def test_existing_table_syncs_without_processing_and_waits_for_exact_update(pipeline):
    pipeline.workspace.pipelines.get_update.side_effect = [
        SimpleNamespace(update=SimpleNamespace(state=UpdateInfoState.RUNNING)),
        SimpleNamespace(update=SimpleNamespace(state=UpdateInfoState.COMPLETED)),
    ]
    run_notebook()
    pipeline.processor.process_and_save.assert_not_called()
    pipeline.workspace.postgres.create_synced_table.assert_not_called()
    pipeline.workspace.pipelines.start_update.assert_called_once_with(pipeline_id="pipeline-1")
    for call in pipeline.workspace.pipelines.get_update.call_args_list:
        assert call.kwargs == {"pipeline_id": "pipeline-1", "update_id": "update-1"}
    assert pipeline.workspace.pipelines.get_update.call_count == 2
    pipeline.sleep.assert_called_once_with(30)


def test_missing_table_enables_extension_creates_table_and_waits_for_initial_sync(pipeline):
    pipeline.workspace.postgres.get_synced_table.side_effect = [
        NotFound("missing"),
        SimpleNamespace(status=None),
        table(),
    ]
    create = pipeline.workspace.postgres.create_synced_table
    create.side_effect = lambda **kwargs: (
        pipeline.pgvector.ensure_extension.assert_called_once() or MagicMock()
    )
    run_notebook()
    create.assert_called_once()
    args = create.call_args.kwargs
    assert args["synced_table_id"] == "catalog.schema.arxiv_chunks_synced"
    spec = args["synced_table"].spec
    assert spec.source_table_full_name == "catalog.schema.arxiv_chunks_table"
    assert spec.branch == "projects/project/branches/production"
    assert spec.postgres_database == "databricks_postgres"
    assert spec.primary_key_columns == ["id"]
    assert spec.scheduling_policy == SyncedTableSyncedTableSpecSyncedTableSchedulingPolicy.TRIGGERED
    assert spec.create_database_objects_if_missing
    assert spec.new_pipeline_spec.budget_policy_id == "policy"
    assert spec.new_pipeline_spec.storage_catalog == "catalog"
    assert spec.new_pipeline_spec.storage_schema == "schema"
    assert spec.type_overrides[0].column_name == "embedding"
    assert spec.type_overrides[0].size == 1024
    assert (
        spec.type_overrides[0].pg_type
        == SyncedTableSyncedTableSpecPgSpecificType.PG_SPECIFIC_TYPE_VECTOR
    )
    pipeline.workspace.pipelines.start_update.assert_not_called()
    pipeline.sleep.assert_called_once_with(30)


def test_initial_sync_failure_is_reported(pipeline):
    pipeline.workspace.postgres.get_synced_table.side_effect = [
        NotFound("missing"),
        table(SyncedTableState.SYNCED_TABLE_OFFLINE_FAILED),
    ]
    with pytest.raises(RuntimeError, match="Initial Lakebase sync failed"):
        run_notebook()


@pytest.mark.parametrize("state", (UpdateInfoState.FAILED, UpdateInfoState.CANCELED))
def test_failed_or_canceled_update_is_reported(pipeline, state):
    pipeline.workspace.pipelines.get_update.return_value.update.state = state
    with pytest.raises(RuntimeError, match="ended in state"):
        run_notebook()


def test_pending_sync_times_out(pipeline):
    pipeline.clock.side_effect = [0, 0, 1801]
    pipeline.workspace.pipelines.get_update.return_value.update.state = UpdateInfoState.RUNNING
    with pytest.raises(TimeoutError, match="30 minutes"):
        run_notebook()
    pipeline.sleep.assert_called_once_with(30)


def test_initial_sync_times_out(pipeline):
    pipeline.clock.side_effect = [0, 0, 1801]
    pipeline.workspace.postgres.get_synced_table.side_effect = [
        NotFound("missing"),
        SimpleNamespace(status=None),
    ]
    with pytest.raises(TimeoutError, match="30 minutes"):
        run_notebook()


def test_missing_pipeline_is_reported(pipeline):
    pipeline.workspace.postgres.get_synced_table.return_value = table(pipeline_id=None)
    with pytest.raises(RuntimeError, match="No sync pipeline"):
        run_notebook()
    pipeline.workspace.pipelines.start_update.assert_not_called()


def test_missing_update_id_is_reported(pipeline):
    pipeline.workspace.pipelines.start_update.return_value.update_id = None
    with pytest.raises(RuntimeError, match="did not return an update ID"):
        run_notebook()
    pipeline.workspace.pipelines.get_update.assert_not_called()


def test_permission_error_does_not_attempt_table_creation(pipeline):
    pipeline.workspace.postgres.get_synced_table.side_effect = PermissionDenied("denied")
    with pytest.raises(PermissionDenied):
        run_notebook()
    pipeline.workspace.postgres.create_synced_table.assert_not_called()


def test_storage_is_provisioned_before_processing(pipeline):
    spark = pipeline.spark_class.builder.getOrCreate.return_value

    def check_storage():
        assert [call.args[0] for call in spark.sql.call_args_list] == [
            "CREATE SCHEMA IF NOT EXISTS catalog.schema",
            "CREATE VOLUME IF NOT EXISTS catalog.schema.arxiv_files",
        ]

    pipeline.processor.process_and_save.side_effect = check_storage
    run_notebook("process_data.py")
    pipeline.workspace.postgres.get_synced_table.assert_not_called()


def test_processing_failure_prevents_sync(pipeline):
    pipeline.processor.process_and_save.side_effect = RuntimeError("processing failed")
    with pytest.raises(RuntimeError, match="processing failed"):
        run_notebook("process_data.py")
    pipeline.workspace.postgres.get_synced_table.assert_not_called()


def test_sync_task_depends_on_processing():
    import yaml

    job = yaml.safe_load((SCRIPTS.parent / "process_data.yml").read_text())
    tasks = {task["task_key"]: task for task in job["resources"]["jobs"]["data-pipeline"]["tasks"]}
    assert tasks["sync_lakebase"]["depends_on"] == [{"task_key": "process_data"}]
    assert (
        tasks["sync_lakebase"]["notebook_task"]["notebook_path"]
        == "deployment_scripts/sync_lakebase.py"
    )
