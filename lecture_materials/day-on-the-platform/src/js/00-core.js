// "A day on the platform", the unconstrained version: an animated map of every moving part, in a
// 3000 x 1680 world seen through a camera. The drawing is SVG, the trails and particles a canvas
// above it, and every motion of the story a child of one GSAP timeline, the scene clock: paused or
// off screen, that timeline stops and the browser has nothing to do.
//
// The files of src/js are concatenated in name order into one function scope by build.py:
// 00-core (helpers, the rail graph), 05-people (the eight figures), 10-world (the drawing),
// 15-info (the explanations), 20-engine (camera, clock, packets, verdicts, particles), 30-stories
// (the scenarios, each hop in the order of the brief's § 6), 40-ui (tour, whole day, controls,
// minimap, present mode).

const NS = "http://www.w3.org/2000/svg";
const $ = (id) => document.getElementById(id);
if (!window.gsap || !window.MotionPathPlugin) {
  // the CDN did not answer: say so instead of showing an empty stage
  const b = $("err");
  b.hidden = false;
  b.textContent = "This page loads GSAP from cdnjs.cloudflare.com and could not reach it. Open it with a network connection, or use index.bundled.html, which carries everything.";
  return;
}
const svg = $("sv"), stage = $("stage"), theater = $("theater");
const W = 3000, H = 1690;
const FAM = {dev: "#c9705f", token: "#d9a441", user: "#6b5fb0", plat: "#506fa0", data: "#4e7566", ok: "#3f9b6b", no: "#d64545"};
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

const el = (tag, attrs, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};
const txt = (x, y, s, cls, parent, attrs = {}) => {
  const t = el("text", {x, y, class: cls, ...attrs}, parent);
  t.textContent = s;
  return t;
};
const use = (id, x, y, size, parent, attrs = {}) => el("use", {href: "#" + id, x, y, width: size, height: size, ...attrs}, parent);
const zoneAttrs = (id, label) => ({"data-zone": id, tabindex: 0, role: "button", "aria-label": label});

svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
const defs = el("defs", {}, svg);
const grad = (id, stops, x2 = 0, y2 = 1) => {
  const g = el("linearGradient", {id, x1: 0, y1: 0, x2, y2}, defs);
  stops.forEach(([o, c, a]) => el("stop", {offset: o, "stop-color": c, ...(a == null ? {} : {"stop-opacity": a})}, g));
};
grad("gTile", [[0, "#ffffff"], [1, "#faf9f6"]]);
grad("gUc", [[0, "#ffffff"], [1, "#f3f6fb"]]);
grad("gCab", [[0, "#333a4b"], [1, "#262b38"]]);
grad("gCyl", [[0, "#dcebe3"], [0.5, "#f4faf6"], [1, "#cfe1d8"]], 1, 0);
grad("gCylB", [[0, "#dfe7f4"], [0.5, "#f6f9fd"], [1, "#d0dbee"]], 1, 0);
grad("gDesk", [[0, "#f3e9d6"], [1, "#e6d8bd"]]);
grad("gScr", [[0, "#fafdff"], [1, "#dbe7fa"]]);
{
  const g = el("linearGradient", {id: "gGlow", x1: 1, y1: 0, x2: 0, y2: 0}, defs);
  el("stop", {offset: 0, "stop-color": "#bcd6ff", "stop-opacity": 0.8}, g);
  el("stop", {offset: 1, "stop-color": "#bcd6ff", "stop-opacity": 0}, g);
}
{
  const p = el("pattern", {id: "pDots", width: 30, height: 30, patternUnits: "userSpaceOnUse"}, defs);
  el("circle", {cx: 2, cy: 2, r: 1.3, fill: "#8a7556", opacity: 0.16}, p);
}

// layers, back to front
const Lbg = el("g", {}, svg), Lzone = el("g", {}, svg), Lrail = el("g", {}, svg), Lhot = el("g", {}, svg);
const Ltile = el("g", {}, svg), Lppl = el("g", {}, svg), Lpk = el("g", {}, svg), Ltop = el("g", {}, svg);

// ---------- zones: tinted grounds with a label ----------
const zone = (id, x, y, w, h, cls, label, sub, at = "tl", rx = 22) => {
  const g = el("g", {class: "zone " + cls, ...zoneAttrs(id, label || id)}, Lzone);
  el("rect", {x, y, width: w, height: h, rx, class: "zr"}, g);
  if (label) {
    const ly = at === "bl" ? y + h - 14 : y + 36;
    const t = txt(x + 22, ly, label, "zl", g);
    if (sub) { const s = el("tspan", {class: "zs", dx: 14}, t); s.textContent = sub; s.setAttribute("style", "letter-spacing:0"); }
  }
  return g;
};

