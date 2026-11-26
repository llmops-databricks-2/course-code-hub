# Databricks notebook source
# MAGIC %md
# MAGIC # Generate App traces for monitoring
# MAGIC
# MAGIC Send example research questions to the deployed App. Each request creates
# MAGIC a separate session and, when tracing is enabled, a production trace. Run
# MAGIC this notebook deliberately: App calls consume model and compute resources.

# COMMAND ----------

from uuid import uuid4

import requests
from databricks.sdk import WorkspaceClient
from openai import OpenAI
from pyspark.sql import SparkSession

from arxiv_curator.config import ProjectConfig, get_env, get_widget

spark = SparkSession.builder.getOrCreate()
env = get_env(spark)
request_count = int(get_widget(spark, "request_count", "10"))
cfg = ProjectConfig.from_yaml("../project_config.yml", env=env)
w = WorkspaceClient()
app = w.apps.get(name=cfg.agent_app_name)
if not app.url or not app.oauth2_app_client_id:
    raise ValueError("Deploy and start the App before running this notebook")

# Exchange the notebook identity's runtime token for an App-scoped OAuth token.
notebook_token = w.config.authenticate()["Authorization"].removeprefix("Bearer ")
token_response = requests.post(
    f"{w.config.host}/oidc/v1/token",
    data={
        "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
        "subject_token": notebook_token,
        "subject_token_type": "urn:databricks:params:oauth:token-type:personal-access-token",
        "requested_token_type": "urn:ietf:params:oauth:token-type:access_token",
        "scope": "all-apis",
        "audience": app.oauth2_app_client_id,
    },
    timeout=30,
)
token_response.raise_for_status()
client = OpenAI(api_key=token_response.json()["access_token"], base_url=app.url)

# COMMAND ----------

questions = [
    "What are recent research directions in LLM reasoning?",
    "Summarize recent research on retrieval augmented generation.",
    "What are current research themes in AI safety?",
    "Find research on evaluating multi-agent systems.",
    "What papers explore long-context language models?",
    "Summarize work on efficient inference for language models.",
    "What are recent trends in multimodal language models?",
    "Find papers on improving tool use by language agents.",
    "What research explores synthetic data for model training?",
    "Summarize recent work on model alignment and feedback.",
]
if not 1 <= request_count <= len(questions):
    raise ValueError(f"request_count must be between 1 and {len(questions)}")

for index, question in enumerate(questions[:request_count], start=1):
    response = client.responses.create(
        model=f"apps/{cfg.agent_app_name}",
        input=[{"role": "user", "content": question}],
        extra_body={
            "custom_inputs": {
                "session_id": f"monitoring-{uuid4().hex}",
                "request_id": f"monitoring-{uuid4().hex}",
            }
        },
    )
    print(f"[{index}/{request_count}] Response: {response.id}")
