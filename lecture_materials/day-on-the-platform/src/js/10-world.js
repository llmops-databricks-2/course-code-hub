// ---------- the drawing ----------
// The ground says where a part runs, as in Databricks' own architecture picture
// (https://docs.databricks.com/aws/en/getting-started/high-level-architecture). Outside: the warm
// page, with the developers, GitHub and the platform users. Your Databricks account: one big
// perimeter that holds the account console, the control plane, the serverless compute plane and
// default storage. Beside it, outside it, dashed and empty: your cloud account, which the course
// does not have, and your resources. No frame wraps them: AWS and its region are a small
// note inside the Databricks account, never a perimeter around it.
// Inside the control plane the tiles stand in the order every request meets them: the front door
// on top, identity and auth below it, then the two authorizers side by side on the spine
// (Unity Catalog for data and AI assets, workspace ACLs for workspace objects), then the services.

el("rect", {x: -400, y: -400, width: W + 800, height: H + 800, fill: "#f7f3ec"}, Lbg);
el("rect", {x: -400, y: -400, width: W + 800, height: H + 800, fill: "url(#pDots)"}, Lbg);

const DBX = {x: 632, y: 24, w: 1524, h: 1650};
const SPINE = 1406, BUS = 734, CBUS = 1096, SBUS = 1370;

// ----- your Databricks account: the Databricks side, the main stage -----
const dbxZ = zone("dbx", DBX.x, DBX.y, DBX.w, DBX.h, "z-dbx", "", "", "tl", 30);
dbxZ.setAttribute("aria-label", "Your Databricks account");
use("mk-databricks", 656, 52, 44, dbxZ);
txt(714, 80, "YOUR DATABRICKS ACCOUNT", "zl", dbxZ);
txt(714, 110, "the Databricks side: the account console, the control plane, the serverless compute plane and default storage", "zs", dbxZ);
{
  // where it runs is a note inside the perimeter, never a frame around it: a neutral glyph of
  // three data-centre halls, and one line
  const g = el("g", {class: "zone z-note", ...zoneAttrs("region", "Runs on AWS, us-west-2")}, Lzone);
  const dc = el("g", {class: "dc", transform: "translate(1846,54)"}, g);
  [[0, 16, 26, 28], [30, 4, 30, 40], [64, 20, 24, 24]].forEach(([x, y, w, h]) => {
    el("rect", {x, y, width: w, height: h, rx: 3}, dc);
    for (let r = 0; r < Math.floor(h / 10); r++) for (let c = 0; c < Math.floor(w / 9); c++) el("rect", {x: x + 4 + c * 8, y: y + 5 + r * 9, width: 4, height: 4, class: "w"}, dc);
  });
  txt(2132, 90, "runs on AWS, us-west-2", "zs", g, {"text-anchor": "end"});
}

// the Databricks account, above every workspace
zone("account", 696, 154, 1420, 148, "z-acct", "ACCOUNT CONSOLE", "above every workspace · identities, federation policies, budgets, the metastore");
tile("metaacct", 720, 208, 210, 80, {icon: "dbx-unity-catalog", title: "Metastore", sub: "account object"});
tile("budgets", 950, 208, 290, 80, {glyph: (g) => { el("circle", {r: 13, fill: "none", stroke: "#506fa0", "stroke-width": 3.2}, g); el("path", {d: "M0-13a13 13 0 0 1 11.3 19.5L0 0z", fill: "#506fa0"}, g); }, title: "Budgets", sub: "serverless usage policies"});
tile("ids", 1260, 208, 300, 80, {icon: "dbx-enterprise-security", title: "Identities", sub: "users · SPs · groups · SCIM"});
tile("fed", 1580, 208, 290, 80, {glyph: (g) => { el("path", {d: "M0-14l12 4.5v8c0 8-5 13-12 16c-7-3-12-8-12-16v-8z", fill: "none", stroke: "#c98f1e", "stroke-width": 3.2, "stroke-linejoin": "round"}, g); el("path", {d: "M-5 1l4 4.5l7-8.5", fill: "none", stroke: "#c98f1e", "stroke-width": 3.2, "stroke-linecap": "round", "stroke-linejoin": "round"}, g); }, title: "Federation policies", sub: "one per deploy SP & env"});
tile("idp", 1890, 208, 202, 80, {cls: "dashed", title: "Identity provider", sub: "(SAML or OIDC)", sub2: "not connected here"});

// ----- the control plane -----
zone("control", 696, 322, 1420, 558, "z-plane", "CONTROL PLANE", "governs, does not run your computation");
tile("door", 1166, 384, 480, 80, {icon: "dbx-rest-api", title: "Web app & REST APIs", sub: "the front door · UI, CLI, SDK, Connect", step: "1"});
tile("auth", 1470, 500, 320, 80, {icon: "dbx-enterprise-security", title: "Identity & auth", sub: "authenticates every request", step: "2"});
tile("acl", 1470, 616, 320, 80, {icon: "dbx-workspace", title: "Workspace ACLs", sub: "authorize workspace objects", step: "3"});
tile("secrets", 720, 772, 290, 80, {glyph: (g) => { el("rect", {x: -11, y: -3, width: 22, height: 17, rx: 3, fill: "#506fa0"}, g); el("path", {d: "M-6-3v-5a6 6 0 0 1 12 0v5", fill: "none", stroke: "#506fa0", "stroke-width": 3.2}, g); el("circle", {cx: 0, cy: 5, r: 2.6, fill: "#fff"}, g); }, title: "Secrets", sub: "scopes · Unity Catalog secrets"});
tile("jobs", 1050, 772, 290, 80, {icon: "dbx-lakeflow-jobs", title: "Jobs", sub: "runs · schedules · run-as"});
tile("genie", 1472, 772, 290, 80, {icon: "dbx-genie", title: "Genie", sub: "question → SQL, as the asker"});
tile("one", 1802, 772, 290, 80, {icon: "dbx-genie-one", title: "Genie One", sub: "formerly Databricks One"});

