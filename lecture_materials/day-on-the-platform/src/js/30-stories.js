// ---------- the stories ----------
// Every request obeys the same order, and the code below is written to be read against it:
//   1. it arrives at the front door (the web app or a REST API);
//   2. identity and auth authenticates it (authn), every time, for every request;
//   3. it is authorized: workspace ACLs for a workspace object (acl), Unity Catalog for data and
//      AI assets (ucAsk), asked by whatever is about to touch the data, before it touches it;
//   4. compute runs it, and executors read or write files in parallel (burst);
//   5. the result comes back through the front door.
// Unity Catalog is never a router: work goes to compute, and compute asks Unity Catalog.
// Before step 1, a developer's action leaves the laptop along its rail and through the laptop
// setup: a commit through pre-commit, a sign-in through the CLI profile, Spark through Databricks
// Connect. A review or an approval is a click in the browser: it passes the tools on its way out.

// ----- small state on the drawing -----
const setSub = (id, s) => { if (T[id].sub && !(mode === "day" && id === "jobs")) T[id].sub.textContent = s; };
const cdSet = (k, state) => {
  const c = CD[k], look = {idle: ["#f4f2ee", "#d9d6d1"], run: ["#fbeae6", FAM.dev], wait: ["#fbf1d9", FAM.token], ok: ["#e2f3ea", FAM.ok]}[state];
  c.r.setAttribute("fill", look[0]); c.r.setAttribute("stroke", look[1]);
  c.tx.textContent = c.label + (state === "ok" ? " ✓" : state === "wait" ? " …" : "");
};
const envLit = (e) => { ENV[e].setAttribute("fill", "#fbf1d9"); later(2.2, () => ENV[e].setAttribute("fill", "none")); };
const gwUse = () => {
  const g = T.gateway;
  g.calls++;
  g.usage.textContent = `usage: ${g.calls} calls today`;
  g.meter.setAttribute("width", Math.min(230, 70 + (g.calls - 128) * 9));
  // the usage record reaches system.ai_gateway.usage later, like every system table
  later(2.5, () => { const s = TABLE.gwusage.slots[g.calls % 4]; s.classList.add("on"); later(1, () => s.classList.remove("on")); });
};

// the repository's history, drawn as it happens
const graph = (() => {
  const g = el("g", {}, T.repo.g), X0 = 92, X1 = 522, YM = 998, LANE = {ada: 970, bo: 942, chen: 914};
  let mainX, br;
  const dot = (x, y, col, r = 5.5) => el("circle", {cx: x, cy: y, r, fill: col, class: "g-dot"}, g);
  const reset = () => {
    g.textContent = "";
    el("path", {d: `M${X0 - 14} ${YM}H${X1}`, class: "g-main"}, g);
    txt(X1 - 2, YM - 10, "main", "g-lbl mono", g, {"text-anchor": "end"});
    mainX = X0; br = {};
    dot(mainX, YM, "#3d4350");
  };
  const fork = (dev) => {
    if (mainX > X1 - 170) reset();
    const y = LANE[dev], b = (br[dev] = {x: mainX + 24, y, col: P[dev].col});
    b.d = `M${mainX} ${YM}C${mainX + 14} ${YM} ${mainX + 10} ${y} ${b.x} ${y}`;
    b.path = el("path", {d: b.d, class: "g-br", stroke: b.col}, g);
    b.label = txt(b.x + 4, y - 9, P[dev].branch, "g-lbl mono", g);
    return b;
  };
  const commit = (dev) => {
    const b = br[dev] || fork(dev);
    b.x += 24; b.d += `L${b.x} ${b.y}`; b.path.setAttribute("d", b.d);
    const c = dot(b.x, b.y, b.col);
    scene.from(c, {attr: {r: 0}, duration: 0.3, ease: "back.out(3)"}, scene.time());
  };
  const merge = (dev) => {
    const b = br[dev];
    if (!b) return;
    const mx = Math.max(b.x + 26, mainX + 26);
    b.d += `C${b.x + 14} ${b.y} ${mx - 12} ${YM} ${mx} ${YM}`; b.path.setAttribute("d", b.d);
    mainX = mx;
    const c = dot(mx, YM, "#3d4350", 6.5);
    scene.from(c, {attr: {r: 0}, duration: 0.3, ease: "back.out(3)"}, scene.time());
    delete br[dev];
  };
  return {reset, fork, commit, merge, has: (dev) => !!br[dev]};
})();

