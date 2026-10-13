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

Call the model service from a notebook or a laptop with `databricks-openai`:

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