// Unity Catalog: the metastore, its catalogs, the privileges it checks
{
  const x = 800, y = 500, w = 542, h = 196;
  const t = tile("uc", x, y, w, h, {icon: "dbx-unity-catalog", title: "Unity Catalog", sub: "authorizes data and AI assets · audits", ty: 30, face: "uc-face", step: "3"});
  ["llmops_dev", "llmops_acc", "llmops_prd", "course_ops"].forEach((n, i) => {
    const cx = x + 82 + i * 126, cy = y + 96, c = el("g", {class: "cat"}, t.g);
    el("path", {d: `M${cx - 24} ${cy}v22a24 7 0 0 0 48 0v-22`}, c);
    el("ellipse", {cx, cy, rx: 24, ry: 7, class: "top"}, c);
    txt(cx, cy + 52, n, "ts mono", t.g, {"text-anchor": "middle"});
  });
  txt(x + 20, y + 180, "USE CATALOG · USE SCHEMA · SELECT · MODIFY · EXECUTE", "ts mono", t.g);
}
// Unity Gateway: one model service, a per-user budget, a usage count
{
  const x = 1830, y = 500, w = 262, h = 196;
  const t = tile("gateway", x, y, w, h, {icon: "dbx-unity-ai-gateway", title: "Unity Gateway", sub: "model services", ty: 30});
  el("rect", {x: x + 14, y: y + 76, width: w - 28, height: 32, rx: 8, class: "chipk"}, t.g);
  txt(x + w / 2, y + 97, "course_ops.gateway.chat", "ts mono", t.g, {"text-anchor": "middle"});
  txt(x + 16, y + 134, "budget per user", "ts", t.g);
  el("rect", {x: x + 16, y: y + 142, width: w - 32, height: 8, rx: 4, fill: "#e4e9f2"}, t.g);
  t.meter = el("rect", {x: x + 16, y: y + 142, width: 70, height: 8, rx: 4, fill: "#506fa0"}, t.g);
  t.usage = txt(x + 16, y + 178, "usage: 128 calls today", "ts", t.g);
  t.calls = 128;
}

// ----- the serverless compute plane -----
zone("compute", 696, 930, 1420, 400, "z-plane", "SERVERLESS COMPUTE PLANE", "runs your computation");
tile("apps", 720, 986, 232, 80, {icon: "dbx-databricks-apps", is: 30, stack: true, title: "Databricks Apps", sub: "agent app · its own SP"});
tile("aisearch", 974, 986, 190, 80, {icon: "dbx-ai-search", is: 30, stack: true, title: "AI Search", sub: "was Vector Search"});
tile("lakebase", 1186, 986, 190, 80, {icon: "dbx-lakebase", is: 30, stack: true, title: "Lakebase", sub: "Postgres · pgvector"});
tile("serving", 1436, 986, 314, 80, {icon: "dbx-model-serving", title: "Model serving", sub: "foundation models"});
tile("zerobus", 1778, 986, 314, 80, {icon: "dbx-zerobus-ingest", title: "Zerobus ingest", sub: "trace spans → tables"});

// compute as racks: a driver that plans, four executor blades that light up
const RACK = {};
const rack = (id, x, title, icon) => {
  const y = 1128, w = 320, h = 182;
  const t = tile(id, x, y, w, h, {icon, is: 30, title, ty: 35});
  txt(x + w - 14, y + 35, "serverless", "ts", t.g, {"text-anchor": "end"});
  el("rect", {x: x + 12, y: y + 56, width: w - 24, height: h - 68, rx: 10, class: "cab"}, t.g);
  el("rect", {x: x + 20, y: y + 63, width: w - 40, height: 27, rx: 6, class: "drv"}, t.g);
  t.drv = txt(x + 30, y + 82, "driver · plans, splits into tasks", "drv-t", t.g);
  t.blades = [0, 1, 2, 3].map((i) => {
    const bx = x + 20 + i * 71.6, by = y + 97;
    const b = el("g", {class: "blade", ...zoneAttrs("exec", "Executors")}, t.g);
    el("rect", {x: bx, y: by, width: 65, height: 66, rx: 6}, b);
    el("circle", {cx: bx + 11, cy: by + 11, r: 3.6, class: "led"}, b);
    el("circle", {cx: bx + 22, cy: by + 11, r: 3.6, class: "led"}, b);
    for (let k = 0; k < 3; k++) el("line", {x1: bx + 10, y1: by + 25 + k * 8, x2: bx + 55, y2: by + 25 + k * 8, class: "vent"}, b);
    el("rect", {x: bx + 8, y: by + 51, width: 49, height: 7, rx: 3.5, class: "meter"}, b);
    const fill = el("rect", {x: bx + 8, y: by + 51, width: 0, height: 7, rx: 3.5, class: "fill"}, b);
    el("line", {x1: bx + 32.5, y1: y + h, x2: bx + 32.5, y2: SBUS, class: "rail r-rib"}, Lrail);
    return {el: b, fill, cx: bx + 32.5, n: 0};
  });
  RACK[id] = t;
  return t;
};
rack("wh", 760, "SQL warehouse", "dbx-sql-warehouse");
rack("nb", 1246, "Notebook compute", "dbx-notebooks");
rack("jc", 1732, "Job compute", "dbx-lakeflow-jobs");

