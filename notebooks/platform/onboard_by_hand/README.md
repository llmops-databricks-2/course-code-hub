# Onboard a student by hand, three ways, then let the pipeline do it

The lecture's live demo. One mock student, `victor.kuznetsov@aarini.com`, gets the first four
things the course's onboarding gives every student, made three times by hand: with Terraform, with
the Python SDK, and with plain REST calls. Each is shown, then deleted, before the next. At the end the
student is added to the intake sheet and the automation pipeline makes all of it, and much more.

| Object | Name | Where it lives |
|---|---|---|
| User, with `workspace-access` and `databricks-sql-access`, in `grp-students-llmops` | `victor.kuznetsov@aarini.com` | account, assigned to the workspace |
| Serverless usage policy, tags `student` and `cohort`, the student its user | `pol-llmops-victor-kuznetsov` | account |
| Schema, owned by `grp-admins-llmops`, the student `ALL_PRIVILEGES` and `MANAGE` | `llmops_dev.victor_kuznetsov` | Unity Catalog |
| Serverless SQL warehouse, 2X-Small, the student `CAN_USE` | `wh-llmops-victor-kuznetsov` | workspace |

The names are the ones the onboarding derives from the address (course-assistant,
`contract/naming.py`), so the pipeline at the end makes the same objects.

Profiles: `course-express` (the workspace) and `course-account` (the account), both
`databricks auth login`. Run everything from the repository root unless a step says otherwise.

## 1. Terraform: declare the end state

```bash
cd notebooks/platform/onboard_by_hand/terraform
terraform init
terraform plan          # 10 to add: what Terraform would do, before it does anything
terraform apply         # create
terraform plan          # "No changes": the state matches the configuration
terraform state list    # the state file remembers every id
terraform destroy       # remove exactly what it made
cd -
```

Talking points: two providers (account and workspace), and why; the state file (local here, shared
and locked in a team); "No changes" on the second plan; destroy knows what to remove because of state.
Right after `apply`, a plan can show one change on the rule set for a few seconds while the account
settles: run it again.

## 2. The Python SDK: call by call

```bash
uv run python notebooks/platform/onboard_by_hand/sdk.py create
uv run python notebooks/platform/onboard_by_hand/sdk.py show
uv run python notebooks/platform/onboard_by_hand/sdk.py delete
```

Talking points: typed calls, two clients; the order matters (the user before the grants); run
`create` twice and the second fails on the first object that exists, which is what the onboarding's
look-up-before-create ("ensure") steps avoid; the script keeps the new user's id in
`.state-sdk.json`, a hand-made state file, because searching users by name lags a create or a delete
by a minute or two.

## 3. REST: everything by hand

```bash
uv run python notebooks/platform/onboard_by_hand/rest.py create
uv run python notebooks/platform/onboard_by_hand/rest.py show
uv run python notebooks/platform/onboard_by_hand/rest.py delete
```

Talking points: the same calls as `sdk.py`, with URLs, bodies, paging and errors written out; two
hosts (`accounts.cloud.databricks.com` and the workspace); the SCIM and rule-set payloads; only the
sign-in is borrowed (`Config.authenticate()`). A user deleted minutes before answers `409 already
exists` until the delete has settled; `create` retries for up to three minutes and says so.

Leave a minute or two between one tool's delete and the next tool's create for the same reason.

## 4. The pipeline: add the student to the list

Done live: the row goes into the sheet during the demo, so the audience sees the list change and the
run react. Before the lecture, make sure the day's scheduled onboarding has finished (GitHub starts
the 06:00 UTC schedule hours late, recently 12:36 to 15:00 UTC), or it may pick the row up
unfiltered:

```bash
gh run list -R llmops-databricks-2/course-assistant -w onboarding.yml -L 1
```

Leave a couple of minutes after step 3's `delete`, so the user's deletion has settled before the
pipeline creates it again. The dry run takes about 2 to 3 minutes and the real run about 5; the
real run also dispatches the first deploy in the new repository, which is worth opening.

1. Add a row to the intake sheet
   (<https://docs.google.com/spreadsheets/d/1hM2Gola2nUC6jBi1_AqYWMc-VNsjLK0GXgGP_zCxqDg/edit#gid=1851995083>): `email address` = `victor.kuznetsov@aarini.com`, `GitHub username`,
   `Discord username`, `Name/Surname`, and `Plan` left blank (full).
2. In `course-assistant`, a dry run for this student alone, then the real run:

   ```bash
   gh workflow run onboarding.yml -R llmops-databricks-2/course-assistant \
     -f dry_run=true -f only=victor.kuznetsov@aarini.com
   gh workflow run onboarding.yml -R llmops-databricks-2/course-assistant \
     -f dry_run=false -f only=victor.kuznetsov@aarini.com
   gh run watch -R llmops-databricks-2/course-assistant
   ```

3. Show the run's summary: every step `created`, or waiting on the student (the invitations), and
   what the hand-made demo did not do: the schemas in `llmops_acc` and `llmops_prd`, the experiments,
   the repository `llmops-victor-kuznetsov` rendered with every id, three deploy principals with their
   federation policies, the first deploys, the Lakebase databases.

Talking points: the identity of the run (`sp-onboarding-llmops`, signed in by OIDC, no secret); the
same names as by hand; a step that finds its object reports `adopted` (skip a delete above and see);
`only=` touches nobody else.

## Clean up after the lecture

The onboarding's reconcile is in `report` mode, so removing the row from the sheet removes nothing.
Remove the student by hand: delete the repository `llmops-victor-kuznetsov`, the three principals
`sp-deploy-victor-kuznetsov-{dev,acc,prd}`, the schemas `llmops_{dev,acc,prd}.victor_kuznetsov`,
the warehouse, the usage policy, the experiments `/llmops/victor-kuznetsov-{dev,acc,prd}`, the Lakebase databases
and roles, the user, and the student's rows in `course_ops.registry` and `audit.onboarding_steps`.
