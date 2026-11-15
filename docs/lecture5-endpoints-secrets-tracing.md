# Lecture 5: endpoints, secrets, and tracing

Verified against Databricks documentation on 14 November 2026. Examples use this course's configured services; support differs between model types.

## Endpoint URLs and invocation methods

`host` means the workspace URL, without a trailing slash.

| Target | OpenAI client base URL | `model` argument | Calls used in this course |
| --- | --- | --- | --- |
| AI Gateway, unified API | `https://<workspace>/ai-gateway/mlflow/v1` | UC service name, e.g. `course_ops.gateway.chat` | `responses.create`, `chat.completions.create`, or `embeddings.create`, according to the model |
| Regular foundation-model serving endpoint | `https://<workspace>/serving-endpoints` | Endpoint name, e.g. `databricks-gte-large-en` | `chat.completions.create` for chat models; `embeddings.create` for embeddings |
| Custom ResponsesAgent on Model Serving | `https://<workspace>/serving-endpoints` | Deployed endpoint name, e.g. `arxiv-curator-serving-dev` | `responses.create` |
| AgentServer in a Databricks App | The App URL | AgentServer's model identifier | `responses.create` |

Gateway also has provider-native routes, such as `/ai-gateway/openai/v1`. These are separate from the unified route. Do not infer a route by checking whether the model name contains a dot. [Gateway API documentation](https://docs.databricks.com/aws/en/ai-gateway/query-model-services).

### Python examples

For regular serving embeddings, use the Workspace SDK's client, as in `vector_search.py`:

```python
from databricks.sdk import WorkspaceClient

w = WorkspaceClient()
serving = w.serving_endpoints.get_open_ai_client()
embedding = serving.embeddings.create(
    model="databricks-gte-large-en", input="Find papers about agents"
)
```

Alternatively, call the same embedding endpoint with an explicit base URL. As in notebook 1.1, this example creates a token valid for 20 minutes:

```python
from databricks.sdk import WorkspaceClient
from openai import OpenAI

w = WorkspaceClient()
token = w.tokens.create(lifetime_seconds=1200).token_value
serving = OpenAI(
    api_key=token,
    base_url=f"{w.config.host}/serving-endpoints",
)
embedding = serving.embeddings.create(
    model="databricks-gte-large-en", input="Find papers about agents"
)
```

The caller needs permission to create tokens and query the endpoint.

With an authenticated token, the OpenAI client also makes the destination explicit for Gateway and custom agent calls:

```python
from openai import OpenAI

gateway = OpenAI(api_key=token, base_url=f"{host}/ai-gateway/mlflow/v1")
response = gateway.responses.create(
    model="course_ops.gateway.chat",
    input=[{"role": "user", "content": "Explain retrieval augmented generation."}],
)

serving = OpenAI(api_key=token, base_url=f"{host}/serving-endpoints")
response = serving.responses.create(
    model="arxiv-curator-serving-dev",
    input=[{"role": "user", "content": "Find recent agent papers."}],
)
```

Other interfaces are REST requests with a bearer token and the appropriate JSON payload, and `w.serving_endpoints.query(...)` for serving endpoints. REST routes include `/serving-endpoints/<endpoint>/invocations`; the OpenAI-compatible client uses shared routes such as `/serving-endpoints/responses`.

**Responses API is not universally exclusive to Gateway.** Use Gateway Responses for the course's foundation chat service. Our custom `ResponsesAgent` deployed to regular Model Serving also supports Responses, which is why notebook 5.2 uses it. Do not assume an ordinary chat-completion endpoint implements Responses simply because it is a serving endpoint. [Agent invocation APIs](https://docs.databricks.com/aws/en/agents/query-llms).

### SQL `ai_query`

**`ai_query` is not supported for our custom AI Gateway services**, such as `course_ops.gateway.chat` and `course_ops.gateway.embed`. Use a supported regular serving endpoint for this course's SQL examples. Current documentation includes an exception for Databricks-provided Gateway models under `system.ai`; therefore “no Gateway model supports ai_query” would be too broad. [Gateway batch inference](https://docs.databricks.com/aws/en/ai-gateway/query-model-services).

## Caller authentication and permissions

App URLs require OAuth; a PAT cannot invoke the App. Notebook 5.1 obtains an
OAuth M2M token using the existing SPN's credentials read from UC secrets.
OAuth can also represent a user (U2M); it is not restricted to SPNs.
[App authentication](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/connect-local).

For production, use separate caller and agent-runtime SPNs. The caller needs
`CAN_USE` on the App; the runtime SPN needs access to the data, models, and trace
tables used by the agent. This course reuses `sp-deploy-arxiv-dev`, which already
has `CAN_MANAGE` on the App and therefore can invoke it.
[App permissions](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/permissions).

Model Serving accepts PATs as well as OAuth. Notebook 5.2 retains its PAT example,
but production callers should use a separate SPN with OAuth M2M and `CAN_QUERY`
on the endpoint. This caller identity is separate from the SPN configured inside
the served model for downstream access.

## Unity Catalog secrets

UC secrets use `catalog.schema.secret`, not a workspace secret scope. The actor retrieving a value needs `USE CATALOG`, `USE SCHEMA`, and explicit **`READ SECRET`**. In this course, do not rely on `ALL PRIVILEGES` as sufficient: apply the named grants. Ownership also permits reading. `REFERENCE SECRET` alone does not return the value. [UC secret permissions](https://docs.databricks.com/aws/en/security/secrets/unity-catalog-secrets).

Notebook/job access on supported compute:

```python
client_secret = dbutils.secrets.get(
    catalog=cfg.catalog, schema=cfg.schema, key="databricks_client_secret"
)
```

App access uses the SDK instead of notebook `dbutils`:

```python
client_secret = w.secrets_uc.get_secret(
    full_name=f"{cfg.catalog}.{cfg.schema}.databricks_client_secret",
    include_value=True,
).effective_value
```

Do not print returned values. SDK/API reads do not provide notebook output redaction. The App initially reads with its managed SPN; `setup_auth(cfg)` then sets the existing agent SPN's credentials before agent clients and MLflow initialize.

### Model Serving secret references

**UC secrets cannot be referenced directly in Model Serving environment configuration.** `{{secrets/<scope>/<key>}}` resolves a workspace secret scope and key. It does not accept a UC three-part name; changing the string cannot make it a UC reference. [Supported secret integrations](https://docs.databricks.com/aws/en/security/secrets/).

Notebook 5.2 reads the current UC values and upserts copies into a workspace secret scope, then configures:

```python
environment_vars = {
    "DATABRICKS_CLIENT_ID": "{{secrets/arxiv-curator-serving-dev/databricks_client_id}}",
    "DATABRICKS_CLIENT_SECRET": "{{secrets/arxiv-curator-serving-dev/databricks_client_secret}}",
}
```

This is a copy, not a live rotation link. Rerun synchronization after UC rotation and redeploy/restart serving workloads to load the updated credentials. Passing the actual value as an environment variable or job parameter does not turn it into a secret reference. [Serving environment secrets](https://docs.databricks.com/aws/en/machine-learning/model-serving/store-env-variable-model-serving).

### App resource declarations

The App `secret` resource accepts workspace `scope` and `key`. It does not declare UC secrets or automatically grant `READ SECRET` on them. A top-level bundle UC secret resource is a different resource type from an App's secret dependency. [App resource types](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/resources).

Our `evaluate_deploy_app` deployment notebook discovers the App-managed SPN after bundle deployment and applies the UC grants. Notebook 5.1 provides the manual alternative. GitHub CD triggers the Databricks job; it does not perform those grants itself.

## UC MLflow trace permissions

**`ALL PRIVILEGES` is not sufficient for UC trace tables: explicitly grant `SELECT` and `MODIFY`.** The runtime identity also needs `USE CATALOG` and `USE SCHEMA`. Experiment permissions alone do not provide access to traces stored in UC. [MLflow UC tracing requirements](https://docs.databricks.com/aws/en/mlflow3/genai/tracing/trace-unity-catalog).

For this course's `llmops_dev.arxiv` trace location:

| Object | Runtime grants |
| --- | --- |
| Catalog `llmops_dev` | `USE CATALOG` |
| Schema `llmops_dev.arxiv` | `USE SCHEMA` |
| `llmops_otel_spans` | `SELECT`, `MODIFY` |
| `llmops_otel_logs` | `SELECT`, `MODIFY` |
| `llmops_otel_metrics` | `SELECT`, `MODIFY` |
| `llmops_otel_annotations` | `SELECT`, `MODIFY` |
| Views `llmops_trace_metadata`, `llmops_trace_unified` | `SELECT` |

Notebook 4.0 applies these explicit grants. Trace ingestion uses Zerobus; grant table permissions to the SPN actually authenticating the writer. [OTLP ingestion permissions](https://docs.databricks.com/aws/en/ingestion/opentelemetry/configure).

### Which SPN writes traces?

This course uses the **existing agent SPN with pre-granted runtime permissions** for both the App agent and Model Serving. The App-managed SPN only bootstraps access to the two UC credentials.

App resource declarations cannot express the required UC trace table grants. This is different from claiming that UC privileges can never be granted to an App-managed SPN: the cited documentation does not establish that blanket restriction. Direct grants and authentication support are separate questions; this course uses the existing SPN rather than relying on automatic App resource grants for tracing.

The App selects `cfg.experiment_name` in code. Model Serving sets `MLFLOW_EXPERIMENT_ID` and `ENABLE_MLFLOW_TRACING=true` in its serving environment. That flag does not grant permissions or replace the experiment's UC trace-location configuration.

## Deployment and identity sequence

CD promotes through `acc` then `prd`, using the same target for the GitHub
environment and bundle deployment. Configure required reviewers on the GitHub
`prd` environment to gate production deployment; the environment name alone
does not enforce approval. See [CD setup](lecture5-service-principal-permissions.md#cicd-release-order).

1. Bundle deployment creates/updates Genie and the App. Genie's `permissions` declaration grants `CAN_RUN` to `${var.agent_service_principal_id}`, the existing agent SPN.
2. CD runs the Databricks `evaluate_deploy_app` job: evaluation and App bootstrap secret grants.
3. After evaluation and grants succeed, the same Databricks job runs the App through `databricks bundle run`, invokes it using SPN OAuth, and stops it in `finally` to avoid course compute costs. A normal production deployment would leave it running.
4. The App-managed SPN reads UC credentials, then the agent uses the existing SPN for Genie, models, Lakebase, and tracing.
5. Notebook 5.2 independently deploys the `latest-model` alias to Model Serving, synchronizes workspace secrets, and demonstrates invocation.

Genie access must belong to the identity making the agent's Genie calls. Granting only the App-managed SPN access would not fix this agent's permission error. The runtime SPN also needs the warehouse and underlying data permissions; a Genie space grant does not replace those.

### Saved notebook validation job

`resources/testing_jobs/lecture5_validation.yml` defines the persistent
`lecture5-validation-dev` job on serverless environment v5. Its tasks run
notebooks 4.4, 5.1, and 5.2; both lecture 5 tasks depend on successful model
registration. Notebook 5.1 starts the previously deployed App, waits for it,
and stops it after invocation.

To run an individual notebook and keep its history on the saved job:

```bash
databricks bundle run lecture5-validation -t dev --only mlflow_log_register
databricks bundle run lecture5-validation -t dev --only agent_app_invoke
databricks bundle run lecture5-validation -t dev --only model_serving_deployment
```
