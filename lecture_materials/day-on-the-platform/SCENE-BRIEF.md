# Brief: "A day on the platform", an animated map of a Databricks platform

A standalone brief for an agent (or a designer) building or improving this scene. Read it whole
before you start.

## 1. What we are building, and for whom

An interactive, animated drawing that opens a university-style lecture called **Platform
infrastructure**, in an LLMOps-on-Databricks course. The audience are ML engineers who have used a
Databricks workspace for five lectures without seeing what sits underneath it.

The scene shows, on one large canvas, **every moving part of the platform on a normal day**:
- developers ship code through GitHub;
- pipelines deploy it into Databricks without a stored secret;
- people use the platform: Python in notebooks, SQL, dashboards, AI questions to Genie, chat with an
  agent app;
- every request is authenticated, then authorized, before compute touches storage;
- everything is audited.

The lecturer presents it live: he walks the chapters, pauses, zooms into parts and tells the story.
It has to be **vivid, fun and technically exact**. It must not be a slide of rectangles. The
reaction we want is "now I see how it all fits together".

## 2. What to build: the unconstrained version

Build the scene as a **standalone page with no tooling limits**. Use whatever makes it clearly
better: any library from a CDN (cdnjs.cloudflare.com, cdn.jsdelivr.net/npm, unpkg.com), pinned to an
exact version. Candidates:
- GSAP with MotionPathPlugin and Draggable (all free since 2025), for choreographed, eased motion
  along paths and inertia panning; or d3-zoom for pan and zoom;
- lottie-web, for a properly licensed animation;
- canvas or WebGL, for particle trails;
- a licensed illustration pack for the people (Open Peeps, Humaaans): check that the licence allows
  this use.

Name every library and asset, with its version and licence, in the README.

**Downloads.** Put every downloaded asset into a new, empty scratch folder and treat it as
untrusted: no scripts, no `on*` attributes, no external hrefs in an SVG. Inline or bundle it only
after sanitizing. Never run a downloaded file, except a pinned CDN library the page loads.

**Network.** The CDN must be reachable when the page opens. Say so in the README, and offer a
bundled build for a room without internet.

**Belonging to the course.** Use the Cauchy palette (`:root` of
`lecture_materials/src/platform-infrastructure/head.html`) and the fonts Nunito and Fira Code
(Google Fonts).

## 3. Where it lives and how it is built

- **One folder.** Everything goes in its own folder on the branch `victor/platform-infrastructure-lecture` of
  `/Users/victorkuznetsov/Repos/course-code-hub-platform-lecture`:
  `lecture_materials/day-on-the-platform/`.
  - The page: `lecture_materials/day-on-the-platform/index.html`.
  - Its sources and a build script, if there is one: `lecture_materials/day-on-the-platform/src/`.
  - A `README.md` with the rebuild command, the libraries and assets and their licences, and the
    network note.
- **Do not touch** anything outside that folder. In particular, do not touch the course page
  `lecture_materials/PLATFORM-UNDER-THE-WORKSPACE.html` or its sources in
  `lecture_materials/src/platform-infrastructure/`. You may read the existing scene there,
  `scene.js` and `scene.css`, for reference.
- **Verify** with Playwright in headless Chrome: `uv run`, inline metadata
  `playwright==1.48.0`, `channel="chrome"`. It needs network access for the CDN. There must be no
  JavaScript errors.
- **Do not commit.**

## 4. Layout and perimeters

- **Three columns.**
  - Left: **developers**, then **GitHub** (a SaaS in its own cloud).
  - Middle: **the platform**.
  - Right: **platform users**.
  - Code comes in from the left, people's work from the right, and both meet in the middle.
