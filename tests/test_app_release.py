import runpy
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
import yaml
from databricks.sdk.service.apps import ComputeState

ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize("failure", [None, "evaluation", "grants", "invocation", "status", "bundle"])
def test_release_orders_deployment_and_stops_app(failure, capsys):
    workspace, caller, client = MagicMock(), MagicMock(), MagicMock()
    workspace.apps.get.return_value.compute_status.state = ComputeState.STOPPED if failure == "bundle" else ComputeState.ACTIVE
    workspace.apps.get.return_value.url = "https://example.databricksapps.com"
    caller.config.oauth_token.return_value.access_token = "test-oauth-token"
    raw_response = client.responses.with_raw_response.create.return_value
    raw_response.status_code = 202 if failure == "status" else 200
    raw_response.parse.return_value.output_text = "Papers about reasoning."
    if failure == "invocation":
        client.responses.with_raw_response.create.side_effect = RuntimeError("invocation failed")
    cfg = SimpleNamespace(catalog="catalog", schema="schema", agent_app_name="test-app", experiment_name="experiment", warehouse_id="warehouse")
    dbutils = MagicMock()
    dbutils.widgets.get.side_effect = {
        "env": "acc", "genie_space_id": "genie-id"
    }.__getitem__
    with (
        patch("databricks.sdk.WorkspaceClient", side_effect=[workspace, caller]),
        patch("openai.OpenAI", return_value=client),
        patch("arxiv_curator.config.ProjectConfig.from_yaml", return_value=cfg),
        patch("mlflow.set_experiment"),
        patch("arxiv_curator.evaluation.evaluate_agent") as evaluate,
        patch("arxiv_curator.app_permissions.grant_app_secret_access") as grant,
        patch("subprocess.run") as bundle_run,

    ):
        if failure == "bundle":
            bundle_run.side_effect = RuntimeError("bundle failed")
        if failure == "evaluation":
            evaluate.side_effect = RuntimeError("evaluation failed")
        if failure == "grants":
            grant.side_effect = RuntimeError("grants failed")
        if failure:
            with pytest.raises(RuntimeError, match="Expected HTTP 200" if failure == "status" else f"{failure} failed"):
                runpy.run_path(str(ROOT / "resources/deployment_scripts/evaluate_deploy_app.py"), init_globals={"dbutils": dbutils})
        else:
            runpy.run_path(str(ROOT / "resources/deployment_scripts/evaluate_deploy_app.py"), init_globals={"dbutils": dbutils})
    if failure is None:
        output = capsys.readouterr().out
        assert "HTTP status: 200" in output
        assert "Papers about reasoning." in output
    evaluate.assert_called_once_with(cfg, eval_inputs_path="../../eval_inputs.txt")
    if failure == "evaluation":
        grant.assert_not_called()
    else:
        grant.assert_called_once_with(workspace, "catalog", "schema", workspace.apps.get.return_value.service_principal_client_id)
    if failure in ("evaluation", "grants"):
        bundle_run.assert_not_called()
        workspace.apps.deploy_and_wait.assert_not_called()
        return
    bundle_run.assert_called_once_with(
        ["databricks", "bundle", "run", "arxiv_agent_app", "--target", "acc"],
        cwd="../..", check=True,
    )
    if failure == "bundle":
        workspace.apps.stop_and_wait.assert_not_called()
    else:
        workspace.apps.stop_and_wait.assert_called_once_with(name="test-app")
    workspace.apps.deploy_and_wait.assert_not_called()


def test_production_waits_for_acceptance_and_target_selects_environment():
    cd = yaml.safe_load((ROOT / ".github/workflows/cd.yml").read_text())
    assert set(cd["jobs"]) == {"acc", "prd"}
    assert cd["jobs"]["prd"]["needs"] == "acc"
    for target in ("acc", "prd"):
        assert cd["jobs"][target]["uses"] == "./.github/workflows/deploy-environment.yml"
        assert cd["jobs"][target]["with"]["target"] == target
    deploy = yaml.safe_load((ROOT / ".github/workflows/deploy-environment.yml").read_text())["jobs"]["deploy"]
    assert deploy["environment"] == "${{ inputs.target }}"
    job = yaml.safe_load((ROOT / "resources/evaluate_deploy_app.yml").read_text())["resources"]["jobs"]["evaluate_deploy_app"]
    assert len(job["tasks"]) == 1
    assert job["tasks"][0]["notebook_task"]["notebook_path"] == "deployment_scripts/evaluate_deploy_app.py"
    assert "bundle run evaluate_deploy_app" in deploy["steps"][-1]["run"]
