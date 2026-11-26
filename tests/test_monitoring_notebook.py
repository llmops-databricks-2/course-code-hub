"""Exercise the monitoring notebook without calling an app or a model."""

import runpy
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import yaml

ROOT = Path(__file__).resolve().parents[1]


def test_view_job_only_runs_view_notebook_for_target():
    resources = yaml.safe_load((ROOT / "resources/monitoring_view.yml").read_text())["resources"]
    jobs = resources["jobs"]
    task = jobs["monitoring-view"]["tasks"][0]["notebook_task"]
    assert task["notebook_path"] == "../notebooks/6.2_create_monitoring_view.py"
    assert task["base_parameters"]["env"] == "${bundle.target}"
    run = resources["job_runs"]["initialize-monitoring-view"]
    assert run["job_id"] == "${resources.jobs.monitoring-view.id}"
    assert run["lifecycle"]["triggers"] == [{"on_bundle_deploy": True}]


def test_lecture6_evaluation_is_an_optional_test_job():
    path = ROOT / "resources/testing_jobs/lecture6_monitoring.yml"
    job = yaml.safe_load(path.read_text())["resources"]["jobs"]["lecture6-monitoring"]
    notebook_path = job["tasks"][0]["notebook_task"]["notebook_path"]
    assert (
        path.parent / notebook_path
    ).resolve() == ROOT / "notebooks/6.1_monitoring_traces_and_tables.py"
    assert job["environments"][0]["spec"]["dependencies"] == ["../../dist/*.whl"]


def test_evaluates_original_traces():
    cfg = SimpleNamespace(
        catalog="llmops_dev",
        schema="arxiv",
        warehouse_id="warehouse",
        experiment_name="/Shared/dev",
        agent_app_name="app-dev",
    )
    trace = object()
    spark = MagicMock()
    spark.sql.side_effect = [
        SimpleNamespace(
            collect=lambda: [SimpleNamespace(trace_id="original-id", llm_sample=False)]
        ),
        SimpleNamespace(collect=lambda: []),
        SimpleNamespace(collect=lambda: []),
    ]

    def scorer(name):
        return SimpleNamespace(name=name)

    with (
        patch("pyspark.sql.SparkSession") as session,
        patch("arxiv_curator.config.ProjectConfig.from_yaml", return_value=cfg),
        patch("arxiv_curator.config.get_env", return_value="dev"),
        patch("arxiv_curator.config.get_widget", side_effect=lambda spark, name, default: default),
        patch("arxiv_curator.evaluation.word_count_check", scorer("word_count_check")),
        patch("arxiv_curator.evaluation.polite_tone_guideline", scorer("polite_tone")),
        patch("arxiv_curator.evaluation.hook_in_post_guideline", scorer("hook_in_post")),
        patch("mlflow.set_tracking_uri"),
        patch("mlflow.set_experiment"),
        patch("mlflow.get_trace", return_value=trace) as get_trace,
        patch("mlflow.genai.evaluate") as evaluate,
    ):
        session.builder.getOrCreate.return_value = spark
        runpy.run_path(
            str(ROOT / "notebooks/6.1_monitoring_traces_and_tables.py"),
            init_globals={"display": MagicMock()},
        )
    assert evaluate.call_args.kwargs["data"] == [trace]
    get_trace.assert_called_once_with("original-id")
    selection = spark.sql.call_args_list[0]
    assert "NOT EXISTS" in selection.args[0]
    assert selection.kwargs["args"] == {
        "app_name": "app-dev",
        "scorer_name": "word_count_check",
        "sample_threshold": 1000,
    }
    assert "pmod(xxhash64(root.trace_id), 10000)" in selection.args[0]
    assert spark.sql.call_count == 1


def test_view_notebook_creates_live_view():
    cfg = SimpleNamespace(catalog="llmops_dev", schema="arxiv", agent_app_name="app-dev")
    spark = MagicMock()
    with (
        patch("pyspark.sql.SparkSession") as session,
        patch("arxiv_curator.config.ProjectConfig.from_yaml", return_value=cfg),
        patch("arxiv_curator.config.get_env", return_value="dev"),
    ):
        session.builder.getOrCreate.return_value = spark
        runpy.run_path(
            str(ROOT / "notebooks/6.2_create_monitoring_view.py"),
            init_globals={"display": MagicMock()},
        )
    create_sql = spark.sql.call_args_list[0].args[0]
    assert "CREATE OR REPLACE VIEW" in create_sql
    assert "llmops_otel_spans" in create_sql and "llmops_otel_annotations" in create_sql
    assert "annotation_type = 'FEEDBACK'" in create_sql


def test_word_count_ignores_tool_outputs_in_responses_agent_trace():
    import json

    from arxiv_curator.evaluation import word_count_check

    response = {
        "output": [
            {"type": "function_call_output", "output": "long " * 500},
            {
                "type": "message",
                "role": "assistant",
                "content": [{"type": "output_text", "text": "Short answer"}],
            },
        ]
    }
    assert word_count_check(outputs=json.dumps(response)) is True
    response["output"][-1]["content"][0]["text"] = "word " * 350
    assert word_count_check(outputs=json.dumps(response)) is False