// ----- the shared steps -----
// steps 1 and 2: the request arrives at the front door and is authenticated
async function arrive(src, who, o) {
  await fly(src, "door", o);
  await fly("door", "auth", {fam: o.fam, icon: "key", label: "token"});
  await verdict("auth", true, `token ✓ ${who}`);
}
// A call from compute to another service of the platform (the gateway, AI Search, the trace
// endpoint) is a request like any other: it arrives at a REST API with the caller's token, and
// identity and auth authenticates it before the service acts. `who` is the identity the code runs as.
async function call(from, to, who, o) {
  await fly(from, "door", o);
  await fly("door", "auth", {fam: "plat", icon: "key", label: "token"});
  await verdict("auth", true, `token ✓ ${who}`, {wait: 0.9});
  await fly("auth", to, o);
}
// step 3, workspace objects: a workspace ACL check, its own small moment
async function acl(text, o) {
  await fly("auth", "acl", o);
  await verdict("acl", true, text);
}
// step 3, data and AI assets: `from` (compute, the gateway, Zerobus, AI Search) asks Unity Catalog,
// which decides, audits the decision, and answers. Nothing is read or written before the answer.
async function ucAsk(from, question, ok, text) {
  await fly(from, "uc", {fam: "plat", icon: "doc", label: question});
  await verdict("uc", ok, text);
  audit(ok);
  await fly("uc", from, {fam: ok ? "ok" : "no", icon: ok ? "ok" : "no", label: ok ? "allowed" : "refused"});
}
// step 5: a small result goes home through the control plane's front door
async function home(from, dst, o) {
  await fly(from, "door", {fam: "ok", ...o});
  await fly("door", dst, {fam: "ok", ...o});
}
const files = (k) => [[k, 0], [k, 1], [k, 2], [k, 3]];
const lap = (dev) => "dv." + dev;       // the developer's laptop, as a node of the rail graph
const sp = (env) => `sp-deploy-arxiv-${env}`;
let prNo = 41;

