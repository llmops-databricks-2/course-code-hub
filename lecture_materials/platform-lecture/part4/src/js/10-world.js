// ---------- the drawing ----------
// The ground says where a part runs, as in Databricks' own architecture picture
// (https://docs.databricks.com/aws/en/getting-started/high-level-architecture). Outside, on the
// warm page: the developer, GitHub and the platform users. Your Databricks account: one perimeter
// that holds the control plane, the serverless compute plane and default storage. Under it,
// outside it, dashed and empty: your cloud account and your resources, which a serverless
// workspace does not have. No cloud-provider frame wraps the Databricks account.
//
// Inside the account the planes are rows and the environments are columns. The control plane's
// tiles stand in the order every request meets them: (1) the front door, (2) identity and auth,
// (3) the two authorizers, Unity Catalog for data and AI assets and workspace ACLs for workspace
// objects. Under them, each environment holds a dashboard (a workspace object), its grants (Unity
// Catalog's privileges), a SQL warehouse (serverless compute) and its tables (default storage):
// top to bottom is the order a request touches them.
//
// buildWorld(n, H) draws the world of scene n for a stage H units high and returns its geometry.

let L = {};

const mkDefs = () => {
  const defs = el("defs", {}, svg);
  const grad = (id, stops, x2 = 0, y2 = 1) => {
    const g = el("linearGradient", {id, x1: 0, y1: 0, x2, y2}, defs);
    stops.forEach(([o, c, a]) => el("stop", {offset: o, "stop-color": c, ...(a == null ? {} : {"stop-opacity": a})}, g));
  };
  grad("gTile", [[0, "#ffffff"], [1, "#faf9f6"]]);
  grad("gCab", [[0, "#333a4b"], [1, "#262b38"]]);
  grad("gCyl", [[0, "#dcebe3"], [0.5, "#f4faf6"], [1, "#cfe1d8"]], 1, 0);
  grad("gDesk", [[0, "#f3e9d6"], [1, "#e6d8bd"]]);
  grad("gScr", [[0, "#fafdff"], [1, "#dbe7fa"]]);
  const fire = el("linearGradient", {id: "gFire", x1: 0, y1: 1, x2: 0, y2: 0}, defs);
  [[0, "#ffc93c"], [0.45, "#f58a1f"], [1, "#dd3f2a"]].forEach(([o, c]) => el("stop", {offset: o, "stop-color": c}, fire));
  const glow = el("linearGradient", {id: "gGlow", x1: 1, y1: 0, x2: 0, y2: 0}, defs);
  el("stop", {offset: 0, "stop-color": "#bcd6ff", "stop-opacity": 0.8}, glow);
  el("stop", {offset: 1, "stop-color": "#bcd6ff", "stop-opacity": 0}, glow);
  const p = el("pattern", {id: "pDots", width: 22, height: 22, patternUnits: "userSpaceOnUse"}, defs);
  el("circle", {cx: 2, cy: 2, r: 1, fill: "#8a7556", opacity: 0.16}, p);
};

// a white card with depth, an icon plate, a title, a step badge
const tile = (x, y, w, h, o = {}) => {
  const g = el("g", {class: "tile " + (o.cls || "")}, o.layer || L.tile);
  el("rect", {x: x + 1, y: y + 3, width: w - 2, height: h, rx: 11, class: "sh1"}, g);
  const face = el("rect", {x, y, width: w, height: h, rx: 10, class: "face"}, g);
  const is = o.is || 24, pl = is + 8;
  let tx = x + 12;
  const py = o.top != null ? y + o.top : y + (h - pl) / 2;
  if (o.icon || o.glyph) {
    el("rect", {x: x + 6, y: py, width: pl, height: pl, rx: 8, class: "plate"}, g);
    if (o.icon) use(o.icon, x + 10, py + 4, is, g);
    else o.glyph(el("g", {transform: `translate(${x + 6 + pl / 2},${py + pl / 2}) scale(${is / 40})`}, g));
    tx = x + 6 + pl + 9;
  }
  const ty = o.top != null ? py + pl / 2 + 6 : y + h / 2 + 6;
  const title = o.title ? txt(tx, ty, o.title, "tt", g) : null;
  if (o.step) {
    const b = el("g", {class: "stepb"}, g);
    el("circle", {cx: x + 3, cy: y + 3, r: 12}, b);
    txt(x + 3, y + 8.8, o.step, "", b);
  }
  return {g, face, title, x, y, w, h, tx, cx: x + w / 2, cy: y + h / 2};
};

