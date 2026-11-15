"""Start the MLflow AgentServer used by Databricks Apps."""

import agent_server.agent  # noqa: F401 - configures credentials and registers handlers

from mlflow.genai.agent_server import AgentServer, setup_mlflow_git_based_version_tracking

agent_server = AgentServer("ResponsesAgent", enable_chat_proxy=True)
app = agent_server.app
setup_mlflow_git_based_version_tracking()


def main() -> None:
    agent_server.run(app_import_string="agent_server.start_server:app")
