// ----- Part 2, the mock's content: the two sidebars and one plausible page per item -----
// The pages use the course's own names (the bundle's jobs, dashboards and alerts, the cohort's
// catalogs, the naming rule's examples). They illustrate; nothing here is read from a workspace.
const NAV = {
  workspace: [
    ["", [["New", "plus"], ["Workspace", "folder"], ["Recents", "clock"], ["Catalog", "book"], ["Jobs & Pipelines", "flow"], ["Compute", "cloud"], ["Discover", "compass"], ["Marketplace", "store"]]],
    ["Analytics", [["Dashboards", "chart"], ["Genie Agents", "spark"], ["Alerts", "bell"], ["Visual Data Prep", "wand"]]],
    ["Lakehouse", [["SQL Editor", "sql"], ["Queries", "file"], ["Query History", "history"], ["SQL Warehouses", "drum"]]],
    ["Data Engineering", [["Runs", "runs"], ["Data Ingestion", "ingest"]]],
    ["AI/ML", [["Playground", "chat"], ["Agents", "robot"], ["AI Gateway", "gate"], ["Experiments", "flask"], ["Features", "grid"], ["Models", "cube"], ["Serving", "serve"]]],
  ],
  account: [
    ["Governance", [["Data", "drum"], ["AI", "spark"], ["Cost", "coin"], ["Tags", "tag"]]],
    ["Admin", [["Workspaces", "grid"], ["Catalog", "book"], ["Genie Ontology", "nodes"], ["Usage", "chart"], ["User management", "users"], ["Security", "shield"], ["Cloud resources", "cloud"], ["Previews", "flask"], ["Settings", "gear"]]],
  ],
};
// the workspace's Settings (behind the avatar): the research file's seven "Settings: …" items
const WS_SETTINGS = ["Users and groups", "Entitlements", "Secrets", "Usage policies", "Git credentials", "Workspace settings", "Tokens"];
// a sidebar label -> its item in the research file, where the two differ
const ITEM_KEY = {"account/Data": "Data (metastores)", "account/Cost": "Cost (budgets, usage)"};
const METASTORE = "metastore_aws_us_west_2";

const mk = {
  st: (kind, text) => `<span class="st st-${kind}"><i></i>${text}</span>`,
  nm: (s) => `<span class="nm">${s}</span>`,
  mono: (s) => `<span class="mono">${s}</span>`,
  tbl: (cols, rows) => `<table class="m-t"><thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
  tabs: (list, on = 0) => `<div class="m-tabs">${list.map((t, i) => `<span class="${i === on ? "on" : ""}">${t}</span>`).join("")}</div>`,
  empty: (glyph, title, text) => `<div class="m-empty">${gl(glyph)}<b>${title}</b><p>${text}</p></div>`,
  cards: (list) => `<div class="m-cards">${list.map(([g, t, d]) => `<div class="m-card">${gl(g)}<b>${t}</b><span>${d}</span></div>`).join("")}</div>`,
  tree: (rows) => `<ul class="m-tree">${rows.map(([depth, glyph, name, hint, open]) => `<li style="--d:${depth}"><i class="tw">${open === undefined ? "" : open ? "▾" : "▸"}</i>${gl(glyph)}<span class="${depth < 2 ? "nm" : ""}">${name}</span>${hint ? `<em>${hint}</em>` : ""}</li>`).join("")}</ul>`,
  kv: (rows) => `<dl class="m-kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`,
  toggles: (rows) => `<ul class="m-tog">${rows.map(([label, on]) => `<li><span>${label}</span><i class="tg ${on ? "on" : ""}"></i></li>`).join("")}</ul>`,
};