// ----- storage -----
zone("storage", 696, 1400, 1420, 250, "z-store", "STORAGE", "in your Databricks account · no bucket of yours", "bl");
el("rect", {x: 750, y: SBUS - 12, width: 1312, height: 24, rx: 12, class: "r-ribbus"}, Lrail);
txt(1163, 1350, "parallel reads and writes", "rl", Lrail, {"text-anchor": "middle"});
const sbox = (id, x, w, label, head, icon) => {
  const g = el("g", zoneAttrs(id, label), Ltile);
  el("rect", {x, y: 1416, width: w, height: 196, rx: 14, class: "sbox face"}, g);
  use(icon, x + 14, 1583, 22, g);
  txt(x + 44, 1600, head, "ts", g).setAttribute("style", "font-weight:600");
  return g;
};
const sysBox = sbox("system", 720, 450, "System tables", "System tables · filled by Databricks, not in real time", "dbx-system-tables");
const defBox = sbox("default", 1190, 902, "Default storage", "Default storage · managed Delta tables and volumes, reached only by serverless compute", "dbx-delta-lake");
const TABLE = {};
const table = (key, cx, kind, l1, l2, parent, zid) => {
  const top = 1434, g = el("g", {class: kind === "sys" ? "sysc" : "", ...(zid ? zoneAttrs(zid, l1) : {})}, parent);
  if (kind === "folder") {
    el("path", {d: `M${cx - 46} ${top + 12}v72a6 6 0 0 0 6 6h80a6 6 0 0 0 6-6v-62a6 6 0 0 0-6-6h-38l-9-10h-33a6 6 0 0 0-6 6z`, class: "fold"}, g);
  } else {
    el("path", {d: `M${cx - 46} ${top + 12}v64a46 11 0 0 0 92 0v-64`, class: "cyl"}, g);
    el("ellipse", {cx, cy: top + 12, rx: 46, ry: 11, class: "cyl-top"}, g);
  }
  const slotx = [0, 1, 2, 3].map((i) => cx + (i - 1.5) * 19);
  const slots = slotx.map((sx) => {
    el("line", {x1: sx, y1: SBUS + 12, x2: sx, y2: top + (kind === "folder" ? 26 : 16), class: "rail r-rib"}, Lrail);
    return el("rect", {x: sx - 7, y: top + 32, width: 14, height: 36, rx: 3, class: "slot"}, g);
  });
  txt(cx, top + 109, l1, "tl mono", g);
  if (l2) txt(cx, top + 127, l2, "tl ts", g);
  TABLE[key] = {key, cx, top, slots, slotx, g, n: [0, 0, 0, 0]};
  J("tbl." + key, cx, top + 12); J("sb." + key, cx, SBUS);
};
table("audit", 795, "sys", "access.audit", "", sysBox);
table("billing", 945, "sys", "billing.usage", "", sysBox);
table("gwusage", 1095, "sys", "ai_gateway", ".usage", sysBox);
table("papers", 1269, "delta", "arxiv_papers", "", defBox, "tables");
table("chunks", 1393, "delta", "arxiv_chunks", "", defBox, "tables");
table("evals", 1517, "delta", "eval_results", "", defBox, "tables");
table("monitor", 1641, "delta", "course_ops", "monitoring", defBox, "tables");
table("traces", 1765, "delta", "trace tables", "your schema", defBox, "traces");
table("volume", 1889, "folder", "arxiv_files", "volume", defBox, "volume");
table("results", 2013, "folder", "results", "workspace storage", defBox, "wsstore");

// ----- your cloud account and your resources: two separate perimeters beside the Databricks
// account, outside it, dashed and empty -----
// The classic compute plane and the workspace storage bucket exist for classic workspaces only,
// and the course has no cloud account. Both perimeters start below the users' road to the front
// door, which passes neither, and no rail leads to them: no traffic of the course enters either.
const YOURS = {x: 2172, y: 480, w: 184, h: 620};
const RES = {x: 2172, y: 1132, w: 184, h: 346};
const ghostZ = zone("ghost", YOURS.x, YOURS.y, YOURS.w, YOURS.h, "z-ghost");
const resZ = zone("resources", RES.x, RES.y, RES.w, RES.h, "z-ghost z-res");
ghostZ.setAttribute("aria-label", "Your cloud account");
resZ.setAttribute("aria-label", "Your resources");
{
  const cx = YOURS.x + YOURS.w / 2;
  const lines = (g, y, rows, cls = "") => rows.forEach((s, i) => txt(cx, y + i * 22, s, cls, g, {"text-anchor": "middle"}));
  lines(ghostZ, 522, ["YOUR CLOUD", "ACCOUNT"], "gh-t");
  lines(ghostZ, 580, ["classic workspaces", "only; none in this", "course: express", "setup gives you", "no cloud account"]);
  // the classic compute plane: a rack that is not there
  el("rect", {x: cx - 45, y: 700, width: 90, height: 112, rx: 10, class: "gh-d"}, ghostZ);
  for (let i = 0; i < 4; i++) el("rect", {x: cx - 33, y: 712 + i * 24, width: 66, height: 16, rx: 4, class: "gh-d"}, ghostZ);
  lines(ghostZ, 842, ["classic compute", "plane, in your VPC"]);
  // the workspace storage bucket that is not there
  el("path", {d: `M${cx - 38} 916l9 78a29 9 0 0 0 58 0l9-78`, class: "gh-d"}, ghostZ);
  el("ellipse", {cx, cy: 916, rx: 38, ry: 11, class: "gh-d"}, ghostZ);
  lines(ghostZ, 1040, ["workspace storage", "bucket (S3)"]);
  // your resources: storage and data sources of your own, apart from both accounts
  lines(resZ, 1174, ["YOUR", "RESOURCES"], "gh-t");
  lines(resZ, 1232, ["optional; the", "course connects", "none"]);
  [-50, 50].forEach((dx) => {
    el("path", {d: `M${cx + dx - 20} 1324v40a20 6 0 0 0 40 0v-40`, class: "gh-d"}, resZ);
    el("ellipse", {cx: cx + dx, cy: 1324, rx: 20, ry: 6, class: "gh-d"}, resZ);
  });
  el("path", {d: `M${cx - 18} 1370v-58h36v58M${cx - 26} 1370h52M${cx - 8} 1326h16M${cx - 8} 1340h16M${cx - 8} 1354h16`, class: "gh-d"}, resZ);
  lines(resZ, 1412, ["external storage", "and data sources"]);
}