const glyphPr = (g) => { el("path", {d: "M-9-8v16M9 8v-9a6 6 0 0 0-6-6h-3", fill: "none", stroke: "#c9705f", "stroke-width": 3.2, "stroke-linecap": "round"}, g); [[-9, -10], [-9, 10], [9, 10]].forEach(([x, y]) => el("circle", {cx: x, cy: y, r: 4.4, fill: "#fff", stroke: "#c9705f", "stroke-width": 3}, g)); };
const keyGlyph = (g, c, s = 1) => { const k = el("g", {transform: `scale(${s})`}, g); el("circle", {cx: -6, cy: 0, r: 5, fill: "none", stroke: c, "stroke-width": 2.8}, k); el("path", {d: "M-1 0h12M7 0v4.5M11 0v3.5", fill: "none", stroke: c, "stroke-width": 2.8, "stroke-linecap": "round"}, k); return k; };
// a small state disc: a tick or a cross on a colour
const mark = (parent, cx, cy, ok, r = 9) => {
  const g = el("g", {transform: `translate(${cx},${cy})`}, parent), inner = el("g", {}, g);
  el("circle", {r, fill: ok ? FAM.ok : FAM.no, stroke: "#fff", "stroke-width": 1.5}, inner);
  el("path", {d: ok ? "M-4 0l2.8 3.3l5.4-6.6" : "M-3.5-3.5l7 7M3.5-3.5l-7 7", fill: "none", stroke: "#fff", "stroke-width": 2.4, "stroke-linecap": "round", "stroke-linejoin": "round"}, inner);
  return inner;
};
// a spinner: three quarters of a ring, turned by the scene clock
const spinner = (parent, cx, cy, r = 8, col = FAM.token) => {
  const g = el("g", {transform: `translate(${cx},${cy})`}, parent), inner = el("g", {}, g);
  el("circle", {r, fill: "none", stroke: "#e6e3de", "stroke-width": 3}, inner);
  el("path", {d: `M0 ${-r}A${r} ${r} 0 1 1 ${-r} 0`, fill: "none", stroke: col, "stroke-width": 3, "stroke-linecap": "round"}, inner);
  return inner;
};