const ST = {
  // ----- 1. local development -----
  // The CLI profile gets the token (U2M); Databricks Connect then uses it, and its request is
  // authenticated like any other.
  async login(dev = "ada") {
    const n = P[dev].name;
    say(`${n} runs <code>databricks auth login</code>`, "dev");
    act(dev, "signing in");
    await fly(lap(dev), "cli", {fam: "dev", icon: "key", label: "databricks auth login"});
    await fly("cli", "door", {fam: "dev", icon: "key", label: "auth login · OAuth U2M"});
    await fly("door", "auth", {fam: "dev", icon: "key", label: "browser sign-in"});
    await verdict("auth", true, `${n} signed in · OAuth U2M`);
    await fly("auth", "door", {fam: "token", icon: "key", label: `token: ${n}`});
    await fly("door", "cli", {fam: "token", icon: "key", label: `token: ${n}`});
    setSub("cli", "token cached · 1 hour");
    say(`The CLI profile caches a short-lived token for ${n}; no secret is pasted`, "token");
  },
  async connect(dev = "ada") {
    const n = P[dev].name;
    say(`${n} runs the code in the editor; its DataFrame work leaves through Databricks Connect, with the profile's token`, "dev");
    act(dev, "running locally");
    await fly(lap(dev), "editor", {fam: "dev", icon: "py", label: "run the script"});
    await fly("editor", "connect", {fam: "dev", icon: "py", label: "DataFrame operations"});
    await arrive("connect", n, {fam: "dev", icon: "py", label: "DataFrame · Connect"});
    await fly("auth", "nb", {fam: "plat", icon: "py", label: `Spark plan · as ${n}`});
    say("Notebook compute asks Unity Catalog before it reads anything: <code>USE CATALOG</code>, <code>USE SCHEMA</code>, then <code>SELECT</code>", "");
    await ucAsk("nb", "SELECT arxiv_chunks?", true, `SELECT ✓ arxiv_chunks · as ${n}`);
    await burst("nb", files("chunks"), "read");
    say("Four executors read four files of <code>arxiv_chunks</code> at once", "data");
    await home("nb", "connect", {icon: "rows", label: "DataFrame"});
    await fly("connect", lap(dev), {fam: "ok", icon: "rows", label: "DataFrame"});
    act(dev, "DataFrame back on the laptop");
  },

  // ----- 2. a pull request: rejected, fixed, merged -----
  async branch(dev) { graph.fork(dev); act(dev, "on " + P[dev].branch); await wait(0.4); },
  async commits(dev, fix) {
    const n = P[dev].name;
    act(dev, fix ? "fixing" : "committing");
    await fly(lap(dev), "precommit", {fam: "dev", icon: "commit", label: "git commit"});
    await verdict("precommit", true, "hooks pass", {wait: 0.6, hold: 1.3});
    await fly("precommit", "repo", {fam: "dev", icon: "commit", label: fix ? "1 commit: the fix" : "2 commits"});
    graph.commit(dev); if (!fix) later(0.25, () => graph.commit(dev));
    say(fix ? `${n} pushes a fix to <code>${P[dev].branch}</code>` : `${n} pushes 2 commits to <code>${P[dev].branch}</code>`, "dev");
  },
  async pr(dev) {
    const no = ++prNo;
    await fly("repo", "pr", {fam: "dev", icon: "pr", label: `PR #${no}`});
    setSub("pr", `#${no} open`);
    say(`${P[dev].name} opens pull request #${no}`, "dev");
    return no;
  },
  async ci(no, fail) {
    await fly("pr", "ci", {fam: "dev", icon: "ci", label: "run checks"});
    setSub("ci", "running…");
    await wait(0.7);
    if (fail) {
      await verdict("ci", false, "pytest ✗ 1 test fails");
      setSub("ci", "pytest failed");
      await fly("ci", "pr", {fam: "no", icon: "no", label: "check failed"});
      setSub("pr", `#${no} · checks red`);
      say(`CI fails on #${no}: pytest is red, and the ruleset on <code>main</code> blocks the merge`, "no");
    } else {
      await verdict("ci", true, "pre-commit ✓ pytest ✓");
      setSub("ci", "all green");
      await fly("ci", "pr", {fam: "ok", icon: "ok", label: "checks green"});
      setSub("pr", `#${no} · checks green`);
      say(`CI is green on #${no}`, "ok");
    }
  },
  async review(reviewer, no, changes) {
    const n = P[reviewer].name;
    act(reviewer, "reviewing #" + no);
    await fly(lap(reviewer), "pr", {fam: "dev", icon: changes ? "no" : "ok", label: changes ? "changes requested" : "approve"});
    await verdict("pr", !changes, changes ? `${n} requests changes` : `${n} approves`);
    setSub("pr", changes ? `#${no} · changes requested` : `#${no} · approved`);
    say(changes ? `${n} reviews #${no} and requests changes` : `${n} approves #${no}`, changes ? "no" : "ok");
  },
  async merge(dev, no) {
    await fly("pr", "repo", {fam: "dev", icon: "commit", label: "merge"});
    graph.merge(dev);
    setSub("pr", "review · approve"); setSub("ci", "pre-commit · pytest");
    act(dev, "merged");
    say(`#${no} is merged: a new commit on <code>main</code> (the ruleset wanted the review and green CI)`, "dev");
  },

  // ----- 3. CD signs in with OIDC -----
  // CD asks GitHub's issuer for a token; the issuer returns it to CD; CD sends it to the front
  // door (the workspace's /oidc/v1/token); identity and auth checks the federation policy of the
  // deploy principal and returns a Databricks token. The issuer never talks to Databricks.
  async cdStart() {
    await fly("repo", "cd", {fam: "dev", icon: "ci", label: "merge → CD"});
    cdSet("acc", "run"); cdSet("gate", "idle"); cdSet("prd", "idle");
    say("The merge starts Actions CD: acc first", "dev");
  },
  async oidc(env) {
    envLit(env);
    say(`The ${env} job reads <code>DATABRICKS_CLIENT_ID</code> from the ${env} environment: an id, not a secret`, "dev");
    await fly("cd", "issuer", {fam: "dev", icon: "key", label: "request an ID token"});
    await wait(0.4);
    await fly("issuer", "cd", {fam: "token", icon: "key", label: `GitHub JWT · environment ${env}`});
    await fly("cd", "door", {fam: "token", icon: "key", label: "POST /oidc/v1/token"});
    await fly("door", "auth", {fam: "token", icon: "key", label: "GitHub JWT"});
    say(`Identity and auth checks the federation policy of <code>${sp(env)}</code>`, "token");
    await policyCheck(env);
    await verdict("auth", true, `exchanged ✓ ${sp(env)}`);
    await fly("auth", "door", {fam: "token", icon: "key", label: `token: ${sp(env)}`});
    await fly("door", "cd", {fam: "token", icon: "key", label: `token: ${sp(env)}`});
    say(`CD now holds a short-lived token for <code>${sp(env)}</code>. No secret was stored anywhere`, "token");
  },

  // ----- 4. deploy to acc, then prd -----
  // A deploy is authorized by workspace ACLs and updates the job and the app. It starts no run.
  async deploy(env) {
    await arrive("cd", sp(env), {fam: "dev", icon: "pkg", label: `bundle deploy · ${env}`});
    await acl("CAN MANAGE ✓ job, app · write ✓ bundle folder", {fam: "dev", icon: "pkg", label: "bundle"});
    await Promise.all([
      fly("acl", "jobs", {fam: "plat", icon: "pkg", label: "update the job"}),
      fly("acl", "apps", {fam: "plat", icon: "pkg", label: "update the app's definition", cam: false}),
    ]);
    setSub("jobs", "job updated · no run started");
    say(`The ${env} deploy updates the job and the app's definition. A deploy starts no run`, "dev");
    await home("jobs", "cd", {icon: "ok", label: `${env} deployed`});
    cdSet(env, "ok");
  },
  // The run is asked for explicitly (bundle run): front door, auth, the job's ACL, the jobs
  // service, job compute; Unity Catalog authorizes the write before any executor writes.
  async run(env) {
    say("CD then asks for a run, explicitly: <code>databricks bundle run</code>", "dev");
    await arrive("cd", sp(env), {fam: "dev", icon: "job", label: "bundle run"});
    await acl("CAN MANAGE RUN ✓ job", {fam: "dev", icon: "job", label: "run now"});
    await fly("acl", "jobs", {fam: "plat", icon: "job", label: "run now"});
    setSub("jobs", "run started");
    await fly("jobs", "jc", {fam: "plat", icon: "job", label: `run · as ${sp(env)}`});
    await ucAsk("jc", "MODIFY arxiv_papers, arxiv_chunks?", true, `MODIFY ✓ as ${sp(env)}`);
    await burst("jc", [["papers", 1], ["papers", 2], ["chunks", 1], ["chunks", 2]], "write");
    say("Four executors write new files to <code>arxiv_papers</code> and <code>arxiv_chunks</code> at once", "data");
    await fly("jc", "jobs", {fam: "ok", icon: "ok", label: "run succeeded"});
    setSub("jobs", "runs · schedules · run-as");
    await home("jobs", "cd", {icon: "ok", label: "run succeeded"});
  },
  async approval(who = "chen") {
    cdSet("gate", "wait");
    say("The prd job waits for an approval: a setting of the <code>prd</code> environment", "dev");
    await wait(0.8);
    act(who, "approves prd");
    await fly(lap(who), "cd", {fam: "dev", icon: "ok", label: "approve prd"});
    cdSet("gate", "ok"); cdSet("prd", "run");
    say(`${P[who].name} approves the prd deployment`, "ok");
  },

  // ----- 5. Python in a notebook, with a model call and traces -----
  async dana() {
    say("Dana runs a Python cell in her notebook", "user");
    act("dana", "runs a cell");
    await arrive("dana", "Dana", {fam: "user", icon: "py", label: "run cell"});
    await acl("CAN RUN ✓ notebook", {fam: "user", icon: "py", label: "notebook"});
    await fly("acl", "nb", {fam: "plat", icon: "py", label: "cell · as Dana"});
    await ucAsk("nb", "SELECT arxiv_chunks?", true, "SELECT ✓ arxiv_chunks · as Dana");
    await burst("nb", files("chunks"), "read");
    say("Her code calls the model service: a REST call with Dana's token, to Unity Gateway", "");
    await call("nb", "gateway", "Dana", {fam: "plat", icon: "chat", label: "course_ops.gateway.chat"});
    await ucAsk("gateway", "EXECUTE gateway.chat?", true, "EXECUTE ✓ as Dana");
    await verdict("gateway", true, "budget ✓ Dana · usage +1");
    gwUse();
    await fly("gateway", "serving", {fam: "plat", icon: "chat", label: "prompt"});
    await wait(0.5);
    await fly("serving", "gateway", {fam: "ok", icon: "chat", label: "completion"});
    await fly("gateway", "nb", {fam: "ok", icon: "chat", label: "completion"});
    say("MLflow sends the trace spans, with Dana's token, to be written by Zerobus", "");
    await call("nb", "zerobus", "Dana", {fam: "plat", icon: "trace", label: "trace spans"});
    await ucAsk("zerobus", "MODIFY, SELECT trace tables?", true, "MODIFY ✓ SELECT ✓ as Dana");
    await stream("zerobus", "traces");
    say("Zerobus writes the spans to the trace tables in Dana's schema", "data");
    await home("nb", "dana", {icon: "rows", label: "cell output"});
    act("dana", "reads the output");
  },

  // ----- 6. an AI question to Genie -----
  // The asker needs the Genie space's ACL. The warehouse is used with the compute credentials the
  // space's author embedded; Unity Catalog evaluates the data access as the asker.
  async eli() {
    say("Eli asks Genie: “which papers scored best last week?”", "user");
    act("eli", "asks a question");
    await arrive("eli", "Eli", {fam: "user", icon: "ask", label: "question"});
    await acl("CAN RUN ✓ Genie space", {fam: "user", icon: "ask", label: "question"});
    await fly("acl", "genie", {fam: "user", icon: "ask", label: "question"});
    setSub("genie", "writing the SQL…");
    await wait(0.9);
    setSub("genie", "question → SQL, as the asker");
    say("Genie writes the SQL. The warehouse is the one its author set up; the data is checked as Eli", "");
    await fly("genie", "wh", {fam: "plat", icon: "sql", label: "SQL · data access as Eli"});
    await ucAsk("wh", "SELECT eval_results?", true, "SELECT ✓ eval_results · as Eli");
    await burst("wh", files("evals"), "read");
    await fly("wh", "genie", {fam: "ok", icon: "rows", label: "rows"});
    await home("genie", "eli", {icon: "chart", label: "answer, with its SQL"});
    act("eli", "reads the answer and its SQL");
  },

  // ----- 7. Unity Catalog allows, and refuses -----
  // A published dashboard with shared data permissions runs as its publisher, so the refusal is
  // shown where the user is the identity: Fay's own query in the SQL editor.
  async dash(user = "tess", tbl = "monitor", what = "course_ops.monitoring") {
    const n = P[user].name;
    say(`${n} opens ${user === "tess" ? "the course dashboard" : "a dashboard"}`, "user");
    act(user, "opens a dashboard");
    await arrive(user, n, {fam: "user", icon: "chart", label: "open dashboard"});
    await acl("CAN RUN ✓ dashboard", {fam: "user", icon: "chart", label: "dashboard"});
    await fly("acl", "one", {fam: "user", icon: "chart", label: "dashboard"});
    say("The dashboard is published with shared data permissions: its queries run as the publisher", "");
    await fly("one", "wh", {fam: "plat", icon: "sql", label: "tile SQL · as the publisher"});
    await ucAsk("wh", `SELECT ${what}?`, true, "SELECT ✓ as the publisher");
    await burst("wh", files(tbl), "read");
    await fly("wh", "one", {fam: "ok", icon: "rows", label: "rows"});
    await home("one", user, {icon: "chart", label: "tiles"});
    act(user, "reads the dashboard");
  },
  async refused() {
    say("Fay queries <code>llmops_prd.jane_doe</code> in the SQL editor, a schema she holds no privilege on", "user");
    act("fay", "runs a query");
    await arrive("fay", "Fay", {fam: "user", icon: "sql", label: "SQL · llmops_prd.jane_doe"});
    await acl("CAN USE ✓ warehouse", {fam: "user", icon: "sql", label: "query"});
    await fly("acl", "wh", {fam: "plat", icon: "sql", label: "query · as Fay"});
    await fly("wh", "uc", {fam: "plat", icon: "doc", label: "USE SCHEMA llmops_prd.jane_doe?"});
    await verdict("uc", false, "refused ✗ Fay has no privilege on llmops_prd.jane_doe");
    audit(false);
    await fly("uc", "wh", {fam: "no", icon: "no", label: "refused"});
    say("Refused: no executor starts and no file is read. The refusal is logged for audit too", "no");
    await fly("wh", "door", {fam: "no", icon: "no", label: "PERMISSION_DENIED"});
    await fly("door", "fay", {fam: "no", icon: "no", label: "PERMISSION_DENIED"});
    act("fay", "permission denied");
  },

  // ----- 8. SQL, read in parallel -----
  async sql() {
    say("Fay runs a query in the SQL editor", "user");
    act("fay", "runs a query");
    await arrive("fay", "Fay", {fam: "user", icon: "sql", label: "SQL query"});
    await acl("CAN USE ✓ warehouse", {fam: "user", icon: "sql", label: "query"});
    await fly("acl", "wh", {fam: "plat", icon: "sql", label: "query · as Fay"});
    RACK.wh.drv.textContent = "driver · planning the query…";
    say("The warehouse's driver plans the query and splits it into four tasks", "");
    await ucAsk("wh", "SELECT arxiv_papers?", true, "SELECT ✓ arxiv_papers · as Fay");
    await burst("wh", files("papers"), "read", {n: 16});
    say("Four executors read four files at once: four files in about the time of one", "data");
    await home("wh", "fay", {icon: "rows", label: "rows"});
    act("fay", "reads the rows");
  },

  // ----- 9. the agent app -----
  // Gus is authenticated and needs CAN USE on the app. From there on the app acts as its own
  // service principal: AI Search is authorized by Unity Catalog, Lakebase by a Postgres role, the
  // model service by Unity Catalog EXECUTE, then the gateway's limits; the spans by MODIFY, SELECT.
  async gus(store = "both") {
    say("Gus opens the agent app and asks a question", "user");
    act("gus", "chats with the app");
    await arrive("gus", "Gus", {fam: "user", icon: "chat", label: "chat · the app's URL"});
    await acl("CAN USE ✓ app", {fam: "user", icon: "chat", label: "chat"});
    await fly("acl", "apps", {fam: "user", icon: "chat", label: "message from Gus"});
    say("From here the app acts as its own service principal", "");
    if (store !== "lakebase") {
      await call("apps", "aisearch", "the app's SP", {fam: "plat", icon: "doc", label: "query the index"});
      await ucAsk("aisearch", "SELECT on the index?", true, "SELECT ✓ index · as the app's SP");
      await fly("aisearch", "apps", {fam: "ok", icon: "rows", label: "context"});
    }
    if (store !== "aisearch") {
      await fly("apps", "lakebase", {fam: "plat", icon: "sql", label: "pgvector query"});
      // Lakebase is reached at its own Postgres endpoint: the app's OAuth token is the password,
      // and Postgres grants, not Unity Catalog, decide what the role may read
      await verdict("lakebase", true, "token ✓ then Postgres role ✓ (not Unity Catalog)");
      await fly("lakebase", "apps", {fam: "ok", icon: "rows", label: "context"});
    }
    say("AI Search is authorized by Unity Catalog; Lakebase by the app's Postgres role and grants. Every call carried the app's token", "");
    await call("apps", "gateway", "the app's SP", {fam: "plat", icon: "chat", label: "course_ops.gateway.chat"});
    await ucAsk("gateway", "EXECUTE gateway.chat?", true, "EXECUTE ✓ as the app's SP");
    await verdict("gateway", true, "within limits ✓ counted as the app's one SP · usage +1");
    gwUse();
    await fly("gateway", "serving", {fam: "plat", icon: "chat", label: "prompt + context"});
    await wait(0.5);
    await fly("serving", "gateway", {fam: "ok", icon: "chat", label: "completion"});
    await fly("gateway", "apps", {fam: "ok", icon: "chat", label: "completion"});
    await call("apps", "zerobus", "the app's SP", {fam: "plat", icon: "trace", label: "trace spans"});
    await ucAsk("zerobus", "MODIFY, SELECT trace tables?", true, "MODIFY ✓ SELECT ✓ as the app's SP");
    await stream("zerobus", "traces");
    say("Zerobus writes the spans to the app's trace tables", "data");
    await home("apps", "gus", {icon: "chat", label: "answer"});
    act("gus", "reads the answer");
  },

  // ----- 10. audit and monitoring -----
  // A scheduled run starts at the jobs service, on its schedule, as the job's run-as service
  // principal. It needs Unity Catalog's decision to read the system tables, and another to write.
  async auditFlow() {
    say("What Unity Catalog allowed and refused today is logged for audit; the records reach <code>system.access.audit</code> later, not in real time", "");
    aimRect({x: 660, y: 480, w: 700, h: 1150}, 40);
    for (let i = 0; i < 5; i++) { audit(i !== 3); await wait(0.45); }
    await wait(1.6);
    ["billing", "gwusage"].forEach((k, j) => later(j * 0.4, () => { TABLE[k].slots.forEach((s) => s.classList.add("on")); later(1.4, () => TABLE[k].slots.forEach((s) => s.classList.remove("on"))); }));
    say("Databricks fills <code>billing.usage</code> and <code>ai_gateway.usage</code> the same way", "");
    aimTile("audit", "billing", "gwusage");
    await wait(1.8);
  },
  async monitoring() {
    say("The schedule fires. No request arrives: the jobs service itself starts the monitoring job, as its run-as service principal", "");
    setSub("jobs", "schedule fires");
    pulse("jobs", "plat", 1.2);
    aimTile("jobs");
    await wait(0.9);
    await fly("jobs", "jc", {fam: "plat", icon: "job", label: "scheduled run · as the monitoring SP"});
    await ucAsk("jc", "SELECT system.access.audit, billing.usage?", true, "SELECT ✓ as the monitoring SP");
    await burst("jc", [["audit", 0], ["audit", 2], ["billing", 1], ["billing", 3]], "read");
    await ucAsk("jc", "MODIFY course_ops.monitoring?", true, "MODIFY ✓ as the monitoring SP");
    await burst("jc", files("monitor"), "write");
    say("The job reads the system tables and writes the course's monitoring tables", "data");
    await fly("jc", "jobs", {fam: "ok", icon: "ok", label: "run succeeded"});
    setSub("jobs", "runs · schedules · run-as");
  },
};