// ----- the developers -----
zone("devs", 30, 30, 540, 670, "z-devs", "DEVELOPERS", "their own laptops");
const P = {};
const SCREEN = {
  code: (g, c) => [[12, 14, 30, c], [18, 22, 44, "#9aa3b5"], [18, 30, 36, "#9aa3b5"], [24, 38, 28, "#3f9b6b"], [18, 46, 40, "#9aa3b5"], [12, 54, 22, c]].forEach(([x, y, w, col]) => el("rect", {x, y: y - 2, width: w, height: 4, rx: 2, fill: col}, g)),
  nb: (g, c) => { [12, 34].forEach((y) => el("rect", {x: 10, y, width: 80, height: 18, rx: 3, fill: "#fff", stroke: "#c6d1e6"}, g)); [[16, 19, 34, c], [16, 25, 50, "#9aa3b5"], [16, 41, 44, "#9aa3b5"], [16, 47, 26, "#3f9b6b"]].forEach(([x, y, w, col]) => el("rect", {x, y: y - 1.5, width: w, height: 3, rx: 1.5, fill: col}, g)); },
  chat: (g, c) => { el("rect", {x: 10, y: 12, width: 48, height: 16, rx: 8, fill: c}, g); el("rect", {x: 36, y: 34, width: 54, height: 20, rx: 8, fill: "#fff", stroke: "#c6d1e6"}, g); [[42, 41, 40], [42, 47, 28]].forEach(([x, y, w]) => el("rect", {x, y: y - 1.5, width: w, height: 3, rx: 1.5, fill: "#9aa3b5"}, g)); },
  chart: (g, c) => { [[14, 26], [30, 16], [46, 34], [62, 22], [78, 30]].forEach(([x, hh]) => el("rect", {x, y: 54 - hh, width: 10, height: hh, rx: 2, fill: c}, g)); el("rect", {x: 10, y: 54, width: 80, height: 2, fill: "#9aa3b5"}, g); },
  sql: (g, c) => { el("rect", {x: 10, y: 10, width: 80, height: 12, rx: 3, fill: c, opacity: 0.85}, g); for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) el("rect", {x: 10 + k * 28, y: 26 + r * 8, width: 24, height: 5, rx: 1.5, fill: r % 2 ? "#c6d1e6" : "#dfe7f4"}, g); },
};
// a person behind a desk with an open laptop: the base lies on the desk, the screen leans back and
// is turned half to the person and half to us, so both see what is on it
const vignette = (parent, x, y, s, flip, who, kind, colour) => {
  const outer = el("g", {transform: `translate(${x},${y}) scale(${s})`}, parent);
  const m = flip ? el("g", {transform: "translate(240,0) scale(-1,1)"}, outer) : outer;
  el("ellipse", {cx: 115, cy: 152, rx: 124, ry: 8, fill: "#1a1a1a", opacity: 0.07}, m);
  const head = personBust(el("g", {}, m), who);
  el("rect", {x: 8, y: 130, width: 9, height: 22, class: "desk-leg"}, m);
  el("rect", {x: 213, y: 130, width: 9, height: 22, class: "desk-leg"}, m);
  el("rect", {x: 6, y: 131, width: 218, height: 13, class: "desk-panel"}, m);
  el("polygon", {points: "18,84 212,84 236,124 -6,124", class: "desk-top"}, m);
  el("rect", {x: -6, y: 124, width: 242, height: 9, rx: 2, class: "desk-front"}, m);
  // the laptop's lead to the edge of the desk, where the rail to the laptop setup takes over
  if (!flip) el("line", {x1: 190, y1: 106, x2: 226, y2: 106, class: "lead"}, m);
  const glow = el("polygon", {points: "159,35 154,83 96,80 86,20", fill: "url(#gGlow)", class: "glow"}, m);
  el("ellipse", {cx: 164, cy: 112, rx: 44, ry: 9, fill: "#1a1a1a", opacity: 0.1}, m);
  el("polygon", {points: "124,100 166,123 166,127 124,104", class: "lap-side"}, m);
  el("polygon", {points: "166,123 196,106 196,110 166,127", class: "lap-side"}, m);
  el("polygon", {points: "124,100 166,123 196,106 154,83", class: "lap-base"}, m);
  const kb = el("g", {transform: "matrix(0.42,0.23,0.5,-0.2833,124,100)"}, m);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) el("rect", {x: 9 + c * 9.2, y: 26 + r * 9, width: 7, height: 6, rx: 1, class: "lap-key"}, kb);
  el("rect", {x: 38, y: 8, width: 24, height: 12, rx: 2, class: "lap-key"}, kb);
  personArms(el("g", {}, m), who);
  el("polygon", {points: "159,35 201,58 204,56 162,33", class: "lap-edge"}, m);
  el("polygon", {points: "154,83 196,106 201,58 159,35", class: "lap-lid"}, m);
  const scr = el("g", {transform: "matrix(0.42,0.23,-0.078,0.75,159,35)"}, m);
  el("rect", {x: 5, y: 5, width: 90, height: 54, rx: 3, class: "lap-scr"}, scr);
  SCREEN[kind](scr, colour);
  const flash = el("rect", {x: 5, y: 5, width: 90, height: 54, rx: 3, fill: "#fff", opacity: 0}, scr);
  // where the laptop's lead starts, in the world: the right corner of its base
  return {bust: head, glow, flash, px: Math.round(x + (flip ? 240 - 196 : 196) * s), py: Math.round(y + 106 * s)};
};
// each developer's laptop is wired to one small trunk that runs down into the "On each laptop" box
const DTRUNK = 300;
[["ada", "Ada", "feature/chunking", FAM.dev], ["bo", "Bo", "fix/eval-judge", "#c98f1e"], ["chen", "Chen", "feature/genie-tool", "#a8624f"]].forEach(([id, name, branch, col], i) => {
  const y = 76 + i * 138;
  const g = el("g", zoneAttrs("devs", name), Lppl);
  const v = vignette(g, 60, y + 16, 0.82, false, id, "code", col);
  txt(322, y + 52, name, "pn", g);
  const bw = branch.length * 8.75 + 22;
  el("rect", {x: 322, y: y + 66, width: bw, height: 28, rx: 14, class: "pill"}, g);
  el("circle", {cx: 336, cy: y + 80, r: 5, fill: col}, g);
  txt(348, y + 85, branch, "br mono", g);
  const st = txt(322, y + 120, "", "st", g);
  P[id] = {...v, name, branch, col, st, kind: "dev"};
  J("dv." + id, v.px, v.py); J("DT." + id, DTRUNK, v.py);
});
// the laptop setup: what every developer has, and what every one of their actions leaves through
{
  const g = el("g", {class: "zone z-lap", ...zoneAttrs("laptop", "On each laptop")}, Lzone);
  el("rect", {x: 40, y: 508, width: 520, height: 182, rx: 16, class: "zr"}, g);
  txt(56, 532, "ON EACH LAPTOP", "rl", g);
}
const glyphCode = (g) => { el("path", {d: "M-6-9l-9 9l9 9M6-9l9 9l-9 9", fill: "none", stroke: "#506fa0", "stroke-width": 3.4, "stroke-linecap": "round", "stroke-linejoin": "round"}, g); };
const glyphHook = (g) => { el("circle", {cx: 0, cy: 0, r: 13, fill: "none", stroke: "#c9705f", "stroke-width": 3.2}, g); el("path", {d: "M-6 0l4 5l8-10", fill: "none", stroke: "#c9705f", "stroke-width": 3.4, "stroke-linecap": "round", "stroke-linejoin": "round"}, g); };
tile("editor", 48, 544, 236, 54, {glyph: glyphCode, is: 30, title: "Editor", sub: "your code runs here", layer: Lppl});
tile("cli", 316, 544, 236, 54, {icon: "dbx-databricks-cli", is: 30, title: "CLI profile", sub: "OAuth U2M · auth login", layer: Lppl});
tile("precommit", 48, 610, 236, 54, {glyph: glyphHook, is: 30, title: "pre-commit", sub: "hooks on every commit", layer: Lppl});
tile("connect", 316, 610, 236, 54, {icon: "dbx-databricks-connect", is: 30, title: "Databricks Connect", sub: "Spark on dev compute", layer: Lppl});