// ----- the four things an environment holds -----
const FLAME = "M0 0C-14 0-15-14-8-22C-6-16-3-16-2-20C-1-30 3-34 2-40C10-32 15-20 13-10C12-3 7 0 0 0Z";
const dashboard = (x, y, w, h, parent) => {
  const g = el("g", {}, parent);
  el("rect", {x: x + 1, y: y + 3, width: w - 2, height: h, rx: 9, class: "sh1"}, g);
  const face = el("rect", {x, y, width: w, height: h, rx: 8, class: "face"}, g);
  use("dbx-genie-one", x + 8, y + 6, 20, g);
  txt(x + 33, y + 22, "Dashboard", "tt", g);
  [[x + 10, y + 34, 76], [x + 10, y + 44, 52]].forEach(([lx, ly, lw]) => { if (ly < y + h - 6) el("line", {x1: lx, y1: ly, x2: lx + lw, y2: ly, class: "ui-l"}, g); });
  const bx = x + w - 78, by = y + h - 8, bh = h - 34;
  const bars = [0.5, 0.78, 0.38, 0.64, 0.92].map((f, i) => el("rect", {x: bx + i * 14, y: by - Math.max(6, bh * f), width: 10, height: Math.max(6, bh * f), rx: 2, class: "dbar"}, g));
  el("line", {x1: bx - 4, y1: by, x2: bx + 70, y2: by, class: "axis"}, g);
  // the better version: a rising line over the bars, drawn when the change lands
  const tp = [[bx - 2, by - bh * 0.3 - 4], [bx + 19, by - bh * 0.62 - 4], [bx + 33, by - bh * 0.5 - 4], [bx + 66, by - bh - 5]];
  const trend = el("path", {d: polyD(tp), class: "trend", "stroke-dasharray": 140, "stroke-dashoffset": 140}, g);
  const star = el("path", {d: "M0-9l2.4 6.6l6.6 2.4l-6.6 2.4l-2.4 6.6l-2.4-6.6l-6.6-2.4l6.6-2.4z", fill: FAM.token, transform: `translate(${bx + 66},${by - bh - 5})`, opacity: 0}, g);
  // broken: a pink face, a crack, no data
  const broken = el("g", {opacity: 0}, g);
  el("rect", {x, y, width: w, height: h, rx: 8, class: "face-no"}, broken);
  use("dbx-genie-one", x + 8, y + 6, 20, broken, {opacity: 0.45});
  txt(x + 33, y + 22, "Dashboard", "tt no", broken);
  el("path", {d: `M${x + w * 0.52} ${y}l-9 ${h * 0.3}l12 ${h * 0.16}l-10 ${h * 0.24}l8 ${h * 0.3}`, class: "crack"}, broken);
  txt(x + w - 12, y + h - 10, "no data", "ts no", broken, {"text-anchor": "end"});
  return {g, face, bars, by, trend, star, broken, x, y, w, h, cx: x + w / 2, cy: y + h / 2};
};
const grant = (x, y, w, h, verb, who, parent) => {
  const g = el("g", {}, parent), ok = el("g", {}, g), no = el("g", {opacity: 0}, g);
  const face = el("rect", {x, y, width: w, height: h, rx: h / 2, class: "gr"}, ok);
  keyGlyph(el("g", {transform: `translate(${x + 20},${y + h / 2})`}, ok), "#c98f1e");
  const t = txt(x + 38, y + h / 2 + 5.5, verb, "mono b", ok);
  el("tspan", {class: "ts sans", dx: 7}, t).textContent = who;
  el("rect", {x, y, width: w, height: h, rx: h / 2, class: "gr gr-no"}, no);
  keyGlyph(el("g", {transform: `translate(${x + 20},${y + h / 2})`}, no), "#d64545");
  el("path", {d: `M${x + 9} ${y + h - 7}L${x + 33} ${y + 7}`, stroke: "#d64545", "stroke-width": 2.6, "stroke-linecap": "round"}, no);
  txt(x + 38, y + h / 2 + 5.5, "REVOKED", "mono b no", no);
  return {g, ok, no, face, x, y, w, h, cx: x + w / 2, cy: y + h / 2};
};
const rack = (x, y, w, h, title, icon, parent) => {
  const g = el("g", {}, parent);
  el("rect", {x: x + 1, y: y + 3, width: w - 2, height: h, rx: 9, class: "sh1"}, g);
  const face = el("rect", {x, y, width: w, height: h, rx: 8, class: "face"}, g);
  use(icon, x + 8, y + 5, 20, g);
  txt(x + 33, y + 21.5, title, "tt", g);
  const cy0 = y + 28, ch = h - 34;
  el("rect", {x: x + 8, y: cy0, width: w - 16, height: ch, rx: 6, class: "cab"}, g);
  const bw = (w - 16 - 8 - 3 * 5) / 4;
  const blades = [0, 1, 2, 3].map((i) => {
    const bx = x + 12 + i * (bw + 5);
    const b = el("rect", {x: bx, y: cy0 + 4, width: bw, height: ch - 8, rx: 3, class: "blade"}, g);
    const led = el("circle", {cx: bx + 8, cy: cy0 + ch / 2, r: 3, class: "led"}, g);
    const lit = el("circle", {cx: bx + 8, cy: cy0 + ch / 2, r: 3, fill: "#7be0a4", opacity: 0}, g);
    el("line", {x1: bx + 16, y1: cy0 + ch / 2, x2: bx + bw - 5, y2: cy0 + ch / 2, class: "vent"}, g);
    return {b, led, lit};
  });
  // burnt: a dark wash, smoke that rises, and flames standing on the cabinet's floor
  const char = el("rect", {x, y, width: w, height: h, rx: 8, fill: "#2a2320", opacity: 0}, g);
  const smoke = [0, 1, 2].map((i) => el("circle", {cx: x + w * (0.25 + i * 0.25), cy: y + 8, r: 7 + i * 2, fill: "#6f6a66", opacity: 0}, g));
  const fire = el("g", {opacity: 0}, g);
  const fy = y + h - 4, fs = ((h + 2) / 40) * 0.86;
  const flames = [0.16, 0.4, 0.63, 0.86].map((f, i) => {
    const fx = x + w * f, s = fs * (i % 2 ? 0.82 : 1);
    const fg = el("g", {transform: `translate(${fx},${fy})`}, fire), inner = el("g", {}, fg);
    el("path", {d: FLAME, fill: "url(#gFire)", transform: `scale(${s})`}, inner);
    el("path", {d: FLAME, fill: "#ffe58a", transform: `translate(1,-1) scale(${s * 0.5})`}, inner);
    return inner;
  });
  return {g, face, blades, char, smoke, fire, flames, x, y, w, h, cx: x + w / 2, cy: y + h / 2};
};
const tables = (x, y, w, h, label, parent) => {
  const g = el("g", {}, parent), cw = 46, gap = 14, x0 = x + (w - 3 * cw - 2 * gap) / 2;
  const cyls = [0, 1, 2].map((i) => {
    const cx = x0 + cw / 2 + i * (cw + gap), top = y + 7;
    const d = `M${cx - cw / 2} ${top}v${h - 14}a${cw / 2} 7 0 0 0 ${cw} 0v${-(h - 14)}`;
    const ghost = el("g", {opacity: 0}, g);
    el("path", {d: d + `a${cw / 2} 7 0 0 0 ${-cw} 0`, class: "cyl-ghost"}, ghost);
    const c = el("g", {}, g), inner = el("g", {}, c);
    el("path", {d, class: "cyl"}, inner);
    el("ellipse", {cx, cy: top, rx: cw / 2, ry: 7, class: "cyl-top"}, inner);
    const rows = [0.42, 0.68].map((f) => el("path", {d: `M${cx - cw / 2} ${top + (h - 14) * f}a${cw / 2} 7 0 0 0 ${cw} 0`, class: "cyl-row"}, inner));
    const hit = el("ellipse", {cx, cy: top, rx: cw / 2, ry: 7, fill: "#bfe6cf", stroke: FAM.ok, "stroke-width": 1.5, opacity: 0}, inner);
    const puffs = [[-16, -6], [0, -14], [16, -6], [-10, 10], [12, 10]].map(([dx, dy]) => el("circle", {cx: cx + dx * 0.4, cy: y + h / 2 + dy * 0.4, r: 5, fill: "#b9b4ab", opacity: 0}, g));
    return {inner, ghost, hit, rows, puffs, cx, cy: y + h / 2};
  });
  const name = txt(x + w / 2, y + h + 19, label, "mono", g, {"text-anchor": "middle"});
  const gone = txt(x + w / 2, y + h + 19, "dropped", "mono b no", g, {"text-anchor": "middle", opacity: 0});
  return {g, cyls, name, gone, x, y, w, h, cx: x + w / 2, cy: y + h / 2};
};

