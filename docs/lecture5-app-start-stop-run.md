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
settings against the deployed bundle state and submits the App deployment. We
do not need to repeat the command or environment variables in Python.

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

## Calling bundle run from our deployment notebook

From `resources/deployment_scripts/evaluate_deploy_app.py`:

```python
import subprocess

env = dbutils.widgets.get("env")
subprocess.run(
    ["databricks", "bundle", "run", "arxiv_agent_app", "--target", env],
    cwd="../..",
    check=True,
)
```

The relative working directory selects the repository root containing
`databricks.yml`. The compute must have the modern Databricks CLI installed,
authentication available to that subprocess, and access to the bundle files
and workspace deployment state. A Python `WorkspaceClient` object does not
automatically pass its credentials to the CLI.

Bundle state lives in the workspace. The workspace, target, and resolved
`workspace.root_path` must identify the same deployment. Our `acc` and `prd`
roots are shared paths; the `dev` root includes the authenticated user's name.
Changing identities in `dev` can therefore select a different deployment root.
[Bundle identity and state](https://docs.databricks.com/aws/en/dev-tools/cli/bundle-commands#bundle-target-and-identity).

**Validation status:** after redeployment and setting
`MLFLOW_TRACING_SQL_WAREHOUSE_ID` from `cfg.warehouse_id`, evaluation and grants
completed. The subprocess reached the provided CLI, which refused notebook
execution with: "The Databricks CLI is only supported for interactive use from
the web terminal." This approach does not work with the CLI provided on the
tested serverless compute. App deployment and HTTP invocation were not reached.
[Saved test run](https://dbc-e81ca4d2-f6bd.cloud.databricks.com/jobs/1119535430976889/runs/600017930765782).

The notebook implementation below describes the intended sequence; it is not
a validated working CD flow while that CLI restriction remains.

## Course release sequence

1. CD deploys the bundle resources and uploaded files.
2. The Databricks job evaluates the agent and grants the App principal UC secret access.
3. The notebook calls `bundle run arxiv_agent_app` to activate the candidate code.
4. It invokes the App with OAuth, checks HTTP 200, and prints the response text.
5. It stops the App in `finally` to avoid ongoing course compute costs. Normal production would leave it running.

`bundle run evaluate_deploy_app` starts the **Databricks job**; the notebook's
`bundle run arxiv_agent_app` runs the **App**. The selected resource key determines
which operation happens.