// ----- GitHub, a cloud of its own -----
const ghZ = el("g", {class: "zone z-gh", ...zoneAttrs("github", "GitHub")}, Lzone);
{
  const parts = [["rect", {x: 36, y: 792, width: 528, height: 768, rx: 64}], ["circle", {cx: 130, cy: 812, r: 62}], ["circle", {cx: 238, cy: 790, r: 78}],
    ["circle", {cx: 368, cy: 794, r: 70}], ["circle", {cx: 478, cy: 816, r: 58}]];
  parts.forEach(([t, a]) => el(t, {...a, class: "gh-out"}, ghZ));
  parts.forEach(([t, a]) => el(t, {...a, class: "gh-in"}, ghZ));
  use("mk-github", 214, 778, 34, ghZ);
  txt(258, 805, "GitHub", "zl", ghZ).setAttribute("style", "letter-spacing:0");
  txt(352, 805, "SaaS · its own cloud", "zs", ghZ);
}
// the repository, with its history drawn as it happens
const repoT = tile("repo", 62, 834, 478, 186, {icon: "mk-github", is: 26, title: "course-code-hub", ty: 33});
txt(526, 867, "ruleset on main: review + green CI", "ts", repoT.g, {"text-anchor": "end"});
const glyphPr = (g) => { el("path", {d: "M-9-8v16M9 8v-9a6 6 0 0 0-6-6h-3", fill: "none", stroke: "#c9705f", "stroke-width": 3.2, "stroke-linecap": "round"}, g); [[-9, -10], [-9, 10], [9, 10]].forEach(([x, y]) => el("circle", {cx: x, cy: y, r: 4.4, fill: "#fff", stroke: "#c9705f", "stroke-width": 3}, g)); };
const glyphKey = (g, c = "#c98f1e") => { el("circle", {cx: -7, cy: 0, r: 7, fill: "none", stroke: c, "stroke-width": 3.6}, g); el("path", {d: "M0 0h15M10 0v6M15 0v4", fill: "none", stroke: c, "stroke-width": 3.6, "stroke-linecap": "round"}, g); };
tile("pr", 62, 1046, 224, 80, {glyph: glyphPr, title: "Pull request", sub: "review · approve"});
tile("ci", 316, 1046, 224, 80, {icon: "mk-githubactions", title: "Actions CI", sub: "pre-commit · pytest"});
// Actions CD as the pipeline it is: acc, the approval gate, prd
const CD = {};
{
  const t = tile("cd", 62, 1152, 478, 100, {icon: "mk-githubactions", is: 30, title: "Actions CD", ty: 34});
  txt(526, 1186, "on a merge to main", "ts", t.g, {"text-anchor": "end"});
  [["acc", "deploy acc", 76, 132], ["gate", "approval", 232, 118], ["prd", "deploy prd", 374, 152]].forEach(([k, label, dx, w], i) => {
    const r = el("rect", {x: dx, y: 1206, width: w, height: 32, rx: 16, fill: "#f4f2ee", stroke: "#d9d6d1", "stroke-width": 1.5}, t.g);
    const tx = txt(dx + w / 2, 1227, label, "ts", t.g, {"text-anchor": "middle"});
    if (i) el("path", {d: `M${dx - 19} 1222h12m-5-5l5 5l-5 5`, fill: "none", stroke: "#9a9a9a", "stroke-width": 2, "stroke-linecap": "round"}, t.g);
    CD[k] = {r, tx, label};
  });
}
tile("issuer", 62, 1276, 478, 70, {glyph: (g) => glyphKey(g), is: 34, title: "OIDC issuer", sub: "token.actions.githubusercontent.com", mono: true});
const ENV = {};
{
  const t = tile("envs", 62, 1370, 478, 150, {title: "Environments", sub: "each holds DATABRICKS_CLIENT_ID, no secret", ty: 30});
  ["dev", "acc", "prd"].forEach((e, i) => {
    const y = 1442 + i * 26;
    const r = el("rect", {x: 74, y: y - 18, width: 454, height: 24, rx: 6, fill: "none"}, t.g);
    txt(84, y, e, "ts mono", t.g).setAttribute("style", "font-weight:600");
    txt(128, y, "sp-deploy-arxiv-" + e, "ts mono", t.g);
    if (e === "prd") txt(520, y, "approval: a setting", "ts", t.g, {"text-anchor": "end"});
    ENV[e] = r;
  });
}

