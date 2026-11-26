# course-code-hub
Full code for LLMOps with Datarbricks Course

## Lecture 5 presentation

- [Browser presentation](presentation_prep/lecture5/lecture5.html)

Press **F** to present, use the arrow keys to navigate, and **N** for speaker notes.
Keep the HTML, CSS, JavaScript, and assets together when downloading.

## Lecture 4 materials

- [Lecture notes in HTML](lecture_materials/lecture4.html) — download and open in a browser.
- [Lecture notes in PDF](lecture_materials/lecture4-materials.pdf)
- [Lecture slides in PDF](presentations/lecture4.pdf)
- [Browser presentation with speaker notes](presentation_prep/lecture4/lecture4.html)

Lecture 4 covers MLflow components, workspace and Unity Catalog storage, sensitive
trace data and permissions, tracing implementation, evaluation, and observability.
The demos follow notebooks 4.0–4.4. In the browser presentation, press **F** to
present, use the arrow keys to navigate, and press **N** for notes and sources.
Keep its CSS, JavaScript, and assets alongside the HTML when downloading it.

## Data pipeline and Genie deployment

`resources/initialize_data.yml` defines a small initialization job and a job-run
resource. During deployment it creates the schema and `arxiv_papers` Delta table
if missing, using the column types expected by `DataProcessor`. Existing data is
preserved. Genie references this run's outcome, so it waits only for table
initialization, not ingestion, PDF parsing, embeddings, or Lakebase sync.

```bash
databricks bundle deploy -t dev --profile dbc-e81ca4d2-f6bd
```

The initialization check runs on each deployment that includes its job-run
resource, so it also handles a table that has been dropped since the last deploy.
The data-processing job is defined separately in `resources/process_data.yml`.
Deploying it does not start ingestion. To deploy and run it independently:

```bash
databricks bundle deploy -t dev --profile dbc-e81ca4d2-f6bd --select jobs.data-pipeline
databricks bundle run data-pipeline -t dev --profile dbc-e81ca4d2-f6bd
```

The job runs `process_data` followed by `sync_lakebase`, each in its own deployment
script. To sync already processed chunks without downloading or processing again:

```bash
databricks bundle run data-pipeline -t dev --profile dbc-e81ca4d2-f6bd --only sync_lakebase
```

For a targeted development deployment of Genie and its initialization dependencies:

```bash
databricks bundle deploy -t dev --profile dbc-e81ca4d2-f6bd --select genie_spaces.arxiv-curator-space
```

Notebook 4.0 creates or selects the configured experiment, checks its Unity Catalog
binding, and then grants the service principal access to the trace tables and views.
It reads the application ID from the UC secret `databricks_client_id` in the configured
catalog and schema. Tables receive `SELECT, MODIFY`; views receive `SELECT`.