// ---------- tiles: white cards with depth, an icon plate, a title and one or two lines ----------
const T = {};
const tile = (id, x, y, w, h, o = {}) => {
  const g = el("g", {class: "tile " + (o.cls || ""), ...zoneAttrs(id, o.title || id)}, o.layer || Ltile);
  el("rect", {x: x + 3, y: y + 7, width: w - 6, height: h, rx: 16, class: "sh2"}, g);
  el("rect", {x: x + 1, y: y + 3, width: w - 2, height: h, rx: 15, class: "sh1"}, g);
  const face = el("rect", {x, y, width: w, height: h, rx: 14, class: "face " + (o.face || "")}, g);
  const pad = 14, is = o.is || 40;
  let tx = x + pad, subEl = null;
  if (o.icon) {
    el("rect", {x: x + pad - 4, y: y + pad - 4, width: is + 8, height: is + 8, rx: 10, class: "plate"}, g);
    use(o.icon, x + pad, y + pad, is, g);
    tx = x + pad + is + 14;
  } else if (o.glyph) {
    el("rect", {x: x + pad - 4, y: y + pad - 4, width: is + 8, height: is + 8, rx: 10, class: "plate"}, g);
    o.glyph(el("g", {transform: `translate(${x + pad + is / 2},${y + pad + is / 2}) scale(${is / 40})`}, g));
    tx = x + pad + is + 14;
  }
  if (o.stack) {                       // narrow tile: the title beside the icon, the lines below
    if (o.title) txt(tx, y + pad + is / 2 + 7, o.title, "tt", g);
    if (o.sub) subEl = txt(x + pad, y + pad + is + 24, o.sub, "ts" + (o.mono ? " mono" : ""), g);
  } else {
    const two = o.sub != null, ty = o.ty ? y + o.ty : two ? y + (o.sub2 ? 27 : h / 2 - 5) : y + h / 2 + 7;
    if (o.title) txt(tx, ty, o.title, "tt", g);
    if (o.sub) subEl = txt(tx, ty + 23, o.sub, "ts" + (o.mono ? " mono" : ""), g);
    if (o.sub2) txt(tx, ty + 44, o.sub2, "ts" + (o.mono2 ? " mono" : ""), g);
  }
  if (o.step) {
    const b = el("g", {class: "stepb"}, g);
    el("circle", {cx: x + 2, cy: y + 2, r: 14}, b);
    txt(x + 2, y + 7, o.step, "", b);
  }
  return (T[id] = {id, x, y, w, h, g, face, sub: subEl, sub0: o.sub || "", cx: x + w / 2, cy: y + h / 2, ports: []});
};

// ---------- the rail graph: junctions, tile ports and the segments between them ----------
const NODE = {}, EDGES = [], ADJ = {};
const J = (name, x, y) => (NODE[name] = {name, x, y});
const isPort = {};
const port = (tileId, name, x, y) => { J(name, x, y); T[tileId].ports.push(name); isPort[name] = true; return name; };
const rail = (kind, ...names) => {
  for (let i = 0; i < names.length - 1; i++) {
    const a = NODE[names[i]], b = NODE[names[i + 1]];
    if (!a || !b) throw new Error("rail: unknown node " + names[i] + " or " + names[i + 1]);
    if (a.x !== b.x && a.y !== b.y) throw new Error(`rail ${a.name}-${b.name} is not orthogonal`);
    const len = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    EDGES.push({a: a.name, b: b.name, kind, len});
    (ADJ[a.name] ||= []).push([b.name, len]);
    (ADJ[b.name] ||= []).push([a.name, len]);
  }
};

// the shortest way along the rails from any port of `from` to any port of `to` (tile ids or node names)
const routeCache = {};
const portsOf = (k) => (T[k] && T[k].ports.length ? T[k].ports : NODE[k] ? [k] : null);
const route = (from, to) => {
  const key = from + ">" + to;
  if (routeCache[key]) return routeCache[key];
  const src = portsOf(from), dst = portsOf(to);
  if (!src || !dst) throw new Error(`route: unknown end ${from} or ${to}`);
  const dist = {}, prev = {}, open = new Set(src);
  src.forEach((s) => (dist[s] = 0));
  const goal = new Set(dst);
  let found = null;
  while (open.size) {
    let u = null;
    for (const n of open) if (u === null || dist[n] < dist[u]) u = n;
    open.delete(u);
    if (goal.has(u)) { found = u; break; }
    for (const [v, len] of ADJ[u] || []) {
      // a port of some tile is a dead end, never a way through
      if (!goal.has(v) && isPort[v]) continue;
      const d = dist[u] + len;
      if (dist[v] === undefined || d < dist[v]) { dist[v] = d; prev[v] = u; open.add(v); }
    }
  }
  if (!found) throw new Error(`route: no rails from ${from} to ${to}`);
  const names = [];
  for (let n = found; n; n = prev[n]) names.unshift(n);
  const pts = names.map((n) => [NODE[n].x, NODE[n].y]);
  return (routeCache[key] = {names, pts: simplify(pts), len: dist[found]});
};
// drop the points in the middle of a straight run
const simplify = (pts) => pts.filter((p, i) => {
  if (i === 0 || i === pts.length - 1) return true;
  const a = pts[i - 1], b = pts[i + 1];
  return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1]));
});
// an orthogonal polyline as a path with rounded corners
const roundPath = (pts, r = 16) => {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1], [x, y] = pts[i], [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(x - px, y - py), l2 = Math.hypot(nx - x, ny - y), q = Math.min(r, l1 / 2, l2 / 2);
    const ax = x - ((x - px) / l1) * q, ay = y - ((y - py) / l1) * q, bx = x + ((nx - x) / l2) * q, by = y + ((ny - y) / l2) * q;
    d += ` L${ax} ${ay} Q${x} ${y} ${bx} ${by}`;
  }
  const last = pts[pts.length - 1];
  return d + ` L${last[0]} ${last[1]}`;
};