// ----- the platform users -----
zone("users", 2420, 24, 560, 1642, "z-devs z-users", "PLATFORM USERS", "their browsers");
const WIN = {
  nb: (g, x, y) => { el("rect", {x: x + 14, y: y + 46, width: 228, height: 50, rx: 6, fill: "#f7f6f3", stroke: "#e2dfd9"}, g); use("mk-python", x + 22, y + 54, 20, g); [[52, 62, 120, "ui-a"], [52, 74, 160, "ui-l"], [52, 86, 96, "ui-l"]].forEach(([dx, dy, w, c]) => el("line", {x1: x + dx, y1: y + dy, x2: x + dx + w, y2: y + dy, class: c}, g)); el("rect", {x: x + 14, y: y + 104, width: 228, height: 34, rx: 6, fill: "#fff", stroke: "#e2dfd9"}, g); [[24, 116, 150], [24, 128, 100]].forEach(([dx, dy, w]) => el("line", {x1: x + dx, y1: y + dy, x2: x + dx + w, y2: y + dy, class: "ui-l"}, g)); },
  genie: (g, x, y) => { el("rect", {x: x + 70, y: y + 46, width: 172, height: 34, rx: 14, class: "ui-b"}, g); [[84, 58, 130], [84, 70, 86]].forEach(([dx, dy, w]) => el("line", {x1: x + dx, y1: y + dy, x2: x + dx + w, y2: y + dy, class: "ui-a"}, g)); el("rect", {x: x + 14, y: y + 88, width: 196, height: 50, rx: 12, fill: "#f7f6f3", stroke: "#e2dfd9"}, g); [[30, 46], [58, 30], [86, 38], [114, 22]].forEach(([dx, hh]) => el("rect", {x: x + dx, y: y + 130 - hh * 0.7, width: 18, height: hh * 0.7, rx: 2, fill: "#6b5fb0", opacity: 0.75}, g)); el("path", {d: `M${x + 186} ${y + 100}l3 7l7 3l-7 3l-3 7l-3-7l-7-3l7-3z`, fill: "#d9a441"}, g); },
  sql: (g, x, y) => { el("rect", {x: x + 14, y: y + 46, width: 228, height: 40, rx: 6, fill: "#f7f6f3", stroke: "#e2dfd9"}, g); [[24, 58, 60, "ui-a"], [92, 58, 110, "ui-l"], [24, 72, 150, "ui-l"]].forEach(([dx, dy, w, c]) => el("line", {x1: x + dx, y1: y + dy, x2: x + dx + w, y2: y + dy, class: c}, g)); for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) el("rect", {x: x + 14 + c * 58, y: y + 94 + r * 15, width: 54, height: 11, rx: 2, fill: r ? "#f1efeb" : "#e9e6f6"}, g); },
  chat: (g, x, y) => { el("rect", {x: x + 90, y: y + 46, width: 152, height: 28, rx: 14, class: "ui-b"}, g); el("line", {x1: x + 106, y1: y + 60, x2: x + 222, y2: y + 60, class: "ui-a"}, g); el("rect", {x: x + 14, y: y + 82, width: 190, height: 56, rx: 14, fill: "#f7f6f3", stroke: "#e2dfd9"}, g); [[28, 98, 150], [28, 110, 160], [28, 122, 96]].forEach(([dx, dy, w]) => el("line", {x1: x + dx, y1: y + dy, x2: x + dx + w, y2: y + dy, class: "ui-l"}, g)); },
  dash: (g, x, y) => { [[14, 108], [128, 114]].forEach(([dx, w]) => el("rect", {x: x + dx, y: y + 46, width: w, height: 92, rx: 6, fill: "#f7f6f3", stroke: "#e2dfd9"}, g)); [[24, 40], [44, 62], [64, 30], [84, 52], [102, 70]].forEach(([dx, hh]) => el("rect", {x: x + dx, y: y + 130 - hh, width: 13, height: hh, rx: 2, fill: "#6b5fb0", opacity: 0.75}, g)); el("path", {d: `M${x + 138} ${y + 120}l24-30l22 14l28-40l22 18`, fill: "none", stroke: "#3f9b6b", "stroke-width": 4, "stroke-linecap": "round", "stroke-linejoin": "round"}, g); },
};
[["dana", "Dana", "data scientist", "Notebook · Python", "dbx-notebooks", "nb"],
 ["eli", "Eli", "analyst", "Genie · asks in plain language", "dbx-genie", "genie"],
 ["fay", "Fay", "manager", "SQL editor · dashboards", "dbx-sql-warehouse", "sql"],
 ["gus", "Gus", "colleague", "The course's agent app", "dbx-databricks-apps", "chat"],
 ["tess", "Tess", "teacher", "Course dashboard", "dbx-genie-one", "dash"]].forEach(([id, name, role, tool, icon, kind], i) => {
  const y = 60 + i * 314, x = 2444;
  const g = el("g", zoneAttrs("u." + id, name), Lppl);
  txt(x, y + 54, name, "pn", g);
  txt(x + name.length * 13 + 14, y + 54, role, "pr", g);
  const st = txt(x, y + 82, "", "st", g);
  const wy = y + 104;
  el("rect", {x: x + 2, y: wy + 5, width: 252, height: 150, rx: 12, class: "sh1"}, g);
  const face = el("rect", {x, y: wy, width: 256, height: 150, rx: 12, class: "win face"}, g);
  el("path", {d: `M${x} ${wy + 36}v-24a12 12 0 0 1 12-12h232a12 12 0 0 1 12 12v24z`, class: "win-bar"}, g);
  use(icon, x + 10, wy + 6, 24, g);
  txt(x + 42, wy + 24, tool, "win-t", g);
  WIN[kind](g, x, wy);
  const v = vignette(g, 2712, y + 96, 1.08, true, id, kind === "genie" ? "chat" : kind === "dash" ? "chart" : kind, FAM.user);
  P[id] = {...v, name, st, kind: "user"};
  T[id] = {id, x, y: wy, w: 256, h: 150, g, face, cx: x + 128, cy: wy + 75, ports: []};
  port(id, id + ".L", x, wy + 91);
  J("Rg." + id, 2389, wy + 91);
});