// ---------- the tour: ten chapters, each framed, played once ----------
const mergedHistory = () => { graph.reset(); graph.fork("ada"); graph.commit("ada"); graph.commit("ada"); graph.commit("ada"); graph.merge("ada"); };
const CH = [
  {t: "Local development", f: {x: 20, y: 30, w: 1340, h: 690},
    c: "Ada signs in from her CLI profile with <code>databricks auth login</code> (OAuth U2M), then runs her Python with Databricks Connect. Each request arrives at the front door and is authenticated; notebook compute asks Unity Catalog, then four executors read four files in parallel and the DataFrame comes back.",
    async play() { await ST.login("ada"); await wait(0.6); await ST.connect("ada"); }},
  {t: "A pull request: rejected, fixed, merged", f: {x: 10, y: 130, w: 1300, h: 640},
    c: "Ada commits through pre-commit, pushes and opens a pull request. Actions CI runs pre-commit and pytest: a red check. She pushes a fix, CI turns green, Bo approves, and the merge lands on <code>main</code>. The merge waits for the review and green CI because a ruleset on <code>main</code> says so.",
    setup() { graph.reset(); },
    async play() {
      await ST.branch("ada"); await ST.commits("ada"); const no = await ST.pr("ada");
      await ST.ci(no, true); await wait(0.9);
      await ST.commits("ada", true); await ST.ci(no, false); await wait(0.4);
      await ST.review("bo", no, false); await ST.merge("ada", no);
    }},
  {t: "CD signs in with OIDC", f: {x: 10, y: 1010, w: 1300, h: 560},
    c: "The merge starts CD. The acc job asks GitHub's issuer for a short-lived token and sends it to the front door of the workspace. Identity and auth checks the federation policy of <code>sp-deploy-arxiv-acc</code> (issuer, subject, audience) and returns a Databricks token. The environment holds only the principal's client id: no secret.",
    setup() { mergedHistory(); },
    async play() { await ST.cdStart(); await ST.oidc("acc"); }},
  {t: "Deploy to acc, then prd", f: {x: 10, y: 1010, w: 1300, h: 560},
    c: "With the token from the last chapter, the bundle deploy is authorized by workspace ACLs and updates the job and the app's definition; it starts no run. CD asks for a run explicitly: Unity Catalog authorizes the write as the deploy principal, and four executors write in parallel. Then prd: an approval (a setting of the GitHub environment), OIDC as <code>sp-deploy-arxiv-prd</code>, and the same deploy.",
    setup() { mergedHistory(); cdSet("acc", "run"); },
    async play() {
      await ST.deploy("acc"); await wait(0.5); await ST.run("acc"); await wait(0.6);
      await ST.approval("chen"); await ST.oidc("prd"); await ST.deploy("prd");
    }},
  {t: "Python in a notebook, with traces", f: {x: 1640, y: 40, w: 1340, h: 640},
    c: "Dana runs a cell. It is authenticated, the notebook's ACL lets her run it, and notebook compute asks Unity Catalog before reading. Her code calls a model through Unity Gateway (authenticated again, then <code>EXECUTE</code>, as Dana). MLflow sends the trace spans to Zerobus, which needs <code>MODIFY</code> and <code>SELECT</code> on the trace tables before a row lands.",
    async play() { await ST.dana(); }},
  {t: "An AI question to Genie", f: {x: 1640, y: 330, w: 1340, h: 640},
    c: "Eli asks in plain language. He needs access to the Genie space; Genie writes the SQL and runs it on a SQL warehouse. Unity Catalog evaluates the data access as Eli, and the answer comes back with its SQL.",
    async play() { await ST.eli(); }},
  {t: "Unity Catalog allows, and refuses", f: {x: 1640, y: 640, w: 1340, h: 960},
    c: "Tess opens the course dashboard: published with shared data permissions, its queries run as the publisher, who may read the monitoring tables. Fay's own query in the SQL editor runs as Fay, and she holds no privilege on <code>llmops_prd.jane_doe</code>: refused, before any file is read. Both are logged for audit.",
    async play() { await ST.dash("tess"); await wait(0.8); await ST.refused(); await wait(1.2); }},
  {t: "SQL, read in parallel", f: {x: 1640, y: 640, w: 1340, h: 640},
    c: "Fay runs a query in the SQL editor. She needs <code>CAN USE</code> on the warehouse and <code>SELECT</code> on the table. The driver plans the query and splits it into tasks; four executors read four files at once, and the rows come back.",
    async play() { await ST.sql(); }},
  {t: "The agent app", f: {x: 1640, y: 960, w: 1340, h: 640},
    c: "Gus is signed in by Databricks and needs <code>CAN USE</code> on the app. The app then acts as its own service principal, and each of its calls carries its token: it retrieves context from its vector store (both are shown: AI Search through Unity Catalog, Lakebase through a Postgres role), calls <code>course_ops.gateway.chat</code> (Unity Catalog checks <code>EXECUTE</code>, then the gateway checks its limits and records usage), and its trace spans land in the trace tables.",
    async play() { await ST.gus("both"); }},
  {t: "Audit and monitoring", f: {x: 660, y: 480, w: 1300, h: 700},
    c: "Unity Catalog logs the access it allowed and the access it refused, and Databricks delivers the audit log to <code>system.access.audit</code>, later rather than in real time. The scheduled monitoring job, run as its service principal, reads the system tables into the course's monitoring tables, and Tess reads them on the teachers' dashboard.",
    async play() { await ST.auditFlow(); await ST.monitoring(); await wait(0.5); await ST.dash("tess"); }},
];
const WHOLE = {t: "The whole day", c: "Everything at once: developers ship, people work, the schedule runs. Every request is authenticated; every request for data or a model meets Unity Catalog, and workspace objects are guarded by their ACLs. Zoom in anywhere, or click a part to read what it does."};