function buildWorld(n, H) {
  svg.replaceChildren();
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  mkDefs();
  ["bg", "zone", "rail", "tile", "ppl", "pk", "fx", "top"].forEach((k) => (L[k] = el("g", {}, svg)));
  el("rect", {x: -1200, y: -1200, width: W + 2400, height: H + 2400, fill: "#f7f3ec"}, L.bg);
  el("rect", {x: -1200, y: -1200, width: W + 2400, height: H + 2400, fill: "url(#pDots)"}, L.bg);
  const G = {n, H, RAIL_Y: 77, BUS: 150};

  // ----- the account, its planes and what is not there -----
  const accB = H - 54;
  const free = H - 413 - 150;
  const hD = 58 + free * 0.34, hR = 52 + free * 0.28, hC = 36 + free * 0.2, gap = 2 + free * 0.09;
  const acc = el("g", {class: "zone z-dbx"}, L.zone);
  G.accR = el("rect", {x: 300, y: 10, width: 680, height: accB - 10, rx: 18, class: "zr"}, acc);
  use("mk-databricks", 313, 17, 21, acc);
  txt(342, 35, "YOUR DATABRICKS ACCOUNT", "zl", acc);
  txt(968, 35, "a serverless workspace", "zs", acc, {"text-anchor": "end"});
  const colX = [318, 536, 754], colW = 208;
  const yDash = 196, yGrant = yDash + hD + 6, cbB = yGrant + 30 + 12;
  const pT = cbB + gap, yRack = pT + 32, pB = yRack + hR + 12;
  const sT = pB + gap, yCyl = sT + 32, sB = yCyl + hC + 33;
  const band = (y, h, cls, label, sub) => {
    const g = el("g", {class: "zone " + cls}, L.zone);
    el("rect", {x: 306, y, width: 668, height: h, rx: 13, class: "zr"}, g);
    const t = txt(318, y + 19, label, "zl", g);
    if (sub) { const s = el("tspan", {class: "zs", dx: 10}, t); s.textContent = sub; s.setAttribute("style", "letter-spacing:0"); }
  };
  band(44, cbB - 44, "z-plane", "CONTROL PLANE");
  band(pT, pB - pT, "z-plane", "SERVERLESS COMPUTE PLANE", "runs the queries");
  band(sT, sB - sT, "z-store", "DEFAULT STORAGE", "in your Databricks account");
  [[300, "YOUR CLOUD ACCOUNT", ""], [646, "YOUR RESOURCES", "z-res"]].forEach(([x, label, cls]) => {
    const g = el("g", {class: "zone z-ghost " + cls}, L.zone);
    el("rect", {x, y: H - 46, width: 334, height: 36, rx: 12, class: "zr"}, g);
    const t = txt(x + 14, H - 22, label, "gh-t", g);
    const s = el("tspan", {class: "zs", dx: 10}, t); s.textContent = "not used here"; s.setAttribute("style", "letter-spacing:0");
  });

  // the control plane, in the order a request meets it
  G.door = tile(515, 48, 250, 38, {icon: "dbx-rest-api", title: "Web app & REST APIs", step: "1"});
  G.auth = tile(colX[1], 98, colW, 40, {icon: "dbx-enterprise-security", title: "Identity & auth", step: "2"});
  G.uc = tile(colX[0], 98, colW, 40, {icon: "dbx-unity-catalog", title: "Unity Catalog", step: "3"});
  G.acl = tile(colX[2], 98, colW, 40, {icon: "dbx-workspace", title: "Workspace ACLs", step: "3"});

  // the environments: one wide one in scene 1, three side by side in scene 2
  const STACK = n === 1
    ? [["SELECT", "analysts", "SQL warehouse", "dbx-sql-warehouse", "sales"], ["MODIFY", "engineers", "Job compute", "dbx-lakeflow-jobs", "features"], ["EXECUTE", "the app", "Notebook compute", "dbx-notebooks", "agent"]]
    : ["llmops_dev", "llmops_acc", "llmops_prd"].map((c) => ["SELECT", "analysts", "SQL warehouse", "dbx-sql-warehouse", c]);
  const cell = (x, y, w, h) => el("rect", {x, y, width: w, height: h, rx: 10, class: "cell"}, L.zone);
  const spans = n === 1 ? [[colX[0], 644, [0, 1, 2]]] : colX.map((x, i) => [x, colW, [i]]);
  const NAMES = n === 1 ? ["prd"] : ["dev", "acc", "prd"];
  G.stacks = [];
  G.envs = spans.map(([x, w, ks], e) => {
    const cells = [cell(x, 158, w, cbB - 6 - 158), cell(x, pT + 26, w, pB - 6 - pT - 26), cell(x, sT + 26, w, sB - 6 - sT - 26)];
    const hg = el("g", {}, L.tile);
    const pill = el("rect", {x: x + 8, y: 164, width: w - 16, height: 26, rx: 13, class: "lh"}, hg);
    const name = txt(x + 21, 183, NAMES[e], "mono b lh-t", hg);
    const env = {name: NAMES[e], x, w, cells, pill, nameT: name};
    if (n === 1) txt(x + 62, 183, "production: the only environment", "ts", hg);
    else {
      const tag = (label, cls, o) => {
        const g = el("g", {opacity: o}, hg);
        el("rect", {x: x + w - 46, y: 167, width: 34, height: 20, rx: 10, class: "vtag " + cls}, g);
        txt(x + w - 29, 182.5, label, "mono vt " + cls, g, {"text-anchor": "middle"});
        return g;
      };
      env.v1 = tag("v1", "", 1);
      env.v2 = tag("v2", "v-new", 0);
      env.smoke = el("g", {opacity: 0}, hg);
      txt(x + w - 73, 183, "smoke", "ts ok", env.smoke, {"text-anchor": "end"});
      mark(env.smoke, x + w - 60, 177, true, 8);
    }
    env.stacks = ks.map((k) => {
      const sx = colX[k] + 8, sw = colW - 16, [verb, who, comp, icon, schema] = STACK[k];
      const s = {
        k, env, x: sx, w: sw, gx: colX[k] - 6,
        dash: dashboard(sx, yDash, sw, hD, L.tile),
        grant: grant(sx, yGrant, sw, 30, verb, who, L.tile),
        rack: rack(sx, yRack, sw, hR, comp, icon, L.tile),
        tab: tables(sx, yCyl, sw, hC, schema, L.tile),
      };
      G.stacks[k] = s;
      return s;
    });
    return env;
  });

  // ----- the developer -----
  // his zone grows with the stage, so the thought has room above his head
  const dy = Math.min(64, (H - HMIN) * 0.46);
  const dz = el("g", {class: "zone z-devs"}, L.zone);
  el("rect", {x: 14, y: 10, width: 272, height: 188 + dy, rx: 16, class: "zr"}, dz);
  txt(26, 33, "DEVELOPER", "zl", dz);
  const dg = el("g", {}, L.ppl);
  G.dev = {...vignette(dg, 20, 74 + dy, 0.78, false, "victor", "code", FAM.dev), head: [100, 84 + dy]};
  txt(214, 128 + dy, "Victor", "pn", dg);

  // ----- GitHub, a cloud of its own -----
  const gz = el("g", {class: "zone z-gh"}, L.zone);
  const cy0 = 226 + dy;
  const cloud = [["rect", {x: 14, y: cy0, width: 272, height: H - 10 - cy0, rx: 24}], ["circle", {cx: 66, cy: cy0 + 6, r: 24}], ["circle", {cx: 122, cy: cy0 + 2, r: 30}], ["circle", {cx: 186, cy: cy0 + 4, r: 27}], ["circle", {cx: 240, cy: cy0 + 10, r: 22}]];
  cloud.forEach(([t, a]) => el(t, {...a, class: "gh-out"}, gz));
  cloud.forEach(([t, a]) => el(t, {...a, class: "gh-in"}, gz));
  use("mk-github", 28, cy0 + 6, 22, gz);
  txt(57, cy0 + 25, "GitHub", "zl", gz).setAttribute("style", "letter-spacing:0;font-size:19px");
  txt(126, cy0 + 25, "its own cloud", "zs", gz);
  const top0 = cy0 + 38, room = H - 20 - top0;
  const gh = (G.gh = {});
  if (n === 1) {
    const sp = Math.min(34, (room - 248) / 2);
    const y1 = top0, y2 = y1 + 74 + sp, y3 = y2 + 90 + sp;
    // the repository: one branch, and it is production
    gh.repo = tile(24, y1, 252, 74, {icon: "mk-github", is: 20, top: 6, title: "main"});
    gh.repo.title.setAttribute("class", "tt mono");
    txt(266, y1 + 26, "→ production", "ts", gh.repo.g, {"text-anchor": "end"});
    el("line", {x1: 40, y1: y1 + 54, x2: 262, y2: y1 + 54, class: "g-main"}, gh.repo.g);
    [64, 112, 160].forEach((x) => el("circle", {cx: x, cy: y1 + 54, r: 6, fill: "#3d4350", class: "g-dot"}, gh.repo.g));
    const nd = el("g", {transform: `translate(216,${y1 + 54})`}, gh.repo.g);
    gh.commit = el("g", {}, nd);
    el("circle", {r: 8, fill: FAM.dev, class: "g-dot"}, gh.commit);
    gh.commitRing = el("circle", {cx: 216, cy: y1 + 54, r: 8, fill: "none", stroke: FAM.dev, "stroke-width": 3, opacity: 0}, gh.repo.g);
    gh.repoIn = [262, y1];
    // what a push to main skips here
    gh.skips = ["no pull request", "no checks", "no approval"].map((label, i) => {
      const y = y2 + i * 32, g = el("g", {}, L.tile);
      const r = el("rect", {x: 24, y, width: 252, height: 26, rx: 13, class: "skip"}, g);
      const x0 = el("path", {d: `M${38} ${y + 8}l10 10M${48} ${y + 8}l-10 10`, class: "skip-x"}, g);
      const t = txt(58, y + 19, label, "ts", g);
      return {g, r, x: x0, t};
    });
    gh.act = tile(24, y3, 252, 84, {icon: "mk-githubactions", is: 20, top: 6, title: "Actions deploy"});
    gh.idle = txt(36, y3 + 54, "waiting for a push", "ts", gh.act.g);
    gh.busy = el("g", {opacity: 0}, gh.act.g);
    gh.spin = spinner(gh.busy, 45, y3 + 48, 8, FAM.dev);
    txt(62, y3 + 54, "Deploying…", "tt dev", gh.busy);
    el("rect", {x: 36, y: y3 + 66, width: 228, height: 8, rx: 4, fill: "#ece9e4"}, gh.busy);
    gh.bar = el("rect", {x: 36, y: y3 + 66, width: 0, height: 8, rx: 4, fill: FAM.dev}, gh.busy);
    gh.out = [276, y3 + 22];
  } else {
    const sp = Math.min(34, (room - 264) / 2);
    const y1 = top0, y2 = y1 + 60 + sp, y3 = y2 + 106 + sp;
    gh.pr = tile(24, y1, 252, 60, {glyph: glyphPr, is: 26, top: 5, title: "Pull request"});
    gh.pr.title.setAttribute("y", y1 + 24);
    const state = (label, cls, o = 0) => txt(gh.pr.tx, y1 + 47, label, "ts " + cls, gh.pr.g, {opacity: o});
    gh.st = {none: state("not opened yet", "", 1), open: state("open", "dev b"), red: state("checks failed", "no b"), green: state("checks passed", "ok b"), ok: state("approved", "ok b"), merged: state("merged", "user b")};
    gh.repoIn = [262, y1];
    gh.rev = avatar(gh.pr.g, 250, y1 + 30, 17, "bo");
    gh.revOk = mark(gh.pr.g, 263, y1 + 44, true, 8);
    // CI: three checks
    gh.ci = tile(24, y2, 252, 106, {icon: "mk-githubactions", is: 20, top: 6, title: "Actions CI"});
    gh.checks = ["pre-commit", "unit tests", "dry-run plan"].map((label, i) => {
      const by = y2 + 52 + i * 22, cx = 45, cy = by - 6;
      txt(62, by, label, "ts ink", gh.ci.g);
      const idle = el("circle", {cx, cy, r: 7, fill: "none", stroke: "#c9c3b8", "stroke-width": 2.5}, gh.ci.g);
      const run = el("g", {opacity: 0}, gh.ci.g), spin = spinner(run, cx, cy, 7, FAM.token);
      return {idle, run, spin, ok: mark(gh.ci.g, cx, cy, true), no: mark(gh.ci.g, cx, cy, false), y: cy};
    });
    gh.ciOut = [276, y2 + 22];
    // CD: dev, acc, the approval, prd
    gh.cd = tile(24, y3, 252, 98, {icon: "mk-githubactions", is: 20, top: 6, title: "Actions CD"});
    gh.chips = {};
    [["dev", 34], ["acc", 102], ["prd", 214]].forEach(([k, x]) => {
      const g = el("g", {}, gh.cd.g);
      const r = el("rect", {x, y: y3 + 38, width: 52, height: 28, rx: 14, class: "chip"}, g);
      const t = txt(x + 26, y3 + 57.5, k, "mono b chip-t", g, {"text-anchor": "middle"});
      gh.chips[k] = {g, r, t, cx: x + 26, cy: y3 + 52};
    });
    [90, 158, 202].forEach((x) => el("path", {d: `M${x} ${y3 + 52}h8m-4-4l4 4l-4 4`, class: "arrow"}, gh.cd.g));
    const lock = (col, open) => {
      const g = el("g", {transform: `translate(185,${y3 + 52})`}, gh.cd.g), inner = el("g", {}, g);
      el("circle", {r: 14, fill: "#fff", stroke: col, "stroke-width": 2}, inner);
      el("rect", {x: -6, y: -2, width: 12, height: 9, rx: 2, fill: col}, inner);
      el("path", {d: open ? "M-3.5-2v-3a3.5 3.5 0 0 1 7-1" : "M-3.5-2v-3a3.5 3.5 0 0 1 7 0v3", fill: "none", stroke: col, "stroke-width": 2.2, "stroke-linecap": "round"}, inner);
      return inner;
    };
    gh.gate = lock("#b98a1e", false);
    gh.gateOpen = lock(FAM.ok, true);
    gh.gateRing = el("circle", {cx: 185, cy: y3 + 52, r: 14, fill: "none", stroke: FAM.token, "stroke-width": 3, opacity: 0}, gh.cd.g);
    gh.note = txt(36, y3 + 88, "prd waits for an approval", "ts", gh.cd.g);
    gh.rev2 = avatar(L.top, 185, y3 + 12, 17, "bo");
    gh.rev2Ok = mark(L.top, 198, y3 + 26, true, 8);
    gh.out = [276, y3 + 22];
  }

  // ----- the platform users -----
  const uz = el("g", {class: "zone z-devs z-users"}, L.zone);
  el("rect", {x: 994, y: 10, width: 272, height: H - 20, rx: 16, class: "zr"}, uz);
  txt(1006, 33, "PLATFORM USERS", "zl", uz);
  const hb = (H - 54) / 3;
  G.users = [["dana", "Dana", "notebook", "nb"], ["fay", "Fay", "dashboard", "chart"], ["gus", "Gus", "agent app", "chat"]].map(([id, name, tool, kind], i) => {
    const y0 = 44 + i * hb, vy = y0 + hb - 118, g = el("g", {}, L.ppl);
    const v = vignette(g, 1085, vy, 0.72, true, id, kind, FAM.user);
    txt(1004, vy + 38, name, "pn", g);
    txt(1004, vy + 59, tool, "ts", g);
    return {...v, id, name, lead: [v.px, v.py], head: [1204, vy + 6], top: y0 + 2};
  });

  // ----- the rails: one way in from each side, then door, auth, authorizers, bus, lanes -----
  const RY = G.RAIL_Y, BUS = G.BUS;
  const rail = (pts, cls = "r-lane") => { el("path", {d: polyD(pts), class: "rail " + cls}, L.rail); if (cls === "r-lane") el("path", {d: polyD(pts), class: "rail r-lane-c"}, L.rail); };
  G.pIn = [[293, RY], [515, RY]];                               // from GitHub to the front door
  G.pTrunk = (from) => [from, [293, from[1]], [293, RY], [515, RY]];
  rail(G.pTrunk(gh.out));
  if (gh.ciOut) rail([gh.ciOut, [293, gh.ciOut[1]]], "r-stub");
  const lastLead = G.users[2].lead[1];
  rail([[987, lastLead], [987, RY], [765, RY]]);
  G.users.forEach((u) => rail([[u.lead[0], u.lead[1]], [987, u.lead[1]]], "r-stub"));
  G.pUser = (u) => [u.lead, [987, u.lead[1]], [987, RY], [765, RY]];
  rail([[640, 86], [640, 98]], "r-stub");
  rail([[colX[1], 118], [colX[0] + colW, 118]], "r-stub");
  rail([[colX[1] + colW, 118], [colX[2], 118]], "r-stub");
  const ucx = G.uc.cx, aclx = G.acl.cx;
  rail([[ucx, 138], [ucx, BUS]], "r-stub");
  rail([[aclx, 138], [aclx, BUS]], "r-stub");
  rail([[312, BUS], [aclx, BUS]], "r-stub");
  G.stacks.forEach((s) => {
    [[BUS, cbB - 6], [pT + 26, pB - 6], [sT + 26, s.tab.cy]].forEach(([a, b]) => rail([[s.gx, a], [s.gx, b]], "r-stub"));
    [s.dash, s.grant, s.rack, s.tab].forEach((o) => rail([[s.gx, o.cy], [s.x, o.cy]], "r-stub"));
  });
  rail([[196, G.dev.py], [262, G.dev.py], gh.repoIn], "r-stub");
  G.pPush = [[G.dev.px, G.dev.py], [262, G.dev.py], gh.repoIn];
  // the ways inside: door -> auth -> an authorizer -> down a lane's gutter to an object
  G.pDoorAuth = (side) => [[side === "L" ? 515 : 765, RY], [640, RY], [640, 118]];
  G.pAuthTo = (z) => [[640, 118], [z === "uc" ? ucx : aclx, 118]];
  G.pDown = (z, s, o) => [[z === "uc" ? ucx : aclx, 118], [z === "uc" ? ucx : aclx, BUS], [s.gx, BUS], [s.gx, o.cy], [s.x + 4, o.cy]];
  G.cross = {L: [300, RY], R: [980, RY]};
  G.mid = [640, (pT + sB) / 2];
  G.planTop = yDash - 2;
  return G;
}