// ---------- the rails: a handful of trunks, with short stubs to the tiles ----------
// developers -> their laptop setup: a short stub from each laptop into one small trunk, which runs
// down the middle of the box; the four tools hang off it
["ada", "bo", "chen"].forEach((d) => rail("stub", "dv." + d, "DT." + d));
J("LB1", DTRUNK, 571); J("LB2", DTRUNK, 637); J("LB3", DTRUNK, 678); J("LB4", 168, 678);
rail("lane", "DT.ada", "DT.bo", "DT.chen", "LB1", "LB2", "LB3", "LB4");
port("editor", "editor.R", 284, 571); port("cli", "cli.L", 316, 571); port("precommit", "precommit.R", 284, 637); port("connect", "connect.L", 316, 637);
rail("stub", "LB1", "editor.R"); rail("stub", "LB1", "cli.L"); rail("stub", "LB2", "precommit.R"); rail("stub", "LB2", "connect.L");
// the laptop setup -> GitHub: a commit leaves through pre-commit; a review or an approval is a click
// in the browser, so it passes the tools and leaves by the same way down
port("precommit", "precommit.B", 168, 664); rail("stub", "precommit.B", "LB4");
J("G0", 168, 818); port("repo", "repo.T", 168, 834);
rail("trunk", "LB4", "G0"); rail("stub", "G0", "repo.T");
J("GL0", 46, 818); J("GLpr", 46, 1086); port("pr", "pr.L", 62, 1086); J("GLcd", 46, 1202); port("cd", "cd.L", 62, 1202);
rail("lane", "G0", "GL0", "GLpr", "GLcd"); rail("stub", "GLpr", "pr.L"); rail("stub", "GLcd", "cd.L");
port("repo", "repo.B1", 174, 1020); port("pr", "pr.T", 174, 1046); rail("stub", "repo.B1", "pr.T");
port("pr", "pr.R", 286, 1086); port("ci", "ci.L", 316, 1086); rail("stub", "pr.R", "ci.L");
port("repo", "repo.R", 540, 927); J("GR1", 554, 927); J("GR2", 554, 1139); J("GR3", 428, 1139); port("cd", "cd.T", 428, 1152);
rail("lane", "repo.R", "GR1", "GR2", "GR3"); rail("stub", "GR3", "cd.T");
port("cd", "cd.B", 301, 1252); port("issuer", "issuer.T", 301, 1276); rail("stub", "cd.B", "issuer.T");
// the laptop setup and GitHub -> the front door (from the left): a sign-in leaves through the CLI
// profile, Spark through Databricks Connect
port("cli", "cli.R", 552, 571); port("connect", "connect.R", 552, 637); port("cd", "cd.R", 540, 1202);
J("Lg.cli", 606, 571); J("Lg.con", 606, 637); J("Lg.cd", 606, 1202); J("Lg0", 606, 424);
rail("stub", "cli.R", "Lg.cli"); rail("stub", "connect.R", "Lg.con"); rail("stub", "cd.R", "Lg.cd");
port("door", "door.L", 1166, 424); port("door", "door.R", 1646, 424); port("door", "door.B", SPINE, 464);
rail("trunk", "Lg.cd", "Lg.con", "Lg.cli", "Lg0", "door.L");
// the users' column -> the front door (from the right)
J("Rg0", 2389, 424);
rail("trunk", "Rg.dana", "Rg0", "Rg.eli", "Rg.fay", "Rg.gus", "Rg.tess"); rail("trunk", "Rg0", "door.R");
["dana", "eli", "fay", "gus", "tess"].forEach((u) => rail("stub", u + ".L", "Rg." + u));
// the spine of the control plane: front door, identity and auth, then the two authorizers
J("S1", SPINE, 540); port("auth", "auth.L", 1470, 540); J("S2", SPINE, 656); port("uc", "uc.R", 1342, 656); port("acl", "acl.L", 1470, 656); J("S3", SPINE, BUS);
rail("trunk", "door.B", "S1", "S2", "S3"); rail("stub", "S1", "auth.L"); rail("stub", "S2", "uc.R"); rail("stub", "S2", "acl.L");
J("B.sec", 865, BUS); J("B.jobs", 1195, BUS); J("B.genie", 1617, BUS); J("B.gw", 1947, BUS);
rail("lane", "B.sec", "B.jobs", "S3", "B.genie", "B.gw");
port("secrets", "secrets.T", 865, 772); port("jobs", "jobs.T", 1195, 772); port("genie", "genie.T", 1617, 772); port("one", "one.T", 1947, 772); port("gateway", "gateway.B", 1947, 696);
rail("stub", "B.sec", "secrets.T"); rail("stub", "B.jobs", "jobs.T"); rail("stub", "B.genie", "genie.T"); rail("stub", "B.gw", "one.T"); rail("stub", "B.gw", "gateway.B");
// the cloud backbone: control plane -> compute plane
J("C0", SPINE, CBUS); rail("trunk", "S3", "C0");
[["apps", 836], ["aisearch", 1069], ["lakebase", 1281], ["serving", 1593], ["zerobus", 1935]].forEach(([t, x]) => { J("C." + t, x, CBUS); port(t, t + ".B", x, 1066); rail("stub", "C." + t, t + ".B"); });
[["wh", 920], ["nb", SPINE], ["jc", 1892]].forEach(([t, x]) => { if (t !== "nb") J("C." + t, x, CBUS); port(t, t + ".T", x, 1128); rail("stub", t === "nb" ? "C0" : "C." + t, t + ".T"); });
J("C.link", 1649, CBUS);
rail("lane", "C.apps", "C.wh", "C.aisearch", "C.lakebase", "C0", "C.serving", "C.link", "C.jc", "C.zerobus");
// a managed service writing straight to storage (Zerobus): down between the racks to the storage trunk
J("SL", 1649, SBUS); rail("stub", "C.link", "SL");
{
  const xs = Object.values(TABLE).map((t) => ["sb." + t.key, t.cx]).concat([["SL", 1649]]).sort((a, b) => a[1] - b[1]).map((a) => a[0]);
  rail("rib", ...xs);
  Object.values(TABLE).forEach((t) => rail("rib", "sb." + t.key, "tbl." + t.key));
}
// the audit log: from Unity Catalog down the edge of Databricks to the system tables
J("uc.L", 800, 598); J("A1", 682, 598); J("A2", 682, 1486); J("sys.L", 720, 1486);
rail("audit", "uc.L", "A1", "A2", "sys.L");

