// "A day on the platform": an animated map of every moving part, in a 2700 x 1560 world seen
// through a camera (drag, wheel, pinch, minimap). An illustration, not a measured drawing.
// The perimeters follow Databricks' own architecture picture
// (https://docs.databricks.com/aws/en/getting-started/high-level-architecture). Left to right: the
// developers and GitHub (outside), your Databricks account (the account console, the control plane,
// the serverless compute plane, default storage), then your cloud account and your resources, dashed
// and unused, and the platform users (outside again). No frame wraps the accounts: AWS and its
// region are a small note inside the Databricks account, never a perimeter around it.
//
// The order of the tiles is the lesson. Every request arrives at a front door (the REST APIs for
// code, the web application for people), is authenticated at identity and auth, and is then
// authorized: workspace objects by their ACLs, data and AI assets by Unity Catalog, which compute
// asks before an executor touches a file. The stories below are built from four helpers:
// enter() (a door, then identity and auth), acl(), ask() (the question to Unity Catalog), and
// call() (code on compute calling another service: one more request, authenticated like any
// other). No story reaches a service, compute or storage except through them.
//
// Connections are a handful of trunks between containers, kept as a graph: a packet names the
// tiles it travels between ("user0>web", "nb>uc") and rides the shortest way along the trunks,
// leaving at a junction by a short stub. A rail takes the colour of the traffic on it.
// Layers, back to front: perimeters and zones, rails, tiles and people, packets. One scene clock
// drives every motion and every wait, and it only ticks while the scene plays and is on screen.
(() => {
  const NS = "http://www.w3.org/2000/svg";
  const $ = (id) => document.getElementById(id);
  const svg = $("daySvg");
  if (!svg) return;
  const day = $("day"), stage = $("dayStage"), log = $("dayLog"), info = $("dayInfo"), clock = $("dayClock");
  const W = 2700, H = 1560;
  const el = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    parent.appendChild(n);
    return n;
  };
  const text = (x, y, s, cls, parent) => { const t = el("text", {x, y, class: cls}, parent); t.textContent = s; return t; };
  const defs = el("defs", {}, svg);
  const Lz = el("g", {class: "dl-zones"}, svg);
  const Lt = el("g", {class: "dl-rails"}, svg);
  const Lh = el("g", {class: "dl-hots"}, svg);
  const Lc = el("g", {class: "dl-chips"}, svg);
  const Lp = el("g", {class: "dl-packets"}, svg);
  const tag = (id, label) => ({"data-zone": id, tabindex: 0, role: "button", "aria-label": label});
  const grad = (id, stops, vertical = true) => {
    const g = el("linearGradient", {id, x1: 0, y1: 0, x2: vertical ? 0 : 1, y2: vertical ? 1 : 0}, defs);
    stops.forEach(([o, c, a]) => el("stop", {offset: o, "stop-color": c, ...(a === undefined ? {} : {"stop-opacity": a})}, g));
  };
  grad("dl-g-chip", [["0", "#ffffff"], ["1", "#f6f7fa"]]);
  grad("dl-g-rack", [["0", "#e9eef7"], ["1", "#d3dced"]]);
  grad("dl-g-cyl", [["0", "#dbe8e1"], ["0.5", "#eaf2ee"], ["1", "#cfdfd6"]], false);
  grad("dl-g-desk", [["0", "#efe3cd"], ["1", "#dfcfb2"]]);
  grad("dl-g-glass", [["0", "#eef6ff"], ["1", "#bcd8ff"]]);
  grad("dl-g-glow", [["0", "#9cc8ff", 0], ["1", "#9cc8ff", 0.34]], false);

  // ---------- what each part does: [title, text, simplification] ----------
  const Z = {
    outside: ["Outside", "Users and applications come in from outside, as in Databricks' own architecture picture: the developers' laptops, GitHub (a SaaS of its own) and the platform users' browsers. Every request that leaves this ground crosses the border of your Databricks account and arrives at a front door."],
    devs: ["Developers", "Ada, Bo and Chen work on branches in their own editor, commit through pre-commit hooks and open pull requests. Nothing on a laptop reaches acceptance or production: a merge to <code>main</code> and the CD pipeline are the only way in."],
    laptop: ["On each laptop", "An editor, pre-commit, a Databricks CLI profile and Databricks Connect. The code runs locally; its Spark work runs on serverless compute of the workspace, on the dev catalog, as the developer."],
    editor: ["The editor", "Any editor; the course uses VS Code with the Databricks extension. Through the CLI profile it reaches the workspace under the developer's own identity."],
    connect: ["Databricks Connect", "Runs the developer's Spark code from the laptop on Databricks compute, here serverless compute of the workspace, working on the dev catalog. It reads the CLI profile and sends that profile's token with every request, so the work runs as the developer."],
    cli: ["Databricks CLI profile", "<code>databricks auth login</code> opens the browser for an OAuth user-to-machine (U2M) sign-in and caches the token on the laptop. An access token lives one hour and is renewed automatically. No personal access token is pasted anywhere.", "The sign-in is drawn as one round trip. In reality the browser signs in and the CLI then exchanges a code for the token."],
    precommit: ["pre-commit", "Hooks that run on every commit, on the laptop, before anything reaches GitHub. CI runs the same hooks again."],
    github: ["GitHub", "A cloud service of its own, outside your Databricks account. It holds the repository, runs Actions for CI and CD, keeps the environments, and issues the OIDC tokens the pipelines present to Databricks."],
    repo: ["The repository's history", "A branch forks from <code>main</code>, commits land on it, a pull request asks to merge it back, and the merge adds a commit to <code>main</code>. That commit is what CD deploys."],
    pr: ["Pull request", "The proposal to merge a branch. Another developer reviews it: an approval lets it merge, a request for changes sends the author back to the branch. The merge waits for the review and for a green CI only where a branch protection rule or a ruleset on <code>main</code> requires them, which a private repository gets on a paid GitHub plan."],
    ci: ["Actions CI", "Runs on every pull request: pre-commit and pytest. A red check blocks the merge where a ruleset or a branch protection rule requires the check; without one it is a warning the reviewer reads."],
    cd: ["Actions CD", "Runs on a merge to <code>main</code>: it deploys the bundle to acc first, then to prd. Each job signs in by OIDC as its environment's deploy service principal. Whether the prd job waits for an approval is a setting of the <code>prd</code> environment."],
    envs: ["GitHub environments", "dev, acc and prd. Each holds <code>DATABRICKS_CLIENT_ID</code>, the application id of that environment's deploy service principal (<code>sp-deploy-arxiv-dev</code>, <code>-acc</code>, <code>-prd</code>): an id, not a secret. The approval before prd is the environment's required-reviewers setting, which a private repository gets only on GitHub Enterprise."],
    issuer: ["GitHub as OIDC issuer", "A workflow job with <code>id-token: write</code> may ask GitHub for an OIDC token, signed by <code>token.actions.githubusercontent.com</code>. Its claims name the repository and the environment the job runs in. The job, not the issuer, takes it to Databricks."],
    ltrunk: ["The road in, for code", "Everything developers and pipelines send to Databricks travels over HTTPS to the REST APIs: the CLI's sign-in, Databricks Connect, CD's token exchange and its deploys. A laptop never talks to the compute plane or to storage directly."],
    rtrunk: ["The road in, for people", "Each platform user's browser talks HTTPS to the web application, and every request carries that person's token."],
    region: ["Runs on AWS, us-west-2", "Where the machines are, not whose perimeter it is. Databricks runs the control plane, the serverless compute plane and default storage of your Databricks account on AWS, in the workspace's region, us-west-2. Databricks' architecture picture draws no cloud-provider or region frame around the Databricks account, and neither does this one: you hold no AWS account for any of it.", "A note inside the perimeter, never a frame around it."],
    dbx: ["Your Databricks account", "The Databricks side and the main stage: one perimeter, as in Databricks' own architecture picture. It holds the account console above the workspaces, the control plane (in the Databricks account for every workspace, classic or serverless), the serverless compute plane and, for a serverless workspace like the course's, default storage. None of it is in a cloud account of yours. Users and applications come in from outside, and a packet that crosses this border lights it.", "It runs on AWS, in us-west-2: that is a note inside the perimeter, not a frame around it."],
    backbone: ["The cloud backbone", "The control plane and the serverless compute plane are both inside your Databricks account. Requests between them travel on the cloud provider's network backbone (here, AWS's), never over the public internet.", "One trunk is drawn; real traffic has no single path."],
    account: ["The account console", "The top level of your Databricks account, above every workspace: users, service principals and groups, the federation policies of the service principals, budgets and serverless usage policies. The Unity Catalog metastore is created here too, one per region."],
    ids: ["Users, service principals and groups", "Account-level identities, assigned to the workspace. The course creates them by code, through the SCIM API; no identity provider syncs them in."],
    idp: ["Identity provider, not connected", "An identity provider (SAML or OIDC, such as Entra ID or Okta) can handle the sign-in and sync users and groups into the account. The course connects none: people sign in with Databricks' own login, a one-time passcode sent by email."],
    fed: ["Federation policies", "One per deploy service principal and GitHub environment. A policy names the issuer, the subject (the repository and the environment) and the audience it accepts. Identity and auth reads it when a pipeline presents a GitHub token; a match is exchanged for a short-lived Databricks token of that principal."],
    budgets: ["Budgets and serverless usage policies", "Budgets watch the spend; a serverless usage policy tags serverless usage with who or what it is for, so the cost can be followed in <code>system.billing.usage</code>."],
    control: ["The control plane", "Databricks' backend services, in your Databricks account and never in your cloud account: the web application and the REST APIs, identity and auth, the workspace's access control lists, Unity Catalog, the jobs service, Genie, Genie One, Unity Gateway and secrets. It plans and governs; it does not run your computation. Small results do pass through it on their way back."],
    rest: ["REST APIs, the front door for code", "Step 1. Every call of the CLI, the SDK, a Databricks Connect session and the CD pipeline arrives here, the token exchange at <code>/oidc/v1/token</code> included. Each call carries a token, and each is handed to identity and auth before anything else happens."],
    web: ["Web application, the front door for people", "Step 1. The workspace in a browser: notebooks, the SQL editor, Genie, Genie One and the sign-in in front of every app. Each click becomes a request that carries the person's token, and each is handed to identity and auth first.", "The web application calls the same REST APIs. The two doors are drawn apart so that developer traffic and user traffic stay readable."],
    auth: ["Identity and auth", "Step 2, for every request: is this token valid, and whose is it? People get theirs with OAuth (U2M: a browser session or a CLI profile). A pipeline presents GitHub's OIDC token, and identity and auth exchanges it for a short-lived Databricks token if the service principal's federation policy matches. No request skips this step."],
    acl: ["Workspace ACLs", "Step 3 for workspace objects: access control lists on jobs (CAN MANAGE RUN to start a run), SQL warehouses (CAN USE), apps (CAN USE), dashboards (CAN VIEW), Genie spaces (CAN VIEW or CAN RUN) and notebooks (CAN RUN). They are separate from Unity Catalog, which guards data and AI assets.", "The permissions live with each object; they are drawn as one tile."],
    uc: ["Unity Catalog", "Step 3 for data and AI assets. Before compute reads or writes a file, Unity Catalog checks the identity's privileges: <code>USE CATALOG</code> and <code>USE SCHEMA</code> on the way down, then <code>SELECT</code>, <code>MODIFY</code>, or <code>EXECUTE</code> on a model service. Its decision goes to the audit log. Every request for data or a model meets Unity Catalog; workspace objects are guarded by their ACLs.", "Compute's check is drawn as one question and one answer. The audit record flies at once here; it reaches <code>system.access.audit</code> later."],
    meta: ["Metastore and catalogs", "The metastore is created in the account, one per region, and attached to the workspace. It holds the catalogs: <code>llmops_dev</code>, <code>llmops_acc</code> and <code>llmops_prd</code>, with one schema per student in each, and <code>course_ops</code>, the course's own. The environments dev, acc and prd are these three catalogs in one workspace, each with its own deploy service principal."],
    jobs: ["Jobs service", "Creates runs, from a schedule or from an explicit run-now such as <code>databricks bundle run</code>, and starts serverless job compute for them. A run works as the job's run-as identity. A bundle deploy creates or updates a job; it never starts one."],
    genie: ["Genie", "Turns a question in plain language into SQL on the tables its space was given, and shows the answer with its SQL. The SQL runs on a SQL warehouse reached through the compute credentials the space's author embedded, and Unity Catalog checks the data as the person who asked.", "A Genie space is called a Genie Agent in today's documentation."],
    one: ["Genie One", "Genie One (formerly Databricks One): the simple home for business users, with the dashboards, Genie spaces and apps shared with them. A dashboard published with shared data permissions runs its queries as its publisher; published with individual data permissions, as the viewer. Either way the warehouse comes from the publisher."],
    gateway: ["Unity Gateway", "Unity Gateway (Unity AI Gateway): the governed door to the models. A model service such as <code>course_ops.gateway.chat</code> is a Unity Catalog object: calling it needs <code>EXECUTE</code>. A call is a REST request with the caller's token, authenticated like any other. The gateway then applies its rate limits and budgets, which are per user, and records every call in <code>system.ai_gateway.usage</code>. An app's calls all count as its one service principal, unless it uses on-behalf-of-user authorization."],
    secrets: ["Secrets", "Workspace secret scopes, guarded by their own ACLs, and Unity Catalog secrets, guarded by <code>READ SECRET</code>: keys the jobs and apps read at run time instead of keeping them in code."],
    compute: ["The serverless compute plane", "In your Databricks account, managed by Databricks, in the same AWS region as the workspace: SQL warehouses, notebook and job compute, model serving, apps, Lakebase and AI Search, started in seconds. This is where your computation runs. Only classic compute would run in a cloud account of your own, and the course has none."],
    apps: ["Databricks Apps", "Web apps hosted by Databricks, such as the course's agent app. Each app gets a dedicated service principal and acts as it, unless it uses on-behalf-of-user authorization. A person needs CAN USE on the app to open it.", "A user reaches an app at its own URL; the drawing routes the request through the web application to show that the workspace's sign-in comes first."],
    serving: ["Model serving", "Serverless endpoints for models, including the foundation models, hosted by Databricks, behind the gateway's model services."],
    zerobus: ["Zerobus ingest", "A serverless ingest service that writes records straight into Unity Catalog Delta tables. MLflow uses it to write trace spans: the client sends them with its token, and the identity that logs them needs <code>MODIFY</code> and <code>SELECT</code> on the trace tables.", "Zerobus is a Databricks-managed service; it is drawn in the compute plane to keep the picture small."],
    lakebase: ["Lakebase", "Serverless Postgres; in the course, one of the two vector stores for the agent's retrieval. Postgres decides here: the Databricks identity gets a short-lived OAuth token, uses it as its password, and its Postgres role and grants say what it may read. Unity Catalog is not asked."],
    aisearch: ["AI Search", "AI Search (formerly Vector Search): indexes kept in sync with a Delta table; in the course, the other vector store. A query is a REST request with the caller's token, and an index is a Unity Catalog object, so the query needs <code>SELECT</code> on the index."],
    wh: ["SQL warehouse", "Serverless compute for SQL: the SQL editor, Genie and dashboards send their queries here. The warehouse plans a query and splits it into tasks, one per executor. Before the executors read, it asks Unity Catalog whether the query's identity may."],
    nb: ["Notebook compute", "Serverless compute for notebooks and for Databricks Connect sessions, working as the person who started them. A Python cell runs here, its Spark work spread over the executors."],
    jc: ["Job compute", "Serverless compute started for one job run and released when it ends. It works as the job's run-as identity; the course's jobs run as service principals."],
    exec: ["Executors", "Each executor takes one task, one share of the files, and they all run at once. That is why a query reads many files in about the time it takes to read one.", "Four executors per engine; a real warehouse or cluster has as many as the work needs."],
    storage: ["Storage", "On the Databricks side. The course's serverless workspace keeps its data in default storage, fully managed by Databricks and inside your Databricks account, not in a bucket of a cloud account of yours. Executors read and write its files directly, many at once, after Unity Catalog has said yes."],
    default: ["Default storage", "Managed tables and volumes, and the MLflow trace tables in each student's schema: files in object storage that executors read and write directly."],
    tables: ["Delta tables", "A Delta table is a folder of Parquet files plus a transaction log. Executors read different files of the same table at the same time."],
    traces: ["Trace tables", "MLflow traces stored in Unity Catalog tables in the student's schema. Zerobus writes the spans, from notebooks and from the app alike, once Unity Catalog has confirmed <code>MODIFY</code> and <code>SELECT</code> for the identity that logs them."],
    volume: ["Volumes", "Files that are not tables, such as the arXiv PDFs in the volume <code>arxiv_files</code>, governed by Unity Catalog like tables (<code>READ VOLUME</code>, <code>WRITE VOLUME</code>)."],
    wsstore: ["Workspace system data", "Job run results and large query results, which a client downloads as files instead of receiving them through the control plane. A serverless workspace keeps this in default storage; a classic workspace keeps it in the workspace storage bucket of your cloud account."],
    system: ["System tables", "Hosted by Databricks, not written by anyone's job: <code>system.access.audit</code> holds the audit events, <code>system.billing.usage</code> the billable usage, <code>system.ai_gateway.usage</code> every call through Unity Gateway. The course's daily monitoring job reads all three.", "A record is drawn flying at once. System tables are not real time: a record arrives later."],
    records: ["Audit and usage records", "Unity Catalog's decisions go to the audit log and the gateway's calls to its usage table. Databricks delivers them to the system tables; nobody's job writes them.", "Drawn as instant; a record arrives later."],
    ghost: ["Your cloud account: none in this course", "A separate perimeter beside your Databricks account, never around it. A classic workspace is attached to a cloud account of your own (an AWS account): its classic compute plane runs there, in your VPC, and its workspace storage bucket is an S3 bucket of that account. Those two are what is drawn here, and they exist for classic workspaces only. The control plane stays in the Databricks account even then. A serverless workspace has neither, though it can connect storage buckets of a cloud account of yours: Databricks' picture of a serverless workspace draws them here. The course's workspace was created with express setup, which gives you no cloud account at all, so this perimeter is empty and no traffic of the course enters it.", "Drawn ghosted and empty: nothing in it exists in the course."],
    resources: ["Your resources: optional, not used", "Storage and data sources of your own that Databricks can connect to: storage buckets, databases, on-premises systems. Databricks' picture of a classic workspace draws them as a box of their own, apart from both accounts; its picture of a serverless workspace shows only your storage buckets, inside your cloud account. The course connects none: its data lives in default storage, inside your Databricks account.", "Drawn ghosted and empty: nothing in it exists in the course."],
    users: ["Platform users", "A data scientist in a notebook, an analyst asking Genie, a manager on a dashboard, someone chatting with the course's agent app, and a teacher. Each signs in as themselves, and each of their requests is authenticated, then authorized."],
    dana: ["Dana, data scientist", "Runs Python in a notebook on serverless notebook compute and logs MLflow traces. Her cell works as Dana: she needs CAN RUN on the notebook, and Unity Catalog checks her own privileges on the tables."],
    eli: ["Eli, analyst", "Asks Genie questions in plain language. He needs access to the Genie space; the SQL Genie writes is checked by Unity Catalog as Eli."],
    fay: ["Fay, manager", "Opens dashboards in Genie One and writes her own queries in the SQL editor. In the editor she is the identity: CAN USE on the warehouse, and her own privileges in Unity Catalog."],
    gus: ["Gus, app user", "Chats with the course's agent app. He needs CAN USE on the app; what the app reads, it reads as its own service principal, not as Gus."],
    tess: ["Tess, teacher", "Reads the course dashboard. It is published with shared data permissions, so its queries run as its publisher; Tess needs only CAN VIEW on the dashboard."],
    legend: ["Where it runs", "The tints follow Databricks' own architecture picture. Outside: the laptops, GitHub and the browsers that users and applications come in from. Your Databricks account: the account console, the control plane, the serverless compute plane and default storage. Your cloud account, ghosted: the classic compute plane and the workspace storage bucket of a classic workspace, or the storage buckets a serverless workspace connects; the course has none. Your resources, ghosted: storage and data sources of your own; the course connects none. No frame wraps them: AWS and its region are where the Databricks account runs, not a perimeter around it. A packet lights the border it crosses: in the course that is always the Databricks account's, never one of the two ghosted perimeters."],
    traffic: ["Whose traffic is it", "Colour says who is asking. Terracotta: the developers and their pipelines. Amber: tokens. Violet: the platform users' requests. Blue: hops inside the platform, from the control plane to compute, and compute's questions to Unity Catalog. Light blue dots: data read from or written to storage. Green: results and answers on their way back. Red: a refusal. A rail takes the colour of what travels on it."],
  };

  // ---------- small builders ----------
  const shadow = (x, y, w, h, rx, parent) => el("rect", {x: x + 1, y: y + 3, width: w, height: h, rx, class: "dl-shadow"}, parent);
  const zone = (id, x, y, w, h, label, sub, cls, mark = null) => {
    const g = el("g", {class: `dl-zone ${cls}`, ...tag(id, Z[id][0])}, Lz);
    el("rect", {x, y, width: w, height: h, rx: 18}, g);
    let tx = x + 18;
    if (mark) { el("use", {href: `#dl-${mark}`, x: tx, y: y + 9, width: 26, height: 26}, g); tx += 32; }
    const t = el("text", {x: tx, y: y + 28, class: "dl-zl"}, g);
    el("tspan", {}, t).textContent = label;
    if (sub) el("tspan", {class: "dl-zs"}, t).textContent = `  ·  ${sub}`;
    return g;
  };
  // a tile: a product mark on the left, a title and up to two lines beside it
  const TILE = {};
  const tile = (id, cx, cy, w, h, title, sub, o = {}) => {
    const g = el("g", {class: `dl-chip dl-shake ${o.cls || ""}`, ...tag(o.zone || id, title)}, o.parent || Lc);
    const x = cx - w / 2, y = cy - h / 2;
    shadow(x, y, w, h, 12, g);
    el("rect", {x, y, width: w, height: h, rx: 12}, g);
    let tx = x + 16;
    if (o.icon) {
      const s = o.is || Math.min(38, h - 20);
      el("use", {href: `#dl-${o.icon}`, x: x + 11, y: cy - s / 2, width: s, height: s}, g);
      tx = x + 11 + s + 9;
    }
    const n = (sub ? 1 : 0) + (o.sub2 ? 1 : 0), ty = cy + 6 - n * 9.5;
    text(tx, ty, title, "dl-ct dl-l", g);
    if (sub) text(tx, ty + 19, sub, `dl-cs dl-l${o.mono ? " dl-mono" : ""}`, g);
    if (o.sub2) text(tx, ty + 37, o.sub2, "dl-cs dl-l", g);
    if (o.step) step(x + 3, y + 3, o.step, g);
    TILE[id] = {g, x, y, w, h, cx, cy};
    return g;
  };
  // the order of a request: 1 front door, 2 authenticated, 3 authorized
  const step = (x, y, n, parent) => {
    const g = el("g", {class: "dl-step"}, parent);
    el("circle", {cx: x, cy: y, r: 12.5}, g);
    text(x, y + 5, n, "dl-stepn", g);
  };
  const P_ = (g, d, fill) => el("path", {d, class: fill ? "f" : "s"}, g);
  const C_ = (g, cx, cy, r, fill = true) => el("circle", {cx, cy, r, class: fill ? "f" : "s"}, g);
  const ICON = {
    branch: (g) => { P_(g, "M-3 -3V3"); P_(g, "M3 -2C3 1.5 -3 0.5 -3 3"); C_(g, -3, -4.4, 1.7); C_(g, -3, 4.4, 1.7); C_(g, 3, -3.6, 1.7); },
    commit: (g) => { P_(g, "M-6 0H-2.6M2.6 0H6"); C_(g, 0, 0, 2.6, false); },
    pr: (g) => { P_(g, "M-3.5 -2.6V2.6"); C_(g, -3.5, -4.3, 1.7); C_(g, -3.5, 4.3, 1.7); C_(g, 3.5, 4.3, 1.7); P_(g, "M3.5 2.6V-1.5Q3.5 -4 1 -4H-0.6"); P_(g, "M1 -5.6L-0.6 -4L1 -2.4"); },
    check: (g) => P_(g, "M-4 0.4L-1.2 3.2L4.2 -3"),
    cross: (g) => P_(g, "M-3.3 -3.3L3.3 3.3M3.3 -3.3L-3.3 3.3"),
    key: (g) => { C_(g, -3, 0, 2.7, false); P_(g, "M-0.3 0H5.5M3.6 0V2.6M5.5 0V2"); },
    play: (g) => P_(g, "M-2.6 -4.3L4.3 0L-2.6 4.3Z", true),
    chat: (g) => P_(g, "M-5 -4.4H5V2.4H0.4L-2.8 5V2.4H-5Z"),
    chatspark: (g) => { P_(g, "M-5.4 -4.4H3V1.8H-1.2L-3.6 4.2V1.8H-5.4Z"); P_(g, "M4.6 -6.2L5.4 -4.2L7.4 -3.4L5.4 -2.6L4.6 -0.6L3.8 -2.6L1.8 -3.4L3.8 -4.2Z", true); },
    chart: (g) => P_(g, "M-4.5 4.5V0.5M-1.5 4.5V-4.2M1.5 4.5V-1.5M4.5 4.5V-3"),
    rows: (g) => { P_(g, "M-5 -4H5V4H-5Z"); P_(g, "M-5 -1.3H5M-5 1.3H5M-1.6 -4V4"); },
    shield: (g) => P_(g, "M0 -5.2L4.6 -3.4V0.4C4.6 3 2.6 4.6 0 5.4C-2.6 4.6 -4.6 3 -4.6 0.4V-3.4Z"),
    code: (g) => P_(g, "M-2.2 -3.8L-5.4 0L-2.2 3.8M2.2 -3.8L5.4 0L2.2 3.8"),
    search: (g) => { C_(g, -1, -1, 3.4, false); P_(g, "M1.5 1.5L4.8 4.8"); },
    sqlfile: (g) => { P_(g, "M-4 -5.5H1.5L4 -3V5.5H-4Z"); P_(g, "M1.5 -5.5V-3H4"); P_(g, "M-2.4 0.6C-2.4 -0.6 0 -0.6 0 0.4C0 1.4 -2.4 1.4 -2.4 2.6M1.2 0.6V2.6H2.8"); },
    spans: (g) => { P_(g, "M-5 -4H3"); P_(g, "M-3 -1H2"); P_(g, "M-1 2H5"); P_(g, "M1 5H4"); P_(g, "M-5 -4V5"); },
    user: (g) => { C_(g, 0, -2.6, 2.4, false); P_(g, "M-4.6 5.2C-4.6 1.4 4.6 1.4 4.6 5.2"); },
    approve: (g) => { C_(g, 0, 0, 5.4, false); P_(g, "M-2.6 0.3L-0.8 2.1L2.8 -1.7"); },
    stop: (g) => { C_(g, 0, 0, 5.4, false); P_(g, "M-3.6 -3.6L3.6 3.6"); },
    sheet: (g) => { P_(g, "M-5 -4H5V4H-5Z"); P_(g, "M-5 -1.3H5M-5 1.3H5M-1.6 -4V4M1.8 -4V4"); },
    lines: (g) => P_(g, "M-5 -4H1M-5 -1.3H4M-3 1.4H5M-3 4H1"),
  };
  // vendor marks ride on a white tile inside a packet
  const MARK = {gha: "githubactions", py: "python", gh: "github", bundle: "dbx-asset-bundles", mlflow: "dbx-mlflow"};
  const icon = (name, parent, x, y, s = 1) => {
    const g = el("g", {class: "dl-ic", transform: `translate(${x},${y}) scale(${s})`}, parent);
    if (MARK[name]) { el("rect", {x: -7, y: -7, width: 14, height: 14, rx: 3, class: "dl-tile"}, g); el("use", {href: `#dl-${MARK[name]}`, x: -5.6, y: -5.6, width: 11.2, height: 11.2}, g); }
    else ICON[name](g);
    return g;
  };
  // the tick or cross a check leaves on its tile
  const BADGE = {};
  const badge = (id, x, y) => {
    const g = el("g", {class: "dl-badge", transform: `translate(${x},${y})`}, Lc);
    const s = el("g", {class: "dl-badge-in"}, g);
    el("circle", {r: 13}, s);
    icon("check", s, 0, 0, 1.4).classList.add("ok");
    icon("cross", s, 0, 0, 1.4).classList.add("bad");
    BADGE[id] = g;
    return g;
  };
  const tileBadge = (id) => badge(id, TILE[id].x + TILE[id].w - 4, TILE[id].y + 4);

  // ---------- the perimeters, as in Databricks' own architecture picture ----------
  // Outside (left and right): the people and GitHub. Your Databricks account: the main stage.
  // Beside it, dashed and empty: your cloud account and your resources. No frame wraps them.
  const outsideL = zone("outside", 20, 30, 545, 1440, "", "", "dl-outside");
  el("rect", {x: 2205, y: 30, width: 475, height: 1440, rx: 18, class: "dl-outside-r"}, outsideL);
  const DBX = {x: 600, y: 95, w: 1350, h: 1365};
  const CA = {x: 1965, y: 470, w: 210, h: 442};
  const RES = {x: 1965, y: 942, w: 210, h: 246};
  zone("dbx", DBX.x, DBX.y, DBX.w, DBX.h, "YOUR DATABRICKS ACCOUNT", "account console · control plane · serverless compute plane · default storage", "dl-dbx", "databricks");
  // where it runs is a note inside the Databricks account, never a frame around it: a small data centre and a line
  const region = el("g", {...tag("region", Z.region[0]), class: "dl-zone dl-lbl dl-region"}, Lz);
  const dc = el("g", {class: "dl-dc", transform: "translate(1738,104) scale(0.6)"}, region);
  el("rect", {x: 0, y: 6, width: 46, height: 30, rx: 3}, dc);
  el("path", {d: "M0 6L23 -4L46 6", class: "roof"}, dc);
  [6, 16, 26].forEach((yy) => [5, 16, 27, 38].forEach((xx) => el("rect", {x: xx, y: yy + 7, width: 4, height: 5, class: "win"}, dc)));
  text(1930, 123, "runs on AWS, us-west-2", "dl-note dl-end", region);

  // a legend is one row in a rounded box, laid out from the measured text widths and centred on the world
  const legendRow = (g, title, items, yRow, sw) => {
    const box = el("rect", {x: 0, y: 0, width: 0, height: 48, rx: 12, class: "dl-tbox"}, g), gap = 30;
    let xi = 0;
    const head = text(xi, yRow + 5, title, "dl-zl", g);
    head.style.fontSize = "14px";
    xi += (head.getBBox().width || title.length * 9.2) + gap;
    items.forEach(([c, t]) => {
      el("rect", {x: xi, y: yRow - sw.h / 2, width: sw.w, height: sw.h, rx: sw.rx, class: `dl-sw ${c}`}, g);
      const label = text(xi + sw.w + 9, yRow + 4.5, t, "dl-note dl-l", g);
      xi += sw.w + 9 + (label.getBBox().width || t.length * 6.6) + gap;
    });
    // centred by moving every part, not by a transform: a click zooms to the row's own box
    const rowW = xi - gap, x0 = (W - rowW) / 2;
    box.setAttribute("x", -20); box.setAttribute("y", yRow - 24); box.setAttribute("width", rowW + 40);
    for (const n of g.children) n.setAttribute("x", (+n.getAttribute("x") + x0).toFixed(1));
  };
  // where it runs: the legend of the perimeters, one row above the Databricks account
  legendRow(el("g", {class: "dl-legend dl-where", ...tag("legend", Z.legend[0])}, Lz), "WHERE IT RUNS",
    [["dl-outside", "outside"], ["dl-dbx", "your Databricks account"], ["dl-ghost", "your cloud account (not used)"], ["dl-res", "your resources (not used)"]],
    58, {w: 24, h: 16, rx: 4});

  // ---------- zones ----------
  const ZX = 640, ZW = 1265;
  zone("devs", 40, 50, 500, 660, "DEVELOPERS", "", "dl-people");
  zone("users", 2225, 50, 450, 1400, "PLATFORM USERS", "", "dl-people dl-upeople");
  zone("account", ZX, 135, ZW, 165, "ACCOUNT CONSOLE", "above every workspace", "dl-acctz");
  zone("control", ZX, 335, ZW, 435, "CONTROL PLANE", "every request: 1 a front door, 2 authenticated, 3 authorized", "dl-control");
  zone("compute", ZX, 800, ZW, 395, "SERVERLESS COMPUTE PLANE", "", "dl-compute", "dbx-serverless-compute");
  zone("storage", ZX, 1225, ZW, 215, "STORAGE", "in your Databricks account · no bucket of yours", "dl-storage");
  // your cloud account and your resources: two separate perimeters beside the Databricks account,
  // outside it, dashed and empty. No rail leads to either: no traffic of the course enters them.
  const GX = CA.x + CA.w / 2;
  const ghostZone = (id, r, title, notes, cls) => {
    const g = zone(id, r.x, r.y, r.w, r.h, "", "", cls);
    text(GX, r.y + 30, title, "dl-zl dl-mid", g).style.fontSize = "14px";
    notes.forEach((s, i) => text(GX, r.y + 54 + i * 18, s, "dl-note dl-mid", g));
  };
  ghostZone("ghost", CA, "YOUR CLOUD ACCOUNT", ["classic workspaces only;", "none in this course:", "express setup gives you", "no cloud account"], "dl-ghost");
  ghostZone("resources", RES, "YOUR RESOURCES", ["optional;", "the course connects none"], "dl-ghost dl-res");
  const bb = el("g", {...tag("backbone", "Cloud backbone"), class: "dl-zone dl-lbl"}, Lz);
  text(1036, 790, "cloud backbone · never the public internet", "dl-note dl-l", bb);
  const rt = el("g", {...tag("rtrunk", "The road in, for people"), class: "dl-zone dl-lbl"}, Lz);
  text(2070, 392, "HTTPS, every request", "dl-note dl-mid", rt);
  text(2070, 410, "carries a token", "dl-note dl-mid", rt);
  const rec = el("g", {...tag("records", "Audit and usage records"), class: "dl-zone dl-lbl"}, Lz);
  el("text", {x: 0, y: 0, class: "dl-note dl-mid", transform: "translate(1940,900) rotate(-90)"}, rec).textContent = "audit and usage records · they arrive later";

  // whose traffic is it: the legend of the packet colours, one row along the bottom of the world
  legendRow(el("g", {class: "dl-legend dl-traffic", ...tag("traffic", "Whose traffic is it")}, Lz), "TRAFFIC",
    [["dl-dev", "developers' requests"], ["dl-tok", "tokens"], ["dl-user", "users' requests"], ["dl-sys", "inside the platform"],
      ["dl-data", "data, to and from files"], ["dl-result", "results, answers"], ["dl-deny", "refused"]],
    1513, {w: 24, h: 13, rx: 6.5});

  // GitHub as a cloud of its own: the puffs are drawn twice, outlined then filled, so only the outer edge shows
  const gh = el("g", {class: "dl-zone dl-gh", ...tag("github", "GitHub")}, Lz);
  const puffs = [["rect", {x: 40, y: 830, width: 500, height: 620, rx: 70}], ["circle", {cx: 150, cy: 862, r: 76}],
    ["circle", {cx: 290, cy: 822, r: 88}], ["circle", {cx: 425, cy: 856, r: 80}]];
  for (const cls of ["dl-cl-o", "dl-cl-f"]) puffs.forEach(([t, a]) => el(t, {...a, class: cls}, gh));
  el("use", {href: "#dl-github", x: 226, y: 782, width: 26, height: 26}, gh);
  text(304, 802, "GITHUB", "dl-zl dl-mid", gh);
  text(290, 826, "repo course-code-hub · a SaaS in its own cloud", "dl-cs", gh);

  // ---------- people at their desks ----------
  // Drawn in a three-quarter view: the desk recedes up and to the left, the person sits at its
  // end in profile, and the open laptop stands on it with its screen turned to the person and
  // half to us. Local coordinates: the desk's front edge runs from (8,0) to (158,0).
  const people = {};
  const HAIR = {
    short: (g, c) => el("path", {d: "M-43 -68C-46 -92 -14 -96 -11 -76C-17 -84 -27 -84 -32 -78C-35 -74 -36 -70 -37 -62C-40 -62 -42 -64 -43 -68Z", fill: c}, g),
    crop: (g, c) => el("path", {d: "M-43 -70C-45 -90 -15 -94 -11 -78C-18 -86 -34 -86 -38 -76C-39 -72 -40 -68 -40 -64C-42 -66 -43 -68 -43 -70Z", fill: c}, g),
    bun: (g, c) => { el("circle", {cx: -43, cy: -86, r: 7, fill: c}, g); HAIR.short(g, c); },
    long: (g, c) => el("path", {d: "M-44 -66C-47 -94 -13 -96 -11 -76C-18 -84 -28 -84 -32 -76C-34 -66 -33 -54 -36 -44C-42 -42 -47 -46 -48 -52C-45 -56 -44 -60 -44 -66Z", fill: c}, g),
    bob: (g, c) => el("path", {d: "M-44 -68C-47 -94 -13 -96 -11 -76C-18 -85 -28 -85 -32 -77C-33 -70 -33 -62 -35 -56C-40 -54 -45 -56 -46 -60C-45 -62 -44 -64 -44 -68Z", fill: c}, g),
    curls: (g, c) => [[-40, -80, 8], [-32, -88, 8], [-22, -89, 8], [-14, -83, 7], [-43, -70, 7]].forEach(([cx, cy, r]) => el("circle", {cx, cy, r, fill: c}, g)),
  };
  const ARM = {
    type: (g, k) => { el("path", {d: "M-26 -40L10 -17", class: "dl-arm", stroke: k.shirt}, g); el("path", {d: "M10 -17L60 -16", class: "dl-arm dl-fore", stroke: k.skin}, g); },
    chin: (g, k) => { el("path", {d: "M-26 -40L0 -18", class: "dl-arm", stroke: k.shirt}, g); el("path", {d: "M0 -18L-9 -50", class: "dl-arm dl-fore", stroke: k.skin}, g); el("circle", {cx: -10.5, cy: -55, r: 5, fill: k.skin}, g); },
    mug: (g, k) => {
      el("path", {d: "M-26 -40L6 -17", class: "dl-arm", stroke: k.shirt}, g); el("path", {d: "M6 -17L30 -22", class: "dl-arm dl-fore", stroke: k.skin}, g);
      el("path", {d: "M30 -31H42V-17H30Z", class: "dl-mug"}, g); el("path", {d: "M42 -28C48 -28 48 -20 42 -20", class: "dl-mugh"}, g);
    },
  };
  const SCREENS = {
    code: (g) => { icon("code", g, 13, 14, 1.5); icon("lines", g, 26, 27, 1.25); },
    py: (g) => { el("use", {href: "#dl-python", x: 9, y: 6, width: 20, height: 20}, g); icon("lines", g, 22, 31, 1.1); },
    chat: (g) => icon("chatspark", g, 19, 20, 2),
    chart: (g) => icon("chart", g, 20, 20, 2.3),
    sql: (g) => { icon("chart", g, 14, 15, 1.4); icon("rows", g, 25, 28, 1.35); },
    sheet: (g) => icon("sheet", g, 20, 20, 2.2),
  };
  // (x, y): where the desk's front left corner stands; o.flip turns the whole desk to face left
  const person = (x, y, o) => {
    const k = o.look, s = o.s || 1;
    const g = el("g", {class: "dl-person", ...tag(o.id, `${o.name}, ${o.role}`)}, Lc);
    if (o.card) el("rect", {x: o.card[0], y: y - 126, width: o.card[1], height: 240, rx: 16, class: "dl-bay"}, g);
    const f = el("g", {transform: `translate(${x},${y}) scale(${o.flip ? -s : s},${s})`}, g);
    el("ellipse", {cx: 40, cy: 47, rx: 104, ry: 5, class: "dl-floor"}, f);
    // the chair, and the legs that go under the desk
    el("rect", {x: -62, y: -60, width: 9, height: 66, rx: 4.5, class: "dl-chair"}, f);
    el("rect", {x: -62, y: 0, width: 46, height: 8, rx: 4, class: "dl-chair"}, f);
    el("path", {d: "M-40 8V43M-54 45H-26", class: "dl-chairleg"}, f);
    el("path", {d: "M-38 -3H-2V38", class: "dl-leg", stroke: k.legs || "#4a5568"}, f);
    el("path", {d: "M-5 42H10", class: "dl-shoe"}, f);
    // the desk: far legs, top, front edge, near legs
    el("path", {d: "M8 0H158L112 -30H-38Z", class: "dl-desk"}, f);
    el("path", {d: "M8 0H158V7H8Z", class: "dl-deskf"}, f);
    el("path", {d: "M14 7V44M152 7V44", class: "dl-dleg"}, f);
    // the person, in profile, looking at the screen
    const b = el("g", {class: "dl-bob"}, f);
    el("path", {d: "M-54 2C-57 -30 -50 -50 -34 -50C-18 -50 -13 -34 -15 2Z", fill: k.shirt}, b);
    el("rect", {x: -33, y: -60, width: 10, height: 13, rx: 4, fill: k.skin}, b);
    el("circle", {cx: -27, cy: -72, r: 15, fill: k.skin}, b);
    el("path", {d: "M-13.5 -73L-9.8 -68.5L-13.5 -66.5Z", fill: k.skin}, b);
    HAIR[k.hair](b, k.hairc);
    el("circle", {cx: -19.5, cy: -74, r: 1.7, class: "dl-eye"}, b);
    if (k.glasses) el("path", {d: "M-24 -78H-14V-71H-24ZM-24 -75H-34", class: "dl-glasses"}, b);
    // the laptop: a thin base on the desk, the lid tilted back, the screen lit
    el("path", {d: "M86 -60L-12 -86L-12 -58L80 -24Z", class: "dl-glow"}, f);
    el("path", {d: "M46.4 -25.8L84.4 -25.8L117.6 -4.2L79.6 -4.2Z", class: "dl-lbase"}, f);
    el("path", {d: "M54 -22.6L80 -22.6L103 -7.6L77 -7.6Z", class: "dl-lkeys"}, f);
    el("path", {d: "M79.6 -4.2H117.6V-1.4H79.6Z", class: "dl-lside"}, f);
    el("path", {d: "M87.4 -24.8L120.6 -3.2L130.6 -43.2L97.4 -64.8Z", class: "dl-lidb"}, f);
    el("path", {d: "M84.4 -25.8L117.6 -4.2L127.6 -44.2L94.4 -65.8Z", class: "dl-lid"}, f);
    const scr = el("g", {class: "dl-scr", transform: "matrix(0.83 0.54 -0.25 1 94.4 -65.8)"}, f);
    el("rect", {x: 2.5, y: 2.5, width: 35, height: 35, rx: 2.5, class: "dl-glass"}, scr);
    SCREENS[o.screen](o.flip ? el("g", {transform: "translate(40,0) scale(-1,1)"}, scr) : scr);
    ARM[k.pose || "type"](b, k);
    // the name and what they work on
    if (o.label === "below") {
      const lx = x + (o.flip ? -40 : 40) * s;
      text(lx, y + 58 * s + 16, o.name, "dl-pn dl-mid", g);
      text(lx, y + 58 * s + 37, o.role, "dl-pr dl-mid", g);
    } else {
      text(x + 172 * s, y - 34, o.name, "dl-pn", g);
      text(x + 172 * s, y - 12, o.role, `dl-pr${o.mono ? " dl-mono" : ""}`, g);
    }
    people[o.name] = g;
  };
  const DEVS = [
    {name: "Ada", branch: "feature/chunking", title: "chunk papers by section", color: "#c9705f", y: 345, look: {skin: "#e8b89a", hairc: "#4a2f23", hair: "bun", shirt: "#c9705f"}},
    {name: "Bo", branch: "fix/eval-judge", title: "a stricter eval judge", color: "#b7791f", y: 495, look: {skin: "#b57a55", hairc: "#241a14", hair: "crop", shirt: "#d19a4f", glasses: true, pose: "mug"}},
    {name: "Chen", branch: "feature/genie-tool", title: "Genie as an agent tool", color: "#8d6e52", y: 645, look: {skin: "#f0c9a8", hairc: "#1f1a18", hair: "short", shirt: "#a8766a", pose: "chin"}},
  ];
  const USERS = [
    {name: "Dana", id: "dana", role: "data scientist · notebooks", screen: "py", y: 236, look: {skin: "#d9a383", hairc: "#5a3a2a", hair: "long", shirt: "#6b5fb0"}},
    {name: "Eli", id: "eli", role: "analyst · asks Genie", screen: "chat", y: 498, look: {skin: "#8d5a3b", hairc: "#1c1512", hair: "curls", shirt: "#8f84c7", pose: "chin"}},
    {name: "Fay", id: "fay", role: "manager · dashboards, SQL", screen: "sql", y: 760, look: {skin: "#f1cdb0", hairc: "#8c5a3c", hair: "bob", shirt: "#57508f", glasses: true}},
    {name: "Gus", id: "gus", role: "chats with the agent app", screen: "chat", y: 1022, look: {skin: "#e2ad8c", hairc: "#9a9a9a", hair: "crop", shirt: "#7d74b8", pose: "mug"}},
    {name: "Tess", id: "tess", role: "teacher · course dashboard", screen: "chart", y: 1284, look: {skin: "#c9926e", hairc: "#2a1c16", hair: "bun", shirt: "#4f4a85"}},
  ];
  const DX = 134, UX = 2500, US = 1.25;
  DEVS.forEach((d) => person(DX, d.y, {name: d.name, role: d.branch, mono: true, look: d.look, screen: "code", id: "devs"}));
  USERS.forEach((u) => person(UX, u.y, {name: u.name, role: u.role, look: u.look, screen: u.screen, id: u.id, flip: true, s: US, label: "below", card: [2240, 420]}));

  // the laptop: what every developer has
  const lap = el("g", {class: "dl-box", ...tag("laptop", "On each laptop")}, Lc);
  el("rect", {x: 60, y: 95, width: 460, height: 140, rx: 12}, lap);
  text(76, 118, "ON EACH LAPTOP", "dl-zl", lap);
  const editor = tile("editor", 176, 152, 208, 46, "Editor", "VS Code in the course", {cls: "dl-lap", is: 26});
  icon("code", editor, 88, 152, 1.9).classList.add("dl-ink");
  editor.querySelectorAll("text").forEach((t) => t.setAttribute("x", 109));
  const pc = tile("precommit", 176, 205, 208, 46, "pre-commit", "hooks on every commit", {cls: "dl-lap"});
  icon("check", pc, 88, 205, 1.9).classList.add("dl-ink");
  pc.querySelectorAll("text").forEach((t) => t.setAttribute("x", 109));
  tile("connect", 392, 152, 208, 46, "Databricks Connect", "Spark on dev compute", {cls: "dl-lap", icon: "dbx-databricks-connect", is: 28});
  tile("cli", 392, 205, 208, 46, "CLI profile", "OAuth U2M · auth login", {cls: "dl-lap", icon: "dbx-databricks-cli", is: 28});

  // GitHub
  tile("pr", 170, 985, 190, 60, "Pull request", "review · approve", {cls: "dl-gc", icon: "github", is: 26});
  tile("ci", 405, 985, 196, 60, "Actions CI", "pre-commit · pytest", {cls: "dl-gc", icon: "githubactions", is: 26});
  tile("cd", 290, 1080, 262, 60, "Actions CD", "acc first, then prd", {cls: "dl-gc", icon: "githubactions", is: 26});
  const envs = el("g", {class: "dl-box", ...tag("envs", "Environments")}, Lc);
  el("rect", {x: 80, y: 1140, width: 420, height: 140, rx: 12}, envs);
  const ENV = {};
  [["dev", 170, ""], ["acc", 290, ""], ["prd", 410, "approval: setting"]].forEach(([n, x, s]) => {
    const g = el("g", {class: "dl-chip dl-gc"}, envs);
    el("rect", {x: x - 55, y: 1160, width: s ? 130 : 100, height: 48, rx: 8}, g);
    text(s ? x + 10 : x - 5, s ? 1179 : 1190, n, "dl-ct dl-mid", g);
    if (s) text(x + 10, 1199, s, "dl-cs dl-mid", g);
    ENV[n] = g;
  });
  text(96, 1244, "Environments", "dl-ct dl-l", envs);
  text(96, 1265, "each holds DATABRICKS_CLIENT_ID, not a secret", "dl-cs dl-l", envs);
  const issuer = tile("issuer", 290, 1345, 340, 64, "OIDC issuer", "token.actions.githubusercontent.com", {cls: "dl-gc"});
  icon("key", issuer, 142, 1345, 2).classList.add("dl-ink");
  issuer.querySelectorAll("text").forEach((t) => t.setAttribute("x", 164));
  badge("ci", 499, 959); badge("pr", 261, 959); badge("prd", 481, 1162);

  // the Databricks account
  tile("budgets", 800, 232, 250, 64, "Budgets", "serverless usage policies");
  tile("fed", 1100, 232, 300, 64, "Federation policies", "one per deploy SP and environment");
  tile("ids", 1445, 232, 290, 64, "Users, SPs, groups", "created by code (SCIM)");
  tile("idp", 1755, 232, 270, 64, "Identity provider", "SAML or OIDC", {cls: "dl-gst", sub2: "not connected in the course"});
  tileBadge("fed"); tileBadge("ids");

  // ---------- the control plane, in the order a request meets it ----------
  // row 1: the two front doors, with identity and auth between them
  tile("rest", 850, 425, 300, 70, "REST APIs", "front door · CLI, SDK, Connect, CD", {icon: "dbx-rest-api", step: "1"});
  tile("auth", 1272, 425, 330, 70, "Identity & auth", "authenticates every request", {icon: "dbx-enterprise-security", step: "2", cls: "dl-gate"});
  tile("web", 1700, 425, 300, 70, "Web application", "front door · the workspace UI", {icon: "databricks", step: "1"});
  // row 2: the workspace's own authorization, and the services it guards
  tile("jobs", 790, 535, 220, 64, "Jobs", "runs · schedules", {icon: "dbx-lakeflow-jobs"});
  tile("acl", 1272, 535, 330, 64, "Workspace ACLs", "authorizes workspace objects", {icon: "dbx-workspace", step: "3", cls: "dl-gate"});
  tile("genie", 1565, 535, 190, 64, "Genie", "question → SQL", {icon: "dbx-genie"});
  tile("one", 1800, 535, 180, 64, "Genie One", "dashboards", {icon: "dbx-genie-one"});
  // row 3, next to the backbone: what compute asks before it touches data or a model
  tile("gateway", 825, 687, 330, 110, "Unity Gateway", "course_ops.gateway.chat", {icon: "dbx-unity-ai-gateway", is: 40, mono: true, sub2: "per-user budgets · limits · usage"});
  const U = {x: 1050, y: 622, w: 640, h: 130};
  const ucRing = el("rect", {x: U.x - 6, y: U.y - 6, width: U.w + 12, height: U.h + 12, rx: 18, class: "dl-ring"}, Lc);
  const UC = el("g", {class: "dl-box dl-ucb dl-shake", ...tag("uc", "Unity Catalog")}, Lc);
  shadow(U.x, U.y, U.w, U.h, 14, UC);
  el("rect", {x: U.x, y: U.y, width: U.w, height: U.h, rx: 14}, UC);
  el("use", {href: "#dl-dbx-unity-catalog", x: U.x + 16, y: U.y + 10, width: 46, height: 46}, UC);
  text(U.x + 72, U.y + 31, "Unity Catalog", "dl-ct dl-l", UC);
  text(U.x + 72, U.y + 51, "authorizes data and AI assets · audits", "dl-cs dl-l", UC);
  step(U.x + 3, U.y + 3, "3", UC);
  TILE.uc = {g: UC, ...U, cx: U.x + U.w / 2, cy: U.y + U.h / 2};
  // the metastore, under the mark, and its catalogs
  const meta = el("g", {class: "dl-chip dl-cat", ...tag("meta", "Metastore and catalogs")}, Lc);
  el("rect", {x: U.x + 16, y: U.y + 68, width: 236, height: 50, rx: 9}, meta);
  el("path", {d: `M${U.x + 30} ${U.y + 84}v18a11 4.5 0 0 0 22 0v-18a11 4.5 0 0 0 -22 0a11 4.5 0 0 0 22 0`, class: "dl-mcyl"}, meta);
  text(U.x + 62, U.y + 89, "metastore", "dl-ct dl-l", meta).style.fontSize = "15.5px";
  text(U.x + 62, U.y + 108, "account object · us-west-2", "dl-cs dl-l", meta);
  el("path", {d: `M${U.x + 252} ${U.y + 93}H${U.x + 326}M${U.x + 326} ${U.y + 38}V${U.y + 93}M${U.x + 326} ${U.y + 38}H${U.x + 344}M${U.x + 326} ${U.y + 93}H${U.x + 344}M${U.x + 484} ${U.y + 38}H${U.x + 492}M${U.x + 484} ${U.y + 93}H${U.x + 492}`, class: "dl-tree"}, Lc);
  [["llmops_dev", 0, 0], ["llmops_acc", 1, 0], ["llmops_prd", 0, 1], ["course_ops", 1, 1]].forEach(([n, c, r]) => {
    const g = el("g", {class: "dl-chip dl-cat", ...tag("meta", n)}, Lc);
    el("rect", {x: U.x + 344 + c * 148, y: U.y + 18 + r * 55, width: 140, height: 40, rx: 8}, g);
    text(U.x + 414 + c * 148, U.y + 43 + r * 55, n, "dl-cs dl-mono dl-mid", g);
  });
  const secrets = tile("secrets", 1800, 672, 180, 64, "Secrets", "scopes · UC secrets");
  icon("key", secrets, 1731, 672, 2).classList.add("dl-ink");
  secrets.querySelectorAll("text").forEach((t) => t.setAttribute("x", 1752));
  tileBadge("auth"); tileBadge("acl"); tileBadge("uc"); tileBadge("gateway");

  // ---------- the compute plane: services in a row, then three racks whose blades are the executors ----------
  tile("apps", 830, 872, 300, 58, "Databricks Apps", "agent app · its own service principal", {icon: "dbx-databricks-apps", is: 34});
  tile("serving", 1150, 872, 200, 58, "Model serving", "foundation models", {icon: "dbx-model-serving", is: 34});
  tile("zerobus", 1372, 872, 204, 58, "Zerobus ingest", "trace spans", {icon: "dbx-zerobus-ingest", is: 34});
  tile("lakebase", 1592, 872, 196, 58, "Lakebase", "Postgres · vectors", {icon: "dbx-lakebase", is: 34});
  tile("aisearch", 1802, 872, 190, 58, "AI Search", "was Vector Search", {icon: "dbx-ai-search", is: 34});
  tileBadge("lakebase");
  const rack = (id, cx, title, sub, mark) => {
    const x = cx - 140, y = 948;
    const g = el("g", {class: "dl-rack dl-shake", ...tag(id, title)}, Lc);
    shadow(x, y, 280, 196, 12, g);
    el("rect", {x, y, width: 280, height: 196, rx: 12, class: "dl-rk"}, g);
    el("rect", {x, y, width: 280, height: 44, rx: 12, class: "dl-rkh"}, g);
    el("rect", {x, y: y + 30, width: 280, height: 14, class: "dl-rkh"}, g);
    el("use", {href: `#dl-${mark}`, x: x + 12, y: y + 7, width: 30, height: 30}, g);
    text(x + 50, y + 20, title, "dl-ct dl-l", g);
    text(x + 50, y + 38, sub, "dl-cs dl-l", g);
    const cores = [];
    for (let i = 0; i < 4; i++) {
      const by = y + 58 + i * 34, bx = x + 18;
      const b = el("g", {class: "dl-blade", ...tag("exec", "Executor")}, g);
      el("rect", {x: bx, y: by, width: 244, height: 26, rx: 5, class: "dl-bl"}, b);
      el("circle", {cx: bx + 14, cy: by + 13, r: 4, class: "dl-led", style: `animation-delay:${(i * 0.7 + cx / 900).toFixed(2)}s`}, b);
      el("path", {d: `M${bx + 28} ${by + 8}H${bx + 120}M${bx + 28} ${by + 18}H${bx + 92}`, class: "dl-vent"}, b);
      for (let k = 0; k < 4; k++) el("rect", {x: bx + 160 + k * 20, y: by + 7, width: 12, height: 12, rx: 2, class: "dl-core", style: `animation-delay:${k * 0.12}s`}, b);
      cores.push({el: b, cx: bx + 122, cy: by + 13, bottom: by + 26, n: 0});
    }
    return {x: cx, chip: g, cores, top: y + 44};
  };
  const ENG = {
    wh: rack("wh", 860, "SQL warehouse", "SQL editor · Genie · dashboards", "dbx-sql-warehouse"),
    nb: rack("nb", 1290, "Notebook compute", "notebooks · Connect", "dbx-notebooks"),
    jc: rack("jc", 1720, "Job compute", "one per job run", "dbx-lakeflow-jobs"),
  };

  // ---------- storage: cylinders for the tables, folders for files ----------
  const TABLES = {};
  const cylinder = (name, x, top, body, rx, files, id, label, parent) => {
    const g = el("g", {class: "dl-table", ...tag(id, label)}, parent);
    el("ellipse", {cx: x + 2, cy: top + body + 3, rx, ry: 11, class: "dl-cshadow"}, g);
    el("path", {d: `M${x - rx} ${top}v${body}a${rx} 11 0 0 0 ${2 * rx} 0v-${body}`, class: "cyl"}, g);
    el("path", {d: `M${x - rx} ${top + body * 0.45}a${rx} 11 0 0 0 ${2 * rx} 0`, class: "cyl-band"}, g);
    el("ellipse", {cx: x, cy: top, rx, ry: 11, class: "lid"}, g);
    TABLES[name] = Array.from({length: files}, (_, k) => {
      const fx = x - (files * 15 - 4) / 2 + k * 15;
      return {el: el("path", {d: `M${fx} ${top + 15}h8l3 3v${body > 40 ? 18 : 14}h-11z`, class: "dl-file"}, g), cx: fx + 5.5, cy: top + 25};
    });
    return g;
  };
  const dflt = el("g", {class: "dl-box dl-stb", ...tag("default", "Default storage")}, Lc);
  shadow(660, 1262, 740, 165, 12, dflt);
  el("rect", {x: 660, y: 1262, width: 740, height: 165, rx: 12}, dflt);
  el("use", {href: "#dl-dbx-delta-lake", x: 672, y: 1268, width: 28, height: 28}, dflt);
  const dt = el("text", {x: 706, y: 1288, class: "dl-ct dl-l"}, dflt);
  el("tspan", {}, dt).textContent = "Default storage";
  el("tspan", {class: "dl-cs"}, dt).textContent = "   managed tables and volumes";
  [["arxiv_papers", 722, "tables"], ["arxiv_chunks", 836, "tables"], ["eval_results", 950, "tables"], ["monitoring", 1064, "tables"], ["traces", 1195, "traces"]].forEach(([n, x, id]) => {
    const g = cylinder(n, x, 1314, 50, 44, 4, id, n, Lc);
    text(x, 1398, n, "dl-cs dl-mono dl-mid", g);
  });
  text(1064, 1416, "course_ops", "dl-cs dl-mid", Lc);
  text(1195, 1416, "MLflow, by Zerobus", "dl-cs dl-mid", Lc);
  const folder = (g, x, y, w) => {
    el("path", {d: `M${x} ${y}h${w * 0.4}l6 7h${w * 0.6 - 6}v${w * 0.62}h-${w}z`, class: "dl-folder"}, g);
    el("path", {d: `M${x} ${y + 12}h${w}v${w * 0.62 - 12}h-${w}z`, class: "dl-folder-f"}, g);
  };
  const vol = el("g", {class: "dl-table", ...tag("volume", "Volume arxiv_files")}, Lc);
  folder(vol, 1300, 1322, 52);
  text(1326, 1398, "volume", "dl-cs dl-mid", vol);
  text(1326, 1416, "arxiv_files", "dl-cs dl-mono dl-mid", vol);
  const ws = el("g", {class: "dl-box dl-stb", ...tag("wsstore", "Workspace system data")}, Lc);
  shadow(1418, 1262, 160, 165, 12, ws);
  el("rect", {x: 1418, y: 1262, width: 160, height: 165, rx: 12}, ws);
  folder(ws, 1472, 1284, 52);
  text(1498, 1356, "Workspace data", "dl-ct dl-mid", ws).style.fontSize = "15px";
  text(1498, 1378, "job results,", "dl-cs dl-mid", ws);
  text(1498, 1396, "large results", "dl-cs dl-mid", ws);
  const sys = el("g", {class: "dl-box dl-stb", ...tag("system", "System tables")}, Lc);
  shadow(1596, 1262, 294, 165, 12, sys);
  el("rect", {x: 1596, y: 1262, width: 294, height: 165, rx: 12}, sys);
  [["billing", 1650, "billing", ".usage"], ["gwusage", 1745, "ai_gateway", ".usage"], ["audit", 1840, "access", ".audit"]].forEach(([n, x, a, b2]) => {
    cylinder(n, x, 1296, 34, 30, 3, "system", `system.${a}${b2}`, Lc);
    text(x, 1363, a, "dl-cs dl-mono dl-mid", Lc);
    text(x, 1379, b2, "dl-cs dl-mono dl-mid", Lc);
  });
  el("use", {href: "#dl-dbx-system-tables", x: 1632, y: 1392, width: 26, height: 26}, sys);
  text(1664, 1411, "System tables · system.*", "dl-ct dl-l", sys).style.fontSize = "15.5px";
  // what the dashed perimeters would hold: a box, a glyph of the thing that is not there, its name
  const ghostBox = (zoneId, y, lines, sub, glyph) => {
    const w = 186, h = 140, x = GX - w / 2;
    const g = el("g", {class: "dl-chip dl-gst", ...tag(zoneId, lines.join(" "))}, Lc);
    el("rect", {x, y, width: w, height: h, rx: 12}, g);
    glyph(el("g", {class: "dl-gd", transform: `translate(${GX},${y + 40})`}, g));
    const ty = y + (lines.length > 1 ? 82 : 92);
    lines.forEach((s, i) => { text(GX, ty + i * 18, s, "dl-ct dl-mid", g).style.fontSize = "15px"; });
    text(GX, ty + lines.length * 18 + 6, sub, "dl-cs dl-mid", g);
  };
  const gCyl = (g, cx) => { el("path", {d: `M${cx - 15} -14v28a15 5 0 0 0 30 0v-28`}, g); el("ellipse", {cx, cy: -14, rx: 15, ry: 5}, g); };
  ghostBox("ghost", CA.y + 128, ["Classic compute plane"], "clusters in your VPC", (g) => {
    el("rect", {x: -34, y: -24, width: 68, height: 48, rx: 6}, g);
    [-14, 0, 14].forEach((yy) => el("path", {d: `M-24 ${yy}H24`}, g));
  });
  ghostBox("ghost", CA.y + 284, ["Workspace storage", "bucket"], "an S3 bucket you own", (g) => {
    el("path", {d: "M-24 -14l5 34a19 6 0 0 0 38 0l5 -34"}, g); el("ellipse", {cx: 0, cy: -14, rx: 24, ry: 7}, g);
  });
  ghostBox("resources", RES.y + 88, ["External storage", "and data sources"], "buckets · databases", (g) => {
    gCyl(g, -42); gCyl(g, 42);
    el("path", {d: "M-14 20V-22H14V20M-20 20H20M-6 -12H6M-6 -2H6M-6 8H6"}, g);
  });

  // ---------- rails: a few trunks between containers, junctions, short stubs ----------
  // An edge joins two stops. A stop whose name starts with "." is a junction on a trunk; any
  // other stop is a tile, where a trip starts or ends and through which no trip passes.
  const NODE = {}, EDGES = [];
  const pts = (p) => p.map((q) => q.join(",")).join(" ");
  const edge = (a, b, p, cls = "", zoneId = null) => {
    const e = {a, b, p, cls, n: 0, len: 0};
    for (let i = 1; i < p.length; i++) e.len += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    e.rail = el("polyline", {points: pts(p), class: `dl-rail ${cls}`, "data-rail": `${a}>${b}`}, Lt);
    if (zoneId) { e.rail.classList.add("dl-rhit"); Object.entries(tag(zoneId, Z[zoneId][0])).forEach(([k, v]) => k !== "tabindex" && e.rail.setAttribute(k, v)); }
    e.hot = el("polyline", {points: pts(p), class: "dl-hot"}, Lh);
    EDGES.push(e);
    (NODE[a] ||= {adj: [], at: p[0]}).adj.push({to: b, e, rev: false});
    (NODE[b] ||= {adj: [], at: p[p.length - 1]}).adj.push({to: a, e, rev: true});
  };
  // a chain of junctions along one line: [[name, x, y], ...]
  const chain = (stops, cls, zoneId) => { for (let i = 1; i < stops.length; i++) edge(stops[i - 1][0], stops[i][0], [stops[i - 1].slice(1), stops[i].slice(1)], cls, zoneId); };

  // trunk 1: the developers' column down to GitHub
  DEVS.forEach((d, i) => edge(`dev${i}`, `.d${i}`, [[72, d.y - 30], [58, d.y - 30]]));
  chain([[".d0", 58, DEVS[0].y - 30], [".d1", 58, DEVS[1].y - 30], [".d2", 58, DEVS[2].y - 30]], "dl-trunk");
  edge(".d2", "repo", [[58, DEVS[2].y - 30], [58, 913], [110, 913]], "dl-trunk");
  // inside GitHub
  edge("prdot", "pr", [[330, 928], [330, 942], [170, 942], [170, 955]]);
  edge("pr", "ci", [[265, 985], [307, 985]]);
  edge("main", "cd", [[470, 870], [518, 870], [518, 1032], [380, 1032], [380, 1050]]);
  edge("cd", "issuer", [[159, 1080], [66, 1080], [66, 1345], [120, 1345]]);
  // trunk 2: laptops and GitHub to the REST APIs, the front door for code
  edge("connect", ".l1", [[496, 152], [582, 152]]);
  edge("cli", ".l2", [[496, 205], [582, 205]]);
  edge("cd", ".l3", [[421, 1080], [582, 1080]]);
  chain([[".l1", 582, 152], [".l2", 582, 205], [".lj", 582, 425]], "dl-trunk", "ltrunk");
  edge(".l3", ".lj", [[582, 1080], [582, 425]], "dl-trunk", "ltrunk");
  edge(".lj", "rest", [[582, 425], [700, 425]], "dl-trunk", "ltrunk");
  // trunk 3: the users' column to the web application, the front door for people
  USERS.forEach((u, i) => edge(`user${i}`, `.u${i}`, [[UX - 198, u.y + 5], [2190, u.y + 5]]));
  edge(".u0", ".rj", [[2190, USERS[0].y + 5], [2190, 425]], "dl-trunk", "rtrunk");
  chain([[".rj", 2190, 425], ...USERS.slice(1).map((u, i) => [`.u${i + 1}`, 2190, u.y + 5])], "dl-trunk", "rtrunk");
  edge(".rj", "web", [[2190, 425], [1850, 425]], "dl-trunk", "rtrunk");
  // the control plane: door, then identity and auth, then the workspace's ACLs
  edge("rest", "auth", [[1000, 425], [1107, 425]], "dl-gatel");
  edge("web", "auth", [[1550, 425], [1437, 425]], "dl-gatel");
  edge("auth", "acl", [[1272, 460], [1272, 503]], "dl-gatel");
  // identity and auth reads the account: the identities, and the federation policies
  edge("auth", ".aj", [[1272, 390], [1272, 318]], "dl-thin");
  edge(".aj", "fed", [[1272, 318], [1100, 318], [1100, 264]], "dl-thin");
  edge(".aj", "ids", [[1272, 318], [1445, 318], [1445, 264]], "dl-thin");
  // the control plane's bus: services above it, what compute asks below it
  const BUS = 600;
  chain([[".bjobs", 790, BUS], [".bgw", 825, BUS], [".brest", 950, BUS], [".bbb", 1020, BUS], [".bacl", 1272, BUS], [".buc", 1375, BUS],
    [".bgenie", 1565, BUS], [".bweb", 1685, BUS], [".bone", 1800, BUS], [".brec", 1920, BUS]]);
  [["jobs", ".bjobs", 790, 567], ["rest", ".brest", 950, 460], ["acl", ".bacl", 1272, 567], ["genie", ".bgenie", 1565, 567],
    ["web", ".bweb", 1685, 460], ["one", ".bone", 1800, 567], ["gateway", ".bgw", 825, 632], ["uc", ".buc", 1375, 622], ["secrets", ".bone", 1800, 640]]
    .forEach(([t, j, x, y]) => edge(t, j, [[x, y], [x, BUS]]));
  // trunk 4: the cloud backbone, control plane to compute plane
  const CB = 925;
  edge(".bbb", ".cbb", [[1020, BUS], [1020, CB]], "dl-trunk dl-bbone", "backbone");
  chain([[".capps", 830, CB], [".cwh", 860, CB], [".cbb", 1020, CB], [".cst", 1075, CB], [".cserve", 1150, CB], [".cnb", 1290, CB],
    [".czb", 1372, CB], [".clb", 1592, CB], [".cjc", 1720, CB], [".cvs", 1802, CB]]);
  [["apps", ".capps", 830, 901], ["serving", ".cserve", 1150, 901], ["zerobus", ".czb", 1372, 901], ["lakebase", ".clb", 1592, 901], ["aisearch", ".cvs", 1802, 901],
    ["wh", ".cwh", 860, 948], ["nb", ".cnb", 1290, 948], ["jc", ".cjc", 1720, 948]].forEach(([t, j, x, y]) => edge(t, j, [[x, y], [x, CB]]));
  // trunk 5: compute to storage (the executors' own reads and writes fan out beside it)
  edge(".cst", ".str", [[1075, CB], [1075, 1210], [1195, 1210]], "dl-trunk");
  edge(".str", "traces", [[1195, 1210], [1195, 1302]]);
  edge(".str", ".sws", [[1195, 1210], [1498, 1210]]);
  edge(".sws", "wsstore", [[1498, 1210], [1498, 1262]]);
  // the records lane: audit and usage records, delivered by Databricks to the system tables
  edge(".brec", ".raud", [[1920, BUS], [1920, 1210], [1840, 1210]], "dl-lane", "records");
  chain([[".raud", 1840, 1210], [".ruse", 1745, 1210], [".rbill", 1650, 1210]], "dl-lane", "records");
  [["audit", ".raud", 1840], ["gwusage", ".ruse", 1745], ["billing", ".rbill", 1650]].forEach(([t, j, x]) => edge(t, j, [[x, 1284], [x, 1210]], "dl-lane"));
  // a dot at every junction
  Object.entries(NODE).forEach(([k, n]) => { if (k[0] === ".") el("circle", {cx: n.at[0], cy: n.at[1], r: 4.5, class: "dl-jn"}, Lt); });

  // the shortest way between two stops, never through a tile
  const routes = new Map();
  const shortest = (a, b) => {
    const key = `${a}>${b}`;
    if (routes.has(key)) return routes.get(key);
    if (!NODE[a] || !NODE[b]) throw new Error(`day: no stop ${NODE[a] ? b : a}`);
    const dist = {[a]: 0}, prev = {}, open = new Set([a]);
    while (open.size) {
      let u = null;
      for (const k of open) if (u === null || dist[k] < dist[u]) u = k;
      open.delete(u);
      if (u === b) break;
      if (u !== a && u[0] !== ".") continue;
      for (const h of NODE[u].adj) {
        const d = dist[u] + h.e.len;
        if (dist[h.to] === undefined || d < dist[h.to]) { dist[h.to] = d; prev[h.to] = [u, h]; open.add(h.to); }
      }
    }
    if (dist[b] === undefined) throw new Error(`day: no way ${key}`);
    const legs = [];
    for (let u = b; u !== a; u = prev[u][0]) legs.unshift(prev[u][1]);
    routes.set(key, legs);
    return legs;
  };
  // "a>b>c": the points to travel and the edges to light
  const resolve = (r) => {
    if (typeof r !== "string") return {p: r, legs: []};
    const stops = r.split(">"), legs = [];
    let p = [];
    for (let i = 1; i < stops.length; i++) for (const h of shortest(stops[i - 1], stops[i])) {
      const q = h.rev ? [...h.e.p].reverse() : h.e.p, last = p[p.length - 1];
      p = p.concat(last && last[0] === q[0][0] && last[1] === q[0][1] ? q.slice(1) : q);
      legs.push(h);
    }
    return {p, legs};
  };
  const hot = (e, d, rev, fam) => {
    e.n = Math.max(0, e.n + d);
    if (d > 0) e.hot.setAttribute("class", `dl-hot on ${fam}${rev ? " rev" : ""}`);
    else if (!e.n) e.hot.classList.remove("on");
  };

  // ---------- the scene clock ----------
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) svg.classList.add("still");
  let speed = 1, playing = true, visible = false, started = false, now = 0, last = 0, raf = 0, epoch = 0;
  let timers = [];
  const flights = new Set();
  const live = () => playing && visible;
  const kick = () => {
    svg.classList.toggle("paused", !live());
    if (live() && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  };
  const after = (ms, fn) => timers.push({at: now + ms, fn});
  const wait = (ms) => new Promise((r) => after(ms, r));
  function frame(t) {
    raf = 0;
    if (!live()) return;
    now += Math.max(0, Math.min(64, t - last)) * speed; last = t;
    for (const f of [...flights]) stepFlight(f);
    for (let i = 0; i < timers.length;) {
      if (timers[i].at <= now) timers.splice(i, 1)[0].fn(); else i++;
    }
    tickClock();
    raf = requestAnimationFrame(frame);
  }
  // story time: 1.5 minutes a second, 09:00 to 18:00, then the next day
  let shown = "09:00", dayNo = 0;
  const tickClock = () => {
    const m = Math.floor(now / 1000 * 1.5), d = Math.floor(m / 540), t = 540 + (m % 540);
    const s = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
    if (s !== shown) clock.textContent = shown = s;
    if (d !== dayNo) { dayNo = d; say("<i>A new day starts at 09:00</i>", "sys"); }
  };

  // ---------- small motions ----------
  let holds = new WeakMap();
  const hold = (node, cls, ms) => {
    const m = holds.get(node) || {}; holds.set(node, m);
    m[cls] = (m[cls] || 0) + 1; node.classList.add(cls);
    after(ms, () => { if (--m[cls] <= 0) node.classList.remove(cls); });
  };
  const lit = (id, ms = 1200) => hold(TILE[id].g, "on", ms);
  const replay = (node, cls) => { node.classList.remove(cls); node.getBoundingClientRect(); node.classList.add(cls); };
  const act = (name) => replay(people[name], "act");
  // a check leaves its mark: a tick or a cross on the tile's corner
  const stamp = (id, ok = true, ms = 1500) => {
    const b = BADGE[id];
    b.classList.remove("ok", "bad"); b.classList.add(ok ? "ok" : "bad"); replay(b, "show");
    if (ms) after(ms, () => b.classList.remove("show"));
    if (TILE[id]) { if (ok) lit(id, ms); else { hold(TILE[id].g, "deny", ms); replay(TILE[id].g, "shake"); } }
  };
  const ripple = (x, y) => { const c = el("circle", {cx: x, cy: y, r: 9, class: "dl-ripple"}, Lp); after(800, () => c.remove()); };
  const say = (html, cls = "") => {
    const li = document.createElement("li"); li.className = cls;
    li.innerHTML = `<b>${shown}</b><span>${html}</span>`;
    log.prepend(li);
    while (log.children.length > 4) log.lastChild.remove();
  };

  // ---------- perimeter crossings: a packet lights the border it passes ----------
  const PERIM = [DBX, CA, RES];
  const crossings = (p) => {
    const out = []; let d0 = 0;
    for (let i = 1; i < p.length; i++) {
      const [ax, ay] = p[i - 1], [bx, by] = p[i], len = Math.hypot(bx - ax, by - ay);
      for (const r of PERIM) {
        for (const [vert, c] of [[true, r.x], [true, r.x + r.w], [false, r.y], [false, r.y + r.h]]) {
          const a = vert ? ax : ay, b = vert ? bx : by;
          if ((a - c) * (b - c) >= 0 || a === b) continue;
          const t = (c - a) / (b - a), x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
          if (vert ? y >= r.y && y <= r.y + r.h : x >= r.x && x <= r.x + r.w) out.push({d: d0 + len * t, x, y, vert});
        }
      }
      d0 += len;
    }
    return out.sort((u, v) => u.d - v.d);
  };
  const crossMark = ({x, y, vert}) => {
    const g = el("g", {class: "dl-cross", transform: `translate(${x.toFixed(1)},${y.toFixed(1)})`}, Lp);
    el("line", vert ? {x1: 0, y1: -26, x2: 0, y2: 26} : {x1: -26, y1: 0, x2: 26, y2: 0}, g);
    el("circle", {r: 7}, g);
    after(900, () => g.remove());
  };

  // ---------- packets ----------
  const curve = (a, b) => {
    const out = [], dn = b[1] > a[1] ? 1 : -1;
    const c1 = [a[0], a[1] + dn * 90], c2 = [b[0], b[1] - dn * 120];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20, u = 1 - t;
      out.push([0, 1].map((j) => u ** 3 * a[j] + 3 * u * u * t * c1[j] + 3 * u * t * t * c2[j] + t ** 3 * b[j]));
    }
    return out;
  };
  // cls is the family: dl-dev, dl-tok, dl-user, dl-sys, dl-data, dl-result, dl-deny, dl-audit
  const fly = (r, cls, label = "", ic = null, v = 0.56) => new Promise((done) => {
    const {p, legs} = resolve(r);
    const g = el("g", {class: `dl-packet ${cls}`}, Lp);
    if (!label && !ic) el("circle", {r: cls === "dl-audit" || cls === "dl-task" ? 6 : 8}, g);
    else {
      const bg = el("rect", {y: -14, height: 28, rx: 14}, g);
      const t = label ? text(0, 5, label, "dl-pt", g) : null;
      const tw = t ? t.getComputedTextLength() : 0, iw = ic ? (MARK[ic] ? 18 : 14) : 0, gap = ic && t ? 7 : 0;
      const w = Math.max(28, tw + iw + gap + 22), x0 = -w / 2 + 11;
      if (ic) icon(ic, g, t ? x0 + iw / 2 : 0, 0, MARK[ic] ? 1.3 : 1.25);
      if (t) t.setAttribute("x", x0 + iw + gap);
      bg.setAttribute("x", -w / 2); bg.setAttribute("width", w);
    }
    const segs = []; let total = 0;
    for (let i = 1; i < p.length; i++) { const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); segs.push(d); total += d; }
    const f = {g, p, segs, total, t0: now, dur: Math.max(380, total / v), legs, big: !!(label || ic), done, cross: legs.length ? crossings(p) : []};
    legs.forEach((h) => hot(h.e, 1, h.rev, cls));
    flights.add(f); stepFlight(f);
  });
  const at = (f, d) => {
    for (let i = 0; i < f.segs.length; i++) {
      if (d <= f.segs[i] && f.segs[i] > 0) { const k = d / f.segs[i], a = f.p[i], b = f.p[i + 1]; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; }
      d -= f.segs[i];
    }
    return f.p[f.p.length - 1];
  };
  function stepFlight(f) {
    const q = Math.min(1, (now - f.t0) / f.dur);
    const e = q < 0.5 ? 2 * q * q : 1 - (-2 * q + 2) ** 2 / 2;
    const dist = e * f.total, [x, y] = at(f, dist);
    while (f.cross.length && f.cross[0].d <= dist) crossMark(f.cross.shift());
    const s = q < 0.1 ? 0.55 + 4.5 * q : q > 0.94 ? 1 - (q - 0.94) * 3 : 1;
    f.g.setAttribute("transform", `translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${s.toFixed(3)})`);
    if (q >= 1) {
      f.g.remove(); flights.delete(f);
      f.legs.forEach((h) => hot(h.e, -1));
      if (f.big) ripple(x, y);
      f.done();
    }
  }

  // ---------- the repository's history, drawn as it happens ----------
  const graph = (() => {
    const g = el("g", {class: "dl-graph", ...tag("repo", "The repository's history")}, Lc);
    el("rect", {x: 80, y: 848, width: 420, height: 92, class: "dl-hit"}, g);
    el("path", {d: "M110 870H470", class: "dl-main"}, g);
    text(112, 862, "main", "dl-cs dl-l", g);
    el("circle", {cx: 130, cy: 870, r: 6.5, class: "dl-gdot"}, g);
    let b = null, color = "", x = 160, merged = null;
    const draw = (d, instant) => {
      const p = el("path", {d, pathLength: 1, class: "dl-draw", stroke: color}, b);
      if (!instant) p.getBoundingClientRect();
      p.classList.add("in");
    };
    const dot = (cx, cy, instant) => el("circle", {cx, cy, r: 6.5, class: `dl-gdot${instant ? "" : " dl-pop"}`, stroke: color}, b);
    return {
      clear() { if (b) b.remove(); b = null; if (merged) merged.remove(); merged = null; },
      reset(c) { this.clear(); color = c; x = 160; b = el("g", {}, g); },
      fork(i) { draw("M130 870C130 900 160 890 160 913", i); },
      commit(i) { draw(`M${x} 913H${x + 18}`, i); x += 18; dot(x, 913, i); },
      pr(i) {
        draw(`M${x} 913H330`, i);
        const p = el("g", {class: i ? "" : "dl-pop", transform: "translate(330,913)"}, b);
        el("circle", {r: 12, fill: color}, p); icon("pr", p, 0, 0, 1.1);
      },
      merge(i) {
        draw("M330 913C348 913 354 896 354 876", i);
        merged = el("circle", {cx: 354, cy: 870, r: 7.5, class: `dl-mdot${i ? "" : " dl-pop"}`}, g);
      },
      merged() { this.reset(DEVS[0].color); this.fork(1); this.commit(1); this.commit(1); this.commit(1); this.pr(1); this.merge(1); },
    };
  })();

  // ---------- executors: one task per blade of the rack, all at once ----------
  const coreOn = (c, d) => { c.n = Math.max(0, c.n + d); c.el.classList.toggle("on", c.n > 0); };
  // targets: four [table, file, "write"?]; they must be tables the Unity Catalog decision before it named
  async function burst(engine, targets) {
    const E = ENG[engine];
    hold(E.chip, "on", 2400);
    await Promise.all(E.cores.map((c, k) => wait(k * 70).then(() => fly([[E.x, E.top], [c.cx, c.cy]], "dl-task", "", null, 0.15))));
    await Promise.all(E.cores.map(async (c, k) => {
      const [table, i, mode] = targets[k], f = TABLES[table][i];
      coreOn(c, 1);
      await wait(k * 80);
      await fly(curve([c.cx, c.bottom], [f.cx, f.cy - 2]), "dl-data", "", null, 0.4);
      hold(f.el, mode === "write" ? "w" : "on", 900);
      if (mode !== "write") { await wait(200); await fly(curve([f.cx, f.cy - 2], [c.cx, c.bottom]), "dl-data", "", null, 0.4); }
      await wait(250);
      coreOn(c, -1);
    }));
  }
  for (const [k, e] of Object.entries(ENG)) TILE[k] = {g: e.chip};

  // ---------- the three checks every story is built from ----------
  // Records are delivered by Databricks to the system tables: faint dots along the records lane.
  const record = (from, table) => { fly(`${from}>${table}`, "dl-audit", "", null, 0.9).then(() => hold(TABLES[table][1].el, "on", 700)); };
  // 1 and 2. A request arrives at a front door ("rest" for code, "web" for people) and is handed
  // to identity and auth. Every request does this, on every pass: nothing reaches a service or
  // compute without it.
  async function enter(from, door, cls, label, ic, html, frame) {
    const trip = fly(`${from}>${door}`, cls, label, ic);
    if (frame) after(1300, () => look(frame));
    await trip;
    lit(door, 900);
    await fly(`${door}>auth`, cls, label, ic);
    stamp("auth");
    say(`Identity and auth: ${html} ✓`, "ok");
    await wait(450);
  }
  // 3a. Workspace objects are authorized by their ACLs: a job, a warehouse, an app, a dashboard,
  // a Genie space, a notebook. A separate check from Unity Catalog.
  async function acl(cls, label, ic, html) {
    await fly("auth>acl", cls, label, ic);
    stamp("acl");
    say(`Workspace ACLs: ${html} ✓`, "ok");
    await wait(450);
  }
  // 3b. Data and AI assets are authorized by Unity Catalog. Whoever is about to touch them asks
  // (a rack, Zerobus, the gateway, AI Search), Unity Catalog decides and audits, and only then
  // does anything read or write. A refusal comes back red and nothing is read.
  async function ask(from, privilege, ok, html) {
    await fly(`${from}>uc`, "dl-sys", `${privilege}?`, "shield");
    if (ok) replay(ucRing, "go");
    stamp("uc", ok, ok ? 1500 : 2000);
    say(`Unity Catalog: ${html}`, ok ? "ok" : "bad");
    record("uc", "audit");
    await wait(450);
    await fly(`uc>${from}`, ok ? "dl-result" : "dl-deny", ok ? privilege : "refused", ok ? "check" : "cross");
    return ok;
  }

  // A call from code on compute to another Databricks service (the gateway, Zerobus, AI Search)
  // is one more request: it goes to the REST APIs with the caller's token and is authenticated
  // there before it reaches the service.
  async function call(from, to, label, ic, html) {
    await fly(`${from}>rest`, "dl-sys", label, ic);
    lit("rest", 800);
    await fly("rest>auth", "dl-sys", label, ic);
    stamp("auth");
    say(`Identity and auth: ${html} ✓`, "ok");
    await wait(350);
    await fly(`auth>rest>${to}`, "dl-sys", label, ic);
  }

  // ---------- the stories, as small steps the tour and the whole day share ----------
  // look() moves the camera to the beat of a story while the tour plays; it does nothing in the
  // whole day or once the viewer has taken the camera.
  const ALL = {x: 0, y: 0, w: W, h: H};
  const B = {
    lap: {x: 20, y: 60, w: 1480, h: 600},
    gh: {x: 20, y: 720, w: 600, h: 750},
    ghDoor: {x: 20, y: 110, w: 1480, h: 1360},
    door: {x: 560, y: 110, w: 1400, h: 500},
    ctrl: {x: 620, y: 320, w: 1340, h: 470},
    ctrlComp: {x: 620, y: 320, w: 1340, h: 890},
    compStore: {x: 620, y: 780, w: 1340, h: 680},
    sys: {x: 620, y: 560, w: 1340, h: 900},
    user: (i) => { const y0 = Math.min(330, USERS[i].y - 150), y1 = Math.max(780, USERS[i].y + 130); return {x: 1040, y: y0, w: 1650, h: y1 - y0}; },
  };
  let lastLook = ALL;
  const look = (f) => { if (chap < CH.length) { lastLook = f; if (!free) camera(f); } };
  // a long trip: the camera hands over to the destination while the packet is on its way
  const flyTo = (f, ms, ...a) => { after(ms, () => look(f)); return fly(...a); };
  const sp = (env) => `sp-deploy-arxiv-${env}`;
  const four = (t, mode) => [0, 1, 2, 3].map((i) => (mode ? [t, i, mode] : [t, i]));
  let gusN = 0;
  const S = {
    // Local development starts at the CLI: its profile gets the token, Databricks Connect uses it.
    async login() {
      look(B.lap);
      act("Ada"); lit("cli", 1400);
      say("Ada runs <code>databricks auth login</code>: the CLI opens her browser for an OAuth sign-in (U2M)", "dev");
      await fly("cli>rest", "dl-tok", "auth login", "key");
      lit("rest", 900);
      await fly("rest>auth", "dl-tok", "sign-in", "key");
      lit("auth", 1600);
      await fly("auth>ids", "dl-sys", "Ada?", "user");
      stamp("ids");
      await fly("ids>auth", "dl-result", "", "check");
      stamp("auth");
      say("Identity and auth: Ada is a user of the account ✓ It issues an OAuth token, valid for one hour", "ok");
      await wait(400);
      await fly("auth>rest>cli", "dl-tok", "token", "key");
      lit("cli", 1400);
      say("Her CLI profile caches the token; Databricks Connect reads the same profile", "dev");
    },
    async connect() {
      look(B.lap);
      act("Ada"); lit("connect", 1400);
      say("Ada runs her Python in the editor: Databricks Connect sends the Spark work to the workspace, with the profile's token", "dev");
      await enter("connect", "rest", "dl-dev", "spark.table(…)", "py", "Ada's token is valid");
      // No workspace object is named in this request: the session opens on serverless compute as Ada.
      look(B.ctrlComp);
      await fly("auth>rest>nb", "dl-sys", "session as Ada", "py");
      lit("nb", 1600);
      await ask("nb", "SELECT", true, "Ada may <code>SELECT</code> from <code>llmops_dev.ada.arxiv_chunks</code> ✓ audited");
      look(B.compStore);
      say("Notebook compute runs her Spark work: 4 executors read 4 files of <code>arxiv_chunks</code> at once", "");
      await burst("nb", four("arxiv_chunks"));
      look(B.ctrlComp);
      await flyTo(B.lap, 1500, "nb>rest>connect", "dl-result", "DataFrame", "rows");
      act("Ada"); say("Ada sees the DataFrame in her editor", "ok");
    },
    async branch(i) {
      const d = DEVS[i];
      look(B.gh);
      graph.reset(d.color);
      act(d.name); say(`${d.name} starts the branch <code>${d.branch}</code>`, "dev");
      await fly(`dev${i}>repo`, "dl-dev", d.branch, "branch");
      graph.fork();
    },
    async commits(i, n = 2) {
      const d = DEVS[i];
      act(d.name); lit("precommit", 1200);
      say(`pre-commit passes on ${d.name}'s laptop; ${d.name} pushes ${n === 1 ? "a fix" : `${n} commits`} to <code>${d.branch}</code>`, "dev");
      await fly(`dev${i}>repo`, "dl-dev", n === 1 ? "1 commit" : `${n} commits`, "commit");
      for (let k = 0; k < n; k++) { graph.commit(); await wait(250); }
    },
    async pr(i, no) {
      const d = DEVS[i];
      act(d.name); say(`${d.name} opens PR #${no}: ${d.title}`, "dev");
      await fly(`dev${i}>repo`, "dl-dev", `PR #${no}`, "pr");
      graph.pr();
      await fly("prdot>pr", "dl-dev", `PR #${no}`, "pr");
      lit("pr", 1200);
    },
    async ci(no, fail) {
      await fly("pr>ci", "dl-dev", "CI", "gha");
      lit("ci", 1600); await wait(1600);
      if (fail) { stamp("ci", false, 0); say(`CI on PR #${no}: <code>pytest</code> fails ✗ The ruleset on <code>main</code> blocks the merge`, "bad"); }
      else { stamp("ci", true, 0); say(`CI on PR #${no}: pre-commit and pytest pass ✓`, "ok"); }
    },
    async review(i, no, changes) {
      const j = (i + 1) % DEVS.length, reviewer = DEVS[j].name;
      act(reviewer); lit("pr", 1400);
      await fly(`dev${j}>repo`, "dl-dev", changes ? "changes" : "approve", changes ? "stop" : "approve");
      await fly("prdot>pr", "dl-dev", "", changes ? "stop" : "approve");
      if (changes) { stamp("pr", false, 0); say(`${reviewer} requests changes on PR #${no}: a test is missing`, "bad"); await wait(900); }
      else { stamp("pr", true, 2400); say(`${reviewer} reviews and approves PR #${no}`, "dev"); }
    },
    async merge(i, no) {
      say(`PR #${no} is merged to <code>main</code>`, "dev");
      await wait(500);
      graph.merge(); await wait(700);
      BADGE.ci.classList.remove("show"); BADGE.pr.classList.remove("show");
    },
    // The OIDC exchange: CD asks GitHub's issuer, the issuer answers CD, CD takes the token to the
    // front door, the door hands it to identity and auth, which reads the federation policy.
    async oidc(env, brief) {
      look(B.gh);
      say(env === "prd" ? "The prd job starts in its environment" : "The merge starts CD on <code>main</code>: acc first", "dev");
      await fly("main>cd", "dl-dev", `deploy ${env}`, "gha");
      lit("cd", 2400); hold(ENV[env], "on", 4000);
      say(`The ${env} job asks GitHub's OIDC issuer for a token`, "dev");
      await fly("cd>issuer", "dl-tok", "token?", "key");
      lit("issuer", 1000); await wait(brief ? 150 : 500);
      await fly("issuer>cd", "dl-tok", "OIDC token", "key");
      if (!brief) say("GitHub signs a short-lived token that names the repository and the environment", "dev");
      look(B.ghDoor);
      say("CD sends it to the workspace's <code>/oidc/v1/token</code>, on the REST APIs", "dev");
      await fly("cd>rest", "dl-tok", "OIDC token", "key");
      lit("rest", 900);
      look(B.door);
      await fly("rest>auth", "dl-tok", "OIDC token", "key");
      lit("auth", 2400);
      say(`Identity and auth reads the federation policy of <code>${sp(env)}</code>`, "sys");
      await fly("auth>fed", "dl-sys", "policy?", "shield");
      stamp("fed");
      say("The policy matches: issuer, subject (repository and environment) and audience ✓", "ok");
      await wait(brief ? 200 : 600);
      await fly("fed>auth", "dl-result", "match", "check");
      stamp("auth");
      await flyTo(B.ghDoor, 700, "auth>rest>cd", "dl-tok", `${env} token`, "key");
      lit("cd", 1200);
      say(`CD holds a short-lived Databricks token for <code>${sp(env)}</code>; no secret is stored anywhere`, "ok");
    },
    // A deploy creates or updates workspace objects, so the workspace's ACLs authorize it. It
    // starts no run, and it asks Unity Catalog nothing unless the bundle makes catalog objects.
    async deploy(env) {
      look(B.ghDoor);
      say(`CD runs <code>databricks bundle deploy -t ${env}</code>`, "dev");
      await enter("cd", "rest", "dl-dev", "bundle", "bundle", `the token of <code>${sp(env)}</code> is valid`);
      look(B.ctrlComp);
      await acl("dl-dev", "bundle", "bundle", `<code>${sp(env)}</code> may manage the job and the app, and write the bundle's folder`);
      await Promise.all([fly("acl>jobs", "dl-sys", "job", "bundle").then(() => lit("jobs", 1400)),
        wait(300).then(() => fly("acl>apps", "dl-sys", "app", "bundle")).then(() => lit("apps", 1400))]);
      say(`Deployed to ${env}: the ingest job and the agent app are updated. A deploy starts no run`, "ok");
    },
    // A run starts from an explicit run-now (here CD's `bundle run`), or from a schedule.
    async bundleRun(env) {
      look(B.ghDoor);
      say(`CD runs <code>databricks bundle run -t ${env} arxiv_ingest</code>`, "dev");
      await enter("cd", "rest", "dl-dev", "bundle run", "play", `the token of <code>${sp(env)}</code> is valid`);
      look(B.ctrlComp);
      await acl("dl-dev", "run-now", "play", `<code>${sp(env)}</code> may run the job (CAN MANAGE RUN)`);
      await fly("acl>jobs", "dl-dev", "run-now", "play");
      lit("jobs", 1400);
      say(`Jobs starts <code>arxiv_ingest</code> on serverless job compute, run as <code>${sp(env)}</code>`, "sys");
      await fly("jobs>jc", "dl-sys", "run", "play");
      lit("jc", 1600);
      await ask("jc", "MODIFY", true, `<code>${sp(env)}</code> may <code>MODIFY</code> <code>arxiv_papers</code> and <code>arxiv_chunks</code> ✓ audited`);
      look(B.compStore);
      say("4 executors write new files to <code>arxiv_papers</code> and <code>arxiv_chunks</code> at once", "");
      await burst("jc", [["arxiv_papers", 3, "write"], ["arxiv_chunks", 1, "write"], ["arxiv_chunks", 2, "write"], ["arxiv_chunks", 3, "write"]]);
    },
    async approvePrd() {
      look(B.gh);
      hold(ENV.prd, "on", 3000);
      say("The prd job waits for an approval: required reviewers, a setting of the <code>prd</code> environment", "dev");
      await wait(900);
      act("Bo");
      await fly("dev1>repo", "dl-dev", "approve prd", "approve");
      await fly("main>cd", "dl-dev", "approve prd", "approve");
      stamp("prd", true, 2600);
      say("Bo approves the prd deployment", "dev");
      await wait(500);
    },
    // A model call from code: the gateway asks Unity Catalog for EXECUTE before it applies its
    // own limits; its usage goes to system.ai_gateway.usage, not to the audit table.
    async model(from, who, as, token) {
      say(`${who} calls the model service <code>course_ops.gateway.chat</code>: a REST call, with ${token}`, "sys");
      look(B.ctrlComp);
      await call(from, "gateway", "chat", "chat", `${token} is valid`);
      lit("gateway", 1600);
      await ask("gateway", "EXECUTE", true, `${as} may <code>EXECUTE</code> <code>course_ops.gateway.chat</code> ✓ audited`);
      stamp("gateway");
      say("Unity Gateway: within the rate limit and the budget ✓ The call is recorded in <code>system.ai_gateway.usage</code>", "ok");
      record("gateway", "gwusage");
      await fly("gateway>serving", "dl-sys", "prompt", "chat");
      lit("serving", 1200); await wait(800);
      await fly("serving>gateway", "dl-result", "completion", "chat");
      await fly(`gateway>${from}`, "dl-result", "completion", "chat");
    },
    // Trace spans: Zerobus asks Unity Catalog before a single row lands in the trace tables.
    async spans(from, whose, as, file, token) {
      say(`MLflow sends ${whose} trace spans to Zerobus, with ${token}`, "sys");
      look(B.ctrlComp);
      await call(from, "zerobus", "spans", "spans", `${token} is valid`);
      lit("zerobus", 1400);
      look(B.sys);
      await ask("zerobus", "MODIFY", true, `${as} may <code>MODIFY</code> and <code>SELECT</code> the trace tables ✓ audited`);
      await fly("zerobus>traces", "dl-data", "spans", "spans");
      hold(TABLES.traces[file].el, "w", 900);
      say("Zerobus writes the spans to the trace tables", "");
    },
    async dana(withModel) {
      look(B.user(0));
      act("Dana"); say(withModel ? "Dana runs a cell: her agent retrieves chunks and asks the model, traced by MLflow" : "Dana runs a Python cell: a traced retrieval over <code>arxiv_chunks</code>", "user");
      await enter("user0", "web", "dl-user", "run cell", "py", "Dana's browser session carries her OAuth token", B.ctrl);
      await acl("dl-user", "run cell", "py", "Dana may run this notebook (CAN RUN)");
      look(B.ctrlComp);
      await fly("acl>nb", "dl-sys", "cell, as Dana", "py");
      lit("nb", 1600);
      await ask("nb", "SELECT", true, "Dana may <code>SELECT</code> from <code>arxiv_chunks</code> ✓ audited");
      look(B.compStore);
      say("Notebook compute: 4 executors read 4 files of <code>arxiv_chunks</code> at once", "");
      await burst("nb", four("arxiv_chunks"));
      if (withModel) await S.model("nb", "Dana's code", "Dana", "Dana's token");
      await S.spans("nb", "the cell's", "Dana", 0, "Dana's token");
    },
    async danaBack() {
      look(B.ctrlComp);
      await flyTo(B.user(0), 1800, "nb>web>user0", "dl-result", "result", "rows");
      act("Dana"); say("Dana sees the result, and its trace in MLflow", "ok");
    },
    // Genie: the space is a workspace object; the SQL is checked by Unity Catalog as the asker.
    async eli(deny) {
      look(B.user(1));
      act("Eli"); say(deny ? "Eli asks Genie: “how did jane_doe's evals do in prd?”" : "Eli asks Genie: “which papers on RAG came in this week?”", "user");
      await enter("user1", "web", "dl-user", "question", "chatspark", "Eli's token is valid", B.ctrl);
      await acl("dl-user", "question", "chatspark", "Eli may use this Genie space (CAN RUN)");
      await fly("acl>genie", "dl-user", "question", "chatspark");
      lit("genie", 1600); say("Genie writes the SQL for Eli's question", "sys"); await wait(1000);
      look(B.ctrlComp);
      await fly("genie>wh", "dl-sys", "SQL, as Eli", "sqlfile");
      lit("wh", 1600);
      say("The warehouse comes with the space, from its author's compute credentials; the data is checked as Eli", "sys");
      if (deny) {
        await ask("wh", "SELECT", false, "the space includes <code>llmops_prd.jane_doe</code>, but Eli holds no privilege on it: refused ✗ The attempt is audited too");
        await fly("wh>genie", "dl-deny", "refused", "cross");
        await flyTo(B.user(1), 1600, "genie>web>user1", "dl-deny", "no access", "cross");
        act("Eli"); say("Genie tells Eli he has no access to that schema; nothing was read", "bad");
        return;
      }
      await ask("wh", "SELECT", true, "Eli may <code>SELECT</code> from <code>arxiv_papers</code> ✓ audited");
      look(B.compStore);
      say("The SQL warehouse splits the query: 4 executors read 4 files of <code>arxiv_papers</code> at once", "");
      await burst("wh", four("arxiv_papers"));
      look(B.ctrlComp);
      await fly("wh>genie", "dl-result", "rows", "rows");
      await flyTo(B.user(1), 1600, "genie>web>user1", "dl-result", "answer + SQL", "chatspark");
      act("Eli"); say("Eli gets the answer, with the SQL Genie ran", "ok");
    },
    // A dashboard: who its queries run as depends on how it was published.
    // mode "shared": as the publisher (Tess's course dashboard); "own": as the viewer, allowed;
    // "deny": as the viewer, on a schema the viewer holds no privilege on.
    async dash(i, mode) {
      const u = USERS[i], shared = mode === "shared", as = shared ? "its publisher" : u.name;
      look(B.user(i));
      act(u.name);
      say(shared ? `${u.name} opens the course dashboard in Genie One` : mode === "deny" ? `${u.name} opens a dashboard with a tile on <code>llmops_prd.jane_doe</code>` : `${u.name} opens the <em>Eval quality</em> dashboard in Genie One`, "user");
      await enter(`user${i}`, "web", "dl-user", "dashboard", "chart", `${u.name}'s token is valid`, B.ctrl);
      await acl("dl-user", "dashboard", "chart", `${u.name} may view this dashboard (CAN VIEW)`);
      await fly("acl>one", "dl-user", "dashboard", "chart");
      lit("one", 1600);
      say(shared ? "Published with shared data permissions: its queries run as its publisher, not as Tess" : `Published with individual data permissions: its queries run as ${u.name}`, "sys");
      await wait(700);
      look(B.ctrlComp);
      await fly("one>wh", "dl-sys", `tile SQL, as ${as}`, "sqlfile");
      lit("wh", 1600);
      if (mode === "deny") {
        await ask("wh", "SELECT", false, `${u.name} holds no privilege on <code>llmops_prd.jane_doe</code>: refused ✗ The attempt is audited too`);
        await fly("wh>one", "dl-deny", "refused", "cross");
        await flyTo(B.user(i), 1600, `one>web>user${i}`, "dl-deny", "permission denied", "cross");
        act(u.name); say(`${u.name} sees “permission denied” on that tile; nothing was read`, "bad");
        return;
      }
      await ask("wh", "SELECT", true, shared ? "the publisher may <code>SELECT</code> from the <code>course_ops</code> monitoring tables ✓ audited" : `${u.name} may <code>SELECT</code> from <code>eval_results</code> ✓ audited`);
      look(B.compStore);
      say(`The SQL warehouse: 4 executors read 4 files of <code>${shared ? "monitoring" : "eval_results"}</code> at once`, "");
      await burst("wh", four(shared ? "monitoring" : "eval_results"));
      look(B.ctrlComp);
      await fly("wh>one", "dl-result", "rows", "rows");
      await flyTo(B.user(i), 1600, `one>web>user${i}`, "dl-result", "chart", "chart");
      act(u.name); say(shared ? "Tess sees each student's usage and progress" : "Fay's dashboard shows today's eval scores", "ok");
    },
    async sql() {
      look(B.user(2));
      act("Fay"); say("Fay runs a query in the SQL editor: <code>SELECT … FROM eval_results</code>", "user");
      await enter("user2", "web", "dl-user", "SQL", "sqlfile", "Fay's token is valid", B.ctrl);
      await acl("dl-user", "SQL", "sqlfile", "Fay may use this SQL warehouse (CAN USE)");
      look(B.ctrlComp);
      await fly("acl>wh", "dl-sys", "SQL, as Fay", "sqlfile");
      lit("wh", 1600);
      await ask("wh", "SELECT", true, "Fay may <code>SELECT</code> from <code>eval_results</code> ✓ audited");
      look(B.compStore);
      say("The warehouse plans the query and splits it into 4 tasks: 4 executors read 4 files at once", "");
      await burst("wh", four("eval_results"));
      look(B.ctrlComp);
      await flyTo(B.user(2), 1800, "wh>web>user2", "dl-result", "rows", "rows");
      act("Fay"); say("Fay sees the rows in the SQL editor. A large result would come back as files from storage", "ok");
    },
    // The agent app: Gus is authenticated and may use the app; everything the app then reads,
    // it reads as its own service principal.
    async gus() {
      const app = "the app's service principal", token = "the service principal's token";
      look(B.user(3));
      act("Gus"); say("Gus asks the course's agent app about a paper", "user");
      await enter("user3", "web", "dl-user", "chat", "chatspark", "Gus signs in with the workspace's OAuth", B.ctrl);
      await acl("dl-user", "chat", "chatspark", "Gus may use the app (CAN USE)");
      look(B.ctrlComp);
      await fly("acl>apps", "dl-sys", "request", "chatspark");
      lit("apps", 1600); say("The app works as its own service principal, not as Gus", "sys");
      await wait(600);
      if (gusN++ % 2 === 0) {
        say("The app asks for a short-lived token to connect to Lakebase", "sys");
        await fly("apps>rest", "dl-tok", "token?", "key");
        lit("rest", 800);
        await fly("rest>auth", "dl-tok", "token?", "key");
        stamp("auth");
        say("Identity and auth: an OAuth token for the app's service principal ✓", "ok");
        await wait(350);
        await fly("auth>rest>apps", "dl-tok", "token", "key");
        await fly("apps>lakebase", "dl-sys", "vector query", "search");
        stamp("lakebase");
        say("Lakebase: the token is the password; the service principal's Postgres role and its grants allow the query ✓ Postgres decides here, not Unity Catalog", "ok");
        await wait(500);
        await fly("lakebase>apps", "dl-result", "passages", "rows");
      } else {
        say(`The app queries its AI Search index: a REST call, with ${token}`, "sys");
        await call("apps", "aisearch", "vector query", "search", `${token} is valid`);
        lit("aisearch", 1600);
        await ask("aisearch", "SELECT", true, `${app} may <code>SELECT</code> from the index ✓ audited`);
        await fly("aisearch>apps", "dl-result", "passages", "rows");
      }
      await S.model("apps", "The app", app, token);
      await S.spans("apps", "the app's", app, 2, token);
      look(B.ctrlComp);
      await flyTo(B.user(3), 1600, "apps>web>user3", "dl-result", "answer", "chatspark");
      act("Gus"); say("Gus reads the answer, with its sources", "ok");
    },
    async records() {
      look(B.sys);
      say("Databricks delivers the day's audit and usage records to the system tables, a little later than drawn here", "sys");
      for (let k = 0; k < 6; k++) { record(k % 3 === 2 ? "gateway" : "uc", k % 3 === 2 ? "gwusage" : "audit"); if (k % 3 === 1) record("wh", "billing"); await wait(420); }
      await wait(1400);
    },
    // A scheduled run: started by the jobs service itself, working as the job's run-as principal.
    async monitoring() {
      const who = "the monitoring service principal";
      look(B.ctrlComp);
      say("The schedule starts the daily monitoring job. No request arrives: the run works as the job's run-as service principal", "sys");
      lit("jobs", 1200);
      await fly("jobs>jc", "dl-sys", "scheduled run", "play");
      lit("jc", 1600);
      await ask("jc", "SELECT", true, `${who} may <code>SELECT</code> from <code>system.access.audit</code>, <code>system.billing.usage</code> and <code>system.ai_gateway.usage</code> ✓ audited`);
      look(B.sys);
      say("4 executors read the audit, billing and gateway usage system tables at once", "");
      await burst("jc", [["audit", 0], ["audit", 2], ["billing", 1], ["gwusage", 1]]);
      await ask("jc", "MODIFY", true, `${who} may <code>MODIFY</code> the <code>course_ops</code> monitoring tables ✓ audited`);
      say("4 executors write the teachers' monitoring tables", "");
      await burst("jc", four("monitoring", "write"));
    },
  };

  // ---------- the tour ----------
  const CH = [
    {t: "Local development", c: "Ada signs in from her CLI profile with OAuth (U2M); Databricks Connect then uses that token. Her request arrives at the REST APIs, is authenticated, and opens a session on serverless notebook compute as Ada. Compute asks Unity Catalog before four executors read, and the DataFrame comes back to her editor.",
      f: B.lap, async play() { await S.login(); await wait(600); await S.connect(); }},
    {t: "A pull request: rejected, fixed, merged", c: "Ada commits through pre-commit, pushes her branch and opens a pull request. Actions CI runs pre-commit and pytest, and the check turns red. She pushes a fix, CI turns green, Bo approves, and the merge lands on <code>main</code>. The merge waits for review and CI because a ruleset on <code>main</code> requires them.",
      f: B.gh, async play() {
        await S.branch(0); await wait(500); await S.commits(0); await wait(300); await S.pr(0, 42);
        await S.ci(42, true); await wait(1200); await S.commits(0, 1); await S.ci(42, false); await wait(600); await S.review(0, 42, false); await S.merge(0, 42);
      }},
    {t: "CD signs in with OIDC", c: "The merge starts CD. The acc job asks GitHub's issuer for a short-lived OIDC token and takes it to the workspace's <code>/oidc/v1/token</code>. Identity and auth reads the federation policy of <code>sp-deploy-arxiv-acc</code>, finds issuer, subject and audience matching, and hands back a token of that principal. The environment holds only the principal's client id: no secret.",
      f: B.gh, setup() { graph.merged(); }, async play() { await S.oidc("acc"); }},
    {t: "Deploy to acc, then prd after an approval", c: "With that token CD runs the bundle deploy. The request is authenticated and the workspace's ACLs authorize it: the job and the app are updated, and nothing runs. Then CD starts the job with <code>bundle run</code>: Unity Catalog authorizes the write, and four executors write at once. Then prd: an approval in its GitHub environment, OIDC as <code>sp-deploy-arxiv-prd</code>, and the same deploy.",
      f: B.ghDoor, setup() { graph.merged(); },
      async play() { await S.deploy("acc"); await wait(600); await S.bundleRun("acc"); await wait(800); await S.approvePrd(); await S.oidc("prd", true); await S.deploy("prd"); }},
    {t: "A notebook, and its traces", c: "Dana runs a Python cell. Her request is authenticated, the notebook's ACL lets her run it, and serverless notebook compute works as Dana. Unity Catalog lets her read, and the executors read in parallel. MLflow then sends the trace spans to Zerobus: one more request, authenticated with Dana's token, and written to the trace tables once Unity Catalog has confirmed <code>MODIFY</code>.",
      f: B.user(0), async play() { await S.dana(false); await S.danaBack(); }},
    {t: "Genie: a question in plain language", c: "Eli asks in plain language. He is authenticated, the Genie space's ACL lets him in, and Genie writes the SQL. It runs on a SQL warehouse, where Unity Catalog checks the tables as Eli, and the answer comes back with the SQL that produced it.",
      f: B.user(1), async play() { await S.eli(false); }},
    {t: "Unity Catalog allows, and refuses", c: "Every request for data or a model meets Unity Catalog; workspace objects are guarded by their ACLs. Fay's dashboard is published with individual data permissions, so its tiles query as Fay. <code>eval_results</code>: allowed. A tile on <code>llmops_prd.jane_doe</code>, where she holds no privilege: refused, and nothing is read. Both decisions go to <code>system.access.audit</code>.",
      f: B.user(2), async play() { await S.dash(2, "own"); await wait(900); await S.dash(2, "deny"); }},
    {t: "SQL: the warehouse reads storage in parallel", c: "Fay runs her own query in the SQL editor: authenticated, then CAN USE on the warehouse, then Unity Catalog on the table, as Fay. The warehouse plans the query and splits it into tasks, one per executor. Each executor reads a different file straight from storage at the same time: four files in about the time of one.",
      f: B.user(2), async play() { await S.sql(); }},
    {t: "The agent app, through the gateway", c: "Gus signs in and opens the agent app. From there the app works as its own service principal, and each call it makes is authenticated with that principal's token. It queries its vector store (Lakebase is guarded by a Postgres role, AI Search by Unity Catalog; replay to see the other), then calls <code>course_ops.gateway.chat</code>. Unity Catalog checks <code>EXECUTE</code>, the gateway applies its limits and records the usage, a foundation model answers, and the spans go to the trace tables.",
      f: B.user(3), async play() { await S.gus(); }},
    {t: "Audit and monitoring", c: "Databricks fills the system tables: audit events in <code>system.access.audit</code>, usage in <code>system.billing.usage</code> and <code>system.ai_gateway.usage</code>. The scheduled monitoring job, run as its service principal, reads them into the course's monitoring tables, and Tess opens the course dashboard, whose queries run as its publisher.",
      f: B.sys, async play() { await S.records(); await S.monitoring(); await wait(700); await S.dash(4, "shared"); }},
  ];
  const WHOLE = {t: "The whole day", c: "Everything at once, as on a normal day: developers ship, people work, schedules run. Every request is authenticated at identity and auth; every request for data or a model meets Unity Catalog, and workspace objects are guarded by their ACLs. Pause, change the speed, drag and zoom, or click any part to read what it does.", f: ALL};

  // the whole day: the same stories, looping
  const on = {devs: true, users: true, sched: true}, gates = {devs: [], users: [], sched: []};
  const gate = async (k) => { while (!on[k]) await new Promise((r) => gates[k].push(r)); };
  async function devLoop() {
    let pr = 42, merges = 0;
    for (let cycle = 0; ; cycle++) {
      for (let i = 0; i < DEVS.length; i++) {
        await gate("devs");
        if (i === 0) { if (cycle % 2 === 0) await S.login(); await S.connect(); await wait(1500); }
        pr += 1;
        await S.branch(i); await wait(600); await S.commits(i); await wait(400); await S.pr(i, pr);
        const fail = i === 1 && cycle % 2 === 0, changes = i === 2 && cycle % 2 === 1;
        await S.ci(pr, fail);
        if (fail) { await wait(1200); await S.commits(i, 1); await S.ci(pr, false); }
        await wait(500);
        await S.review(i, pr, changes);
        if (changes) { await S.commits(i, 1); await S.ci(pr, false); await wait(400); await S.review(i, pr, false); }
        await S.merge(i, pr);
        merges += 1;
        await S.oidc("acc", true); await S.deploy("acc"); await wait(600); await S.bundleRun("acc");
        if (merges % 3 === 0) { await wait(1200); await S.approvePrd(); await S.oidc("prd", true); await S.deploy("prd"); }
        await wait(2500);
      }
    }
  }
  async function userLoop(i, first) {
    await wait(first);
    for (let n = 0; ; n++) {
      await gate("users");
      if (i === 0) { await S.dana(n % 2 === 1); await S.danaBack(); }
      if (i === 1) await S.eli(n % 4 === 2);
      if (i === 2) { if (n % 3 === 2) await S.sql(); else await S.dash(2, n % 3 === 1 ? "deny" : "own"); }
      if (i === 3) await S.gus();
      if (i === 4) await S.dash(4, "shared");
      await wait(9000 + i * 3500);
    }
  }
  // the schedule has its own switch: it belongs to neither the developers nor the users
  async function scheduleLoop() {
    await wait(30000);
    for (;;) { await gate("sched"); await S.monitoring(); await wait(70000); }
  }

  // ---------- reset between steps: drop every pending wait and flight ----------
  function reset() {
    epoch += 1;
    timers = []; flights.clear(); Lp.replaceChildren();
    for (const e of EDGES) { e.n = 0; e.hot.setAttribute("class", "dl-hot"); }
    for (const e of Object.values(ENG)) e.cores.forEach((c) => { c.n = 0; c.el.classList.remove("on"); });
    svg.querySelectorAll(".on,.deny,.shake,.show,.w,.go,.act").forEach((n) => n.classList.remove("on", "deny", "shake", "show", "w", "go", "act"));
    holds = new WeakMap();
    gates.devs = []; gates.users = []; gates.sched = [];
    graph.clear();
    log.replaceChildren();
  }

  // ---------- the camera ----------
  const left = day.querySelector(".day-left"), mini = $("dayMini");
  let vb = {...ALL}, target = ALL, free = false, camRaf = 0;
  const size = () => [svg.clientWidth || 1000, svg.clientHeight || 620];
  const nav = day.querySelector(".day-nav");
  // the room the notes take, [top, bottom] in screen pixels: the drawing is framed between them
  const insets = () => {
    if (innerWidth <= 760) return [nav.offsetHeight + 16, left.offsetHeight + 16];
    return [12, Math.max(left.offsetHeight, nav.offsetHeight) + 24];
  };
  const fit = (T) => {
    const [cw, ch] = size(), [it, ib] = insets();
    const aw = Math.max(200, cw - 24), ah = Math.max(160, ch - it - ib);
    const s = Math.min(aw / T.w, ah / T.h);
    return {x: T.x - (cw / s - T.w) / 2, y: T.y - it / s - (ah / s - T.h) / 2, w: cw / s, h: ch / s};
  };
  const miniView = el("rect", {class: "mini-v"}, mini);
  const setVb = (v) => {
    vb = v;
    svg.setAttribute("viewBox", `${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.w.toFixed(1)} ${v.h.toFixed(1)}`);
    Object.entries({x: v.x, y: v.y, width: v.w, height: v.h}).forEach(([k, n]) => miniView.setAttribute(k, n.toFixed(0)));
  };
  function camera(T, instant) {
    target = T;
    const to = fit(T);
    cancelAnimationFrame(camRaf); camRaf = 0;
    if (instant || reduced) return setVb(to);
    const from = {...vb}, t0 = performance.now();
    const go = (t) => {
      const q = Math.min(1, (t - t0) / 650), e = q < 0.5 ? 4 * q ** 3 : 1 - (-2 * q + 2) ** 3 / 2;
      setVb({x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, w: from.w + (to.w - from.w) * e, h: from.h + (to.h - from.h) * e});
      camRaf = q < 1 ? requestAnimationFrame(go) : 0;
    };
    camRaf = requestAnimationFrame(go);
  }
  const setFree = (v) => { free = v; $("dayResume").hidden = !(v && chap < CH.length); };
  const clampVb = (v) => {
    const w = Math.min(Math.max(v.w, 320), W * 1.6), h = w * v.h / v.w;
    return {x: Math.min(Math.max(v.x, -w * 0.7), W - w * 0.3), y: Math.min(Math.max(v.y, -h * 0.7), H - h * 0.3), w, h};
  };
  const zoomAt = (sx, sy, k) => {
    cancelAnimationFrame(camRaf); camRaf = 0;
    const [cw, ch] = size(), px = vb.x + sx / cw * vb.w, py = vb.y + sy / ch * vb.h;
    const w = Math.min(Math.max(vb.w / k, 320), W * 1.6), h = w * ch / cw;
    setVb(clampVb({x: px - sx / cw * w, y: py - sy / ch * h, w, h}));
    setFree(true);
  };
  new ResizeObserver(() => {
    if (free) { const [cw, ch] = size(); setVb({...vb, h: vb.w * ch / cw}); } else camera(target, true);
  }).observe(stage);

  // minimap: the perimeters and zones, and the current view outlined
  [[20, 30, 545, 1440, "o"], [2205, 30, 475, 1440, "o"], [DBX.x, DBX.y, DBX.w, DBX.h, "d"],
    [40, 50, 500, 660, "w"], [2225, 50, 450, 1400, "u"], [40, 760, 500, 690, "p"], [ZX, 135, ZW, 165, "b"],
    [ZX, 335, ZW, 435, "b"], [ZX, 800, ZW, 395, "b"], [ZX, 1225, ZW, 215, "s"], [CA.x, CA.y, CA.w, CA.h, "g"], [RES.x, RES.y, RES.w, RES.h, "g"]]
    .forEach(([x, y, w, h, c]) => mini.insertBefore(el("rect", {x, y, width: w, height: h, rx: 30, class: `mini-z ${c}`}, mini), miniView));
  const miniMove = (ev) => {
    const r = mini.getBoundingClientRect();
    const px = (ev.clientX - r.left) / r.width * W, py = (ev.clientY - r.top) / r.height * H;
    cancelAnimationFrame(camRaf); camRaf = 0;
    setVb(clampVb({...vb, x: px - vb.w / 2, y: py - vb.h / 2})); setFree(true);
  };
  mini.addEventListener("pointerdown", (ev) => { mini.setPointerCapture(ev.pointerId); miniMove(ev); });
  mini.addEventListener("pointermove", (ev) => { if (mini.hasPointerCapture(ev.pointerId)) miniMove(ev); });

  // drag to pan, pinch to zoom, click a part to zoom to it and read about it
  let armed = false;
  const ptrs = new Map();
  let drag = null;
  svg.addEventListener("pointerdown", (ev) => {
    armed = true;
    ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (ptrs.size === 1) drag = {x: ev.clientX, y: ev.clientY, vb: {...vb}, moved: false, part: ev.target.closest("[data-zone]")};
    else drag = {pinch: true};
  });
  svg.addEventListener("pointermove", (ev) => {
    if (!ptrs.has(ev.pointerId) || !drag) return;
    const prev = ptrs.get(ev.pointerId);
    ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]);
    const r = svg.getBoundingClientRect();
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const other = a === ptrs.get(ev.pointerId) ? b : a;
      const d0 = Math.hypot(prev[0] - other[0], prev[1] - other[1]), d1 = Math.hypot(ev.clientX - other[0], ev.clientY - other[1]);
      if (d0 > 0) zoomAt((ev.clientX + other[0]) / 2 - r.left, (ev.clientY + other[1]) / 2 - r.top, d1 / d0);
      return;
    }
    if (drag.pinch) return;
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    if (!drag.moved) { drag.moved = true; $("dayHint").classList.add("gone"); svg.setPointerCapture(ev.pointerId); svg.classList.add("drag"); cancelAnimationFrame(camRaf); camRaf = 0; setFree(true); }
    const [cw] = size(), k = vb.w / cw;
    setVb(clampVb({...vb, x: drag.vb.x - dx * k, y: drag.vb.y - dy * k}));
  });
  const up = (ev) => {
    ptrs.delete(ev.pointerId);
    svg.classList.remove("drag");
    if (drag && !drag.moved && !drag.pinch && ptrs.size === 0) pick(drag.part, true);
    if (ptrs.size === 0) drag = null;
  };
  svg.addEventListener("pointerup", up);
  svg.addEventListener("pointercancel", (ev) => { ptrs.delete(ev.pointerId); drag = null; svg.classList.remove("drag"); });
  svg.addEventListener("wheel", (ev) => {
    if (!(armed || presenting || ev.ctrlKey)) return;
    ev.preventDefault();
    const r = svg.getBoundingClientRect();
    zoomAt(ev.clientX - r.left, ev.clientY - r.top, Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015)));
  }, {passive: false});
  $("dayZoomIn").onclick = () => { const [cw, ch] = size(); zoomAt(cw / 2, ch / 2, 1.4); };
  $("dayZoomOut").onclick = () => { const [cw, ch] = size(); zoomAt(cw / 2, ch / 2, 1 / 1.4); };
  $("dayFit").onclick = () => { setFree(true); camera(ALL); };

  function pick(z, zoom) {
    svg.querySelectorAll(".sel").forEach((n) => n.classList.remove("sel"));
    if (!z) { info.hidden = true; return; }
    z.classList.add("sel");
    const [title, body, simp] = Z[z.dataset.zone];
    info.innerHTML = `<button class="x" aria-label="Close">×</button><h3>${title}</h3><p>${body}</p>${simp ? `<p class="simp">Simplified: ${simp}</p>` : ""}`;
    info.hidden = false;
    info.querySelector(".x").onclick = () => pick(null);
    if (zoom) {
      const b = z.getBBox(), pad = 80, w = Math.max(b.width + 2 * pad, 560), h = Math.max(b.height + 2 * pad, 360);
      setFree(true);
      camera({x: b.x + b.width / 2 - w / 2, y: b.y + b.height / 2 - h / 2, w, h});
    }
  }

  // ---------- chapters ----------
  let chap = 0;
  const next = $("dayNext"), back = $("dayBack");
  function ui() {
    const whole = chap === CH.length, c = whole ? WHOLE : CH[chap];
    day.classList.toggle("whole", whole);
    $("dayNum").textContent = whole ? "after the tour" : `${chap + 1} / ${CH.length}`;
    $("dayCapTitle").textContent = c.t;
    $("dayCapText").innerHTML = c.c;
    back.disabled = chap === 0; next.disabled = whole;
    $("dayWhole").classList.toggle("on", whole);
    $("dayJump").value = String(chap);
    next.classList.remove("ready");
  }
  function run() {
    const my = epoch;
    if (chap === CH.length) {
      devLoop(); scheduleLoop();
      USERS.forEach((_, i) => userLoop(i, 1500 + i * 4200));
      return;
    }
    const c = CH[chap];
    if (c.setup) c.setup();
    wait(750).then(() => c.play()).then(() => { if (my === epoch) { next.classList.add("ready"); say("<i>End of the chapter: press Next</i>", "sys"); } });
  }
  function go(k) {
    chap = Math.max(0, Math.min(CH.length, k));
    reset(); ui(); setFree(false); pick(null);
    lastLook = chap === CH.length ? ALL : CH[chap].f;
    camera(lastLook);
    if (started) run();
  }
  next.onclick = () => go(chap + 1);
  back.onclick = () => go(chap - 1);
  $("dayReplay").onclick = () => go(chap);
  $("dayWhole").onclick = () => go(CH.length);
  $("dayJump").onchange = (ev) => { go(+ev.target.value); ev.target.blur(); };
  $("dayResume").onclick = () => { setFree(false); camera(lastLook); };

  // ---------- controls ----------
  const play = $("dayPlay");
  const setPlaying = (v) => {
    playing = v;
    play.innerHTML = playing ? '<span aria-hidden="true">❚❚</span> Pause' : '<span aria-hidden="true">▶</span> Play';
    play.classList.toggle("paused", !playing);
    day.classList.toggle("day-paused", !playing);
    kick();
  };
  play.onclick = () => setPlaying(!playing);
  const speedIn = $("daySpeed"), speedOut = $("daySpeedOut");
  const setSpeed = (v) => {
    speed = Math.max(0.25, Math.min(3, Math.round(v * 4) / 4));
    speedIn.value = String(speed);
    speedOut.textContent = `${speed}×`;
  };
  speedIn.oninput = (ev) => setSpeed(+ev.target.value);
  speedIn.onchange = () => speedIn.blur(); // so Space and the arrows reach the scene again
  const toggle = (id, k) => ($(id).onchange = (ev) => {
    on[k] = ev.target.checked;
    if (on[k]) gates[k].splice(0).forEach((r) => r());
  });
  toggle("dayDevs", "devs");
  toggle("dayUsers", "users");
  toggle("daySched", "sched");
  svg.addEventListener("keydown", (ev) => {
    const z = ev.target.closest && ev.target.closest("[data-zone]");
    if (z && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); pick(z, true); }
  });

  // present mode: full screen, or a fixed overlay where the Fullscreen API is refused
  let presenting = false;
  const presentBtn = $("dayPresent");
  const setPresent = (v) => {
    presenting = v;
    day.classList.toggle("day-present", v);
    document.documentElement.classList.toggle("day-lock", v);
    presentBtn.textContent = v ? "Exit" : "Present";
  };
  const present = async () => {
    try {
      if (!day.requestFullscreen) throw new Error("no fullscreen");
      await day.requestFullscreen();
    } catch { setPresent(true); }
  };
  const leave = () => { if (document.fullscreenElement) document.exitFullscreen(); else setPresent(false); };
  presentBtn.onclick = () => (presenting ? leave() : present());
  document.addEventListener("fullscreenchange", () => setPresent(document.fullscreenElement === day));
  document.addEventListener("pointerdown", (ev) => { armed = day.contains(ev.target); }, true);
  day.addEventListener("focusin", () => (armed = true));
  document.addEventListener("keydown", (ev) => {
    if (!(armed || presenting) || ev.altKey || ev.metaKey) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(ev.target.tagName)) return;
    const k = ev.key;
    if (k === " ") {
      // a focused button clicks itself on Space, and a focused part of the drawing opens its text
      if (ev.target.tagName === "BUTTON" || (ev.target.closest && ev.target.closest("[data-zone]"))) return;
      setPlaying(!playing);
    }
    else if (k === "[") setSpeed(speed - 0.25);
    else if (k === "]") setSpeed(speed + 0.25);
    else if (k === "ArrowRight" || k === "PageDown") go(chap + 1);
    else if (k === "ArrowLeft" || k === "PageUp") go(chap - 1);
    else if (k === "f" || k === "F") presenting ? leave() : present();
    else if (k === "Escape" && presenting && !document.fullscreenElement) setPresent(false);
    else if (k === "+" || k === "=") $("dayZoomIn").click();
    else if (k === "-") $("dayZoomOut").click();
    else if (k === "0") $("dayFit").click();
    else return;
    ev.preventDefault();
  });

  // start only when the scene is on screen, and stop the clock whenever it is not
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !started) { started = true; run(); setTimeout(() => $("dayHint").classList.add("gone"), 12000); }
    kick();
  }, {threshold: 0.15}).observe(svg);
  go(0);
  kick();
})();