- **Perimeters, as in Databricks' own architecture picture**
  (https://docs.databricks.com/aws/en/getting-started/high-level-architecture). They are shown as
  translucent background tints (rgba, about 0.06–0.14 alpha), with a small legend. There is no cloud
  or region frame around them:
  1. **Outside**: the developers and their laptops, GitHub (its own SaaS tint), and the platform
     users. Users and applications come in from outside, as in the docs.
  2. **Your Databricks account**, the Databricks side and the main stage. It holds:
     - the account console: identities, federation policies, budgets, metastore;
     - the **control plane**: web application and REST APIs, identity and auth, compute
       orchestration (jobs), Unity Catalog, queries and code (notebooks, Genie, Genie One), Unity
       Gateway, secrets;
     - the **serverless compute plane**;
     - **default storage**, which a serverless workspace keeps on the Databricks side.

     Note "runs on AWS, us-west-2" as a small label inside it, never as an enclosing frame.
  3. **Your cloud account**: a separate perimeter beside, outside the Databricks one, dashed and
     ghosted. It holds the classic compute plane and the workspace storage bucket. Label it
     "classic workspaces only; none in this course: express setup gives you no cloud account". No
     traffic of the course enters it.
  4. **Your resources** (optional): external data sources, ghosted, near "your cloud account", as
     in the docs.

  Do not draw the Databricks perimeter inside a cloud-provider perimeter, and do not draw "your
  cloud account" around the control plane.
- A packet crossing a perimeter lights a short highlight on the border.

## 5. What is on the canvas

All of it is true of this course's platform. Do not invent beyond it.

**Developers.** Three people at desks: Ada (`feature/chunking`), Bo (`fix/eval-judge`) and Chen
(`feature/genie-tool`). Each laptop setup has:
- an editor (VS Code; draw a generic `</>` editor glyph, not the VS Code mark);
- Databricks Connect, which runs Spark on dev compute;
- a CLI profile signed in with OAuth U2M (`databricks auth login`);
- pre-commit.

**GitHub**, drawn as a cloud:
- the repository `course-code-hub`, with a live branch graph;
- pull requests with review;
- Actions CI (pre-commit, pytest);
- Actions CD (acc first, then prd after an approval in the `prd` environment);
- the environments `dev`, `acc` and `prd`, each holding `DATABRICKS_CLIENT_ID`, the application id
  of that environment's deploy service principal: `sp-deploy-arxiv-dev`, `-acc`, `-prd`;
- the OIDC issuer `token.actions.githubusercontent.com`.

**Databricks account.**
- users, service principals and groups, which the course creates by code (SCIM);
- federation policies, one per deploy principal and GitHub environment;
- budgets and serverless usage policies;
- the metastore, an account object.

An identity provider (Entra ID or Okta) can sync people into a Databricks account on AWS too, but
**this course connects none**. Show it only as a dashed "optional, not used here" note, or leave it
out.

**Control plane.**
- the front door, the web app and REST APIs, where every person and pipeline arrives;
- **identity and auth**, which authenticates every request: OAuth tokens, and the token exchange for
  federated pipelines;
- **Unity Catalog**, which authorizes every data access, with the metastore and the catalogs
  `llmops_dev`, `llmops_acc`, `llmops_prd` and `course_ops`, grants and audit;
- workspace ACLs, a separate authorization for workspace objects (jobs, warehouses, apps,
  dashboards, Genie spaces);
- the jobs service;
- Genie;
- Databricks One (dashboards);
- Unity Gateway (Unity AI Gateway), with the model service `course_ops.gateway.chat`, per-user
  budgets and usage tracking;
- secrets: workspace scopes and Unity Catalog secrets.

**Serverless compute plane.**
- SQL warehouses, notebook compute and job compute, each drawn as server racks whose blades
  (executors) light up when tasks run;
- model serving (foundation models);
- Databricks Apps (the course's agent app runs as its own service principal);
- Zerobus ingest (MLflow trace spans);
- Lakebase (Postgres, the course's vector store);
- AI Search (formerly Vector Search).

**Storage.**
- default storage: Delta tables (`arxiv_papers`, `arxiv_chunks`, `eval_results`, monitoring in
  `course_ops`), the MLflow trace tables in the user's schema, and the volume `arxiv_files`;
- workspace storage: job results and large results;
- system tables (`access.audit`, `billing.usage`), filled by Databricks.

**Platform users.**
- Dana, a data scientist running **Python** in notebooks and logging MLflow traces;
- Eli, an analyst asking **Genie** questions in natural language;
- Fay, a manager using **dashboards** and the **SQL editor**;
- Gus, chatting with the **agent app**;
- Tess, a teacher reading the course dashboard.

## 6. The rules every flow must obey (architecture)

The order of hops is the lesson. Every request follows this order:

1. **The front door.** It arrives at the web app or REST API.
2. **Authenticated** at identity and auth.
   - A person uses OAuth U2M (a browser session, or a CLI profile).
   - A pipeline's GitHub OIDC token is exchanged for a Databricks token; the service principal's
     federation policy (issuer, subject, audience) is checked there.
   - No request skips this step.
3. **Authorized.**
   - **Workspace objects** use workspace ACLs: running a job, using a warehouse, opening an app,
     dashboard or Genie space, deploying a bundle's jobs and apps.
   - **Data and AI assets** use Unity Catalog: `USE CATALOG` and `USE SCHEMA`, `SELECT`,
     `MODIFY`, `EXECUTE` on a model service or function, `READ SECRET`.
   - Unity Catalog decides before any compute reads or writes a file.
   - Every Unity Catalog decision is written to `system.access.audit`. That record arrives minutes
     later; say so where it is drawn as instant.
4. **Compute** runs the work, and executors read or write files in storage **in parallel**.
5. **Results come back**: small ones through the control plane, large ones as files in storage.

**Identities matter.**
- Genie runs its SQL as the asking user.
- A dashboard with embedded credentials runs as its publisher, otherwise as the viewer.
- A job runs as its run-as identity; the course uses service principals for deploys.
- An app runs as its own service principal, unless it uses on-behalf-of-user auth.
- CD runs as the environment's deploy principal.

**Where these rules sit in the drawing.**
- Draw the authentication and authorization checks as visible moments: a ✓ pulse, or a ✗ with a
  refusal.
- Every scenario passes through them in this order.

## 7. Scenarios (chapters), then the whole day

Each chapter frames its part with the camera, plays once and waits for Next:
1. **Local development.** Ada signs in with `databricks auth login` (U2M) and runs code through
   Databricks Connect. The request is authenticated, then Unity Catalog authorizes it, then
   notebook compute reads 4 files in parallel and the DataFrame comes back.
2. **A pull request rejected, fixed and merged.** Commits pass pre-commit, the PR opens, CI runs
   and pytest fails (✗). Variants: a reviewer requests changes. The fix goes in, CI passes (✓),
   it is approved and merged.
3. **CD signs in with OIDC.** The acc job requests a GitHub token, exchanges it at identity and
   auth, where the federation policy is checked, and receives a token for `sp-deploy-arxiv-acc`.
4. **Deploy to acc, then prd.** The bundle deploy is authorized by workspace ACLs: jobs and the
   app update. A job run starts, Unity Catalog authorizes the write, and executors write in
   parallel. Then a prd approval in GitHub, OIDC as `sp-deploy-arxiv-prd`, and the deploy.
5. **Python in a notebook, with traces.** Dana runs a cell. It is authenticated, Unity Catalog
   authorizes it, notebook compute runs it, the trace spans go to Zerobus, and Zerobus writes
   them to the trace tables (Unity Catalog `MODIFY`).
6. **An AI question to Genie.** Eli asks in natural language; Genie writes SQL, which runs on a SQL
   warehouse as Eli, authorized by Unity Catalog. The answer comes back with its SQL.
7. **Unity Catalog allows, and refuses.** A dashboard tile asks for `llmops_prd.jane_doe` without
   the privilege: refused (✗). Both decisions are audited.
8. **SQL, read in parallel.** Fay runs a query in the SQL editor. The warehouse plans it and
   splits it into tasks; 4 executors read 4 files at once, and the rows come back.
9. **The agent app.**
   1. Gus signs in through the workspace's OAuth and chats with the app.
   2. The app, as its own service principal, retrieves context from the vector store (Lakebase or
      AI Search).
   3. It calls `course_ops.gateway.chat`; Unity Catalog checks `EXECUTE`, then the gateway checks
      the budget and records usage.
   4. Model serving answers, and the trace spans land in the trace tables.
10. **Audit and monitoring.** The day's decisions flow into `system.access.audit`. The scheduled
    monitoring job, run as its service principal, reads the system tables into the teachers'
    dashboard.

**The whole day** zooms out and loops all of it. The developer loop alternates a CI failure and a
review asking for changes. Fay alternates a dashboard, a refused tile and a SQL query.

## 8. Visual language

**Depth, not flat boxes.**
- Soft offset shadows, gentle gradients, rounded cards.
- A cloud that reads as a cloud. A region or data centre that reads as one.
- Racks with blades and LEDs for compute. Cylinders and file stacks for storage.

**People.** Simple, friendly flat illustrations at desks.
- **Laptops must read as open laptops.** Draw a three-quarter or side view: a thin keyboard base on
  the desk, and the screen tilted back at about 100–110°.
- The screen faces the person and its glow lights their face.
- Seen from the audience's side, show the lid's back with a small logo, or turn the person so the
  screen is visible, showing what they do: code, a chart, a chat.
- Never upright dark slabs: the last version looked like tombstones.
- Vary pose, hair and skin tone with care; avoid caricature.

**Real product icons.**
- **Databricks products.** Use the community set of official Databricks artwork,
  `oieduardorabelo/databricks-architecture-icons` (MIT for the packaging; the marks are
  Databricks' trademarks). Use the `svg` (colour) or `svg-tile` variants, for:
  - `unity-catalog`, `genie`, `genie-one`, `sql-warehouse`;
  - `notebooks`, `lakeflow-jobs`, `model-serving`, `databricks-apps`;
  - `unity-ai-gateway`, `zerobus-ingest`, `lakebase`, `ai-search`;
  - `system-tables`, `serverless-compute`, `asset-bundles`, `databricks-cli`;
  - `databricks-connect`, `mlflow`, `rest-api`, `workspace`, `enterprise-security`, `delta-lake`.
- **Downloading them.** Download only the files you use, from the repository's raw URLs, into a
  new empty folder. Treat them as untrusted: strip any `<script>`, `on*` attributes and external
  `href`s. Prefix every id (`dl-`) and inline them as `<symbol>`s.
- **Attribution.** Add one line to the page footer: "Databricks product icons: official Databricks
  artwork, via the community set oieduardorabelo/databricks-architecture-icons (MIT). Databricks
  and its product names are trademarks of Databricks, Inc."
- **GitHub and others.** For GitHub, Actions and Python, use
  `/Users/victorkuznetsov/.claude/plugins/cache/cauchy/cauchy/1.1.2/brand/assets/icons.svg`.
  There is no AWS mark there: draw a neutral region or cloud glyph, and do not imitate AWS's.

**Artifacts in flight carry the right icon.**

| Artifact | Icon |
|---|---|
| Commit | a commit dot |
| PR | the PR glyph |
| CI or CD run | the Actions mark |
| OIDC token | a key |
| Bundle | a package |
| SQL | a SQL file |
| Python | the Python mark |
| Question in natural language | a chat bubble with a sparkle |
| Rows | a mini table |
| Dashboard | a chart |
| Trace | a span tree |
| Allowed or refused | ✓ or ✗ |

**Two families of colour.**
- **Developer traffic**: commits, PRs, CI, CD, OIDC tokens, deploys. One family, warm terracotta
  (about `#c9705f`), with tokens in amber.
- **User traffic**: Python, SQL, AI questions, dashboards, app chats. Another family, indigo or
  violet (about `#6b5fb0`).
- **Platform-internal** hops (control plane to compute) in platform blue.
- **Data** read from or written to storage in sage or link blue.
- **Results** returning in green. **Refusals** in red.
- The legend explains the families. The rail a packet travels on takes its family's colour while
  in use.

**Connections, simplified.**
- Do not draw a line from every tile to every tile.
- Group them into **trunks between containers**:
  - the developers' column → GitHub;
  - GitHub → the control plane's front door;
  - the users' column → the front door (from the right);
  - the control plane → the compute plane (one backbone, labelled "cloud backbone");
  - compute → storage.
- Inside a container, a packet leaves the trunk at a small junction and goes to its tile with a
  short stub. At Fit all, the drawing must read as a handful of clean trunks, not a wiring diagram.

**Palette.** The page's tokens (`:root` in `head.html`), in the restrained Cauchy style. Orange
`#f24b37` is the logo accent; the life comes from depth, light and motion, not loud colour.

**Text.** At least 13 px in the viewBox. Nothing overlaps. Rails never cross a tile or its text.

## 9. Interaction (keep all of it)

- **Canvas.** A large canvas (about 2700 × 1500) in a card about one screen high.
  - Drag to pan; the wheel zooms once the scene is focused, or with ctrl/pinch.
  - Buttons for +, −, and Fit all; a minimap with the view outlined.
  - A click on a part zooms to it and opens an explanation overlay that says what it is, who uses
    it, and "Simplified:" where the drawing simplifies.
- **Tour.** Back, Next and Replay, with a "Resume tour" button once the user has moved the camera.
  A chapter caption shows "n / 10".
- **Present mode.** The Fullscreen API, or a fixed overlay as the fallback.
  - Keys: ← → for chapters, + − 0 to zoom, F for present, Esc to leave.
- **The whole day.** Free play, with an event log that reads like a day ("09:14 Ada pushes 2
  commits to feature/chunking").
- **Performance.** One clock drives all motion. Use no CPU when paused or off screen. Start when
  the scene scrolls into view. Respect `prefers-reduced-motion` for ambient motion.

## 10. Done means

- The page builds with no JavaScript errors, and the phone scrollWidth is 390.
- Screenshots of every chapter and of the whole day at 1440×900 and 1280×800, plus Present mode,
  looked at and fixed.
- Every scenario's hop sequence follows § 6, checked by reading the code.
- A short report:
  - what changed;
  - the hop sequence of each scenario;
  - the icons used, with their source;
  - the screenshot paths;
  - anything left undone.

## 11. Findings of the architecture review of the previous version (fix all of them)

A read-only review of the previous `scene.js` on 2026-11-22 found the following. Each is a rule
for the new version.

**Authentication.**
1. **Authenticate every request.** Every arrival at the web app or REST API is followed by
   identity and auth ("token ✓"), in every chapter and every pass of the loops: Connect calls,
   CD's API calls, each user's request, and Tess too. A sign-in shown once at the start does not
   cover later requests.
2. **The OIDC exchange goes through the front door.**
   1. CD asks the GitHub issuer for a token.
   2. The issuer returns it to CD.
   3. CD sends it to the web app (the workspace's `/oidc/v1/token`).
   4. The web app passes it to identity and auth.
   5. Identity and auth checks the deploy principal's federation policy (✓).
   6. A token for `sp-deploy-arxiv-<env>` goes back to CD.

   The issuer never talks to the policy directly. Source:
   https://docs.databricks.com/aws/en/dev-tools/auth/oauth-federation-exchange
3. **Local development starts at the CLI.** It is the CLI profile (`databricks auth login`) that
   gets the token; Databricks Connect then uses it.

**Authorization.**
4. **Unity Catalog is not a router.** Work goes from the front door (or Genie, or Databricks One)
   to compute. Compute then asks Unity Catalog "may I read or write …?". Unity Catalog decides
   (✓ or ✗) and audits, and only then do the executors touch storage. The previous `S.jobRun`
   already had this shape; use it everywhere.
5. **Every read and write needs its decision.** Each parallel burst touches only the tables its
   Unity Catalog decision named. Writes need their own decisions too:
   - the job's writes to `arxiv_chunks` and `arxiv_papers`;
   - Zerobus writing trace spans: `MODIFY` and `SELECT` on the trace tables, checked before any
     row lands;
   - the monitoring job writing `course_ops` monitoring tables.

   A packet that reads storage with no decision before it is a bug. The worst one was "Dana's next
   cell" in the SQL chapter.
6. **Show workspace ACLs as their own small checks**, separate from Unity Catalog:
   - the bundle deploy: `CAN MANAGE` on the jobs and the app, write on the bundle folder;
   - `CAN USE` on a warehouse (the SQL editor, Genie);
   - access to the Genie space;
   - `CAN VIEW` or `CAN RUN` on a dashboard;
   - `CAN USE` on the app;
   - the notebook itself.

   Unity Catalog appears in a deploy only if the bundle makes catalog objects.
7. **The gateway's `EXECUTE` is a Unity Catalog decision.** The app's service principal needs
   `EXECUTE` on `course_ops.gateway.chat`, so route Gateway → Unity Catalog ✓ before the gateway
   applies its budget and rate limit. Gateway usage lands in `system.ai_gateway.usage`, not in
   `access.audit`.
8. **The vector stores are authorized differently.**
   - AI Search: the index is a Unity Catalog securable (`SELECT` checked).
   - Lakebase: authorized by the principal's Postgres role and grants, not by Unity Catalog. Label
     it so.

**Identities and triggers.**
9. **Who a dashboard query runs as.** A dashboard published with shared (the publisher's)
   permissions runs its queries as the publisher; Unity Catalog checks the publisher. Only
   "individual data permissions" uses the viewer's privileges. So the **refusal story** happens
   where the user is the identity: Fay's own query in the **SQL editor**, or Eli's question in
   **Genie**, refused on `llmops_prd.jane_doe`. Or label the dashboard as published with
   individual permissions.
10. **A deploy never starts a job run.** It creates or updates the job. A run starts from its
    schedule, or from an explicit `bundle run` (CD → front door → auth → jobs "run-now"). Show one
    of those, labelled.
11. **The notebook's model call.** If the log says Dana's code calls a model, draw it: notebook →
    gateway → Unity Catalog `EXECUTE` (as Dana) → model serving → back.

**Texts to correct.**
12. No single sign-on claims: the course connects no identity provider, and people sign in with
    Databricks' own login. People are created by code through the SCIM API. The identity-provider
    tile reads "Identity provider (SAML or OIDC), not connected in the course", or goes.
13. Never say "every request meets Unity Catalog". Say "every request for data or a model meets
    Unity Catalog; workspace objects are guarded by their ACLs".
14. Unity Gateway budgets are per user, and an app's calls all count as its one service principal
    (unless it uses on-behalf-of-user auth).
15. Say the control plane "does not run your computation". Small results do pass through it.
16. Say "Genie One (formerly Databricks One)".
17. A merge waits for review and green CI only with branch protection or a ruleset, so say so.
    Required reviewers on the `prd` environment of a private repository need GitHub Enterprise (or
    a public repository), so label the prd approval as a setting.
18. Gate the scheduled loop (monitoring) on its own toggle, not on "Developers".

## 12. How to work: research first, review last

Do not build from memory, and do not judge your own work alone. Use subagents for both ends.

**Models.** Only the build of the animation itself runs on the most capable model. Every other
subagent runs on `sonnet`: the research subagents (or `haiku` for simple look-ups) and the review
subagent. Pass the model explicitly; a subagent without one inherits the builder's model.

**Before building: collect the docs.** Spin up research subagents in parallel, one per area. Each
writes a short fact sheet with a docs URL and a quote of at most two sentences per fact. Areas:
1. the request path and the planes: control plane, serverless compute plane, default storage, results;
2. authentication: OAuth U2M and M2M, token federation and the GitHub OIDC exchange;
3. authorization: Unity Catalog privileges and audit, workspace ACLs for jobs, warehouses, apps,
   dashboards and Genie spaces, and whose identity each runs as;
4. Genie, dashboards and their sharing modes, Databricks Apps auth, and Unity Gateway (EXECUTE,
   budgets, usage);
5. MLflow traces in Unity Catalog through Zerobus, Lakebase and AI Search authorization;
6. the libraries and asset packs, with their versions and licences.

Build only on facts the sheets support. Where the sheets disagree with this brief, the docs win:
say so in the report.

**After building: an independent review.** When the page is done and verified, spin up a
read-only review subagent that has not seen your reasoning. Give it the code and § 6 and § 11 of
this brief, not your conclusions. It writes down every scenario's hop sequence as coded (with line
numbers) and judges each hop against how Databricks works, checking the docs where unsure. It also
flags false texts, workspace ACLs confused with Unity Catalog, wrong identities, and reads or
writes with no decision before them. Fix every finding, then run the review again on the fix
alone. Repeat while anything actionable remains; a finding that survives three rounds goes to the
lecturer. Include the last review's verdict in your report.
