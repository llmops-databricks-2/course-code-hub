"""The App snapshot contains its runtime files, while the bundle keeps its other assets."""

import importlib.util
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]


def test_bundle_deploys_app_from_separate_source():
    app = yaml.safe_load((ROOT / "resources/agent_app.yml").read_text())["resources"]["apps"][
        "arxiv_agent_app"
    ]
    job = yaml.safe_load((ROOT / "resources/evaluate_deploy_app.yml").read_text())["resources"][
        "jobs"
    ]["evaluate_deploy_app"]
    assert app["source_code_path"] == "../app_deployment"
    assert (
        job["tasks"][0]["notebook_task"]["base_parameters"]["source_code_path"]
        == "${workspace.file_path}/app_deployment"
    )


def test_generated_payload_uses_current_runtime_files(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location(
        "prepare_app_deployment", ROOT / "scripts/prepare_app_deployment.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    for name in module.FILES:
        (tmp_path / name).write_text(f"current {name}")
    for name in module.DIRECTORIES:
        (tmp_path / name).mkdir()
        (tmp_path / name / "current.txt").write_text(name)
    (tmp_path / "lecture_materials").mkdir()
    (tmp_path / "tests").mkdir()
    destination = tmp_path / "app_deployment"
    (destination / "src").mkdir(parents=True)
    (destination / "src" / "stale.py").write_text("stale")
    monkeypatch.setattr(module, "ROOT", tmp_path)
    monkeypatch.setattr(module, "DESTINATION", destination)
    module.main()
    assert (destination / "src" / "current.txt").read_text() == "src"
    assert not (destination / "src" / "stale.py").exists()
    assert not (destination / "tests").exists()
    assert not (destination / "lecture_materials").exists()
    assert (destination / "project_config.yml").read_text() == "current project_config.yml"