// key: "<console>/<sidebar label>" (and "workspace/Settings: <name>"); each: {title, btn, body}
const PAGES = {
  // ----- workspace -----
  "workspace/New": {title: "New", body: `<ul class="m-menu">${[["file", "Notebook"], ["sql", "Query"], ["chart", "Dashboard"], ["spark", "Genie Agent"], ["flow", "Job"], ["flow", "Pipeline"], ["bell", "Alert"], ["flask", "Experiment"], ["drum", "SQL warehouse"], ["serve", "Serving endpoint"]].map(([g, t]) => `<li>${gl(g)}${t}</li>`).join("")}</ul>`},
  "workspace/Workspace": {title: "Workspace", btn: "Create", body: mk.tree([
    [0, "folder", "Workspace", "", true], [1, "folder", "llmops", "every student's experiments"], [1, "folder", "Shared", ""], [1, "folder", "Users", "", true],
    [2, "folder", "jane.doe@example.com", "home"], [0, "folder", "Repos", ""],
  ])},
  "workspace/Recents": {title: "Recents", body: mk.tbl(["Name", "Type"], [
    [mk.nm("job-guard-llmops"), "Job"], [mk.nm("dash-cohort-llmops"), "Dashboard"], [mk.nm("genie-cohort-llmops"), "Genie Agent"],
    [mk.nm("llmops_dev.jane_doe"), "Schema"], [mk.nm("wh-llmops-jane-doe"), "SQL warehouse"],
  ])},
  "workspace/Catalog": {title: "Catalog", btn: "Create", body: mk.tree([
    [0, "book", "llmops_dev", "", true], [1, "grid", "jane_doe", "schema", true], [2, "folder", "arxiv_files", "volume"], [1, "grid", "john_smith", "schema", false],
    [0, "book", "llmops_acc", "", false], [0, "book", "llmops_prd", "", false],
    [0, "book", "course_ops", "", true], [1, "grid", "registry", "students, identities", false], [1, "grid", "audit", "onboarding_runs, onboarding_steps", false],
    [1, "grid", "monitoring", "", false], [1, "grid", "gateway", "chat, embed", false], [0, "book", "system", "", false],
  ])},
  "workspace/Jobs & Pipelines": {title: "Jobs & Pipelines", btn: "Create", body: mk.tbl(["Name", "Run as", "Trigger"], [
    [mk.nm("job-monitoring-llmops"), "sp-monitoring-llmops", "Daily"],
    [mk.nm("job-guard-llmops"), "sp-onboarding-llmops", "Table update"],
    [mk.nm("job-apps-stop-llmops"), "sp-onboarding-llmops", "Hourly"],
  ])},
  "workspace/Compute": {title: "Compute", body: mk.tabs(["All-purpose", "Job compute", "Policies"]) + mk.empty("cloud", "Serverless only", "This workspace has no clusters to create. Serverless compute starts when a notebook, a job or a query asks for it.")},
  "workspace/Discover": {title: "Discover", body: mk.cards([["compass", "Domains", "none yet · a domain groups assets"], ["book", "course_ops", "popular · the cohort tables"], ["chart", "dash-student-llmops", "popular · dashboard"]])},
  "workspace/Marketplace": {title: "Marketplace", body: mk.cards([["table", "Data products", "listings to install as catalogs"], ["cube", "Models", "listings to install as models"], ["doc", "Solution accelerators", "notebooks and examples"]])},
  "workspace/Dashboards": {title: "Dashboards", btn: "Create dashboard", body: mk.tbl(["Name", "Owner"], [
    [mk.nm("dash-cohort-llmops"), "sp-monitoring-llmops"], [mk.nm("dash-student-llmops"), "sp-monitoring-llmops"],
  ])},
  "workspace/Genie Agents": {title: "Genie Agents", btn: "New", body: mk.tbl(["Name", "Owner"], [[mk.nm("genie-cohort-llmops"), "sp-monitoring-llmops"]])},
  "workspace/Alerts": {title: "Alerts", btn: "Create alert", body: mk.tbl(["Name", "Status"], [
    [mk.nm("alert-daily-cost-llmops"), mk.st("ok", "OK")], [mk.nm("alert-weekly-cost-llmops"), mk.st("ok", "OK")], [mk.nm("alert-inactivity-llmops"), mk.st("ok", "OK")],
    [mk.nm("alert-onboarding-llmops"), mk.st("ok", "OK")], [mk.nm("alert-guard-llmops"), mk.st("ok", "OK")], [mk.nm("alert-apps-running-llmops"), mk.st("ok", "OK")],
  ])},
  "workspace/Visual Data Prep": {title: "Visual Data Prep", body: `<div class="m-flow"><span>${gl("table")}Source</span><i>→</i><span>${gl("wand")}Transform</span><i>→</i><span>${gl("table")}Output</span></div>` + mk.empty("wand", "Prepare data without code", "Pick a table, add steps, write the result.")},
  "workspace/SQL Editor": {title: "SQL Editor", body: `<div class="m-ed"><div class="m-ed-bar"><span class="m-btn">Run ▸</span><span class="m-pill">${gl("drum")}wh-llmops-jane-doe</span></div>
<pre class="m-code"><b>SELECT</b> *\n<b>FROM</b> course_ops.audit.onboarding_runs\n<b>LIMIT</b> 3</pre></div>` + mk.tbl(["#", "state"], [["1", "succeeded"], ["2", "succeeded"], ["3", "succeeded"]])},
  "workspace/Queries": {title: "Queries", btn: "Create query", body: mk.tbl(["Name", "Warehouse"], [
    [mk.nm("My query"), "wh-llmops-jane-doe"],
  ])},
  "workspace/Query History": {title: "Query History", body: mk.tbl(["Statement", "Status"], [
    [mk.mono("SELECT * FROM course_ops.audit…"), mk.st("ok", "Finished")], [mk.mono("MERGE INTO course_ops.registry…"), mk.st("ok", "Finished")], [mk.mono("SELECT 42"), mk.st("ok", "Finished")],
  ])},
  "workspace/SQL Warehouses": {title: "SQL Warehouses", btn: "Create", body: mk.tbl(["Name", "Type", "State"], [
    [mk.nm("wh-llmops-jane-doe"), "Serverless", mk.st("off", "Stopped")], [mk.nm("wh-ops-llmops"), "Serverless", mk.st("ok", "Running")], [mk.nm("wh-tests-llmops"), "Serverless", mk.st("off", "Stopped")],
  ])},
  "workspace/Runs": {title: "Runs", body: mk.tbl(["Job", "Run as", "Result"], [
    [mk.nm("job-monitoring-llmops"), "sp-monitoring-llmops", mk.st("ok", "Succeeded")], [mk.nm("job-guard-llmops"), "sp-onboarding-llmops", mk.st("ok", "Succeeded")],
    [mk.nm("job-apps-stop-llmops"), "sp-onboarding-llmops", mk.st("ok", "Succeeded")],
  ])},
  "workspace/Data Ingestion": {title: "Data Ingestion", body: mk.cards([["ingest", "Upload files", "to a table or a volume"], ["gate", "Connectors", "managed, from apps and databases"], ["key", "Connections", "a source, kept in Unity Catalog"]])},
  "workspace/Playground": {title: "Playground", body: `<div class="m-chat"><span class="m-pill">${gl("gate")}course_ops.gateway.chat</span><p class="u">What does a federation policy check?</p><p class="b">The issuer, the subject and the audience of the token.</p><div class="m-ask">Type a message…</div></div>`},
  "workspace/Agents": {title: "Agents", body: mk.cards([["doc", "Knowledge Assistant", "answers from your documents"], ["robot", "Supervisor Agent", "routes work between agents"]]) + mk.empty("robot", "No agents yet", "An agent you build appears here.")},
  "workspace/AI Gateway": {title: "AI Gateway", btn: "Create", body: mk.tbl(["Service", "Type"], [
    [mk.nm("course_ops.gateway.chat"), "Model service"], [mk.nm("course_ops.gateway.embed"), "Model service"],
  ])},
  "workspace/Experiments": {title: "Experiments", btn: "Create", body: mk.tbl(["Name", "Traces in"], [
    [mk.nm("/llmops/jane-doe-dev"), "Unity Catalog"], [mk.nm("/llmops/jane-doe-acc"), "Unity Catalog"], [mk.nm("/llmops/jane-doe-prd"), "Unity Catalog"],
  ])},
  "workspace/Features": {title: "Features", body: mk.tabs(["Features", "Online stores"]) + mk.empty("grid", "No features yet", "Features in Unity Catalog and online stores appear here.")},
  "workspace/Models": {title: "Models", body: mk.empty("cube", "Registered models live in Unity Catalog", `A model you register appears in your schema, such as ${mk.mono("llmops_dev.jane_doe")}.`)},
  "workspace/Serving": {title: "Serving", btn: "Create", body: mk.tbl(["Name", "Type", "State"], [[mk.nm("databricks-gte-large-en"), "Foundation model", mk.st("ok", "Ready")]])},
  // ----- workspace settings -----
  "workspace/Settings: Users and groups": {body: mk.tbl(["Name", "Type"], [
    [mk.nm("grp-students-llmops"), "Group"], [mk.nm("jane.doe@example.com"), "User"], [mk.nm("sp-onboarding-llmops"), "Service principal"],
    [mk.nm("sp-monitoring-llmops"), "Service principal"], [mk.nm("sp-deploy-jane-doe-dev"), "Service principal"],
  ])},
  "workspace/Settings: Entitlements": {body: `<p class="m-sub">jane.doe@example.com</p>` + mk.toggles([["Workspace access", true], ["Databricks SQL access", true], ["Allow cluster creation", false]])},
  "workspace/Settings: Secrets": {body: mk.empty("lock", "Secret scopes", "A scope holds the values; the page never shows them.")},
  "workspace/Settings: Usage policies": {body: mk.tbl(["Policy", "Tags"], [[mk.nm("pol-llmops-jane-doe"), "student, cohort"], [mk.nm("pol-llmops-john-smith"), "student, cohort"]])},
  "workspace/Settings: Git credentials": {body: mk.tbl(["Provider", "User"], [["GitHub", "jane-doe"]])},
  "workspace/Settings: Workspace settings": {body: mk.toggles([["IP access lists", false], ["Web terminal", true], ["Notebook exports", true]])},
  "workspace/Settings: Tokens": {body: mk.empty("key", "No personal access tokens", "A token you create appears here, once.")},
  // ----- account console -----
  "account/Data": {title: "Data", body: mk.tabs(["Metastores"]) + mk.tbl(["Name", "Region"], [[mk.nm(METASTORE), "us-west-2"]])},
  "account/AI": {title: "AI", body: mk.empty("spark", "AI governance for the account", "Settings that apply to every workspace of the account.")},
  "account/Cost": {title: "Cost", btn: "Create", body: mk.tabs(["Budgets", "Usage policies"]) + mk.tbl(["Name", "Kind"], [[mk.nm("budget-gateway-llmops"), "Budget"], [mk.nm("pol-llmops-jane-doe"), "Usage policy"]])},
  "account/Tags": {title: "Tags", btn: "Create", body: mk.empty("tag", "No governed tags yet", "A governed tag fixes a key and its allowed values for the whole account.")},
  "account/Workspaces": {title: "Workspaces", btn: "Create workspace", body: `<div class="m-ws">
  <div class="band b4"><label>Name</label><label>Status</label><label>Pricing tier</label><label>Region</label>
    <span class="nm">workspace</span>${mk.st("ok", "Running")}<span>Premium</span><span>us-west-2</span></div>
  <div class="band b2"><label>Storage</label><label>Created</label>
    <span>Default storage <em class="m-chip">Serverless only</em></span><span>11/02/2026</span></div>
  <div class="band b2"><label>Metastore</label><label></label>
    <span class="nm">${METASTORE}</span><span><button class="m-btn" data-open-ws>Open ↗</button></span></div>
</div>`},
  "account/Catalog": {title: "Catalog", body: mk.tree([[0, "drum", METASTORE, "metastore", true], [1, "book", "llmops_dev", ""], [1, "book", "llmops_acc", ""], [1, "book", "llmops_prd", ""], [1, "book", "course_ops", ""]])},
  "account/Genie Ontology": {title: "Genie Ontology", body: mk.empty("nodes", "A shared context for Genie", "What Genie has learned and what you have modeled, kept for the whole account.")},
  "account/Usage": {title: "Usage", btn: "Download", body: `<div class="m-bars" aria-label="Illustrative bars, no real numbers">${[38, 52, 47, 66, 58, 74, 61, 83, 70, 64, 90, 77].map((v) => `<i style="height:${v}%"></i>`).join("")}</div><p class="m-sub">Usage by day. The bars are an illustration, not the course's numbers.</p>`},
  "account/User management": {title: "User management", btn: "Add", body: mk.tabs(["Users", "Service principals", "Groups"], 1) + mk.tbl(["Name", "Account roles"], [
    [mk.nm("sp-onboarding-llmops"), "Account admin, billing admin"], [mk.nm("sp-monitoring-llmops"), "None"], [mk.nm("sp-evals-llmops"), "None"], [mk.nm("sp-deploy-jane-doe-dev"), "None"],
  ])},
  "account/Security": {title: "Security", body: mk.tabs(["Federation policies", "Single sign-on", "IP access lists"]) + `<p class="m-sub">sp-onboarding-llmops</p>` + mk.kv([
    ["Issuer", mk.mono("https://token.actions.githubusercontent.com")], ["Subject", mk.mono("repo:llmops-databricks-2…/course-assistant…:ref:refs/heads/main")], ["Audiences", "the account id, the workspace token endpoint"],
  ])},
  "account/Cloud resources": {title: "Cloud resources", body: mk.tabs(["Credentials", "Storage", "Network"]) + mk.empty("cloud", "Nothing to configure", "A serverless workspace made by express setup has no cloud account of its own.")},
  "account/Previews": {title: "Previews", body: mk.toggles([[`<i class="sk" style="width:210px"></i>`, true], [`<i class="sk" style="width:260px"></i>`, false], [`<i class="sk" style="width:180px"></i>`, true], [`<i class="sk" style="width:240px"></i>`, false]]) + `<p class="m-sub">Switches for features in preview. The names are left out of this mock.</p>`},
  "account/Settings": {title: "Settings", body: mk.tabs(["Account", "Feature enablement", "Network policies"]) + mk.kv([["Account name", "LLMOps Cauchy Cohort 2"], ["Account ID", "••••••••-••••-••••"], ["Console", "accounts.cloud.databricks.com"]])},
};

