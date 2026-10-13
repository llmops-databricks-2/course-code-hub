# course-code-hub
Full code for LLMOps with Datarbricks Course

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
teacher, the way the course runs its notebooks, as the job the same file declares: a serverless job
on environment 5 whose environment installs the wheel the bundle builds, so the notebook imports
`arxiv_curator`, `loguru` and the pinned `openai` without an install cell:

```bash
databricks bundle run gateway_demo -t dev --profile <your profile>
```

To run it interactively instead, give the notebook the same environment: in the Environment side
pane add the wheel the deploy uploaded,
`/Workspace/Users/<you>/.bundle/dev/course-code-hub/artifacts/.internal/arxiv_curator-0.0.0-py3-none-any.whl`,
or open the repository as a Git folder and attach the notebook to Git Folder Serverless, which
builds its environment from this `pyproject.toml` (`[tool.databricks.environment]`, environment 5).

It uses the course's pinned `openai` client with the workspace's credentials:
`databricks-openai` 0.14.0 and later, which offer `DatabricksOpenAI(use_ai_gateway=True)`, cannot be
installed beside the course's pins (they need `pydantic>=2.12.2`, and 0.17.1 also needs
`typing-extensions>=4.15` against serverless environment 5's `~=4.12.2`).
