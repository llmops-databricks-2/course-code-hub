"""MLflow AgentServer handlers for the Databricks App deployment."""

import os

import mlflow
from mlflow.genai.agent_server import invoke, stream
from mlflow.entities import SpanType
from mlflow.types.responses import ResponsesAgentRequest, ResponsesAgentResponse

from arxiv_curator.agent import ArxivAgent
from arxiv_curator.config import ProjectConfig


def _load_config() -> ProjectConfig:
    """Load app configuration from the bundle workspace root."""
    config_path = os.getenv("PROJECT_CONFIG_PATH", "project_config.yml")
    environment = os.getenv("ARXIV_ENV", "dev")
    return ProjectConfig.from_yaml(config_path=config_path, env=environment)


cfg = _load_config()
if os.getenv("GENIE_SPACE_ID"):
    cfg.genie_space_id = os.environ["GENIE_SPACE_ID"]
experiment_id = os.getenv("MLFLOW_EXPERIMENT_ID")
if experiment_id:
    mlflow.set_tracking_uri("databricks")
    mlflow.set_experiment(experiment_id=experiment_id)
mlflow.set_active_model(name=cfg.agent_app_name or "arxiv-curator-agent")

agent = ArxivAgent(
    llm_endpoint=cfg.llm_endpoint,
    system_prompt=cfg.system_prompt,
    catalog=cfg.catalog,
    schema=cfg.schema,
    genie_space_id=cfg.genie_space_id,
    lakebase_project_id=cfg.lakebase_project_id,
    lakebase_user=cfg.lakebase_user,
    embedding_endpoint=cfg.embedding_endpoint,
)


@invoke()
def invoke_handler(request: ResponsesAgentRequest) -> ResponsesAgentResponse:
    """Handle non-streaming Responses API requests."""
    with mlflow.start_span(name="app_invoke", span_type=SpanType.AGENT) as span:
        span.set_inputs(request.model_dump())
        response = agent.predict(request)
        span.set_outputs(response.model_dump())
        return response


@stream()
def stream_handler(request: ResponsesAgentRequest):
    """Stream Responses API events from the existing agent implementation."""
    yield from agent.predict_stream(request)
