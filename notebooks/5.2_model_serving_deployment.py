# Databricks notebook source
# MAGIC %md
# MAGIC # Lecture 5.2: Deploy the Agent to Model Serving
# MAGIC
# MAGIC Resolve the UC model's `latest-model` alias from notebook 4.4 and deploy that
# MAGIC version with the Model Serving SDK. This notebook does not use `agents.deploy`.
# MAGIC Re-run it to deploy the version currently assigned to the alias.

# COMMAND ----------

import mlflow
from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound, ResourceAlreadyExists
from databricks.sdk.service.serving import EndpointCoreConfigInput, ServedEntityInput
from loguru import logger
from mlflow import MlflowClient

from arxiv_curator.config import load_config

dbutils.widgets.text("env", "dev")
env = dbutils.widgets.get("env")
cfg = load_config("../project_config.yml", env)
w = WorkspaceClient()
client = MlflowClient()

model_name = f"{cfg.catalog}.{cfg.schema}.arxiv_agent"
model_version = client.get_model_version_by_alias(model_name, "latest-model")
experiment = mlflow.set_experiment(cfg.experiment_name)

endpoint_name = f"arxiv-curator-serving-{env}"
logger.info(f"Deploying {model_name} version {model_version.version} to {endpoint_name}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Supply the same SPN credentials used by the App
# MAGIC
# MAGIC UC secrets remain the source of truth for the SPN credentials. This cell
# MAGIC creates a dedicated workspace scope if needed and overwrites both secret
# MAGIC values from UC on every run. Model Serving uses references to these copies.
# MAGIC The notebook identity needs UC secret read access, permission to create the
# MAGIC scope (on first run), and WRITE and READ access to an existing scope.
# MAGIC
# MAGIC After UC credential rotation, re-run this notebook to synchronize the copies
# MAGIC and update the endpoint. UC rotation does not automatically synchronize the
# MAGIC workspace scope or refresh credentials in an already-running serving process.
# MAGIC Values are never printed or included directly in endpoint configuration.
# MAGIC
# MAGIC The SPN needs Gateway, Genie, Lakebase, and tracing permissions. Notebook 4.0
# MAGIC covers the UC trace grants; this notebook does not grant runtime permissions.
# MAGIC [Supported secret surfaces](https://docs.databricks.com/aws/en/security/secrets/#where-you-can-use-secrets)

# COMMAND ----------

dbutils.widgets.text("serving_secret_scope", f"arxiv-curator-serving-{env}")
secret_scope = dbutils.widgets.get("serving_secret_scope")

# Read both current UC values before updating the serving copies.
client_id = dbutils.secrets.get(catalog=cfg.catalog, schema=cfg.schema, key="databricks_client_id")
client_secret = dbutils.secrets.get(
    catalog=cfg.catalog, schema=cfg.schema, key="databricks_client_secret"
)

try:
    w.secrets.create_scope(scope=secret_scope)
except ResourceAlreadyExists:
    pass

# put_secret creates a missing key or overwrites its existing value.
w.secrets.put_secret(scope=secret_scope, key="databricks_client_id", string_value=client_id)
w.secrets.put_secret(scope=secret_scope, key="databricks_client_secret", string_value=client_secret)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Configure tracing and deploy
# MAGIC
# MAGIC Unlike the App, Model Serving uses `ENABLE_MLFLOW_TRACING` in its endpoint
# MAGIC configuration. `MLFLOW_EXPERIMENT_ID` selects the existing experiment and its
# MAGIC UC trace location. The SPN credentials authenticate both agent calls and trace
# MAGIC writes. The registered model retains the configuration logged in notebook 4.4.
# MAGIC
# MAGIC This creates or replaces the endpoint's served model configuration with the
# MAGIC selected version. Deployment waits until ready and can take several minutes.
# MAGIC [Model Serving tracing](https://docs.databricks.com/aws/en/mlflow3/genai/tracing/prod-tracing)

# COMMAND ----------

served_entity = ServedEntityInput(
    entity_name=model_name,
    entity_version=str(model_version.version),
    workload_size="Small",
    scale_to_zero_enabled=True,
    environment_vars={
        "DATABRICKS_HOST": w.config.host,
        "DATABRICKS_CLIENT_ID": f"{{{{secrets/{secret_scope}/databricks_client_id}}}}",
        "DATABRICKS_CLIENT_SECRET": f"{{{{secrets/{secret_scope}/databricks_client_secret}}}}",
        "MLFLOW_TRACKING_URI": "databricks",
        "MLFLOW_EXPERIMENT_ID": experiment.experiment_id,
        "ENABLE_MLFLOW_TRACING": "true",
    },
)

try:
    w.serving_endpoints.get(name=endpoint_name)
except NotFound:
    w.serving_endpoints.create_and_wait(
        name=endpoint_name,
        config=EndpointCoreConfigInput(name=endpoint_name, served_entities=[served_entity]),
    )
else:
    w.serving_endpoints.update_config_and_wait(
        name=endpoint_name,
        served_entities=[served_entity],
    )

logger.info(f"Endpoint ready: {endpoint_name}; model version: {model_version.version}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Invoke the Model Serving endpoint
# MAGIC
# MAGIC Use the OpenAI client with a token valid for 2,000 seconds and the endpoint
# MAGIC name as the model. The caller needs permission to create tokens and CAN QUERY
# MAGIC on the endpoint. Pass session and request IDs through `custom_inputs`.
# MAGIC
# MAGIC **Production recommendation:** invoke the endpoint with a dedicated caller
# MAGIC SPN using OAuth M2M and `CAN_QUERY` on the endpoint. Keep it separate from
# MAGIC the runtime SPN whose credentials are configured in the served model.
# MAGIC Model Serving accepts PATs too, so this notebook retains the short-lived
# MAGIC PAT example. Databricks App URLs require OAuth instead; a PAT will not work.

# COMMAND ----------

import random
from datetime import datetime

from openai import OpenAI

host = w.config.host
token = w.tokens.create(lifetime_seconds=2000).token_value

serving_client = OpenAI(
    api_key=token,
    base_url=f"{host}/serving-endpoints",
)

timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
session_id = f"s-{timestamp}-{random.randint(100000, 999999)}"
request_id = f"req-{timestamp}-{random.randint(100000, 999999)}"

response = serving_client.responses.create(
    model=endpoint_name,
    input=[
        {
            "role": "user",
            "content": "What are recent papers about LLMs and reasoning?",
        }
    ],
    extra_body={
        "custom_inputs": {
            "session_id": session_id,
            "request_id": request_id,
        }
    },
)

print(response)
