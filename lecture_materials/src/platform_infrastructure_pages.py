"""Build lecture_materials/platform-infrastructure.html, the study guide of the platform lecture.

The pages are A4, in the look of lecture4.html: its <head> (fonts and styles) is reused as is,
and each page below is one <section class="page">. Run from the repository root:

    python3 lecture_materials/src/platform_infrastructure_pages.py
"""

import re
from pathlib import Path

TITLE = "Platform infrastructure"
DATE = "Lecture · November 2026"
ROOT = Path(__file__).resolve().parents[2]
HEAD_FROM = ROOT / "lecture_materials" / "lecture4.html"
OUT = ROOT / "lecture_materials" / "platform-infrastructure.html"

DOCS = "https://docs.databricks.com/aws/en"
FIGURES = ROOT / "lecture_materials" / "src" / "platform-infrastructure" / "figures"
SETUP_FIGURE = (FIGURES / "system-overview.html").read_text()

PAGES: list[str] = [
    # 1
    f"""<h1>{TITLE}</h1>
<p class="lead">From an empty Databricks account to a student's first deploy</p>
<p>Every lecture so far started inside a workspace that was already there: your user, your schemas,
your warehouse, your repository and three deploy service principals existed before you logged in.
This lecture goes top to bottom through how that platform was built: the account and its identities,
the metastore, the workspace, GitHub and the trust between them, and the code that creates all of
it. It ends with why that code matters more than the objects it makes.</p>
<h2>What you should be able to do</h2>
<ul>
<li>Tell the account from the workspace, and say which admin role can change what.</li>
<li>Choose between users, service principals, account groups and entitlements for a given need.</li>
<li>Trace a Unity Catalog privilege from the metastore down to your schema in each environment.</li>
<li>Choose how automation signs in, and explain how a GitHub Actions job does it without a secret.</li>
<li>Compare REST, the SDKs, the CLI, bundles and Terraform, and pick one for a job.</li>
<li>Write an idempotent "ensure" step, and say why a platform has to be rebuildable from code.</li>
</ul>
<h2>Reading map</h2>
<table><thead><tr><th>Pages</th><th>Topic</th></tr></thead><tbody>
<tr><td>2</td><td>Databricks as a platform: your Databricks account, your cloud account, the planes</td></tr>
<tr><td>3–6</td><td>The account, its admins, identities and the one-time setup</td></tr>
<tr><td>7–8</td><td>Unity Catalog and the workspace</td></tr>
<tr><td>9–12</td><td>GitHub, how it signs in, automation identities and secrets</td></tr>
<tr><td>13–14</td><td>Ways to manage resources, and what the course chose</td></tr>
<tr><td>15–18</td><td>The workspace migration, the course's automation, onboarding, demos</td></tr>
</tbody></table>
<div class="note"><b>The running example</b> is this course's own platform: one Express setup
workspace per cohort, a GitHub organisation per cohort, and the repository
<code>course-assistant</code> that provisions both. The demos are in
<code>notebooks/platform/</code> of this repository.</div>""",
    # 2
    f"""<h1>Start with the platform</h1>
<p>Databricks runs on a cloud provider: AWS, Azure or Google Cloud. The provider supplies the machines,
the network, the regions and the object storage. On top of it, Databricks splits itself in two. The
<b>control plane</b> holds the backend services Databricks manages in your Databricks account, a
perimeter of its own, outside your cloud account: the web application, the APIs, Unity Catalog. The
<b>compute plane</b> is where your data is processed.</p>
<div style="display:grid;grid-template-columns:24mm 1fr 1fr;gap:1.5mm;font-size:9pt;margin:3mm 0">
<div></div><div style="background:#f4f0eb;padding:2mm;font-weight:600">Your Databricks account (run by Databricks)</div><div style="background:#f4f0eb;padding:2mm;font-weight:600">Your cloud account</div>
<div style="font-weight:600;padding:2mm">Control plane</div><div style="background:#f0f4fb;border:1px solid #cdd8ed;padding:2mm">Web application, REST APIs, jobs service, Unity Catalog, small notebook results</div><div style="padding:2mm;color:#888">nothing</div>
<div style="font-weight:600;padding:2mm">Compute plane</div><div style="background:#f0f4fb;border:1px solid #cdd8ed;padding:2mm"><b>Serverless</b>: notebooks, jobs, SQL warehouses, model serving, apps. Starts in seconds; the course uses only this.</div><div style="border:1px dashed #ccc;padding:2mm"><b>Classic</b>: clusters in your VPC, no public IPs, connecting out to the control plane.</div>
<div style="font-weight:600;padding:2mm">Storage</div><div style="background:#f0f5f2;border:1px solid #c8dad2;padding:2mm"><b>Default storage</b> of a serverless workspace: your tables, volumes and the workspace's own files.</div><div style="border:1px dashed #ccc;padding:2mm">Your S3 bucket: the workspace storage of a classic workspace, and any external data.</div>
</div>
<p>The course's workspace was made by <b>express setup</b>, so it is a serverless workspace: everything
above runs in your Databricks account, on AWS <code>us-west-2</code>. You bring no cloud account, and you
pay Databricks for compute by the second. Traffic between the control plane and the serverless compute
plane stays on the cloud provider's backbone, never the public internet.</p>
<h2>One query, end to end</h2>
<ol>
<li>Your browser or laptop sends it to the <b>control plane</b>, signed in as you.</li>
<li>The control plane sends it to your warehouse in the <b>compute plane</b>.</li>
<li><b>Unity Catalog</b> checks your privileges on the catalog, schema and table, and audits the access.</li>
<li>The driver splits the work into tasks; <b>executors</b> read the table's files from storage in parallel.</li>
<li>A small result returns through the control plane. Above 1 MB, a client using Cloud Fetch gets links and downloads the result files straight from storage.</li>
</ol>
<p class="sources"><b>Interactive</b> view 1 of <code>PLATFORM-UNDER-THE-WORKSPACE.html</code> · <b>Read more</b>
<a href="{DOCS}/getting-started/high-level-architecture">High-level architecture</a> ·
<a href="{DOCS}/admin/workspace/serverless-workspaces">Serverless workspaces</a> ·
<a href="{DOCS}/integrations/odbc/capability">Cloud Fetch</a></p>""",
    # 3
    """<h1>Read the platform top to bottom</h1>
<p>Databricks has two control planes you program against. The <b>account</b> holds identities,
workspaces, metastores, billing and the trust settings for outside identity providers. Each
<b>workspace</b> holds the things you build: jobs, warehouses, experiments, apps, serving endpoints,
notebooks. Unity Catalog sits across both: the metastore is an account object, and its catalogs are
reached from the workspaces attached to it.</p>
<div class="flow"><b>Account</b> · users, service principals, groups, federation policies, budgets<br>
└── <b>Metastore</b> (one per region) · catalogs → schemas → tables, volumes, models, functions<br>
└── <b>Workspace</b> · identity assignments with entitlements, compute, jobs, apps, experiments<br>
<b>GitHub organisation</b> · repositories → environments → workflows that sign in to the workspace</div>
<table><thead><tr><th>Layer</th><th>Course example</th><th>API</th></tr></thead><tbody>
<tr><td>Account</td><td>One account per cohort, Express setup, pay-as-you-go</td><td><code>AccountClient</code>, <code>accounts.cloud.databricks.com</code></td></tr>
<tr><td>Identities</td><td>Students, teachers, 3 shared and 3 per-student service principals, 5 groups</td><td>Account SCIM; workspace assignment</td></tr>
<tr><td>Metastore</td><td>Owned by the teachers' group; <code>llmops_dev</code>, <code>_acc</code>, <code>_prd</code>, <code>course_ops</code></td><td><code>WorkspaceClient</code> Unity Catalog APIs, SQL</td></tr>
<tr><td>Workspace</td><td>Serverless only; a warehouse, usage policy and experiment per student</td><td><code>WorkspaceClient</code>, the workspace host</td></tr>
<tr><td>GitHub</td><td><code>llmops-databricks-2</code>: one repository per student, environments dev, acc, prd</td><td>GitHub REST through a GitHub App</td></tr>
</tbody></table>
<p>Build from the top. A workspace user needs an account identity; a Unity Catalog grant needs an
account group; a GitHub deploy needs a service principal with a federation policy. The order in
which the course creates things is this dependency order.</p>""",
    # 3
    f"""<h1>Know who can change what</h1>
<p>Three admin roles look alike and do different things. Most platform mistakes are a task done with
the wrong one, or a role handed out because it was the only one someone knew.</p>
<table><thead><tr><th>Role</th><th>Scope and typical tasks</th></tr></thead><tbody>
<tr><td>Account admin</td><td>The account: create workspaces and metastores, manage users, service principals and account groups, assign them to workspaces, federation policies, account settings.</td></tr>
<tr><td>Billing admin</td><td>Budgets and serverless usage policies. The course found that creating a usage policy needs this role, not account admin alone.</td></tr>
<tr><td>Workspace admin</td><td>One workspace: entitlements, workspace settings, <code>CAN MANAGE</code> on every workspace object (jobs, warehouses, apps).</td></tr>
<tr><td>Metastore admin</td><td>Unity Catalog: create catalogs, grant and transfer ownership on any securable. No data access by default, but can grant it to themselves, audited.</td></tr>
</tbody></table>
<h2>Express setup and Free Edition</h2>
<p>The course runs on an account made by <b>express setup</b>: a serverless workspace with default
storage and no cloud account of your own, a 14-day trial, then pay-as-you-go. In the course's account
the account console and account APIs stayed available, which this lecture relies on.
<b>Free Edition</b>, for self-study, is different: one workspace, no account console or account
APIs, no SCIM, one 2X-Small warehouse, and no commercial use.</p>
<div class="note"><b>Give the role to a group, the object to a group.</b> The metastore is owned by
<code>grp-owners-llmops</code>, the teachers. Ownership by one person ends when they leave; ownership
by a service principal makes the automation a metastore admin.</div>
<p class="sources"><b>Read more</b> <a href="{DOCS}/admin/admin-concepts">Admin roles</a> ·
<a href="{DOCS}/getting-started/express-setup">Express setup</a> ·
<a href="{DOCS}/getting-started/free-edition-limitations">Free Edition limits</a> ·
<a href="{DOCS}/data-governance/unity-catalog/manage-privileges/admin-privileges">Admin privileges in Unity Catalog</a></p>""",
    # 4
    f"""<h1>Pick the right identity</h1>
<p>A <b>user</b> is a person who signs in. A <b>service principal</b> is an identity for automation:
it signs in with OAuth, never with a password, and it survives the people who created it. A
<b>group</b> carries rights so you grant once, not per person. Create all three in the account,
then assign them to the workspace.</p>
<table><thead><tr><th>Identity</th><th>What it does in the course</th></tr></thead><tbody>
<tr><td><code>sp-onboarding-llmops</code></td><td>The daily onboarding run. Account, billing and workspace admin, because it creates users, principals and usage policies.</td></tr>
<tr><td><code>sp-monitoring-llmops</code></td><td>Deploys the monitoring bundle and runs its jobs. A workspace user with grants, not an admin.</td></tr>
<tr><td><code>sp-evals-llmops</code></td><td>Runs the assessment evals on pull requests. In no group; holds five narrow grants.</td></tr>
<tr><td><code>sp-deploy-&lt;you&gt;-&lt;env&gt;</code></td><td>Three per student. Each deploys your bundle to one environment and writes that environment's schema alone.</td></tr>
<tr><td><code>grp-students-llmops</code> and four more</td><td>Owners, admins, students, teachers, services: every grant goes to one of them.</td></tr>
</tbody></table>
<h2>Account groups, not workspace groups</h2>
<p>Workspace-local groups are legacy: they cannot be granted Unity Catalog privileges, assigned
to another workspace or given an account role. The course creates every group in the account and
assigns it to the workspace. In a company, an identity provider (Entra ID, Okta) usually owns the
users and groups and syncs them in; here the code creates them.</p>
<h2>Entitlements are explicit</h2>
<p>Being assigned to a workspace is not the same as being allowed to use it. Entitlements
(<code>workspace-access</code>, <code>databricks-sql-access</code>, <code>allow-cluster-create</code>)
decide that, and since 14 September 2026 they are granted explicitly: the <code>users</code> group carries none. A deploy principal without
<code>workspace-access</code> was refused by the workspace's APIs in the course's first rehearsal.</p>
<p class="sources"><b>Read more</b> <a href="{DOCS}/admin/users-groups/">Users, service principals and groups</a> ·
<a href="{DOCS}/admin/users-groups/entitlements">Entitlements</a></p>""",
    # 5
    """<h1>Set up the account once, by code</h1>
<p>Some objects must exist before any automation can run: the automation's own identity, its roles,
the groups and the catalogs it writes into. In the course they are made by one script,
<code>scripts/setup_cohort.py</code> in <code>course-assistant</code>, run by an account admin from a
laptop with an OAuth profile. Nothing is clicked in the console.</p>
<table><thead><tr><th>Part, in order</th><th>What it makes, and the right it needs</th></tr></thead><tbody>
<tr><td><code>principals</code></td><td>The onboarding and monitoring principals, entitlements, one GitHub federation policy each. Account admin.</td></tr>
<tr><td><code>account-admin</code>, <code>billing-admin</code></td><td>The onboarding principal's roles, so the daily run can create users and usage policies.</td></tr>
<tr><td><code>groups</code>, <code>owners</code></td><td>The five account groups with their members, assigned to the workspace.</td></tr>
<tr><td><code>metastore</code></td><td>The metastore handed to <code>grp-owners-llmops</code>. Must run before any grant on <code>system</code>.</td></tr>
<tr><td><code>system-schemas</code></td><td>The system tables monitoring reads, granted to the monitoring principal.</td></tr>
<tr><td><code>warehouse</code>, <code>catalog</code>, <code>catalogs</code></td><td>The ops warehouse, <code>course_ops</code> and the three environment catalogs, owned by the admins group.</td></tr>
<tr><td><code>secret</code>, <code>destinations</code>, <code>budget</code>, <code>lakebase</code>, <code>teachers</code>, …</td><td>Unity Catalog secrets, alert destinations, the model budget, the vector store, the teachers' kit.</td></tr>
</tbody></table>
<pre><code># read what exists and what would be made: the default is a dry run
PYTHONPATH=src uv run python scripts/setup_cohort.py --profile course-account
# then write, and run the dry run again: every part must say "exists"
PYTHONPATH=src uv run python scripts/setup_cohort.py --profile course-account --apply</code></pre>
<p>Three rules make it safe to run again at any time: every part looks up by name before it
creates, the default only reads, and the profile is always named, never guessed. The second run of a
correct setup changes nothing.</p>""",
    # 6
    f"""<h1>Trace a privilege through Unity Catalog</h1>
<p>A metastore is the top container for data and AI assets in one region; a workspace is attached to
exactly one. Inside it, <code>catalog.schema.object</code>. A privilege granted on a catalog or schema
is inherited by everything below it, and you also need <code>USE CATALOG</code> and
<code>USE SCHEMA</code> on the way down.</p>
<table><thead><tr><th>Securable</th><th>Who holds what in the course</th></tr></thead><tbody>
<tr><td><code>llmops_dev.&lt;you&gt;</code></td><td>You: <code>ALL PRIVILEGES</code> and <code>MANAGE</code>, your sandbox. Your dev deploy principal: <code>ALL PRIVILEGES</code>.</td></tr>
<tr><td><code>llmops_acc.&lt;you&gt;</code>, <code>llmops_prd.&lt;you&gt;</code></td><td>You: read only. That environment's deploy principal: <code>ALL PRIVILEGES</code>. Nobody writes to production by hand.</td></tr>
<tr><td>The three catalogs</td><td>Owned by <code>grp-admins-llmops</code>; <code>USE CATALOG</code> to the students group.</td></tr>
<tr><td><code>course_ops</code></td><td>The course's own tables, secrets and model services; students reach only <code>gateway</code> and their own rows.</td></tr>
</tbody></table>
<pre><code>effective = w.grants.get_effective("schema", "llmops_acc.jane_doe", principal=me)
for assignment in effective.privilege_assignments or []:
    for privilege in assignment.privileges or []:
        print(privilege.privilege, privilege.inherited_from_name or "granted here")</code></pre>
<h2>Ownership and isolation</h2>
<p>Every catalog and schema is owned by a group, so no single account can lock the others out. A
catalog can be bound to named workspaces (<code>ISOLATED</code>) instead of every workspace on the
metastore (<code>OPEN</code>): the usual way to keep a production catalog writable only from the
production workspace.</p>
<p class="sources"><b>Demo</b> <code>notebooks/platform/p2_unity_catalog_tour.py</code> · <b>Read more</b>
<a href="{DOCS}/data-governance/unity-catalog/manage-privileges/privileges">Unity Catalog privileges</a> ·
<a href="{DOCS}/catalogs/binding">Workspace-catalog binding</a></p>""",
    # 7
    f"""<h1>Shape the workspace for many tenants</h1>
<p>One workspace serves the whole cohort, so each student needs their own resources, their own cost
line and no way into anyone else's. The course does it with names, tags and grants rather than more
workspaces.</p>
<table><thead><tr><th>Resource</th><th>Per student, and why</th></tr></thead><tbody>
<tr><td>Serverless usage policy</td><td><code>pol-llmops-&lt;you&gt;</code>: tags your serverless jobs, notebooks and apps, so <code>system.billing.usage</code> attributes their cost to you.</td></tr>
<tr><td>SQL warehouse</td><td><code>wh-llmops-&lt;you&gt;</code>, 2X-Small, stopped when made. Usage policies do not cover warehouses, so it carries a <code>student</code> tag instead.</td></tr>
<tr><td>Experiment</td><td><code>/llmops/&lt;you&gt;</code>, its traces in Unity Catalog tables in your dev schema.</td></tr>
<tr><td>Lakebase role and database</td><td>On the cohort's shared instance per environment, closed to everyone else.</td></tr>
</tbody></table>
<h2>What a non-admin may create</h2>
<p>Creating a SQL warehouse needs a workspace admin or the cluster-create entitlement, so warehouses
are made for you. A Lakebase project or a vector search endpoint can be created by any user. Those bill while they exist,
so a daily guard job deletes the ones no one registered.</p>
<h2>Names carry the meaning</h2>
<p>Non-Unity Catalog resources are <code>&lt;type&gt;-&lt;purpose&gt;-&lt;owner&gt;</code> in kebab-case
(<code>wh-llmops-jane-doe</code>); Unity Catalog names are snake_case; no name carries the cohort,
the <code>cohort</code> tag does. A deterministic name is what lets code find an object again.</p>
<p class="sources"><b>Read more</b> <a href="{DOCS}/admin/usage/budget-policies">Serverless usage policies</a> ·
<a href="{DOCS}/compute/sql-warehouse/create">Creating a SQL warehouse</a></p>""",
    # 8
    """<h1>Version the code, not just the notebooks</h1>
<p>Each cohort gets a new GitHub organisation, <code>llmops-databricks-2</code> for this one. It
holds the course code, your repository and the repository that provisions the platform. It is
deleted with the workspace when the cohort ends, so you fork what you want to keep.</p>
<table><thead><tr><th>Piece</th><th>How it is set up</th></tr></thead><tbody>
<tr><td>Your repository</td><td><code>llmops-&lt;you&gt;</code>, rendered from a cookiecutter template with your catalog, schema, warehouse id, usage policy and experiment already filled in.</td></tr>
<tr><td>Environments</td><td><code>dev</code>, <code>acc</code>, <code>prd</code>, each with the variable <code>DATABRICKS_CLIENT_ID</code> naming its deploy principal.</td></tr>
<tr><td>Workflows</td><td>CI on a pull request; CD on a merge to <code>main</code>: acceptance first, then production.</td></tr>
<tr><td>The GitHub App</td><td>The onboarding's identity in GitHub. Its private key is the only GitHub secret in the system, kept as a Unity Catalog secret.</td></tr>
</tbody></table>
<h2>Why an App and not a personal token</h2>
<p>A personal access token acts as one person, with all their access, until it expires or they leave.
A GitHub App is installed on the organisation with only the permissions it asks for, and mints a
short-lived installation token for each run.</p>
<div class="note"><b>Protection depends on the plan.</b> On a GitHub Free organisation, required
reviewers on an environment are enforced only for public repositories. A private repository there
does not stop a deploy to <code>prd</code> for an approval; check the plan before you promise a gate.</div>
<p>Lecture 5 covered the branch flow and the promotion between environments. This lecture covers
the part underneath: how a workflow is allowed to deploy at all.</p>""",
    # 9
    f"""<h1>Let GitHub sign in without a secret</h1>
<p>A GitHub Actions job can ask GitHub for an OIDC token: a short-lived, signed statement of which
repository, branch or environment it is running for. Databricks can be told to trust such tokens for
one service principal. The job then exchanges the GitHub token for a Databricks token, and no
long-lived secret is stored anywhere.</p>
<div class="flow"><b>GitHub</b> signs a token: <code>sub = repo:llmops-databricks-2@330009903/llmops-jane-doe@&lt;repo id&gt;:environment:prd</code><br>
→ <b>Databricks</b> finds the federation policy of <code>sp-deploy-jane-doe-prd</code> that matches issuer, subject and audience<br>
→ returns an OAuth token for that principal → <code>databricks bundle deploy -t prd</code></div>
<table><thead><tr><th>Policy field</th><th>Value, and what it pins</th></tr></thead><tbody>
<tr><td>Issuer</td><td><code>https://token.actions.githubusercontent.com</code>: tokens from GitHub Actions only.</td></tr>
<tr><td>Subject</td><td>The repository and environment (or branch, or pull request). Repositories created after 15 July 2026 send the owner's and the repository's ids too, so a renamed or re-created repository does not inherit the trust, and a policy written with names alone does not match.</td></tr>
<tr><td>Audience</td><td>The workspace's <code>/oidc/v1/token</code> endpoint, or the account id for account calls.</td></tr>
</tbody></table>
<pre><code>env:
  DATABRICKS_AUTH_TYPE: github-oidc
  DATABRICKS_HOST: ${{{{ vars.DATABRICKS_HOST }}}}
  DATABRICKS_CLIENT_ID: ${{{{ vars.DATABRICKS_CLIENT_ID }}}}   # the principal's application id
permissions:
  id-token: write                                  # lets the job request the OIDC token</code></pre>
<p>The client id is not a secret: it names the principal, and only a token matching its policy can
act as it. One principal per environment means a token from <code>dev</code> can never deploy to
production.</p>
<table><thead><tr><th>How automation signs in</th><th>When</th></tr></thead><tbody>
<tr><td>Token federation (OIDC)</td><td>Recommended: CI/CD and any workload whose platform issues tokens. No Databricks secret.</td></tr>
<tr><td>OAuth M2M (client secret)</td><td>Unattended jobs where federation is impossible. Secrets last up to 730 days and are deleted after 90 days unused.</td></tr>
<tr><td>OAuth U2M (<code>databricks auth login</code>)</td><td>You, on your laptop: the course's CLI profiles.</td></tr>
<tr><td>Personal access token</td><td>Legacy. One workspace, one person's rights; avoid for automation.</td></tr>
</tbody></table>
<p class="sources"><b>Demo</b> <code>.github/workflows/whoami.yml</code> · <b>Read more</b>
<a href="{DOCS}/dev-tools/auth/provider-github">GitHub Actions token federation</a> ·
<a href="{DOCS}/dev-tools/auth/oauth-federation-policy">Federation policies</a> ·
<a href="{DOCS}/dev-tools/auth/">Authentication methods</a></p>""",
    # 10
    f"""<h1>Give every automation its own narrow identity</h1>
<p>A pipeline that deploys to production is the most powerful user on the platform, and nobody watches
it type. Whoever can act as it can do what it can do. So the automation's identity, and how it
proves who it is, deserve more care than any person's account.</p>
<table><thead><tr><th>Rule</th><th>How the course applies it</th></tr></thead><tbody>
<tr><td>One identity per job, not per team</td><td>Onboarding, monitoring, evals and each student's deploys are separate service principals, never a person's account.</td></tr>
<tr><td>Least privilege, per environment</td><td><code>sp-deploy-&lt;you&gt;-dev</code> writes your dev schema only; the prd one writes prd only. A leaked dev token cannot touch production.</td></tr>
<tr><td>Admin only where the API demands it</td><td>Only <code>sp-onboarding-llmops</code> is account, billing and workspace admin, because creating users and usage policies needs those roles. Monitoring is a plain user with grants.</td></tr>
<tr><td>No stored credential where federation works</td><td>Every workflow signs in by GitHub OIDC. The only secret the course stores is the GitHub App's private key.</td></tr>
<tr><td>Groups and ownership, not people</td><td>Catalogs, schemas and the metastore are owned by groups; people come and go.</td></tr>
<tr><td>Every access audited</td><td><code>system.access.audit</code> records who did what, including each secret read.</td></tr>
</tbody></table>
<h2>What goes wrong without it</h2>
<p>A personal access token in a CI variable acts as one person, with all their rights, in every
environment, until it expires or they leave. Rotation is manual, and a leak is invisible until it is
used. An OAuth secret is better scoped, but it is still a secret to store and rotate, and since
September 2026 an unused one is deleted after 90 days, which breaks a rarely run pipeline.</p>
<p class="sources"><b>Read more</b> <a href="{DOCS}/dev-tools/ci-cd/">CI/CD best practices</a> ·
<a href="{DOCS}/dev-tools/auth/oauth-federation">Why token federation</a> ·
<a href="{DOCS}/dev-tools/auth/oauth-m2m">OAuth M2M</a></p>""",
    # secrets
    f"""<h1>Store the secrets you cannot avoid</h1>
<p>Some credentials cannot be federated: a GitHub App's private key, a webhook URL, a third-party API
key. Databricks offers three places for them, and they do not reach the same places.</p>
<table><thead><tr><th>Where</th><th>How it works</th></tr></thead><tbody>
<tr><td>Workspace secret scope (Databricks-backed)</td><td>A named set of secrets in one workspace, encrypted by Databricks. ACLs per scope (<code>READ</code>, <code>WRITE</code>, <code>MANAGE</code>): who reads one secret reads all. Up to 1,000 scopes, 128 KB a value.</td></tr>
<tr><td>Azure Key Vault-backed scope</td><td>Azure only: a read-only window on a Key Vault, which you manage in Azure. Vault access policies only, not RBAC; access to the scope is access to the whole vault.</td></tr>
<tr><td>Unity Catalog secret (GA August 2026)</td><td><code>catalog.schema.secret</code>, in every workspace on the metastore, governed per secret (<code>READ SECRET</code>), each read audited. Up to 60 KiB.</td></tr>
</tbody></table>
<pre><code># a scope: one workspace, scope-wide access
databricks secrets create-scope platform-demo
dbutils.secrets.get(scope="platform-demo", key="api-key")

# a Unity Catalog secret: governed like a table
databricks secrets-uc create-secret api_key llmops_dev jane_doe "&lt;value&gt;"
dbutils.secrets.get(catalog="llmops_dev", schema="jane_doe", key="api_key")</code></pre>
<h2>Where each one reaches</h2>
<p>Only scopes can be referenced as <code>{{{{secrets/scope/key}}}}</code> in compute environment
variables, model serving environment variables and Databricks Apps resources. Unity Catalog secrets
are read in code: <code>dbutils</code> in notebooks and jobs, the SDK in an app. That is why lecture
5's app reads its credentials with <code>w.secrets_uc.get_secret</code>. On AWS and Azure a Unity
Catalog schema can also front AWS Secrets Manager or Key Vault (Beta). The course keeps its few
secrets in <code>course_ops.secrets</code>, readable only by the principal that needs each.</p>
<p class="sources"><b>Read more</b> <a href="{DOCS}/security/secrets/">Secret management</a> ·
<a href="{DOCS}/security/secrets/unity-catalog-secrets">Unity Catalog secrets</a> ·
<a href="https://learn.microsoft.com/en-us/azure/databricks/security/secrets/workspace-secret-scopes">Key Vault-backed scopes</a> ·
<a href="{DOCS}/security/secrets/external-secrets">External secrets</a></p>""",
    # 11
    f"""<h1>Choose how to manage resources</h1>
<p>Every way of managing Databricks ends in the same REST API, and all of them share one way of
finding credentials (unified authentication: arguments, then environment variables, then a profile
in <code>~/.databrickscfg</code>). They differ in what they do for you. The demo makes the same
volume five ways.</p>
<table><thead><tr><th>Option</th><th>Strengths, and what you still own</th></tr></thead><tbody>
<tr><td>REST API</td><td>The docs' fallback, for when no SDK fits. You write URLs, bodies, paging, retries and error handling.</td></tr>
<tr><td>SDKs (Python 0.169, Go, Java, …)</td><td>For applications and integrations. Typed calls, retries, paging, unified auth. Imperative: whether an object should exist is your code's decision.</td></tr>
<tr><td>CLI (1.27, GA since 1.0)</td><td>One command per call, good in a terminal or a CI step. Same as the SDK underneath; no state.</td></tr>
<tr><td>Bundles</td><td>Declarative YAML for what a project deploys: jobs, pipelines, apps, dashboards, model services, volumes. Targets per environment; a state file in the workspace. The docs' recommendation for CI/CD; the Terraform engine was removed in CLI 1.20.</td></tr>
<tr><td>Terraform (provider 1.144)</td><td>Declarative, a plan before apply. Recommended for cloud-level and account-level resources: workspaces, metastores, identities, networking. You keep and protect the state file.</td></tr>
</tbody></table>
<pre><code># the SDK: look up, then create
try:
    w.volumes.read(f"{{catalog}}.{{schema}}.platform_demo_sdk")
except NotFound:
    w.volumes.create(catalog_name=catalog, schema_name=schema,
                     name="platform_demo_sdk", volume_type=VolumeType.MANAGED)</code></pre>
<pre><code># a bundle: describe the end state, the CLI works out the rest
resources:
  volumes:
    platform_demo_bundle:
      catalog_name: ${{var.catalog}}
      schema_name: ${{var.schema}}
      name: platform_demo_bundle
      volume_type: MANAGED</code></pre>
<p class="sources"><b>Demo</b> <code>notebooks/platform/four_ways/</code> · <b>Read more</b>
<a href="{DOCS}/dev-tools/">Developer tools</a> · <a href="{DOCS}/dev-tools/bundles/">Bundles</a> ·
<a href="https://registry.terraform.io/providers/databricks/databricks/latest/docs">Terraform provider</a></p>""",
    # 11
    """<h1>Match the tool to the job</h1>
<p>The course uses three of the five, each where it fits, and the reasons are more useful than the
choice.</p>
<table><thead><tr><th>Job</th><th>Tool, and why</th></tr></thead><tbody>
<tr><td>One-time account setup</td><td>A Python SDK script: it reads before it writes, runs dry by default, and refuses a profile that points at the wrong account.</td></tr>
<tr><td>Daily onboarding of many students</td><td>The Python SDK: it loops over a list from a sheet, calls GitHub in the same run, and records each step in a table. The student list is the desired state and the audit table is the state; there is no state file to lose.</td></tr>
<tr><td>Monitoring jobs, dashboards, Genie, model services</td><td>A bundle, deployed by CI on every merge: one project's resources, versioned with its code.</td></tr>
<tr><td>Your project</td><td>A bundle with targets <code>dev</code>, <code>acc</code>, <code>prd</code>, deployed by your principals.</td></tr>
<tr><td>Terraform</td><td>Not used here: the course's rule is the SDK only, and Terraform's strength, the account and cloud estate, is small on an express setup account. In a company platform with cloud networking and many workspaces it is the usual choice.</td></tr>
</tbody></table>
<h2>The ensure pattern</h2>
<p>An imperative tool becomes safe to re-run when every step is written as "make sure":</p>
<pre><code>def ensure_volume(w, catalog, schema, name, comment) -&gt; StepResult:
    full_name = f"{catalog}.{schema}.{name}"
    try:
        volume = w.volumes.read(full_name)
    except NotFound:
        w.volumes.create(catalog_name=catalog, schema_name=schema, name=name,
                         volume_type=VolumeType.MANAGED, comment=comment)
        return StepResult("created", full_name)
    if volume.comment != comment:          # drift: changed by hand
        w.volumes.update(full_name, comment=comment)
        return StepResult("updated", full_name)
    return StepResult("adopted", full_name)</code></pre>
<p class="sources"><b>Demo</b> <code>notebooks/platform/p3_ensure_pattern.py</code></p>""",
    # 12
    f"""<h1>Rebuild a workspace from code</h1>
<p>On 2 November 2026, in the middle of lecture 4's week, compute in the cohort workspace stopped
after a payment-method update. Every warehouse query and model call was refused from 10:09 UTC. At
14:46 UTC the API answered: <i>"Workspace … has been banned"</i>. Nobody could say when it would come
back.</p>
<p>The same afternoon the cohort moved to a new express setup workspace in a second account. Nothing
was rebuilt by hand. The repository was pointed at the new workspace and the code that had built the
first one ran again, in narrowing steps:</p>
<table><thead><tr><th>Step</th><th>What ran</th></tr></thead><tbody>
<tr><td>1. Point the code</td><td>The cohort file's workspace and account ids, the bundle's host, the template's host. Tests pass.</td></tr>
<tr><td>2. The account</td><td><code>setup_cohort.py</code> dry run, <code>--apply</code>, dry run again: every part <code>exists</code>.</td></tr>
<tr><td>3. The tables</td><td>The cohort tables in <code>course_ops</code>, created empty.</td></tr>
<tr><td>4. GitHub variables</td><td>The new host and the new principals' client ids. The secrets did not change.</td></tr>
<tr><td>5–8. Onboarding</td><td>The teachers' projects alone; the whole list as a dry run; one test student; then everyone, and the schedule back on.</td></tr>
</tbody></table>
<p>Your GitHub repositories survived: they live outside Databricks. The onboarding found each one,
gave it new deploy principals and rewrote its variables. What did not come back was the data no code
makes: tables written in the old workspace, which no compute could read while it was blocked.</p>
<div class="note"><b>The lesson.</b> A workspace is replaceable when everything in it is made by code
that looks before it creates. The cost of a lost workspace is then the data, and that is what backups
are for. Anything you made by clicking is something you must remember to make again.</div>
<p>Databricks' own disaster-recovery guidance says the same: treat every artifact in a workspace as
infrastructure as code. There is no one-click workspace move; the Terraform exporter (experimental)
can capture an existing workspace's configuration, but not MLflow data or secrets.</p>
<p class="sources"><b>Demo</b> <code>notebooks/platform/inventory.py</code>: what you own, and which of it your bundle declares. · <b>Read more</b>
<a href="{DOCS}/admin/disaster-recovery">Disaster recovery</a> ·
<a href="{DOCS}/security/privacy/export-workspace-data">Export workspace data</a></p>""",
    # 13
    f"""<h1>See the whole automation at once</h1>
<p>The course's platform is run by the repository <code>course-assistant</code>: three automated parts
that share one state, the <code>course_ops</code> tables. The daily onboarding run provisions each
student and renders their repository; the student's repository deploys their own bundle as their own
principals; the monitoring bundle turns the system tables into the teachers' dashboard and Genie agent.</p>
<div class="setupfig">{SETUP_FIGURE}</div>
<p class="sources">Figure from <code>course-assistant</code>, <code>docs/figures/system-overview.html</code>.</p>""",
    """<h1>Follow one student through onboarding</h1>
<p>Once a day a GitHub Actions workflow signs in as <code>sp-onboarding-llmops</code> by OIDC and runs
one Python entry point: read the student list, merge it into <code>registry.students</code>, take every
step each student still needs, and write a report.</p>
<div class="flow"><b>Intake</b> (sheet: email, GitHub, Discord, plan) → <b>merge</b> into the registry →
<b>steps</b> for each student who still needs them → <b>report</b> (job summary and a Teams card)</div>
<table><thead><tr><th>Steps, in order</th><th>What they make</th></tr></thead><tbody>
<tr><td><code>user</code></td><td>Your workspace user with entitlements, in <code>grp-students-llmops</code>.</td></tr>
<tr><td><code>policy</code>, <code>catalog</code>, <code>warehouse</code>, <code>experiment</code></td><td>Usage policy, a schema in each environment catalog, your warehouse, your experiment.</td></tr>
<tr><td><code>repo</code></td><td>Your repository, rendered once with every id above, so it waits for them.</td></tr>
<tr><td><code>principal</code>, <code>_acc</code>, <code>_prd</code></td><td>A deploy principal per environment, its federation policy on your repository's environment, its grants, the repository variable.</td></tr>
<tr><td><code>membership</code>, <code>materials</code></td><td>The organisation and repository invitations; read access to the course materials.</td></tr>
<tr><td><code>first_deploy</code>, <code>_acc</code></td><td>Your <code>deploy.yml</code> dispatched for dev and acc; prd waits for your approval.</td></tr>
<tr><td><code>lakebase</code>, <code>_acc</code>, <code>_prd</code>, <code>credentials</code></td><td>Your Postgres roles and databases, and the credentials your deploys use.</td></tr>
</tbody></table>
<h2>Why it can run every day</h2>
<ul>
<li>Every step looks up by a deterministic name and ends <code>created</code>, <code>adopted</code>, <code>pending</code>, <code>skipped</code> or <code>failed</code>.</li>
<li>A failed step holds only the steps that need its result; one student's failure never stops another.</li>
<li>A student who leaves the list is first reported, and removed only by a later run set to apply.</li>
</ul>""",
    # 14
    f"""<h1>Demos, homework and further reading</h1>
<table><thead><tr><th>Repository file</th><th>Purpose</th></tr></thead><tbody>
<tr><td><code>notebooks/platform/p1_identity_and_auth.py</code></td><td>Who you are: auth type, entitlements, groups.</td></tr>
<tr><td><code>notebooks/platform/p2_unity_catalog_tour.py</code></td><td>Metastore, catalogs, your effective privileges per environment.</td></tr>
<tr><td><code>notebooks/platform/p3_ensure_pattern.py</code></td><td>An idempotent step: created, adopted, updated.</td></tr>
<tr><td><code>notebooks/platform/four_ways/</code></td><td>One volume by REST, SDK, CLI, bundle and Terraform.</td></tr>
<tr><td><code>notebooks/platform/inventory.py</code></td><td>What you own, and what your bundle declares.</td></tr>
<tr><td><code>.github/workflows/whoami.yml</code></td><td>The OIDC claims GitHub signs, and the principal they become.</td></tr>
</tbody></table>
<h2>Homework</h2>
<ol>
<li>Run <code>p2</code> and explain each privilege you hold on your acc schema, and where it comes from.</li>
<li>Run <code>inventory.py</code>. Move one thing you made by hand into your bundle and deploy it.</li>
<li>Make the volume two ways from <code>four_ways/</code>, run each twice, and compare what the second run does. Delete what you made.</li>
</ol>
<h2>Documentation</h2>
<ul>
<li><a href="{DOCS}/admin/users-groups/">Users, service principals and groups</a> · <a href="{DOCS}/admin/users-groups/entitlements">Entitlements</a></li>
<li><a href="{DOCS}/data-governance/unity-catalog/">Unity Catalog</a> · <a href="{DOCS}/data-governance/unity-catalog/manage-privileges/privileges">Privileges</a></li>
<li><a href="{DOCS}/dev-tools/auth/">Authentication for automation</a> · <a href="{DOCS}/dev-tools/auth/provider-github">GitHub Actions federation</a></li>
<li><a href="{DOCS}/dev-tools/sdk-python">Databricks SDK for Python</a> · <a href="{DOCS}/dev-tools/bundles/">Declarative Automation Bundles</a></li>
<li><a href="https://registry.terraform.io/providers/databricks/databricks/latest/docs">Databricks Terraform provider</a></li>
</ul>
<p>The platform's own code is the repository <code>course-assistant</code> in this organisation: the
setup script, the onboarding steps and the runbook for a new workspace are all there.</p>""",
]


def main() -> None:
    head = HEAD_FROM.read_text()
    head = head[: head.index("<body>")]
    head = head.replace("Lecture 4 materials | MLflow for GenAI", f"Platform lecture | {TITLE}")
    # Drop lecture 4's per-page tweaks; the base styles stay.
    head = re.sub(r"#section-\d+[^{]*\{[^}]*\}", "", head)
    sections = []
    for number, body in enumerate(PAGES, start=1):
        sections.append(
            f'<section class="page" id="section-{number}"><header><b>CAUCHY · LLMOPS</b>'
            f"<span>{DATE}</span></header>{body}<footer><span>{TITLE}</span>"
            f"<span>{number:02d} / {len(PAGES)}</span></footer></section>"
        )
    sprite = (FIGURES / "sprite.svg").read_text()
    style = "<style>.setupfig svg{width:100%;height:auto;max-height:190mm}</style>"
    OUT.write_text(head + style + "<body>" + sprite + "\n".join(sections) + "\n</body></html>\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(PAGES)} pages")


if __name__ == "__main__":
    main()
