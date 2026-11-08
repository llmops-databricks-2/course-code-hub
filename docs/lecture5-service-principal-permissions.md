# Lecture 5: Service Principal Permissions

Lecture 5 uses three separate identities. Keeping them separate explains why a
bundle can deploy successfully while a job or App still cannot access a model,
table, or Lakebase database.

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
- Permission to run the App deployment operation when the release gate passes.

Jobs use the Run-as identity's permissions while executing. Setting the CD
SPN as the Run-as identity is optional for development, but recommended for a
stable production pipeline.

## 3. Databricks App service principal

Every Databricks App receives its own dedicated service principal. It should
not reuse the GitHub or Job SPN. The App resource configuration grants it:

- `CAN RUN` on the Genie Agent.
- `CAN USE` on the SQL warehouse.
- `CAN CONNECT AND CREATE` on the Lakebase resource.
- `CAN EDIT` or `CAN MANAGE` on the MLflow experiment, depending on the App's
  tracing requirements.
- `CAN QUERY` on the chat and embedding model services.
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
5. Keep the App's automatically created SPN separate.
