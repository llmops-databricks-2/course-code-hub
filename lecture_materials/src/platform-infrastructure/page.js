// Behaviour of PLATFORM-UNDER-THE-WORKSPACE.html: one block per view. Plain DOM, no libraries.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
function tabs(el, items, current, onPick) {
  el.innerHTML = items.map(([k, label]) => `<button data-k="${k}" class="${k === current ? "on" : ""}">${label}</button>`).join("");
  el.onclick = (ev) => { const b = ev.target.closest("button"); if (b) onPick(b.dataset.k); };
}
function uc() { return ($("ucName").value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_") || "jane_doe"); }
function kebab() { return uc().replace(/_/g, "-"); }

/* ---------- top pipeline ---------- */
const VIEWS = [
  ["path", "The path of an action", "browser → control plane → compute → storage"],
  ["layers", "Identities and roles", "account, workspace, Unity Catalog"],
  ["uc", "Unity Catalog", "metastore → catalogs → your schemas"],
  ["oidc", "GitHub and Databricks", "OIDC federation, no secret"],
  ["tools", "Managing resources", "REST, SDK, CLI, bundles, Terraform"],
  ["rebuild", "Everything as code", "the workspace that was banned"],
  ["onboard", "Student onboarding", "one daily, idempotent run"],
];
// the opening scene sits above the pipeline and is not one of its numbered views
$("pipe").innerHTML = VIEWS.map(([id, t, s], i) => `<button data-id="${id}"><span>${i + 1}. ${t}</span><small>${s}</small></button>`).join("");
$("pipe").onclick = (ev) => { const b = ev.target.closest("button"); if (b) $(b.dataset.id).scrollIntoView({behavior: "smooth"}); };

/* ---------- 2. who may do what ---------- */
const WHO = [
  ["you", "You, a student", "workspace user, in grp-students-llmops"],
  ["dev", "sp-deploy-<you>-dev", "your dev deploy principal"],
  ["prd", "sp-deploy-<you>-prd", "your production deploy principal"],
  ["onb", "sp-onboarding-llmops", "the daily onboarding run"],
  ["mon", "sp-monitoring-llmops", "the monitoring bundle's principal"],
];
const WHAT = [
  ["wdev", "Write a table in llmops_dev.<you>"],
  ["wprd", "Write a table in llmops_prd.<you>"],
  ["rprd", "Read a table in llmops_prd.<you>"],
  ["wh", "Create a SQL warehouse"],
  ["pol", "Create a serverless usage policy"],
  ["usr", "Add a user to the account and workspace"],
  ["lb", "Create a Lakebase project"],
  ["gh", "Deploy to prd from GitHub Actions"],
];
const ADMINS_OWN = "member of grp-admins-llmops, which owns every student schema; an owner can do anything on what it owns";
const RULES = {
  wdev: {you: [1, "ALL PRIVILEGES and MANAGE on your dev schema: it is your sandbox."], dev: [1, "ALL PRIVILEGES on your dev schema, granted by the onboarding's principal step."], prd: [0, "Nothing on the dev schema: each environment's principal writes its own schema alone."], onb: [1, ADMINS_OWN + "."], mon: [1, ADMINS_OWN + "."]},
  wprd: {you: [0, "Read only on your acc and prd schemas (USE SCHEMA, SELECT, EXECUTE, READ VOLUME). Production changes go through your deploy."], dev: [0, "Nothing on the prd schema: a dev token can never touch production."], prd: [1, "ALL PRIVILEGES on your prd schema, and nothing else."], onb: [1, ADMINS_OWN + "."], mon: [1, ADMINS_OWN + "."]},
  rprd: {you: [1, "SELECT on your prd schema, so you can check what your deploys wrote; USE CATALOG comes from grp-students-llmops."], dev: [0, "No privilege on the prd schema."], prd: [1, "ALL PRIVILEGES includes SELECT."], onb: [1, ADMINS_OWN + "."], mon: [1, ADMINS_OWN + "."]},
  wh: {you: [0, "Creating a warehouse needs workspace admin or the allow-cluster-create entitlement. Yours was made for you."], dev: [0, "Not a workspace admin, no allow-cluster-create."], prd: [0, "Not a workspace admin, no allow-cluster-create."], onb: [1, "Workspace admin: it creates every student's warehouse."], mon: [0, "A workspace user with grants, not an admin: the setup script made the ops warehouse."]},
  pol: {you: [0, "Usage policies are managed at account level by a billing admin."], dev: [0, "No account role."], prd: [0, "No account role."], onb: [1, "Billing admin. The course found that account admin alone was refused (CreateBudgetPolicyPermission) at its first rehearsal."], mon: [0, "No account role."]},
  usr: {you: [0, "No account or workspace admin role."], dev: [0, "No admin role."], prd: [0, "No admin role."], onb: [1, "Account admin and workspace admin: it creates your user, adds you to grp-students-llmops and sets your entitlements."], mon: [0, "No admin role."]},
  lb: {you: [1, "Every workspace user inherits CAN_CREATE on Lakebase projects. They bill while they run, so a daily guard deletes any that are not registered."], dev: [1, "Inherited CAN_CREATE, like every workspace user; the same guard applies."], prd: [1, "Inherited CAN_CREATE, like every workspace user; the same guard applies."], onb: [1, "Workspace admin."], mon: [1, "Inherited CAN_CREATE."]},
  gh: {you: [0, "You have no credential in GitHub. A deploy runs as a principal, never as you."], dev: [0, "Its federation policy accepts only the subject ending :environment:dev."], prd: [1, "Its federation policy accepts the subject ending :environment:prd of your repository. View 4 shows the exchange."], onb: [0, "Its policy names main of course-assistant, not your repository."], mon: [0, "Its policy names main of course-assistant, not your repository."]},
};
let who = "you", what = "wprd";
function drawWho() {
  const name = (s) => esc(s.replace("<you>", kebab()));
  $("whoList").innerHTML = WHO.map(([k, t, s]) => `<button data-k="${k}" class="${k === who ? "on" : ""}"><span>${name(t)}</span><small>${s}</small></button>`).join("");
  $("whatList").innerHTML = WHAT.map(([k, t]) => `<button data-k="${k}" class="${k === what ? "on" : ""}"><span>${esc(t.replace("<you>", uc()))}</span></button>`).join("");
  const [ok, why] = RULES[what][who];
  $("verdict").innerHTML = `<p class="${ok ? "yes" : "no"}">${ok ? "Allowed" : "Refused"}</p><p>${esc(why)}</p>`;
}
$("whoList").onclick = (ev) => { const b = ev.target.closest("button"); if (b) { who = b.dataset.k; drawWho(); } };
$("whatList").onclick = (ev) => { const b = ev.target.closest("button"); if (b) { what = b.dataset.k; drawWho(); } };

/* ---------- 3. Unity Catalog tree ---------- */
let ucSel = "metastore";
function ucNodes() {
  const n = uc();
  return [
    ["metastore", 0, "metastore (us-west-2)", "One per region; the workspace is attached to exactly one. Owned by <code>grp-owners-llmops</code>, the teachers, so they are its admins and no service principal is.", "Account admin creates it; <code>scripts/setup_cohort.py</code> part <code>metastore</code> hands it to the owners group."],
    ["dev", 1, "llmops_dev", "The dev catalog. Owned by <code>grp-admins-llmops</code>; <code>USE CATALOG</code> to <code>grp-students-llmops</code>.", "Setup part <code>catalogs</code>."],
    ["devs", 2, `llmops_dev.${n}`, "Your sandbox: you hold <code>ALL PRIVILEGES</code> and <code>MANAGE</code>; your dev deploy principal holds <code>ALL PRIVILEGES</code>. Your experiment's trace tables live here.", "Onboarding step <code>catalog</code>, with the <code>arxiv_files</code> volume."],
    ["acc", 1, "llmops_acc", "The acceptance catalog, the same shape.", "Setup part <code>catalogs</code>."],
    ["accs", 2, `llmops_acc.${n}`, "Written by <code>sp-deploy-" + kebab() + "-acc</code> alone; you read it (<code>USE SCHEMA</code>, <code>SELECT</code>, <code>EXECUTE</code>, <code>READ VOLUME</code>).", "Onboarding step <code>catalog</code>; grants by <code>principal_acc</code>."],
    ["prd", 1, "llmops_prd", "The production catalog, the same shape.", "Setup part <code>catalogs</code>."],
    ["prds", 2, `llmops_prd.${n}`, "Written by <code>sp-deploy-" + kebab() + "-prd</code> alone; you read it. Nobody writes to production by hand.", "Onboarding step <code>catalog</code>; grants by <code>principal_prd</code>."],
    ["ops", 1, "course_ops", "The course's own catalog: the registry, audit and monitoring tables, the secrets, the model services. Students reach <code>gateway</code> (<code>EXECUTE</code> on <code>chat</code> and <code>embed</code>) and their own rows through row filters.", "Setup parts <code>catalog</code> and <code>secret</code>; the tables by the daily run; the model services by the bundle."],
  ];
}
function drawUc() {
  const nodes = ucNodes();
  $("ucTree").innerHTML = nodes.map(([k, d, t]) => `<button data-k="${k}" class="uc-l${d} ${k === ucSel ? "on" : ""}"><code>${esc(t)}</code></button>`).join("");
  const [, , t, what, made] = nodes.find((x) => x[0] === ucSel);
  $("ucDetail").innerHTML = `<h3><code>${esc(t)}</code></h3><p>${what}</p><p class="note">Made by: ${made}</p>`;
}
$("ucTree").onclick = (ev) => { const b = ev.target.closest("button"); if (b) { ucSel = b.dataset.k; drawUc(); } };

/* ---------- 4. OIDC ---------- */
const ORG = "llmops-databricks-2@330009903";
function subjectOf() {
  const repo = {own: `${ORG}/llmops-${kebab()}@1400000001`, other: `${ORG}/llmops-someone-else@1400000002`, fork: `your-account@51000001/llmops-${kebab()}@1400000003`}[$("oRepo").value];
  return `repo:${repo}:${$("oCtx").value}`;
}
function drawOidc() {
  const sub = subjectOf();
  const aud = $("oAud").value === "ws" ? "https://dbc-e81ca4d2-f6bd.cloud.databricks.com/oidc/v1/token" : "https://example.org";
  $("oClaims").textContent = JSON.stringify({iss: "https://token.actions.githubusercontent.com", sub, aud, repository: sub.split(":")[1].replace(/@\d+/g, "")}, null, 2);
  const policies = ["dev", "acc", "prd"].map((env) => [`sp-deploy-${kebab()}-${env}`, `repo:${ORG}/llmops-${kebab()}@1400000001:environment:${env}`]);
  let match = null;
  $("oPolicies").innerHTML = policies.map(([sp, s]) => {
    const hit = s === sub && $("oAud").value === "ws";
    if (hit) match = sp;
    return `<button class="${hit ? "on" : ""}" disabled><span>${esc(sp)}</span><small>${esc(s.replace(ORG + "/", "…/"))}</small></button>`;
  }).join("");
  let why;
  if (match) why = `<div class="callout ok">The token's issuer, subject and audience match the policy of <code>${esc(match)}</code>. Databricks returns an OAuth token for it, and the job deploys as that principal.</div>`;
  else if ($("oAud").value !== "ws") why = `<div class="callout warn">No policy accepts that audience: the exchange is refused. The CLI asks for the workspace's token endpoint by itself.</div>`;
  else if ($("oRepo").value === "fork") why = `<div class="callout warn">A fork has another owner and repository id, so its subject matches nothing. This is why the subject carries ids: a fork or a re-created repository of the same name gets no trust.</div>`;
  else if ($("oRepo").value === "other") why = `<div class="callout warn">Another student's repository: its subject matches only their principals' policies, never yours.</div>`;
  else why = `<div class="callout warn">The subject has no environment, or a pull request, and each of your policies names one environment: refused. A deploy runs in an environment.</div>`;
  $("oResult").innerHTML = why;
}
["oRepo", "oCtx", "oAud"].forEach((id) => ($(id).onchange = drawOidc));

/* ---------- 5. five tools ---------- */
const TOOLS = {
  rest: {label: "REST", code: () => `config = Config(profile="course-express")
requests.post(f"{config.host}/api/2.1/unity-catalog/volumes",
    headers=config.authenticate(),
    json={"catalog_name": "llmops_dev", "schema_name": "${uc()}",
          "name": "platform_demo_rest", "volume_type": "MANAGED"})`,
    run: ["200: the volume, as JSON", "Error: the volume already exists. Your code decides what that means.", "DELETE /api/2.1/unity-catalog/volumes/llmops_dev.${s}.platform_demo_rest, by hand"],
    facts: [["You write", "URL, body, paging, retries, errors"], ["State", "none"], ["Docs' advice", "the fallback when no SDK fits"]]},
  sdk: {label: "Python SDK", code: () => `w = WorkspaceClient(profile="course-express")
try:
    w.volumes.read("llmops_dev.${uc()}.platform_demo_sdk")
except NotFound:
    w.volumes.create(catalog_name="llmops_dev", schema_name="${uc()}",
                     name="platform_demo_sdk", volume_type=VolumeType.MANAGED)`,
    run: ["created", "exists: the lookup found it, nothing to do", "w.volumes.delete(...), in your code"],
    facts: [["You write", "the decision: look up, then create"], ["State", "none; the name is the key"], ["Docs' advice", "applications and integrations"]]},
  cli: {label: "CLI", code: () => `databricks volumes create llmops_dev ${uc()} platform_demo_cli MANAGED \\
  --profile course-express`,
    run: ["the volume, as JSON", "Error: the volume already exists", "databricks volumes delete llmops_dev.${s}.platform_demo_cli"],
    facts: [["You write", "one command per call"], ["State", "none"], ["Docs' advice", "shell scripts and auth profiles"]]},
  bundle: {label: "Bundle", code: () => `# databricks.yml, then: databricks bundle deploy
resources:
  volumes:
    platform_demo_bundle:
      catalog_name: llmops_dev
      schema_name: ${uc()}
      name: platform_demo_bundle
      volume_type: MANAGED`,
    run: ["Deployment complete: the volume is created", "Deployment complete: nothing changed", "databricks bundle destroy: removes what the bundle made, and only that"],
    facts: [["You write", "the end state"], ["State", "a state file in the workspace, per target"], ["Docs' advice", "jobs, pipelines and project resources; CI/CD"]]},
  tf: {label: "Terraform", code: () => `resource "databricks_volume" "platform_demo" {
  catalog_name = "llmops_dev"
  schema_name  = "${uc()}"
  name         = "platform_demo_tf"
  volume_type  = "MANAGED"
}`,
    run: ["Plan: 1 to add. Apply complete", "No changes. Your infrastructure matches the configuration.", "terraform destroy: Plan: 1 to destroy"],
    facts: [["You write", "the end state"], ["State", "terraform.tfstate, yours to keep safe"], ["Docs' advice", "cloud-level and account-level resources"]]},
};
let tool = "sdk", toolRuns = [];
function drawTool() {
  tabs($("toolTabs"), Object.entries(TOOLS).map(([k, t]) => [k, t.label]), tool, (k) => { tool = k; toolRuns = []; drawTool(); });
  $("toolCode").textContent = TOOLS[tool].code();
  const body = $("toolLog").querySelector("tbody");
  body.innerHTML = toolRuns.length ? toolRuns.map(([n, t]) => `<tr class="new"><td>${n}</td><td class="wrapc">${esc(t)}</td></tr>`).join("") : `<tr class="empty"><td colspan="2">Nothing run yet.</td></tr>`;
  $("toolFacts").innerHTML = TOOLS[tool].facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("");
}
const say = (i, n) => { toolRuns.push([n, TOOLS[tool].run[i].replace("${s}", uc())]); drawTool(); };
$("toolRun").onclick = () => say(0, "Run");
$("toolAgain").onclick = () => say(1, "Run again");
$("toolRemove").onclick = () => say(2, "Remove");

/* ---------- 6. ban and rebuild ---------- */
const ASSETS = [
  ["Your user, groups and entitlements", "onboarding", "Recreated by the onboarding's user step"],
  ["Your schemas in dev, acc and prd, with grants", "onboarding", "Recreated by the catalog and principal steps"],
  ["Your warehouse and usage policy", "onboarding", "Recreated, with new ids written into your repository"],
  ["Three deploy principals and their federation policies", "onboarding", "Recreated; your repository's DATABRICKS_CLIENT_ID_* variables rewritten"],
  ["Your GitHub repository", "GitHub", "Untouched: it never lived in Databricks"],
  ["Your jobs and app", "your bundle", "Redeployed by your next CD run"],
  ["arxiv_papers and the chunks table", "a job", "Rebuilt by re-running the data job (the papers are on arXiv)"],
  ["A notebook you edited in the workspace and never committed", "by hand", "Lost"],
  ["A volume you created in Catalog Explorer", "by hand", "Lost; you must remember to make it again"],
  ["Your traces and evaluation results", "data", "Lost: history no code can recreate. Backups exist for this."],
];
let banState = "live", moved = new Set();
function drawAssets() {
  const body = $("assets").querySelector("tbody");
  body.innerHTML = ASSETS.map(([o, by, after], i) => {
    const m = moved.has(i);
    const madeBy = m ? "your bundle (moved)" : by;
    let state;
    if (banState === "live") state = by === "by hand" && !m ? `<button data-i="${i}">Move into my bundle</button>` : "live";
    else if (banState === "banned") state = by === "GitHub" ? "untouched" : `<span class="no">gone</span>`;
    else if (m) state = `<span class="yes">Redeployed by your bundle</span>`;
    else state = `<span class="${by === "by hand" || by === "data" ? "no" : "yes"}">${esc(after)}</span>`;
    return `<tr><td class="wrapc">${esc(o)}</td><td>${esc(madeBy)}</td><td class="wrapc">${state}</td></tr>`;
  }).join("");
  $("banBtn").disabled = banState !== "live";
  $("rebuildBtn").disabled = banState !== "banned";
  if (banState === "rebuilt") {
    const lost = ASSETS.filter(([, by], i) => (by === "by hand" && !moved.has(i)) || by === "data").length;
    $("rebuildSummary").innerHTML = `<div class="callout ${lost > 1 ? "warn" : "ok"}">Rebuilt from code: ${ASSETS.length - lost} of ${ASSETS.length}. Lost: ${lost}${lost === 1 ? ", the data, which is what backups are for" : ""}. In the course's real move, the setup script, the cohort tables, the GitHub variables and the onboarding ran in narrowing steps: the teachers' projects, a dry run of the list, one test student, then everyone.</div>`;
  } else $("rebuildSummary").innerHTML = banState === "banned" ? `<div class="callout warn">The API answers <code>Workspace … has been banned</code>. Only what lives outside the workspace is left: your GitHub repository and the code that made the rest.</div>` : "";
}
$("assets").onclick = (ev) => { const b = ev.target.closest("button[data-i]"); if (b) { moved.add(+b.dataset.i); drawAssets(); } };
$("banBtn").onclick = () => { banState = "banned"; drawAssets(); };
$("rebuildBtn").onclick = () => { banState = "rebuilt"; drawAssets(); };
$("banReset").onclick = () => { banState = "live"; moved = new Set(); drawAssets(); };

/* ---------- 7. onboarding ---------- */
const STEPS = ["user", "policy", "catalog", "warehouse", "experiment", "repo", "principal", "membership", "first_deploy"];
const NEEDS = {policy: ["user"], catalog: ["user"], warehouse: ["user"], experiment: ["user"], repo: ["warehouse", "policy"], principal: ["repo"], first_deploy: ["principal"]};
const STUDENTS = ["Ada", "Bo", "Chen"];
let day = 0, grid = {}, when = {};
function runDay() {
  day += 1;
  for (const s of STUDENTS) {
    const row = grid[s] || (grid[s] = {});
    const at = when[s] || (when[s] = {});
    for (const step of STEPS) {
      const prev = row[step];
      if (prev === "created" || prev === "adopted") continue; // done steps are not taken again
      at[step] = day;
      const blocked = (NEEDS[step] || []).some((n) => !["created", "adopted"].includes(row[n]));
      if (blocked) { row[step] = "held"; continue; }
      if (step === "warehouse" && s === "Bo" && day === 1 && $("fQuota").checked) { row[step] = "failed"; continue; }
      if (step === "membership" && s === "Chen" && day < 3 && $("fInvite").checked) { row[step] = "pending"; continue; }
      if (step === "repo" && s === "Ada" && $("fRepo").checked) { row[step] = "adopted"; continue; }
      row[step] = "created";
    }
  }
  drawSteps();
}
function drawSteps() {
  const cell = (s, st) => { const v = (grid[s] || {})[st]; if (!v) return "<td></td>"; const old = ((when[s] || {})[st] || 0) < day ? " was" : ""; return `<td><span class="st st-${v}${old}">${v}</span></td>`; };
  $("steps").innerHTML = `<thead><tr><th>Student</th>${STEPS.map((s) => `<th>${s}</th>`).join("")}</tr></thead><tbody>${STUDENTS.map((s) => `<tr class="${day ? "new" : ""}"><td>${s}</td>${STEPS.map((st) => cell(s, st)).join("")}</tr>`).join("")}</tbody>`;
  $("dayBtn").textContent = `Run day ${day + 1}`;
  $("dayBtn").disabled = day >= 4;
  const notes = {0: "No run yet.", 1: "Day 1: one student's failure never stops another. Where a step failed, the steps that read its result are held for that student alone; a repository that already exists is adopted, not made again.", 2: "Day 2: the failed and held steps run again and the rest follow. Steps done earlier (greyed) are not taken again.", 3: "Day 3: the waiting invitation is accepted, so that step is done too.", 4: "Day 4: nothing left to do, so the run changes nothing. That is why it can run every day."};
  $("dayNote").textContent = notes[Math.min(day, 4)];
}
$("dayBtn").onclick = runDay;
$("dayReset").onclick = () => { day = 0; grid = {}; when = {}; drawSteps(); };
$("stepLegend").innerHTML = ["created", "adopted", "pending", "failed", "held"].map((v) => `<span><span class="st st-${v}">${v}</span> ${{created: "made by this run", adopted: "found by name, nothing to do", pending: "waits on a person", failed: "error, retried next run", held: "needs a step that is not done"}[v]}</span>`).join("");

/* ---------- the student's name follows every view ---------- */
$("ucName").oninput = () => { drawWho(); drawUc(); drawOidc(); drawTool(); };
drawWho(); drawUc(); drawOidc(); drawTool(); drawAssets(); drawSteps();

/* ---------- 1. the path of an action ---------- */
const D = "https://docs.databricks.com/aws/en/";
const ARCH = [D + "getting-started/high-level-architecture", "High-level architecture"];
const NET = [D + "security/network/serverless-network-security/", "Serverless network security"];
const COMPUTE = [D + "compute/configure", "Compute configuration: driver and workers"];
const RESULTS = [D + "admin/workspace-settings/notebook-results", "Where notebook results are stored"];
const FETCH = [D + "integrations/odbc/capability", "Cloud Fetch"];
const JOBS = [D + "jobs/", "Lakeflow Jobs"];
const UCDOC = [D + "data-governance/unity-catalog/", "Unity Catalog"];
const hop = (edges, title, text, src, inferred = false) => ({edges, title, text, src, inferred});
const START = {
  nb: hop(["e_ui"], "You run a cell", "The browser talks only to the web application, over HTTPS. The web application and the workspace's backend services are the <strong>control plane</strong>, which Databricks runs in its own cloud account.", ARCH),
  sql: hop(["e_sql"], "Your laptop sends a query", "The SQL connector names the workspace host and the warehouse's <code>http_path</code>; your profile's OAuth token says who you are. Your laptop never talks to the compute directly.", [D + "dev-tools/python-sql-connector", "Python SQL connector"]),
  job: hop(["e_cd"], "Your CD workflow calls the API", "GitHub Actions signs in as your deploy principal (view 4) and calls the Jobs API. From here on the run is that principal's, not yours.", JOBS),
};
const SHARED = [
  hop(["e_auth"], "Unity Catalog decides", "Before data is read, Unity Catalog checks that the identity holds the privileges on every level, catalog, schema and table, and records the access in the audit log. How the compute then gets its short-lived access to the files is not spelled out in the docs: this hop is a simplification.", UCDOC, true),
  hop(["e_tasks"], "The driver splits the work", "The driver (in a warehouse, the cluster behind it) plans the query and hands tasks to the executors. Photon, the vectorized engine, runs on serverless compute and every SQL warehouse.", COMPUTE),
  hop(["e_read"], "Executors read in parallel", "Each executor reads its share of the table's files from storage at the same time. In a serverless workspace like the course's, that storage is <strong>default storage</strong>, managed by Databricks.", ARCH),
];
const PATHS = {
  nb: {
    small: [START.nb, hop(["e_cmd"], "The command goes to serverless compute", "The control plane sends the command to compute in the <strong>serverless compute plane</strong>, also in Databricks' account and region. Between the two, traffic stays on the cloud provider's backbone, never the public internet.", NET), ...SHARED,
      hop(["e_small", "e_back"], "A small result stays in the control plane", "Small notebook results are stored in the control plane.", RESULTS),
      hop(["e_reply_ui"], "The page shows it", "The web application returns the result to your browser.", RESULTS)],
    large: [START.nb, hop(["e_cmd"], "The command goes to serverless compute", "Control plane to serverless compute plane, over the cloud backbone.", NET), ...SHARED,
      hop(["e_large"], "A large result goes to workspace storage", "Larger notebook results are written to the workspace's storage, which in a serverless workspace is default storage.", RESULTS),
      hop(["e_large_ui", "e_reply_ui"], "The page reads it back", "The web application reads the stored result and shows it to you.", RESULTS, true)],
  },
  sql: {
    small: [START.sql, hop(["e_cmd"], "The query goes to your warehouse", "The control plane routes the query to your SQL warehouse in the serverless compute plane.", ARCH), ...SHARED,
      hop(["e_small", "e_back", "e_reply_cli"], "Rows come back through the control plane", "Below 1 MB, Cloud Fetch does not apply: the rows come back in the API response. The docs state the 1 MB threshold; that the small path goes through the control plane is our reading of them.", FETCH, true)],
    large: [START.sql, hop(["e_cmd"], "The query goes to your warehouse", "The control plane routes the query to your SQL warehouse.", ARCH), ...SHARED,
      hop(["e_large"], "The result is written as files", "Above 1 MB, the warehouse writes the result to workspace storage as Arrow files of up to 20 MB each.", FETCH),
      hop(["e_reply_cli"], "You get links, not rows", "Databricks returns presigned URLs to the result files.", FETCH),
      hop(["e_fetch"], "Your laptop downloads straight from storage", "The connector downloads the files directly from cloud storage, in parallel, bypassing the control plane. The files are cleaned up after a day or two.", FETCH)],
  },
  job: {
    any: [START.job, hop(["e_sched"], "The jobs service creates a run", "The run is created and queued. That the jobs service lives in the control plane is our reading: the docs say only \"backend services\".", JOBS, true),
      hop(["e_run"], "Serverless compute starts for the run", "Tasks run on serverless compute unless the job names other compute; it starts in seconds, in Databricks' account.", [D + "jobs/compute", "Compute for jobs"]), ...SHARED,
      hop(["e_large"], "Job results always go to storage", "For jobs, all results are stored in the workspace storage.", RESULTS),
      hop(["e_ui", "e_large_ui", "e_reply_ui"], "You read the run later", "When you open the run page, the web application reads the output back from storage.", RESULTS, true)],
  },
};
const NODES = {
  browser: "Your browser: everything you click goes to the web application over HTTPS.",
  client: "Your laptop: the SQL connector, the CLI and the SDK, signed in with your OAuth profile.",
  github: "A GitHub Actions runner, signed in as a deploy principal through OIDC (view 4).",
  webapp: "The web application and REST APIs: part of the control plane, run by Databricks in its own cloud account.",
  scheduler: "The jobs service: creates and queues runs. Its exact place in the control plane is not documented.",
  uc: "Unity Catalog: privileges on every catalog, schema, table and volume, plus lineage and audit.",
  cpresults: "Small interactive results are kept in the control plane.",
  driver: "The driver plans and coordinates; in a SQL warehouse, a cluster sized by the warehouse size.",
  exec: "Executors run the tasks in parallel, one executor per worker.",
  data: "Your Delta tables and volumes. In the course's serverless workspace they sit in default storage.",
  wsstore: "Workspace storage: job results, large notebook results, Cloud Fetch files. Default storage here; an S3 bucket in your account in a classic workspace.",
  classic: "In a classic workspace, clusters run in your own cloud account and connect out to the control plane through secure cluster connectivity, with no public IPs.",
  bucket: "In a classic workspace, the workspace storage bucket is in your AWS account.",
};
let pAction = "nb", pSize = "small", pStep = -1;
function pathHops() { return pAction === "job" ? PATHS.job.any : PATHS[pAction][pSize]; }
function drawPath() {
  tabs($("pathActions"), [["nb", "Run a notebook cell"], ["sql", "Query from your laptop"], ["job", "A job started by CD"]], pAction, (k) => { pAction = k; pStep = -1; drawPath(); });
  tabs($("pathSize"), [["small", "Small"], ["large", "Large (over 1 MB)"]], pSize, (k) => { pSize = k; pStep = -1; drawPath(); });
  $("pathSize").querySelectorAll("button").forEach((b) => (b.disabled = pAction === "job"));
  const hops = pathHops();
  const lit = new Set(), now = new Set(), nodes = new Set();
  hops.slice(0, pStep + 1).forEach((h, i) => h.edges.forEach((e) => (i === pStep ? now : lit).add(e)));
  const svg = $("pathMap");
  svg.querySelectorAll("[data-edge]").forEach((el) => {
    const id = el.dataset.edge;
    el.classList.toggle("hot", now.has(id));
    el.classList.toggle("done", lit.has(id) && !now.has(id));
    el.classList.toggle("cold", pStep >= 0 && !lit.has(id) && !now.has(id));
    if (el.hasAttribute("marker-end") || el.dataset.marker) {
      el.dataset.marker = el.dataset.marker || el.getAttribute("marker-end");
      el.setAttribute("marker-end", lit.has(id) || now.has(id) ? "url(#rp-arrow-hot)" : el.dataset.marker);
    }
    if (now.has(id) && el.dataset.from) { nodes.add(el.dataset.from); nodes.add(el.dataset.to); }
  });
  svg.querySelectorAll("[data-node]").forEach((el) => el.classList.toggle("sel", nodes.has(el.dataset.node)));
  $("pathPrev").disabled = pStep < 0;
  $("pathNext").disabled = pStep >= hops.length - 1;
  if (pStep < 0) {
    $("pathDetail").innerHTML = `<p>${hops.length} hops. Press <strong>Next hop</strong>, or click a box to read what it is.</p>`;
    return;
  }
  const h = hops[pStep];
  $("pathDetail").innerHTML = `<p class="eyebrow">Hop ${pStep + 1} of ${hops.length}${h.inferred ? " · partly inferred" : ""}</p><h3>${h.title}</h3><p>${h.text}</p><p class="note">Source: <a href="${h.src[0]}">${h.src[1]}</a></p>`;
}
$("pathNext").onclick = () => { pStep += 1; drawPath(); };
$("pathPrev").onclick = () => { pStep -= 1; drawPath(); };
$("pathReset").onclick = () => { pStep = -1; drawPath(); };
$("pathMap").onclick = (ev) => {
  const n = ev.target.closest("[data-node]");
  if (n && NODES[n.dataset.node]) $("pathDetail").innerHTML = `<h3>${esc(n.querySelector("text")?.textContent || n.dataset.node)}</h3><p>${NODES[n.dataset.node]}</p>`;
};
drawPath();
