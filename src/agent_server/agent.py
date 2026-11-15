"""MLflow AgentServer handlers for the Databricks App deployment."""

import os

from agent_server.auth import setup_auth
from arxiv_curator.config import ProjectConfig

cfg = ProjectConfig.from_yaml("project_config.yml", env=os.getenv("ARXIV_ENV", "dev"))
setup_auth(cfg)

if os.getenv("GENIE_SPACE_ID"):
    cfg.genie_space_id = os.environ["GENIE_SPACE_ID"]

import mlflow
from mlflow.genai.agent_server import invoke, stream
from mlflow.types.responses import ResponsesAgentRequest, ResponsesAgentResponse

from arxiv_curator.agent import ArxivAgent

mlflow.set_tracking_uri("databricks")
mlflow.set_experiment(cfg.experiment_name)

agent = ArxivAgent(
    llm_endpoint=cfg.llm_endpoint,
    system_prompt=cfg.system_prompt,
    catalog=cfg.catalog,
    schema=cfg.schema,
    genie_space_id=cfg.genie_space_id,
    lakebase_project_id=cfg.lakebase_project_id,
    embedding_endpoint=cfg.embedding_endpoint,
)


@invoke()
def invoke_handler(request: ResponsesAgentRequest) -> ResponsesAgentResponse:
    """Handle non-streaming Responses API requests."""
    return agent.predict(request)


@stream()
def stream_handler(request: ResponsesAgentRequest):
    """Stream Responses API events from the existing agent implementation."""
    yield from agent.predict_stream(request)
