# course-code-hub
Full code for LLMOps with Datarbricks Course

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
