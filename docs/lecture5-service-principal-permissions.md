# Lecture 5: Service Principal Permissions

Lecture 5 distinguishes deployment, Job Run-as, App hosting, and agent runtime
identities. See [Endpoints, secrets, and tracing](lecture5-endpoints-secrets-tracing.md) for API routes, UC secret limitations, and explicit trace-table grants.

A successful deployment does not establish runtime access to models,
tables, or Lakebase.

## 1. GitHub Actions deployment service principal

This identity runs the CD workflow and should be allowed to:

- Authenticate to the dev workspace.
- Create and update bundle-managed jobs, Apps, experiments, and Genie resources.
- Upload bundle files and artifacts.
- Start the release job.
- Use the Job Run-as service principal, if one is configured.

It is the identity that performs `databricks bundle deploy`; it is not
automatically the identity used inside a job or App.

## 2. Job Run-as service principal

This identity executes the data refresh, evaluation, and deployment-gate tasks.
Grant it only the permissions required by the pipeline:

- `USE CATALOG` on `llmops_dev`.
- `USE SCHEMA` on `llmops_dev.arxiv`.
- Read/write permissions on the Delta tables and Unity Catalog volume used by
  paper ingestion and processing.
- `CAN USE` on the SQL warehouse.
- Read/write access to the MLflow experiment used for evaluation and tracing.
- Permission to call `course_ops.gateway.chat` and `course_ops.gateway.embed`.
- Access to the Lakebase project, database, branch, and required PostgreSQL
  tables.
- Permission to grant the App-managed SPN access to the two UC credential secrets.
  The job also needs `CAN_MANAGE` on the App to start and stop it.

Jobs use the Run-as identity's permissions while executing. Setting the CD
SPN as the Run-as identity is optional for development, but recommended for a
stable production pipeline.

## 3. Databricks App service principal

Every Databricks App receives its own dedicated service principal. This agent
uses it only to bootstrap authentication: before importing MLflow, startup
reads `databricks_client_id` and `databricks_client_secret` from the Unity Catalog
catalog and schema in `project_config.yml`, selected by `ARXIV_ENV`.
`agent_server/agent.py` loads this configuration and calls `setup_auth(cfg)`
from `agent_server/auth.py` before importing MLflow.

Grant the App's managed principal `USE CATALOG`, `USE SCHEMA`, and `READ SECRET`
on those two UC secrets. The app reads their `effective_value` through the UC
SDK (`workspace.secrets_uc.get_secret(..., include_value=True)`) using the
initial `WorkspaceClient()` and the App's injected credentials. No workspace secret scopes,
credential environment references, or App resource declarations are used.

`agent_server/auth.py` sets `DATABRICKS_HOST` from
`workspace.config.host`, and sets `DATABRICKS_CLIENT_ID`,
`DATABRICKS_CLIENT_SECRET` in the running process before loading MLflow and the
agent. The SDK automatically selects OAuth M2M from the client credentials. Missing credentials or failed secret reads stop
startup rather than running the agent with the App identity. Secret values are
never logged. Each fresh server process performs this bootstrap; if a process
inherits the agent credentials, that identity also needs to read these secrets.

Lakebase endpoints are discovered using the configured project. Grant the
**existing agent principal** these runtime permissions separately:

- `CAN RUN` on the Genie space, applied by `resources/genie_space.yml` during
  bundle deployment to `agent_service_principal_id`.
- `CAN USE` on the SQL warehouse.
- `CAN CONNECT AND CREATE` on the Lakebase resource.
- Explicit `SELECT` and `MODIFY` on UC trace tables, plus `SELECT` on trace views.
  Experiment permissions alone are insufficient for UC traces.
- `EXECUTE` on the UC Gateway chat service and `CAN QUERY` on the regular
  embedding serving endpoint.
- `USE CATALOG` and `USE SCHEMA`.
- `SELECT` on Unity Catalog tables that the App reads directly.
- PostgreSQL table privileges for Lakebase tables such as
  `arxiv_chunk_embeddings` and `session_messages`.

## Gateway 404 troubleshooting

The evaluation error:

```text
ENDPOINT_NOT_FOUND: The given endpoint does not exist
```

does not necessarily mean the model service was deleted. A Gateway request can
also fail when the calling identity cannot access the configured service.

The configured model name is:

```yaml
llm_endpoint: course_ops.gateway.chat
```

Compare these values in the failing job:

```python
logger.info(f"Workspace: {w.config.host}")
logger.info(f"LLM endpoint: {cfg.llm_endpoint}")
logger.info(f"Identity: {w.current_user.me().user_name}")
```

Also run the same `OpenAI.responses.create()` request from the job using the
job's notebook-context token. If the direct request fails, grant the Job
Run-as identity access to the Gateway model service. If it succeeds but the
agent fails, rebuild and redeploy the wheel so the job is using the latest
`ArxivAgent` authentication code.

## Recommended development sequence

1. Deploy the bundle using the GitHub/CD SPN.
2. Run the release job as the current user while debugging.
3. Confirm Gateway, Lakebase, MLflow, and Unity Catalog access.
4. Move the job to a dedicated Run-as SPN.
5. Grant the App's managed SPN read access to the two UC credential secrets, and grant the
   existing agent SPN the runtime permissions above.

## CI/CD release order

CD deploys only to `acc` and then `prd`. Each call to the reusable deployment
workflow passes the literal target name (`acc` or `prd`). That name selects both
the GitHub environment and the bundle target; no GitHub target variable is needed.
Each environment supplies its own `DATABRICKS_HOST` and `DATABRICKS_CLIENT_ID`
variables for GitHub OIDC authentication. Configure the federation policy for
the corresponding GitHub environment identity.

For each target, GitHub deploys the bundle and runs the Databricks job
`evaluate_deploy_app`. The job:

1. The `evaluate_deploy_app.py` notebook evaluates the agent, then grants the App
   principal access to its UC bootstrap secrets.
2. The same notebook starts stopped compute with `w.apps.start_and_wait`, then
   deploys uploaded source with `w.apps.deploy_and_wait`. It passes the command
   and environment variables explicitly to match the bundle App configuration.
3. Waits for App startup, then calls its Responses API with SPN OAuth.
   The bundle grants the caller `CAN_USE` on the App.
4. Stops the App in `finally`, including when startup or invocation fails.
   **Stopping avoids ongoing compute costs for the course. A normal production
   deployment would leave the App running after validation.**

The job's Run-as identity needs evaluation access, permission to grant the App
SPN's UC bootstrap secret access, read access to the caller credentials, and
`CAN_MANAGE` on the App. Grant statements do not read secret values and are safe
to repeat. Evaluation exceptions and invocation failures fail the job and block
promotion; evaluation metrics currently have no minimum-score threshold.

### Configure production approval in GitHub

Create the `acc` and `prd` environments in repository **Settings > Environments**.
Set their Databricks variables, then configure **Required reviewers** on `prd`.
Optionally prevent self-review and administrator bypass. The `prd` workflow job
requires successful completion of `acc` and approval of its environment before
it receives a runner or deploys resources.

The YAML references the protected environment; it does not create a reviewer
rule. Without that GitHub setting, `environment: prd` alone does not require
approval. See [GitHub deployment approvals](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/review-deployments).

## Manual notebook alternative

Notebook 5.1 includes an optional UC secret grant cell using the same
`grant_app_secret_access` helper as the CD job. After bundle creation, run that cell
and start the App before invocation. When CD has run `evaluate_deploy_app`,
skip the notebook grant cell and proceed directly to invocation.
