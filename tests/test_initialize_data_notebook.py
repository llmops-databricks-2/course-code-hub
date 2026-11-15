"""Verify Genie initialization without contacting Spark or Databricks."""

import ast
import re
import runpy
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
import yaml
from pyspark.sql import types as T

ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK = ROOT / "resources/deployment_scripts/initialize_data.py"


@pytest.fixture
def statements():
    spark = MagicMock()
    cfg = SimpleNamespace(catalog="test_catalog", schema="test_schema")
    with (
        patch("pyspark.sql.SparkSession") as session,
        patch("arxiv_curator.config.get_env", return_value="dev"),
        patch("arxiv_curator.config.load_config", return_value=cfg),
    ):
        session.builder.getOrCreate.return_value = spark
        runpy.run_path(str(NOTEBOOK))
    return [call.args[0] for call in spark.sql.call_args_list]


def test_only_creates_missing_schema_and_table(statements):
    assert len(statements) == 2
    assert statements[0] == "CREATE SCHEMA IF NOT EXISTS test_catalog.test_schema"
    assert re.search(
        "CREATE TABLE IF NOT EXISTS test_catalog\\.test_schema\\.arxiv_papers", statements[1]
    )
    assert statements[1].strip().endswith("USING DELTA")
    assert not re.search(
        "\\b(DROP|TRUNCATE|REPLACE|INSERT|DELETE)\\b", " ".join(statements).upper()
    )


def test_table_types_match_actual_processor_schema(statements):
    tree = ast.parse((ROOT / "src/arxiv_curator/data_processor.py").read_text())
    method = next(
        (
            node
            for node in ast.walk(tree)
            if isinstance(node, ast.FunctionDef) and node.name == "download_and_store_papers"
        )
    )
    schema_assignment = next(
        (
            node
            for node in method.body
            if isinstance(node, ast.Assign)
            and any(
                (isinstance(target, ast.Name) and target.id == "schema" for target in node.targets)
            )
        )
    )
    schema = eval(compile(ast.Expression(schema_assignment.value), "<schema>", "eval"), {"T": T})
    schema.add(T.StructField("ingest_ts", T.TimestampType()))
    ddl = statements[1]
    columns = re.search("\\((.*)\\)\\s*USING DELTA", ddl, re.S).group(1)
    actual = {}
    for column in columns.split(","):
        name, data_type, *constraints = column.split()
        actual[name] = (data_type.lower(), constraints != ["NOT", "NULL"])
    expected = {field.name: (field.dataType.simpleString(), field.nullable) for field in schema}
    assert actual == expected


def test_genie_depends_on_initialization_and_not_ingestion():
    init = yaml.safe_load((ROOT / "resources/initialize_data.yml").read_text())["resources"]
    genie = yaml.safe_load((ROOT / "resources/genie_space.yml").read_text())
    space = genie["resources"]["genie_spaces"]["arxiv-curator-space"]
    assert space["lifecycle"]["depends_on"] == [{"resource": "job_runs.initialize-tables"}]
    assert init["job_runs"]["initialize-tables"]["job_id"] == "${resources.jobs.initialize-data.id}"
    assert (
        init["jobs"]["initialize-data"]["tasks"][0]["notebook_task"]["notebook_path"]
        == "deployment_scripts/initialize_data.py"
    )
    ingestion = yaml.safe_load((ROOT / "resources/process_data.yml").read_text())
    assert "job_runs" not in ingestion["resources"]
