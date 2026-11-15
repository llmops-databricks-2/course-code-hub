# Databricks notebook source
import os
import random
from datetime import datetime

import mlflow
from arxiv_curator.agent import ArxivAgent
from pyspark.sql import SparkSession
from arxiv_curator.config import load_config, get_env, get_widget
from arxiv_curator.evaluation import (
    hook_in_post_guideline,
    polite_tone_guideline,
    word_count_check,
)

# COMMAND ----------
# Initialize the agent
spark = SparkSession.builder.getOrCreate()
cfg = load_config("../project_config.yml", get_env(spark))
os.environ["MLFLOW_TRACING_SQL_WAREHOUSE_ID"] = cfg.warehouse_id
genie_space_id = get_widget(spark, "genie_space_id")
mlflow.set_experiment(cfg.experiment_name)

agent = ArxivAgent(
    llm_endpoint=cfg.llm_endpoint,
    system_prompt=cfg.system_prompt,
    catalog=cfg.catalog,
    schema=cfg.schema,
    genie_space_id=genie_space_id,
    lakebase_project_id=cfg.lakebase_project_id,
    embedding_endpoint=cfg.embedding_endpoint,
)

# COMMAND ----------
# Load evaluation inputs.
with open("../eval_inputs.txt") as f:
    eval_data = [{"inputs": {
        "question": line.strip()}} for line in f if line.strip()]


def predict_fn(question: str) -> str:
    """Predict function that wraps the agent for evaluation."""
    request = {"input": [{"role": "user", "content": question}]}
    result = agent.predict(request)
    return result.output[-1].content


# COMMAND ----------
# Run evaluation
results = mlflow.genai.evaluate(
    predict_fn=predict_fn,
    data=eval_data,
    scorers=[word_count_check,
             polite_tone_guideline,
             hook_in_post_guideline]
)

# COMMAND ----------
timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
session_id = f"s-{timestamp}-{random.randint(100000, 999999)}"
request_id = f"req-{timestamp}-{random.randint(100000, 999999)}"

test_request = {
    "input": [
        {"role": "user",
         "content": "What are recent papers about LLMs and reasoning?"}
    ],
    "custom_inputs": {
        "session_id": session_id,
        "request_id": request_id,
    },
}

model_config = {
        "catalog": cfg.catalog,
        "schema": cfg.schema,
        "genie_space_id": genie_space_id,
        "system_prompt": cfg.system_prompt,
        "llm_endpoint": cfg.llm_endpoint,
        "lakebase_project_id": cfg.lakebase_project_id,
        "embedding_endpoint": cfg.embedding_endpoint,
    }

git_sha = "abc"
run_id = "unset"

ts = datetime.now().strftime('%Y-%m-%d')
with mlflow.start_run(
    run_name=f"arxiv-agent-{ts}",
    tags={"git_sha": git_sha, "run_id": run_id}
) as run:
    # Serving uses the dedicated SP OAuth credentials configured on the endpoint.
    # Notebook 4.0 grants access to the UC trace tables.
    model_info = mlflow.pyfunc.log_model(
        name="agent",
        python_model="../agent_model.py",
        input_example=test_request,
        model_config=model_config,
    )
    mlflow.log_metrics(results.metrics)

# COMMAND ----------
# register model
model_name = f"{cfg.catalog}.{cfg.schema}.arxiv_agent"

registered_model = mlflow.register_model(
    model_uri=model_info.model_uri,
    name=model_name,
    tags={"git_sha": git_sha, "run_id": run_id},
    env_pack="databricks_model_serving"
)

# COMMAND ----------
from mlflow import MlflowClient

client = MlflowClient()
client.set_registered_model_alias(
    name=model_name,
    alias="latest-model",
    version=registered_model.version,
)
