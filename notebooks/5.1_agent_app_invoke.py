# Databricks notebook source
# MAGIC %md
# MAGIC # Lecture 5.1: Invoke the Agent App
# MAGIC
# MAGIC The agent is deployed by the Databricks bundle as a Databricks App. The app
# MAGIC exposes the MLflow Responses API at `/responses` and can be opened from the
# MAGIC Databricks Apps UI.
# MAGIC
# MAGIC Choose a permission setup path after creating the App:
# MAGIC
# MAGIC - **Notebook:** deploy the bundle, run the optional secret-grant cell below,
# MAGIC   then run the start and invocation cells.
# MAGIC - **CD:** the workflow deploys the bundle, runs the
# MAGIC   `evaluate_grant_permissions` job, then starts the App. Skip the grant cell.
# MAGIC
# MAGIC The equivalent CD commands, from the repository root:
# MAGIC
# MAGIC ```bash
# MAGIC databricks bundle validate -t dev --profile dev
# MAGIC databricks bundle deploy -t dev --profile dev
# MAGIC databricks bundle run evaluate_grant_permissions -t dev --profile dev
# MAGIC databricks bundle run arxiv_agent_app -t dev --profile dev
# MAGIC ```

# COMMAND ----------

import os

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.apps import ComputeState
from openai import OpenAI
from loguru import logger

from arxiv_curator.app_permissions import grant_app_secret_access
from arxiv_curator.config import ProjectConfig


cfg = ProjectConfig.from_yaml("../project_config.yml", env=os.getenv("ARXIV_ENV", "dev"))
app_name = cfg.agent_app_name
w = WorkspaceClient()

app = w.apps.get(name=app_name)
logger.info(f"App: {app.name}")
logger.info(f"URL: {app.url}")
logger.info(f"State: {app.active_deployment.status if app.active_deployment else 'not deployed'}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Optional: grant UC secret access from this notebook
# MAGIC
# MAGIC Run this cell for the notebook setup path. Skip it if the CD job has already
# MAGIC applied the grants. The executing identity must be allowed to grant these
# MAGIC UC privileges. Only the two credential secrets and their parent access are
# MAGIC granted to the App SPN; runtime data permissions belong to the existing SPN.

# COMMAND ----------

app_spn_client_id = app.service_principal_client_id
if not app_spn_client_id:
    raise RuntimeError("Deploy the bundle first to create the App and its SPN")

grant_app_secret_access(w, cfg.catalog, cfg.schema, app_spn_client_id)
logger.info(f"Granted UC secret access to App SPN {app_spn_client_id}")

# COMMAND ----------

# MAGIC %md
# MAGIC Start the previously deployed App after applying the grants and wait for
# MAGIC it to be ready before invoking it.

# COMMAND ----------

app = w.apps.get(name=app_name)
if app.compute_status.state == ComputeState.STOPPED:
    app = w.apps.start_and_wait(name=app_name)
logger.info(f"App state: {app.app_status.state}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Invoke the deployed app
# MAGIC
# MAGIC Both setup paths lead to the same invocation below. The caller needs
# MAGIC permission to use the deployed App.
# MAGIC
# MAGIC Apps use the OpenAI Responses API with the `apps/<app-name>` model name.
# MAGIC Use a WorkspaceClient authenticated with OAuth to invoke the App.
# MAGIC
# MAGIC ### Why this differs from notebook 1.1
# MAGIC
# MAGIC Both PATs and OAuth access tokens are bearer tokens. Their issuance,
# MAGIC lifetime, and supported destinations differ:
# MAGIC
# MAGIC | | Notebook 1.1: PAT | App invocation: OAuth |
# MAGIC |---|---|---|
# MAGIC | SDK call | `w.tokens.create(lifetime_seconds=1200).token_value` | `app_client.config.oauth_token().access_token` |
# MAGIC | What it does | Creates a new personal access token | Retrieves an access token from the client's OAuth provider |
# MAGIC | Lifetime | Requested explicitly: 1,200 seconds (20 minutes) | Determined by Databricks; M2M tokens typically last one hour |
# MAGIC | Renewal | Create a replacement PAT | SDK refreshes tokens when requested through the OAuth provider |
# MAGIC | Model API used in 1.1 | Accepted | Accepted |
# MAGIC | Databricks App URL | Not accepted | Accepted |
# MAGIC
# MAGIC In both cases OpenAI receives `api_key=token`; the destination determines
# MAGIC which token types are accepted. The `oauth_token()` call does not accept
# MAGIC a `lifetime_seconds` parameter. Once copied into the OpenAI client, the token
# MAGIC is a fixed string: fetch a fresh token and update the client after expiry.
# MAGIC
# MAGIC **PATs do not work for App invocation: use an OAuth token.** This notebook
# MAGIC obtains one with SPN OAuth M2M; the default notebook-context client cannot
# MAGIC supply it through `oauth_token()`. OAuth is not exclusive to SPNs: user OAuth
# MAGIC is also supported. See the
# MAGIC [App authentication guide](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/connect-local).
# MAGIC
# MAGIC **Production recommendation:** use different SPNs for the caller and the
# MAGIC agent running inside the App. Grant the caller `CAN_USE` on the App, and
# MAGIC grant data/model/trace permissions to the runtime SPN. For this course we
# MAGIC reuse the existing SPN, which already has `CAN_MANAGE` (including `CAN_USE`).
# MAGIC The notebook identity also needs `READ SECRET` and parent catalog/schema
# MAGIC usage permissions to retrieve the credentials below.

# COMMAND ----------

app_client = WorkspaceClient(
    host=w.config.host,
    client_id=dbutils.secrets.get(
        catalog=cfg.catalog, schema=cfg.schema, key="databricks_client_id"
    ),
    client_secret=dbutils.secrets.get(
        catalog=cfg.catalog, schema=cfg.schema, key="databricks_client_secret"
    ),
    auth_type="oauth-m2m",
)
oauth_token = app_client.config.oauth_token().access_token

client = OpenAI(
    api_key=oauth_token,
    base_url=app.url,
)
response = client.responses.create(
    model=f"apps/{app_name}",
    input=[
        {
            "role": "user",
            "content": "What are recent papers about LLMs and reasoning?",
        }
    ],
)

logger.info(f"Response ID: {response.id}")
if response.output:
    logger.info(response.output_text)
else:
    logger.warning("The App returned no output items")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Stop the App
# MAGIC
# MAGIC Run this cell when finished to stop the App and wait until it has stopped.
# MAGIC The App remains available to start again later.

# COMMAND ----------

w.apps.stop_and_wait(name=app_name)
logger.info(f"Stopped App: {app_name}")
