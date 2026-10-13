# Databricks notebook source
# /// script
# dependencies = [
#   "..",
# ]
# [tool.databricks.environment]
# environment_version = "5"
# ///
# MAGIC %md
# MAGIC # Lecture 1.5: External Models Through the AI Gateway
# MAGIC
# MAGIC Lecture 1.4 creates a serving endpoint for an external model and reads the OpenAI key from
# MAGIC a secret scope. This notebook shows the **gateway form** of the same idea: two governed Unity
# MAGIC Catalog objects that the course's bundle deploys (`resources/gateway_demo.yml`):
# MAGIC
# MAGIC - a **model provider service**, `course_ops.gateway.openai`, which holds the OpenAI key *by
# MAGIC   reference* to the Unity Catalog secret `course_ops.secrets.openai_api_key` and lists the
# MAGIC   models it may route to (`gpt-4o-mini`);
# MAGIC - a **model service**, `course_ops.gateway.openai_demo`, the name you call, which routes to
# MAGIC   that provider service, with a rate limit.
# MAGIC
# MAGIC You never see the key. You authenticate to Databricks, and the gateway calls OpenAI with the
# MAGIC key of the provider service. The call is traced in MLflow and recorded in
# MAGIC `system.ai_gateway.usage`. Running this notebook creates no gateway object and no token.
# MAGIC
# MAGIC The notebook's serverless environment is declared at the top of this file, in the inline
# MAGIC [PEP 723](https://peps.python.org/pep-0723/) block the notebook format reads: environment
# MAGIC version 5 and one dependency, `..`, the course project itself (`pyproject.toml`, one folder
# MAGIC up from `notebooks/`), so `arxiv_curator`, `loguru` and the pinned `openai` are installed when
# MAGIC the notebook opens, on the laptop's deploy as on a teacher's. No install cell, no job.
# MAGIC
# MAGIC **Checked: October 13, 2026 (AWS).** See
# MAGIC [model provider services](https://docs.databricks.com/aws/en/ai-gateway/model-provider-services)
# MAGIC and [query model services](https://docs.databricks.com/aws/en/ai-gateway/query-model-services).

# COMMAND ----------

import os

import mlflow
from databricks.sdk import WorkspaceClient
from loguru import logger
from openai import APIStatusError, OpenAI
from pyspark.dbutils import DBUtils
from pyspark.sql import SparkSession

from arxiv_curator.config import get_env, load_config

# COMMAND ----------

# MAGIC %md
# MAGIC ## 1. Parameters
# MAGIC
# MAGIC `model_service` is the fully qualified name of the model service to call. The default is the
# MAGIC demonstration service; `course_ops.gateway.chat`, the course's own chat service, works the same
# MAGIC way. `experiment_name` is the MLflow experiment that receives the trace, and
# MAGIC `tracing_warehouse_id` the SQL warehouse MLflow reads Unity Catalog traces through. Their
# MAGIC defaults are yours: the onboarding registered your experiment, `/llmops/<your uc_name>`, whose
# MAGIC traces live in Unity Catalog trace tables in your schema, the way the course monitors every
# MAGIC student's traces, and your warehouse, `wh-llmops-<you>`; the notebook reads both from
# MAGIC `course_ops.registry.students` through the row that is yours (`registry.identities`). A user
# MAGIC the registry does not know, a teacher signed in under another address, gets the deploying
# MAGIC teacher's two values written below; change them to yours. With a trace table as the
# MAGIC destination, the inline trace viewer under the cell and `mlflow.get_trace` need the
# MAGIC warehouse; without one the trace is still written and shown on the experiment's Traces page.
# MAGIC The course's shared experiment from `project_config.yml` keeps its traces in the workspace
# MAGIC tracking server instead, and MLflow prints a hint to migrate them when you use it.
# MAGIC
# MAGIC To call a model service you need `EXECUTE` on it, plus `USE CATALOG` on `course_ops` and
# MAGIC `USE SCHEMA` on `course_ops.gateway`. A model service runs with its owner's privileges, so you
# MAGIC need nothing on the provider service and nothing on the secret.
# MAGIC
# MAGIC **Run it as a teacher, in the workspace.** The demonstration service grants `EXECUTE` to the
# MAGIC teachers only, and reading `system.ai_gateway.usage` needs `SELECT` on it, which the course
# MAGIC does not grant to students: a student sees the permission errors, not the answer. Off the
# MAGIC workspace (Databricks Connect), the trace would go to a local `mlruns` folder instead.

