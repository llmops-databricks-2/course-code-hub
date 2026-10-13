# Databricks notebook source
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
# MAGIC **Checked: October 13, 2026 (AWS).** See
# MAGIC [model provider services](https://docs.databricks.com/aws/en/ai-gateway/model-provider-services)
# MAGIC and [query model services](https://docs.databricks.com/aws/en/ai-gateway/query-model-services).

# COMMAND ----------

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
# MAGIC way. `experiment_name` is the MLflow experiment that receives the trace; by default the
# MAGIC course's experiment from `project_config.yml`.
# MAGIC
# MAGIC To call a model service you need `EXECUTE` on it, plus `USE CATALOG` on `course_ops` and
# MAGIC `USE SCHEMA` on `course_ops.gateway`. A model service runs with its owner's privileges, so you
# MAGIC need nothing on the provider service and nothing on the secret.

# COMMAND ----------

spark = SparkSession.builder.getOrCreate()
dbutils = DBUtils(spark)

env = get_env(spark)
cfg = load_config("../project_config.yml", env)

dbutils.widgets.text("model_service", "course_ops.gateway.openai_demo")
dbutils.widgets.text("experiment_name", cfg.experiment_name)
MODEL_SERVICE = dbutils.widgets.get("model_service")
EXPERIMENT_NAME = dbutils.widgets.get("experiment_name")

logger.info(f"Environment: {env}")
logger.info(f"Model service: {MODEL_SERVICE}")
logger.info(f"MLflow experiment: {EXPERIMENT_NAME}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. Trace Every Call
# MAGIC
# MAGIC `mlflow.openai.autolog()` records each call of the OpenAI client as a trace in the experiment:
# MAGIC the request, the response or the error, and the model service name as the span's `model`.

# COMMAND ----------

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
# MAGIC The provider service of the demonstration routes the OpenAI Chat Completions API
# MAGIC (`openai/v1/chat/completions`), so this call uses `chat.completions`.
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
                " The provider service's key (a Unity Catalog secret) is wrong, expired or"
                " missing; a teacher fixes the secret, nothing in this notebook holds it."
            )
        return message
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

answer = None
try:
    response = client.chat.completions.create(
        model=MODEL_SERVICE,
        messages=[{"role": "user", "content": "In one sentence, what is an AI gateway?"}],
        max_tokens=100,
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
# MAGIC **about 90 minutes** on our workspace (October 2026), so the call above shows up in a later
# MAGIC run. The query shows only your own calls of the last day.

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
        f"status {row.status_code}, tokens in {row.input_tokens}, out {row.output_tokens}"
    )
