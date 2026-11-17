"""MLflow model entry point for Model Serving."""

import mlflow
from mlflow.models import ModelConfig

from arxiv_curator.agent import ArxivAgent

config = ModelConfig(
    development_config={
        "catalog": "placeholder",
        "schema": "placeholder",
        "genie_space_id": "placeholder",
        "system_prompt": "prompt placeholder",
        "llm_endpoint": "placeholder",
        "lakebase_project_id": "placeholder",
        "embedding_endpoint": "placeholder",
    }
)

agent = ArxivAgent(
    llm_endpoint=config.get("llm_endpoint"),
    system_prompt=config.get("system_prompt"),
    catalog=config.get("catalog"),
    schema=config.get("schema"),
    genie_space_id=config.get("genie_space_id"),
    lakebase_project_id=config.get("lakebase_project_id"),
    embedding_endpoint=config.get("embedding_endpoint"),
)
mlflow.models.set_model(agent)