Notebook 4.4 logs the model without automatic resource-based authentication.
When deploying the serving endpoint, configure secret-backed `DATABRICKS_CLIENT_ID`
and `DATABRICKS_CLIENT_SECRET`, the workspace `DATABRICKS_HOST`, and the created
experiment's `MLFLOW_EXPERIMENT_ID`. These grants do not configure a serving endpoint.
See [Databricks UC tracing setup](https://docs.databricks.com/aws/en/mlflow3/genai/tracing/trace-unity-catalog).

Notebook test job definitions live in `resources/testing_jobs/`; the lecture
notebooks remain in `notebooks/`. These jobs run only when explicitly triggered.
The ingestion notebook test overwrites `arxiv_papers`, so use an isolated test
schema when running it against existing data.

Bundle deployment runs the `monitoring-view` job to create or update the live
view; the target environment's UC trace tables must already exist. The separate
lecture 6 monitoring test job evaluates existing traces. It is defined in
`resources/testing_jobs/lecture6_monitoring.yml`, alongside the other optional
test jobs; enable the testing-jobs include in `databricks.yml` to deploy it.
The dashboard definition is in `resources/dashboards/`.

Databricks App telemetry is configured in `resources/agent_app.yml` for each
target's catalog and schema. It writes app logs to `app_otel_logs`, separate
from the MLflow trace tables. Databricks also requires destinations for app
metrics and spans, named `app_otel_metrics` and `app_otel_spans`. The App must
be redeployed for telemetry changes to take effect. The deploying identity and
App service principal must meet the documented privileges for creating or using
the target tables; see [App telemetry requirements](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/observability).
App telemetry ingestion is billed separately through Zerobus Ingest.

The `lecture4-tracing-evaluation` testing job runs notebooks 4.0 through 4.4
sequentially. It has no schedule or deployment-triggered run. Notebook 4.0 grants
trace permissions; notebook 4.4 evaluates and registers a model version and updates
its `latest-model` alias. Run it explicitly after the data pipeline has completed:

```bash
databricks bundle deploy -t dev --profile dbc-e81ca4d2-f6bd --select jobs.lecture4-tracing-evaluation
databricks bundle run lecture4-tracing-evaluation -t dev --profile dbc-e81ca4d2-f6bd
```

For user-authenticated Lakebase connections, `lakebase_user` in `project_config.yml`
can select a group database role. The dev configuration uses `grp-teachers-llmops`:
group members connect with their own OAuth token and the group's database username.
Omit the setting to use the individual user's role. Service-principal connections
continue to use the service principal's application ID.

Run the mocked deployment-notebook tests locally:

```bash
uv run pytest
```

## Lecture 1 materials

- [Lecture notes in HTML](lecture_materials/lecture1.html) — download and open in a browser.
- [Lecture notes in PDF](lecture_materials/lecture1-materials.pdf)
- [Lecture slides in PDF](presentations/lecture1.pdf)

The notes cover serverless environment 5, the current course notebooks, Unity Gateway,
and the ingestion bundle, with links to the Databricks documentation.

## Lecture 3 materials

- [Lecture notes in HTML](lecture_materials/lecture3.html) — download and open in a browser.
- [Lecture notes in PDF](lecture_materials/lecture3-materials.pdf)
- [Lecture slides in PDF](presentations/lecture3.pdf)

The notes cover agent orchestration, custom tools, MCP, Genie, and Lakebase session
memory, with code examples, permission guidance, troubleshooting, and homework.
The examples align with the current course notebooks and bundle configuration.

## Demonstration: an OpenAI model behind the AI Gateway

`resources/gateway_demo.yml` declares two Unity Catalog objects in `course_ops.gateway`, beside the
course's own model services (`chat`, `embed`, `assessment`, which this bundle does not manage). It
is the gateway form of lecture 1.4's external model:

- `course_ops.gateway.openai`, a **model provider service**: OpenAI, with one target, `gpt-4o-mini`
  (`openai/v1/chat/completions`);
- `course_ops.gateway.openai_demo`, a **model service** routed to it, limited to 400 requests a
  minute in all; the teachers (`grp-teachers-llmops`) may call it, students may not.

The OpenAI key is read **by reference** from the Unity Catalog secret
`course_ops.secrets.openai_api_key`, which must exist before the deploy. The key is never copied
into this repository, the bundle or the services' configuration.

Deploy by hand, as a teacher, with the Databricks CLI 1.20.0 or later (`databricks.yml` refuses an
older one):

```bash
databricks --version
databricks bundle deploy -t dev --profile <your profile>
```

The two objects belong to the `dev` target only: a deploy of `acc` or `prd` never touches them.
One teacher deploys them and owns them. The model service runs with its owner's privileges, so that
teacher must be able to read the secret, and a caller needs `EXECUTE` on the model service and
`USE CATALOG`/`USE SCHEMA` on `course_ops` and its `gateway` schema, nothing on the provider
service. The bundle's state lives in that teacher's workspace folder, so another person's `dev`
deploy of this repository would try to create the two again and fail. Students do not deploy this
bundle.

Call the model service with `databricks-openai` 0.14.0 or later, in an environment outside the
course's pins (see the notebook below for the course's own environment):

```python
from databricks_openai import DatabricksOpenAI

client = DatabricksOpenAI(use_ai_gateway=True)
response = client.chat.completions.create(
    model="course_ops.gateway.openai_demo",
    messages=[{"role": "user", "content": "Say hello in five words."}],
)
print(response.choices[0].message.content)
```

Each call is recorded in `system.ai_gateway.usage`, with
`service_name = 'course_ops.gateway.openai_demo'`.

`notebooks/1.5_external_models_ai_gateway.py` does all of this in a notebook: it calls the model
service named by its `model_service` parameter (default `course_ops.gateway.openai_demo`) with
MLflow tracing on, prints the answer and the trace id, reports a provider's refusal (OpenAI's `401`
for a wrong key) as a message, and reads your calls back from `system.ai_gateway.usage`. Run it as a
teacher: the deploy syncs it with the bundle's files, and the notebook carries its own serverless
environment in its first lines, an inline [PEP 723](https://peps.python.org/pep-0723/) block the
notebook format reads (environment version 5; one dependency, `..`, the course project one folder
up, so `arxiv_curator`, `loguru` and the pinned `openai` are installed when the notebook opens). No
install cell and no job. Open it from your bundle folder,
`/Workspace/Users/<you>/.bundle/dev/course-code-hub/files/notebooks/`, and run it on serverless.

It uses the course's pinned `openai` client with the workspace's credentials:
`databricks-openai` 0.14.0 and later, which offer `DatabricksOpenAI(use_ai_gateway=True)`, cannot be
installed beside the course's pins (they need `pydantic>=2.12.2`, and 0.17.1 also needs
`typing-extensions>=4.15` against serverless environment 5's `~=4.12.2`).
