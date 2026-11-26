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
# MAGIC   then run the SDK deployment and invocation cells.
# MAGIC - **CD:** the workflow deploys the bundle, runs the
# MAGIC   `evaluate_deploy_app` job, which evaluates, starts, invokes, and stops
# MAGIC   the App. Skip the grant cell; the SDK deployment cell below deploys and runs it for manual use.
# MAGIC
# MAGIC For manual development, from the repository root (CD uses `acc` then `prd`):
# MAGIC
# MAGIC ```bash
# MAGIC databricks bundle validate -t dev --profile dev
# MAGIC databricks bundle deploy -t dev --profile dev
# MAGIC databricks bundle run evaluate_deploy_app -t dev --profile dev
# MAGIC ```

# COMMAND ----------

import os

import requests
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.apps import AppDeployment, ComputeState, EnvVar
from loguru import logger
from openai import OpenAI

from arxiv_curator.app_permissions import grant_app_secret_access, grant_runtime_trace_access
from arxiv_curator.config import ProjectConfig

dbutils.widgets.dropdown("env", "dev", ["dev", "acc", "prd"])
env = dbutils.widgets.get("env")
dbutils.widgets.text("genie_space_id", "")
genie_space_id = dbutils.widgets.get("genie_space_id")
cfg = ProjectConfig.from_yaml("../project_config.yml", env=env)
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

# Use the notebook identity (your user or the pipeline SPN) to grant access.
runtime_spn_client_id = dbutils.secrets.get(
    catalog=cfg.catalog, schema=cfg.schema, key="databricks_client_id"
)
grant_runtime_trace_access(w, cfg.catalog, cfg.schema, runtime_spn_client_id)


# COMMAND ----------

# MAGIC %md
# MAGIC Deploy the uploaded source with the Python SDK after applying the grants.
# MAGIC The notebook CLI cannot execute `bundle run`. Starting compute alone resumes
# MAGIC the previous deployment; `deploy_and_wait` activates the source below.
# MAGIC Set the `genie_space_id` widget to the deployed Genie space ID (the validation
# MAGIC job supplies it). The command and environment match `resources/agent_app.yml`.

# COMMAND ----------

if not genie_space_id:
    raise ValueError("Set the genie_space_id widget to the deployed Genie space ID")
# deploy_and_wait requires running compute: a stopped App returns
# "Please start the app first." Start + deploy is the lifecycle sequence
# handled by CLI bundle run (which also resolves bundle configuration).
if app.compute_status.state == ComputeState.STOPPED:
    w.apps.start_and_wait(name=app_name)
# Starting compute may resume a deployment; wait before submitting new code.
app = w.apps.get(name=app_name)
if app.pending_deployment:
    w.apps.wait_get_deployment_app_succeeded(
        app_name=app_name, deployment_id=app.pending_deployment.deployment_id
    )
w.apps.deploy_and_wait(
    app_name=app_name,
    app_deployment=AppDeployment(
        # This notebook lives in notebooks/; deploy the repository root.
        source_code_path=os.path.abspath(".."),
        command=["uv", "run", "start-server"],
        env_vars=[
            EnvVar(name="ARXIV_ENV", value=env),
            EnvVar(name="GENIE_SPACE_ID", value=genie_space_id),
        ],
    ),
)
app = w.apps.get(name=app_name)
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
# MAGIC ### Call as your user
# MAGIC
# MAGIC Run this notebook as your user, who needs `CAN_USE` on the App.
# MAGIC In a job, the caller is the job's **Run as** identity, not necessarily the
# MAGIC person who clicks Run. Use your user as the Run as identity for this example.
# MAGIC
# MAGIC Unlike notebook 1.1, Apps do not accept a PAT directly. Exchange the notebook
# MAGIC runtime token retrieved through WorkspaceClient for an OAuth token scoped to this App, following the
# MAGIC [Databricks notebook authentication guide](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/connect-local#from-a-databricks-notebook).
# MAGIC Verified on serverless v5: retrieving the internal runtime token through
# MAGIC `w.config.authenticate()` and exchanging it succeeds. A PAT created with
# MAGIC `w.tokens.create(lifetime_seconds=1200)` (as in notebook 1.1) was rejected
# MAGIC by this App token exchange with HTTP 400: `invalid token for subject_token_type`.
# MAGIC Use the existing runtime credential here, not a newly created PAT.
# MAGIC
# MAGIC The response supplies `expires_in` in seconds; rerun the cell to obtain a
# MAGIC fresh token after expiry. Never print either token.
# MAGIC
# MAGIC This changes the **caller** only. The agent still accesses resources using
# MAGIC the existing runtime SPN. Per-user data access would additionally require
# MAGIC user authorization scopes and request-scoped clients inside the App.

# COMMAND ----------

logger.info(f"Notebook caller: {w.current_user.me().user_name}")
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
token_data = token_response.json()
oauth_token = token_data["access_token"]
logger.info(f"App OAuth token valid for {token_data['expires_in']} seconds")

client = OpenAI(
    api_key=oauth_token,
    base_url=app.url,
)
raw_response = client.responses.with_raw_response.create(
    model=f"apps/{app_name}",
    input=[
        {
            "role": "user",
            "content": "What are recent papers about LLMs and reasoning?",
        }
    ],
)

logger.info(f"App HTTP status: {raw_response.status_code}")
response = raw_response.parse()
logger.info(f"Response ID: {response.id}")
logger.info(response.output_text)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Stop the App
# MAGIC
# MAGIC Run this cell when finished to stop the App and wait until it has stopped.
# MAGIC The App remains available to start again later.

# COMMAND ----------

w.apps.stop_and_wait(name=app_name)
logger.info(f"Stopped App: {app_name}")
