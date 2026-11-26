"""Verify multi-environment experiment setup without accessing Databricks."""

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from databricks.sdk.service.catalog import TableType
from mlflow.entities.trace_location import UnityCatalog

NOTEBOOK = Path(__file__).resolve().parents[1] / "notebooks/4.0.uc_traces_setup.py"


@pytest.fixture
def tracing():
    configs = {
        env: SimpleNamespace(
            experiment_name=f"/Shared/agent-{env}-uc",
            catalog=f"catalog_{env}",
            schema="arxiv",
            warehouse_id="warehouse",
        )
        for env in ("dev", "acc", "prd")
    }
    with (
        patch("arxiv_curator.config.load_config", side_effect=lambda path, env: configs[env]),
        patch("pyspark.sql.SparkSession") as session,
        patch("databricks.sdk.WorkspaceClient") as workspace,
        patch("mlflow.get_experiment_by_name") as get_experiment,
        patch("mlflow.set_experiment") as set_experiment,
    ):
        workspace.return_value.tables.list.return_value = [
            SimpleNamespace(name="llmops_otel_spans", table_type=TableType.MANAGED),
            SimpleNamespace(name="llmops_otel_metadata", table_type=TableType.VIEW),
            SimpleNamespace(name="arxiv_papers", table_type=TableType.MANAGED),
        ]
        dbutils = MagicMock()
        dbutils.secrets.get.side_effect = lambda **kwargs: f"sp-{kwargs['catalog']}"
        set_experiment.side_effect = lambda **kwargs: SimpleNamespace(
            name=kwargs.get("experiment_name", "existing"), experiment_id="123"
        )
        yield SimpleNamespace(
            configs=configs,
            spark=session.builder.getOrCreate.return_value,
            workspace=workspace.return_value,
            get=get_experiment,
            set=set_experiment,
            dbutils=dbutils,
        )


def run_notebook(tracing):
    exec(compile(NOTEBOOK.read_text(), str(NOTEBOOK), "exec"), {"dbutils": tracing.dbutils})


def test_creates_each_environment_and_grants_its_principal(tracing):
    tracing.get.return_value = None
    run_notebook(tracing)
    assert tracing.set.call_count == 3
    statements = [call.args[0] for call in tracing.spark.sql.call_args_list]
    for env, cfg in tracing.configs.items():
        call = next(
            c
            for c in tracing.set.call_args_list
            if c.kwargs["experiment_name"] == cfg.experiment_name
        )
        location = call.kwargs["trace_location"]
        assert (location.catalog_name, location.schema_name, location.table_prefix) == (
            cfg.catalog,
            "arxiv",
            "llmops",
        )
        principal = f"sp-{cfg.catalog}"
        assert f"GRANT USE CATALOG ON CATALOG `{cfg.catalog}` TO `{principal}`" in statements
        assert f"GRANT USE SCHEMA ON SCHEMA `{cfg.catalog}`.`arxiv` TO `{principal}`" in statements
        assert (
            f"GRANT SELECT, MODIFY ON TABLE `{cfg.catalog}`.`arxiv`.`llmops_otel_spans` TO `{principal}`"
            in statements
        )
        assert (
            f"GRANT SELECT ON TABLE `{cfg.catalog}`.`arxiv`.`llmops_otel_metadata` TO `{principal}`"
            in statements
        )
    assert len(statements) == 12


def test_existing_uc_experiments_are_reused(tracing):
    def existing(name):
        cfg = next(c for c in tracing.configs.values() if c.experiment_name == name)
        return SimpleNamespace(
            experiment_id="123", trace_location=UnityCatalog(cfg.catalog, cfg.schema, "llmops")
        )

    tracing.get.side_effect = existing
    run_notebook(tracing)
    assert tracing.set.call_count == 3
    assert all(call.kwargs == {"experiment_id": "123"} for call in tracing.set.call_args_list)


def test_incompatible_experiment_is_reported_without_blocking_other_environments(tracing):
    tracing.get.side_effect = lambda name: (
        SimpleNamespace(trace_location=None) if name.endswith("dev-uc") else None
    )
    with pytest.raises(RuntimeError, match="dev:.*different trace location"):
        run_notebook(tracing)
    assert [c.kwargs["experiment_name"] for c in tracing.set.call_args_list] == [
        tracing.configs["acc"].experiment_name,
        tracing.configs["prd"].experiment_name,
    ]
