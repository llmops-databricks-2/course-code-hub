# Databricks Apps: start, stop, deploy, and bundle run

Starting App compute and deploying new App code are separate operations.

## Which operation does what?

| Operation | Code and configuration | Compute |
| --- | --- | --- |
| `databricks bundle deploy -t acc` | Uploads bundle files and creates or updates declared resources. Does not activate the updated App code. | Does not restart the App process. |
| `databricks bundle run arxiv_agent_app -t acc` | Creates an App deployment using the bundle's source path and resolved App configuration. | Starts compute if needed, then deploys the App. |
| `databricks apps start agent-arxiv-curator-acc` | Resumes the existing deployment. Does not deploy newly uploaded source files. | Starts stopped App compute. |
| `databricks apps stop agent-arxiv-curator-acc` | Retains the App resource and its deployment. | Stops App compute; the App cannot serve requests while stopped. |
| `databricks apps deploy <app-name> --source-code-path <workspace-path>` | Creates a deployment from the specified source. Unlike `bundle run`, this API-style invocation does not resolve our bundle's inline configuration. | Runs the new deployment on App compute. |

Sources: [bundle commands](https://docs.databricks.com/aws/en/dev-tools/cli/bundle-commands), [App commands](https://docs.databricks.com/aws/en/dev-tools/cli/reference/apps-commands), and [Apps CI/CD](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/cicd-github-actions).

## Why bundle run matters here

Our App command and environment variables are declared once in
[`resources/agent_app.yml`](../resources/agent_app.yml). `bundle run` resolves those
settings against the deployed bundle state and submits the App deployment.
Our notebooks use the SDK instead, so they pass these settings explicitly.

`arxiv_agent_app` is the **bundle resource key**. `agent-arxiv-curator-acc` is the
**workspace App name**, used by the Apps API and `apps start` / `apps stop`.

In the CLI version pinned by this repository, 1.24.0, `bundle run` starts stopped
compute and then calls the App deployment API. Calling it for an already-running
App still creates a deployment. It does not merely resume the previous process.
See the [version-pinned implementation](https://github.com/databricks/cli/blob/v1.24.0/bundle/run/app.go).

## Python SDK equivalents

```python
from databricks.sdk import WorkspaceClient

w = WorkspaceClient()
w.apps.start_and_wait(name=cfg.agent_app_name)
w.apps.stop_and_wait(name=cfg.agent_app_name)
```

These are separate examples: the second call stops the App started by the first.
`w.apps.deploy_and_wait(...)` creates and waits for an App deployment, but it
takes an `AppDeployment` object rather than a bundle resource key. It does not
read `databricks.yml` for you. [SDK reference](https://databricks-sdk-py.readthedocs.io/en/stable/workspace/apps/apps.html).

## Deployment from notebooks

The CLI supplied on tested serverless compute rejects notebook subprocess use.
Notebook 5.1 and the CD deployment job therefore use the Python SDK:

1. Start stopped compute with `w.apps.start_and_wait(...)`.
2. Wait for any pending deployment resumed during startup with
   `w.apps.wait_get_deployment_app_succeeded(...)`, then submit uploaded source
   with `w.apps.deploy_and_wait(...)`.
3. Invoke the App with OAuth and display the response.
4. Stop the App to avoid ongoing course compute costs.

The SDK does not resolve bundle configuration. Both notebooks explicitly pass the
source directory, `uv run start-server` command, and `ARXIV_ENV` / `GENIE_SPACE_ID`
environment variables matching `resources/agent_app.yml`. Keep these in sync.
The deployment job receives `${workspace.file_path}` as its `source_code_path`
notebook parameter. Notebook 5.1 uses its parent directory (the repository root).
Do not rely on `app.default_source_code_path`: it can be empty for a new App,
and the first deployment requires an explicit source path.
The validation job supplies the Genie ID; for interactive use, set notebook
5.1's `genie_space_id` widget.

CD still uses `databricks bundle run evaluate_deploy_app` from GitHub Actions to
launch the Databricks job after deploying the bundle. The job evaluates and grants
secret access before deploying and invoking the App, and stops it in `finally`.
Normal production would leave the App running.

## Verified stopped-App behavior

Notebook 5.1 was run with the start call commented out. `deploy_and_wait()` failed
with: “Cannot deploy app agent-arxiv-curator-dev as it is not in RUNNING state.
Please start the app first.” [Test run](https://dbc-e81ca4d2-f6bd.cloud.databricks.com/jobs/824103077470358/runs/741716130825692).

For stopped compute, use `start_and_wait()` followed by `deploy_and_wait()`.
This is the lifecycle sequence performed by `bundle run arxiv_agent_app`; the CLI
also resolves the source and App configuration from the bundle.