# COMMAND ----------

spark = SparkSession.builder.getOrCreate()
dbutils = DBUtils(spark)

env = get_env(spark)
cfg = load_config("../project_config.yml", env)

# The deploying teacher's experiment and warehouse, the defaults for a user the registry does not
# know; everyone the registry knows gets their own row's values.
TEACHER_EXPERIMENT = "/llmops/victor_kuznetsov"
TEACHER_WAREHOUSE_ID = "992f5f04071d814b"


def my_registry_row() -> tuple[str, str]:
    """The current user's experiment path and warehouse id from the registry, else the teacher's."""
    try:
        row = spark.sql(
            "SELECT s.experiment_path, s.warehouse_id "
            "FROM course_ops.registry.students AS s "
            "JOIN course_ops.registry.identities AS i ON i.uc_name = s.uc_name "
            "WHERE i.identity = current_user() LIMIT 1"
        ).first()
    except Exception as error:  # noqa: BLE001 - no read on the registry is not an error here
        logger.warning(f"Registry not readable ({type(error).__name__}); the teacher's defaults apply")
        row = None
    if row is None or not row.experiment_path:
        return TEACHER_EXPERIMENT, TEACHER_WAREHOUSE_ID
    return row.experiment_path, row.warehouse_id or ""


DEFAULT_EXPERIMENT, DEFAULT_WAREHOUSE_ID = my_registry_row()

dbutils.widgets.text("model_service", "course_ops.gateway.openai_demo")
dbutils.widgets.text("experiment_name", DEFAULT_EXPERIMENT)
dbutils.widgets.text("tracing_warehouse_id", DEFAULT_WAREHOUSE_ID)
MODEL_SERVICE = dbutils.widgets.get("model_service")
EXPERIMENT_NAME = dbutils.widgets.get("experiment_name")
TRACING_WAREHOUSE_ID = dbutils.widgets.get("tracing_warehouse_id").strip()