// draw the rails: trunks as pipes, lanes and stubs thinner, junction dots where three meet
{
  const seg = (e, cls) => el("line", {x1: NODE[e.a].x, y1: NODE[e.a].y, x2: NODE[e.b].x, y2: NODE[e.b].y, class: "rail " + cls}, Lrail);
  EDGES.filter((e) => e.kind === "audit").forEach((e) => seg(e, "r-audit"));
  EDGES.filter((e) => e.kind === "stub").forEach((e) => seg(e, "r-stub"));
  EDGES.filter((e) => e.kind === "lane").forEach((e) => seg(e, "r-lane"));
  EDGES.filter((e) => e.kind === "trunk").forEach((e) => seg(e, "r-trunk"));
  EDGES.filter((e) => e.kind === "lane").forEach((e) => seg(e, "r-lane-c"));
  EDGES.filter((e) => e.kind === "trunk").forEach((e) => seg(e, "r-trunk-c"));
  const deg = {};
  EDGES.filter((e) => e.kind !== "rib" && e.kind !== "audit").forEach((e) => { deg[e.a] = (deg[e.a] || 0) + 1; deg[e.b] = (deg[e.b] || 0) + 1; });
  for (const n in deg) if (deg[n] >= 3) el("circle", {cx: NODE[n].x, cy: NODE[n].y, r: 6.5, class: "jn"}, Lrail);
  // the trunks are named where they run
  txt(184, 742, "git push · reviews", "rl", Lrail);
  txt(598, 1010, "HTTPS · over the internet", "rl", Lrail, {transform: "rotate(-90 598 1010)", "text-anchor": "middle"});
  txt(2381, 900, "HTTPS · over the internet", "rl", Lrail, {transform: "rotate(-90 2381 900)", "text-anchor": "middle"});
  txt(1424, 912, "cloud backbone · never the public internet", "rl", Lrail);
  txt(674, 1050, "audit log → system.access.audit · arrives later, not in real time", "rl", Lrail, {transform: "rotate(-90 674 1050)", "text-anchor": "middle"});
  // gates where the two trunks cross the border of your Databricks account, the only border the
  // course's traffic crosses: users and applications come in from outside
  var GATES = [[DBX.x, 424], [DBX.x + DBX.w, 424]].map(([x, y]) => {
    const g = el("g", {class: "gate gate-dbx"}, Lrail), hw = 8, hh = 24;
    el("rect", {x: x - hw, y: y - hh, width: hw * 2, height: hh * 2, rx: hw}, g);
    return {x, y, g};
  });
}
