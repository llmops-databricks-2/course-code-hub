"""Start the MLflow AgentServer used by Databricks Apps."""

# Initialize credentials before importing MLflow; this order is intentional.
# isort: off
import agent_server.agent  # noqa: F401 - configures credentials and registers handlers
from mlflow.genai.agent_server import AgentServer, setup_mlflow_git_based_version_tracking

from agent_server.http_metrics import configure_http_metrics
# isort: on

agent_server = AgentServer("ResponsesAgent", enable_chat_proxy=True)
app = agent_server.app
metrics_provider = configure_http_metrics(app)
setup_mlflow_git_based_version_tracking()


def main() -> None:
    agent_server.run(app_import_string="agent_server.start_server:app")