logger.info(f"Environment: {env}")
logger.info(f"Model service: {MODEL_SERVICE}")
logger.info(f"MLflow experiment: {EXPERIMENT_NAME}")
logger.info(f"Tracing warehouse: {TRACING_WAREHOUSE_ID or 'none (traces read on the experiment page)'}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. Trace Every Call
# MAGIC
# MAGIC `mlflow.openai.autolog()` records each call of the OpenAI client as a trace in the experiment:
# MAGIC the request, the response or the error, and the model service name as the span's `model`.
# MAGIC When the experiment's traces live in Unity Catalog tables, MLflow reads them back through a
# MAGIC SQL warehouse, named by `MLFLOW_TRACING_SQL_WAREHOUSE_ID`; the write needs none. The variable
# MAGIC is set here only when you gave `tracing_warehouse_id`, before the first trace.

# COMMAND ----------

if TRACING_WAREHOUSE_ID:
    os.environ["MLFLOW_TRACING_SQL_WAREHOUSE_ID"] = TRACING_WAREHOUSE_ID

mlflow.set_experiment(EXPERIMENT_NAME)
mlflow.openai.autolog()

# COMMAND ----------

# MAGIC %md
# MAGIC ## 3. Call the Model Service
# MAGIC
# MAGIC The OpenAI client points at the workspace's AI Gateway, `/ai-gateway/mlflow/v1`, and `model`
# MAGIC is the model service's name. The workspace client authenticates you to Databricks: its token is
# MAGIC sent to the gateway, never to OpenAI, and no new token is created.
# MAGIC
# MAGIC Lectures 1.1 and 1.2 use the Unified Responses API. The provider service of the
# MAGIC demonstration lists only the OpenAI Chat Completions API (`openai/v1/chat/completions`) for its
# MAGIC model, so this call uses `chat.completions`, which `course_ops.gateway.chat` answers too.
# MAGIC
# MAGIC A reasoning model (such as GPT OSS behind `course_ops.gateway.chat`) answers with a list of
# MAGIC parts, its reasoning summary and its text; `answer_text` keeps the text.
# MAGIC
# MAGIC If the provider refuses the call (for example OpenAI's `401` for a wrong key), the gateway
# MAGIC answers with the provider's status. The cell reports it as a message, and the trace records
# MAGIC the error.

# COMMAND ----------


def describe_gateway_error(error: APIStatusError, service: str) -> str:
    """Turn the gateway's error answer into one readable sentence."""
    body = error.body if isinstance(error.body, dict) else {}
    details = body.get("details") or [{}]
    metadata = details[0].get("metadata", {}) if isinstance(details[0], dict) else {}
    reason = details[0].get("reason", "") if isinstance(details[0], dict) else ""
    if reason == "MODEL_PROVIDER_ERROR":
        provider = metadata.get("provider", "the provider")
        upstream = str(metadata.get("upstream_status", error.status_code))
        message = f"{service} reached {provider}, which refused the call with status {upstream}."
        if upstream in ("401", "403"):
            message += (
                " The provider service's key (a Unity Catalog secret) or its access at the"
                " provider is wrong, expired or missing; a teacher fixes the secret, nothing in"
                " this notebook holds it."
            )
        return message
    if error.status_code == 404:
        return (
            f"{service} was not found (404): check the name; a service created or re-created"
            " a minute ago may not answer yet."
        )
    if error.status_code == 403:
        return (
            f"{service} refused the call (403): you need EXECUTE on it, plus USE CATALOG and"
            " USE SCHEMA on its catalog and schema."
        )
    return f"{service} answered status {error.status_code}: {body.get('error_code', error.message)}"


def answer_text(content) -> str:
    """The text of an answer: a plain string, or the text parts of a reasoning model's list."""
    if isinstance(content, list):
        return " ".join(part.get("text", "") for part in content if part.get("type") == "text")
    return content or ""


workspace = WorkspaceClient()
client = OpenAI(
    base_url=f"{workspace.config.host.rstrip('/')}/ai-gateway/mlflow/v1",
    api_key=workspace.config.authenticate()["Authorization"].removeprefix("Bearer "),
)

try:
    response = client.chat.completions.create(
        model=MODEL_SERVICE,
        messages=[{"role": "user", "content": "In one sentence, what is an AI gateway?"}],
        max_tokens=256,
    )
    answer = answer_text(response.choices[0].message.content)
    logger.info(f"Answer from {response.model}: {answer}")
    if response.usage is not None:
        logger.info(f"Input tokens: {response.usage.prompt_tokens}")
        logger.info(f"Output tokens: {response.usage.completion_tokens}")
except APIStatusError as error:
    logger.error(describe_gateway_error(error, MODEL_SERVICE))

trace_id = mlflow.get_last_active_trace_id()
logger.info(f"Trace id: {trace_id} (experiment {EXPERIMENT_NAME})")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 4. Read the Call Back From the Usage Table
# MAGIC
# MAGIC Every call through the AI Gateway lands in the system table `system.ai_gateway.usage`, with
# MAGIC the model service name, the model it routed to, the status and the tokens. The table lags:
# MAGIC **40 to 90 minutes** on our workspace (October 2026), so the call above shows up in a later
# MAGIC run. The query shows only your own calls of the last day; a refused call has no tokens.

# COMMAND ----------

usage = spark.sql(
    """
    SELECT event_time, service_name, destination_type, destination_model, status_code,
           input_tokens, output_tokens
    FROM system.ai_gateway.usage
    WHERE service_name = :service
      AND requester = current_user()
      AND event_time >= current_timestamp() - INTERVAL 1 DAY
    ORDER BY event_time DESC
    LIMIT 10
    """,
    args={"service": MODEL_SERVICE},
)
rows = usage.collect()
logger.info(f"Your calls of {MODEL_SERVICE} in the last day: {len(rows)}")
for row in rows:
    logger.info(
        f"{row.event_time} {row.destination_type} {row.destination_model} "
        f"status {row.status_code}, tokens in {row.input_tokens or '-'}, "
        f"out {row.output_tokens or '-'}"
    )