// the one line an item gets when it has no code form, or is a view (written from the research file's own words)
const SAY = {
  "workspace/New": "A menu, not an object. Each entry maps to that item's own create call.",
  "workspace/Recents": "A view, not an object: your own recent objects. The closest code form is a list call.",
  "workspace/Compute": "Serverless compute needs no object of its own; a classic cluster does.",
  "workspace/Discover": "The page is a view. Only its domains are objects.",
  "workspace/Marketplace": "No Terraform resource. The SDK lists the listings.",
  "workspace/Visual Data Prep": "UI only: no resource and no API was found for it.",
  "workspace/SQL Editor": "The editor is not an object. What you save is a query; what you run is a statement.",
  "workspace/Query History": "A view, not an object: read-only, through a list call.",
  "workspace/Runs": "A view, not an object. A run is made by running a job, so it has no declarative form.",
  "workspace/Playground": "UI only. The closest code form is to query the endpoint.",
  "workspace/Settings: Usage policies": "Managed at account level: the account provider and AccountClient.",
  "account/AI": "UI only: no account-level API group was found for this page.",
  "account/Tags": "Tag policies are called through a workspace host: WorkspaceClient, not AccountClient.",
  "account/Catalog": "A view across metastores. The closest code form is a list call.",
  "account/Genie Ontology": "UI only: no Terraform resource, SDK service or REST group was found.",
  "account/Usage": "Usage is read, not configured: a download call, and no resource.",
  "account/Previews": "UI only: switches, with no resource of their own.",
};