// ---------- the whole day: the same stories, looping, each loop on its own toggle ----------
const on = {devs: true, users: true, sched: true}, gates = {devs: [], users: [], sched: []};
const gate = async (k) => { while (!on[k]) await new Promise((r) => gates[k].push(r)); };
const setOn = (k, v) => { on[k] = v; if (v) gates[k].splice(0).forEach((r) => r()); };
async function devLoop() {
  const devs = ["ada", "bo", "chen"];
  for (let i = 0; ; i++) {
    const dev = devs[i % 3], rev = devs[(i + 1) % 3], env = "acc";
    await gate("devs");
    if (i % 3 === 0) { await ST.login(dev); await ST.connect(dev); await gate("devs"); }
    await ST.branch(dev); await ST.commits(dev); const no = await ST.pr(dev);
    // the developer loop alternates a CI failure and a review asking for changes
    if (i % 2 === 0) { await ST.ci(no, true); await wait(1.5); await ST.commits(dev, true); await ST.ci(no, false); await ST.review(rev, no, false); }
    else { await ST.ci(no, false); await ST.review(rev, no, true); await wait(1.5); await ST.commits(dev, true); await ST.ci(no, false); await ST.review(rev, no, false); }
    await ST.merge(dev, no);
    await gate("devs");
    await ST.cdStart(); await ST.oidc(env); await ST.deploy(env); await ST.run(env);
    await gate("devs");
    await ST.approval(devs[(i + 2) % 3]); await ST.oidc("prd"); await ST.deploy("prd");
    await wait(4);
    cdSet("acc", "idle"); cdSet("gate", "idle"); cdSet("prd", "idle");
  }
}
async function userLoop(first, steps, pause) {
  await wait(first);
  for (let i = 0; ; i++) { await gate("users"); await steps[i % steps.length](); await wait(pause); }
}
async function schedLoop() {
  await wait(30);
  for (;;) { await gate("sched"); await ST.monitoring(); await wait(70); }
}
const startDay = () => [
  devLoop(),
  userLoop(2, [ST.dana], 26),
  userLoop(12, [ST.eli], 30),
  // Fay alternates a dashboard, a refused query in the SQL editor, and a SQL query
  userLoop(22, [() => ST.dash("fay", "evals", "eval_results"), ST.refused, ST.sql], 20),
  userLoop(34, [() => ST.gus("aisearch"), () => ST.gus("lakebase")], 30),
  userLoop(48, [() => ST.dash("tess")], 44),
  schedLoop(),
];
