// ---------- the engine: camera, scene clock, packets, verdicts, particles ----------
gsap.registerPlugin(MotionPathPlugin);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fxc = $("fx"), ctx = fxc.getContext("2d");

// ----- the camera: a centre and a scale, applied as the SVG's viewBox and the canvas transform -----
const cam = {x: W / 2, y: H / 2, k: 0.4};
let sw = 1, sh = 1, dpr = 1;
const kFit = () => Math.min(sw / W, sh / H) * 0.985;
const pkScale = () => clamp(Math.pow(0.95 / cam.k, 0.62), 1, 2);
const livePk = new Set();
let onCam = () => {};
const applyCam = () => {
  cam.k = clamp(cam.k, kFit() * 0.85, 3.2);
  const hw = sw / 2 / cam.k, hh = sh / 2 / cam.k, m = 140;
  cam.x = hw * 2 >= W + 2 * m ? W / 2 : clamp(cam.x, hw - m, W - hw + m);
  cam.y = hh * 2 >= H + 2 * m ? H / 2 : clamp(cam.y, hh - m, H - hh + m);
  svg.setAttribute("viewBox", `${cam.x - hw} ${cam.y - hh} ${hw * 2} ${hh * 2}`);
  const s = pkScale();
  livePk.forEach((p) => p.inner.setAttribute("transform", `scale(${s})`));
  onCam();
  if (!ticking) drawFx();
};
const resize = () => {
  const r = stage.getBoundingClientRect();
  sw = Math.max(1, r.width); sh = Math.max(1, r.height);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  fxc.width = Math.round(sw * dpr); fxc.height = Math.round(sh * dpr);
  applyCam();
};
const fitRect = (r, pad = 40) => ({x: r.x + r.w / 2, y: r.y + r.h / 2, k: Math.min(sw / (r.w + 2 * pad), sh / (r.h + 2 * pad))});
const ALL = {x: 0, y: 0, w: W, h: H};
// a camera move the user asked for: runs on the global clock, so it works while the scene is paused
const camTo = (t, dur = 0.8) => gsap.to(cam, {x: t.x, y: t.y, k: t.k, duration: reduced ? 0.01 : dur, ease: "power2.inOut", overwrite: true, onUpdate: applyCam});

// the story's camera: an aim the camera glides to while the scene plays, unless the viewer took over
const aim = {x: W / 2, y: H / 2, k: 0.4, on: false};
let free = false, follow = null;
// the scale of a chapter: about 1420 world units across, so 15 px text stays above 13 px on screen
const kStory = () => clamp(Math.min(sw / 1420, sh / 640), 0.62, 1.5);
const aimRect = (r, pad = 70) => {
  const ks = kStory(), f = fitRect(r, pad);
  aim.x = f.x; aim.y = f.y; aim.k = clamp(f.k, ks * 0.84, ks * 1.12); aim.on = true; follow = null;
};
const aimTile = (...ids) => {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  ids.forEach((id) => { const t = T[id] || TABLE[id] && {x: TABLE[id].cx - 50, y: TABLE[id].top, w: 100, h: 130}; x0 = Math.min(x0, t.x); y0 = Math.min(y0, t.y); x1 = Math.max(x1, t.x + t.w); y1 = Math.max(y1, t.y + t.h); });
  aimRect({x: x0, y: y0, w: x1 - x0, h: y1 - y0}, 130);
};

// ----- the scene clock: every motion of the story is a child of this timeline -----
const scene = gsap.timeline({paused: true, autoRemoveChildren: true});
let ticking = false, now = 0, epoch = 0, mode = "tour";
let lastTick = 0;
// one endless tween is the clock's heartbeat: it never ends and is never removed, so the timeline's
// playhead runs on through every restart of a story
const heartbeat = gsap.to({}, {duration: 1e7, ease: "none", onUpdate: () => tick()});
scene.add(heartbeat, 0);
const clearScene = () => scene.getChildren(true, true, true).forEach((c) => { if (c !== heartbeat) c.kill(); });
const wait = (s) => new Promise((res) => scene.call(res, null, scene.time() + s));
const later = (s, fn) => scene.call(fn, null, scene.time() + s);
const S = (target, vars) => scene.to(target, vars, scene.time());
function tick() {
  const t = scene.time(), dt = Math.min(0.1, Math.max(0, t - lastTick));
  lastTick = t; now = t;
  if (aim.on && !free && mode === "tour" && !(camTween && camTween.isActive())) {
    if (follow) { aim.x = follow.x; aim.y = follow.y; }
    const a = 1 - Math.exp(-dt * 3.4), dx = aim.x - cam.x, dy = aim.y - cam.y, dk = aim.k - cam.k;
    if (Math.abs(dx) + Math.abs(dy) > 0.4 || Math.abs(dk) > 0.0005) {
      cam.x += dx * a; cam.y += dy * a; cam.k += dk * a;
      applyCam();
    }
  }
  ticking = true;
  storyClock(dt);
  drawFx();
}

// ----- the canvas: comet trails behind packets, particle streams for parallel reads, sparks -----
const trails = new Set(), parts = [], sparks = [], rings = [], lanes = [];
const polyLen = (pts) => { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return cum; };
const polyAt = (pts, cum, s) => {
  s = clamp(s, 0, cum[cum.length - 1]);
  let i = 1;
  while (i < cum.length - 1 && cum[i] < s) i++;
  const f = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
  return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
};
const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
function drawFx() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, fxc.width, fxc.height);
  const k = cam.k * dpr;
  ctx.setTransform(k, 0, 0, k, fxc.width / 2 - cam.x * k, fxc.height / 2 - cam.y * k);
  // trails
  trails.forEach((tr) => {
    const h = tr.hist, n = h.length;
    for (let i = 0; i < n; i++) {
      const a = (i + 1) / n;
      ctx.globalAlpha = a * a * 0.5;
      ctx.fillStyle = tr.col;
      ctx.beginPath(); ctx.arc(h[i][0], h[i][1], (3 + 9 * a) * tr.s, 0, 6.2832); ctx.fill();
    }
  });
  // the lanes of a parallel read or write glow while the files flow
  for (let i = lanes.length - 1; i >= 0; i--) {
    const l = lanes[i];
    if (now >= l.t1) { lanes.splice(i, 1); continue; }
    if (now < l.t0) continue;
    ctx.globalAlpha = 0.5 * Math.min(1, (now - l.t0) / 0.3, (l.t1 - now) / 0.4);
    ctx.strokeStyle = l.col; ctx.lineWidth = 4; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(l.pts[0][0], l.pts[0][1]);
    for (let j = 1; j < l.pts.length; j++) ctx.lineTo(l.pts[j][0], l.pts[j][1]);
    ctx.stroke();
  }
  // particle streams
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i], q = (now - p.t0) / p.dur;
    if (q >= 1) { parts.splice(i, 1); if (p.done) p.done(); continue; }
    if (q < 0) continue;
    const e = ease(q), L = p.cum[p.cum.length - 1];
    for (let j = 0; j < 6; j++) {
      const [x, y] = polyAt(p.pts, p.cum, e * L - j * 10);
      ctx.globalAlpha = (1 - j / 6) * (j ? 0.55 : 1);
      ctx.fillStyle = j ? p.col : "#ffffff";
      ctx.beginPath(); ctx.arc(x, y, j ? p.r * (1 - j / 9) : p.r * 0.55, 0, 6.2832); ctx.fill();
      if (!j) { ctx.globalAlpha = 0.9; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(x, y, p.r, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, p.r * 0.42, 0, 6.2832); ctx.fill(); }
    }
  }
  // sparks of a verdict, rings of a perimeter crossing
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i], q = (now - s.t0) / s.dur;
    if (q >= 1) { sparks.splice(i, 1); continue; }
    if (q < 0) continue;
    const d = s.v * (1 - Math.pow(1 - q, 3));
    ctx.globalAlpha = 1 - q;
    ctx.fillStyle = s.col;
    ctx.beginPath(); ctx.arc(s.x + Math.cos(s.a) * d, s.y + Math.sin(s.a) * d + 30 * q * q, s.r * (1 - q * 0.6), 0, 6.2832); ctx.fill();
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i], q = (now - r.t0) / r.dur;
    if (q >= 1) { rings.splice(i, 1); continue; }
    ctx.globalAlpha = (1 - q) * 0.8;
    ctx.strokeStyle = r.col; ctx.lineWidth = 5 * (1 - q) + 1;
    ctx.beginPath(); ctx.arc(r.x, r.y, 10 + r.R * (1 - Math.pow(1 - q, 3)), 0, 6.2832); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
const sparkle = (x, y, col, n = 12) => {
  if (reduced) return;
  for (let i = 0; i < n; i++) sparks.push({x, y, a: (i / n) * 6.2832 + Math.random() * 0.4, v: 26 + Math.random() * 34, r: 3 + Math.random() * 3, col, t0: now, dur: 0.6 + Math.random() * 0.3});
};

// ----- the glyphs packets carry (drawn white on the family's disc; vendor marks keep their colours) -----
const stroke = (g, d, w = 2.4) => el("path", {d, fill: "none", stroke: "#fff", "stroke-width": w, "stroke-linecap": "round", "stroke-linejoin": "round"}, g);
const GLYPH = {
  commit: (g) => { stroke(g, "M-10 0h5M5 0h5"); el("circle", {r: 4.6, fill: "none", stroke: "#fff", "stroke-width": 2.6}, g); },
  pr: (g) => { stroke(g, "M-5-5v10M5 6v-6a4 4 0 0 0-4-4h-1"); [[-5, -7], [-5, 7], [5, 7]].forEach(([x, y]) => el("circle", {cx: x, cy: y, r: 2.4, fill: "#fff"}, g)); },
  key: (g) => { el("circle", {cx: -4.5, cy: 0, r: 4.2, fill: "none", stroke: "#fff", "stroke-width": 2.6}, g); stroke(g, "M0 0h9M6 0v4M9 0v3", 2.6); },
  pkg: (g) => { stroke(g, "M0-9l8 4.5v9l-8 4.5l-8-4.5v-9zM-8-4.5l8 4.5l8-4.5M0 0v9", 2.1); },
  sql: (g) => { stroke(g, "M-6-9h8l5 5v13h-13z", 2.1); stroke(g, "M-3 0h7M-3 4h7", 1.9); },
  ask: (g) => { stroke(g, "M-9-6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-6l-5 4v-4h-2z", 2.1); el("path", {d: "M2-6.5l1.2 2.8l2.8 1.2l-2.8 1.2l-1.2 2.8l-1.2-2.8l-2.8-1.2l2.8-1.2z", fill: "#fff"}, g); },
  chat: (g) => { stroke(g, "M-9-6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-8l-5 4v-4h-2z", 2.1); stroke(g, "M-4-3h8", 2); },
  rows: (g) => { stroke(g, "M-9-7h18v14h-18zM-9-2h18M-9 3h18M-2-7v14", 1.9); },
  chart: (g) => { stroke(g, "M-9 8h18", 2); [[-7, 5], [-2, 10], [3, 7], [8, 13]].forEach(([x, h]) => el("rect", {x: x - 1.8, y: 6 - h, width: 3.6, height: h, rx: 1, fill: "#fff"}, g)); },
  trace: (g) => { stroke(g, "M-9-7h10M-5-2h12M-5 3h7M-1 8h9", 2.6); },
  job: (g) => { el("path", {d: "M-4-7l10 7l-10 7z", fill: "#fff"}, g); },
  ok: (g) => stroke(g, "M-6 0l4 5l8-10", 3),
  no: (g) => stroke(g, "M-5-5l10 10M5-5l-10 10", 3),
  dot: (g) => el("circle", {r: 3.5, fill: "#fff"}, g),
  doc: (g) => { stroke(g, "M-6-9h8l5 5v13h-13z", 2.1); },
};
const MARK = {ci: "mk-githubactions", py: "mk-python"};

// ----- packets: an icon on a disc that rides the rails, a tag that says what it is -----
const inRect = (x, y, r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
const hotPath = (d, col) => {
  const p = el("path", {d, class: "hot", stroke: col}, Lhot);
  S(p, {opacity: 0.55, duration: 0.25});
  return p;
};
// the perimeters a packet can cross: your Databricks account, and the two dashed ones beside it,
// which no rail enters, so nothing in the course ever lights them
const PERIMS = [{r: DBX, z: dbxZ}, {r: YOURS, z: ghostZ}, {r: RES, z: resZ}];
// the point of a rectangle's border nearest to (x, y)
const onBorder = (x, y, r) => {
  const d = [x - r.x, r.x + r.w - x, y - r.y, r.y + r.h - y].map(Math.abs), m = Math.min(...d);
  return m === d[0] ? [r.x, y] : m === d[1] ? [r.x + r.w, y] : m === d[2] ? [x, r.y] : [x, r.y + r.h];
};
const crossFx = (x, y, col, z) => {
  rings.push({x, y, col, t0: now, dur: 0.8, R: 46});
  sparkle(x, y, col, 6);
  const gate = GATES.find((g) => Math.abs(g.x - x) < 30 && Math.abs(g.y - y) < 40);
  // the border that was crossed lights up too
  z.style.setProperty("--hc", col);
  z.classList.add("crossed");
  later(0.9, () => z.classList.remove("crossed"));
  if (gate) {
    const r = gate.g.firstChild;
    r.setAttribute("style", `fill:${col};stroke:${col}`);
    scene.fromTo(gate.g, {scale: 1.9, transformOrigin: "50% 50%"}, {scale: 1, duration: 0.6, ease: "back.out(2)", onComplete: () => r.removeAttribute("style")}, scene.time());
  }
};
const pulse = (id, fam = "plat", s = 0.7) => {
  const t = T[id];
  if (!t) return;
  t.g.style.setProperty("--hc", FAM[fam]);
  t.g.classList.add("lit");
  later(s, () => t.g.classList.remove("lit"));
};
// fly(from, to, {fam, icon, label, v, cam}): one hop along the rails, resolved on arrival
function fly(from, to, o = {}) {
  const r = route(from, to), col = FAM[o.fam || "plat"];
  const d = roundPath(r.pts), [sx, sy] = r.pts[0], [ex, ey] = r.pts[r.pts.length - 1];
  const g = el("g", {class: "pk"}, Lpk), inner = el("g", {transform: `scale(${pkScale()})`}, g);
  const small = o.small;
  el("circle", {r: small ? 11 : 21, fill: col, opacity: 0.2}, inner);
  if (MARK[o.icon]) {
    el("circle", {r: 15, fill: "#fff", stroke: col, "stroke-width": 3}, inner);
    use(MARK[o.icon], -9.5, -9.5, 19, inner);
  } else {
    el("circle", {r: small ? 7 : 15, fill: col, class: "pk-disc"}, inner);
    if (!small) (GLYPH[o.icon] || GLYPH.dot)(inner);
  }
  if (o.label) {
    const tag = el("g", {class: "pk-tag"}, inner), t = txt(0, -30, o.label, "", tag, {"text-anchor": "middle"});
    const w = Math.max(40, t.getComputedTextLength() + 20);
    tag.insertBefore(el("rect", {x: -w / 2, y: -48, width: w, height: 26, rx: 13, stroke: col}), t);
  }
  const pk = {inner}, tr = {col, hist: [], s: small ? 0.5 : 1};
  livePk.add(pk); trails.add(tr);
  const hot = small ? null : hotPath(d, col);
  const story = o.cam !== false && mode === "tour";
  if (story) {
    const x0 = Math.min(...r.pts.map((p) => p[0])), x1 = Math.max(...r.pts.map((p) => p[0])), y0 = Math.min(...r.pts.map((p) => p[1])), y1 = Math.max(...r.pts.map((p) => p[1]));
    const ks = kStory();
    if (x1 - x0 + 360 <= sw / (ks * 0.84) && y1 - y0 + 300 <= sh / (ks * 0.84)) aimRect({x: x0, y: y0, w: x1 - x0, h: y1 - y0}, 190);
    else { aim.k = ks; aim.on = true; follow = {x: sx, y: sy}; }
  }
  const dur = clamp(r.len / (o.v || 640), 0.75, o.v ? 30 : 3);
  const inP = PERIMS.map((q) => inRect(sx, sy, q.r));
  const mine = follow;
  return new Promise((res) => {
    gsap.set(g, {x: sx, y: sy});
    scene.from(inner, {opacity: 0, duration: 0.18}, scene.time());
    scene.to(g, {motionPath: {path: d}, duration: dur, ease: "power1.inOut",
      onUpdate() {
        const x = gsap.getProperty(g, "x"), y = gsap.getProperty(g, "y");
        tr.hist.push([x, y]); if (tr.hist.length > 16) tr.hist.shift();
        PERIMS.forEach((q, k) => {
          const inside = inRect(x, y, q.r);
          if (inside !== inP[k]) { inP[k] = inside; crossFx(...onBorder(x, y, q.r), col, q.z); }
        });
        if (story && follow === mine && mine) { mine.x = x + (ex - x) * 0.22; mine.y = y + (ey - y) * 0.22; }
      },
      onComplete() {
        livePk.delete(pk); trails.delete(tr); g.remove();
        if (hot) scene.to(hot, {opacity: 0, duration: 0.5, onComplete: () => hot.remove()}, scene.time());
        if (T[to]) pulse(to, o.fam);
        res();
      }}, scene.time());
  });
}
// a person does something: the screen lights up, the head nods, a status line says what
const act = (who, text) => {
  const p = P[who];
  if (text !== undefined) p.st.textContent = text;
  scene.fromTo(p.flash, {opacity: 0.75}, {opacity: 0, duration: 0.9, ease: "power2.out"}, scene.time());
  scene.fromTo(p.glow, {opacity: 1}, {opacity: 0.5, duration: 1.2}, scene.time());
  if (!reduced) scene.fromTo(p.bust, {y: 0}, {y: -4, duration: 0.16, yoyo: true, repeat: 1, ease: "power1.out"}, scene.time());
};

// ----- verdicts: the visible moment of a check. A disc with a drawn tick or cross, a ring, a tag -----
const vdCount = {};
function verdict(id, ok, text, o = {}) {
  const t = T[id], col = ok ? FAM.ok : FAM.no;
  const n = (vdCount[id] = (vdCount[id] || 0) + 1);
  const x = t.x + t.w - 12, y = t.y - 20 - (n - 1) * 38 * pkScale();
  if (mode === "tour" && o.cam !== false) aimRect({x: t.x - 60, y: t.y - 110, w: t.w + 120, h: t.h + 150}, 150);
  // zoomed far out (the whole day), a verdict is drawn larger, like the packets
  const vs = pkScale(), g = el("g", {class: "vd", transform: `translate(${x},${y}) scale(${vs}) translate(${-x},${-y})`}, Ltop);
  const tag = el("g", {class: "vd-tag"}, g), tx = txt(x - 30, y + 6, text, "", tag, {"text-anchor": "end", fill: ok ? "#1f6b46" : "#a12b2b"});
  tx.setAttribute("style", `fill:${ok ? "#1f6b46" : "#a12b2b"}`);
  const w = tx.getComputedTextLength() + 44;
  tag.insertBefore(el("rect", {x: x - 20 - w, y: y - 16, width: w + 20, height: 32, rx: 16, stroke: col}), tx);
  const ring = el("circle", {cx: x, cy: y, r: 18, class: "vd-ring", stroke: col}, g);
  const disc = el("g", {transform: `translate(${x},${y})`}, g), inner = el("g", {}, disc);
  el("circle", {r: 19, fill: col, class: "vd-disc"}, inner);
  const mark = el("path", {d: ok ? "M-8 0l5.5 6.5l10.5-13" : "M-7-7l14 14M7-7l-14 14", class: "vd-mark", "stroke-dasharray": 44, "stroke-dashoffset": 44}, inner);
  const at = scene.time();
  scene.from(inner, {scale: 0, duration: 0.38, ease: "back.out(2.6)"}, at);
  scene.to(mark, {attr: {"stroke-dashoffset": 0}, duration: 0.3, ease: "power2.out"}, at + 0.14);
  scene.fromTo(ring, {attr: {r: 18}, opacity: 0.9}, {attr: {r: 54}, opacity: 0, duration: 0.8, ease: "power2.out"}, at + 0.1);
  scene.from(tag, {opacity: 0, x: 26, duration: 0.3, ease: "power2.out"}, at + 0.1);
  later(0.14, () => sparkle(x, y, col, ok ? 12 : 8));
  t.g.style.setProperty("--hc", col);
  t.g.classList.add("lit");
  if (!ok && !reduced) scene.fromTo(t.g, {x: 0}, {keyframes: {x: [0, -9, 8, -6, 5, -3, 0]}, duration: 0.5, ease: "none"}, at + 0.1);
  const hold = o.hold || (ok ? 2.4 : 3.4);
  later(hold, () => {
    t.g.classList.remove("lit");
    vdCount[id]--;
    scene.to(g, {opacity: 0, duration: 0.35, onComplete: () => g.remove()}, scene.time());
  });
  return wait(o.wait || (ok ? 1.15 : 1.7));
}
// the federation policy, checked claim by claim at identity and auth
async function policyCheck(env) {
  const x = 1824, y = 474, w = 404, rows = [["issuer", "GitHub Actions"], ["subject", `course-code-hub · environment ${env}`], ["audience", "this Databricks account"]];
  const g = el("g", {class: "pop"}, Ltop);
  el("rect", {x: x + 3, y: y + 6, width: w, height: 132, rx: 14, fill: "#1a1a1a", opacity: 0.08, stroke: "none"}, g).setAttribute("style", "stroke:none;fill:#1a1a1a");
  el("rect", {x, y, width: w, height: 132, rx: 14}, g);
  txt(x + 16, y + 28, `Federation policy of sp-deploy-arxiv-${env}`, "", g).setAttribute("style", "font-weight:600");
  scene.from(g, {opacity: 0, y: -12, duration: 0.3}, scene.time());
  pulse("fed", "token", 3.4);
  await wait(0.45);
  for (let i = 0; i < rows.length; i++) {
    const ry = y + 56 + i * 26;
    txt(x + 16, ry, rows[i][0], "k", g);
    txt(x + 96, ry, rows[i][1], "", g);
    const c = el("g", {transform: `translate(${x + w - 24},${ry - 5})`}, g), ci = el("g", {}, c);
    el("circle", {r: 10, fill: FAM.ok}, ci);
    el("path", {d: "M-4.5 0l3 3.6l6-7.4", fill: "none", stroke: "#fff", "stroke-width": 2.6, "stroke-linecap": "round", "stroke-linejoin": "round"}, ci);
    scene.from(ci, {scale: 0, duration: 0.3, ease: "back.out(2.6)"}, scene.time());
    sparkle(x + w - 24, ry - 5, FAM.ok, 5);
    await wait(0.5);
  }
  later(1.6, () => scene.to(g, {opacity: 0, duration: 0.35, onComplete: () => g.remove()}, scene.time()));
}

// ----- executors: blades light up, particles stream along four lanes, the files they touch light up -----
const bladeOn = (b, d) => { b.n = Math.max(0, b.n + d); b.el.classList.toggle("on", b.n > 0); };
// burst(rack, [[table, slot] x4], "read" | "write"): four executors, four files, at once
function burst(rk, targets, kind = "read", o = {}) {
  const R = RACK[rk], col = kind === "read" ? "#3fa878" : "#e09a1f";
  const ord = targets.map(([k, s]) => ({tb: TABLE[k], s, x: TABLE[k].slotx[s]})).sort((a, b) => a.x - b.x);
  const meanX = ord.reduce((a, b) => a + b.x, 0) / ord.length, dir = meanX >= R.cx ? 1 : -1;
  if (mode === "tour" && o.cam !== false) {
    const xs = ord.map((t) => t.x).concat([R.x, R.x + R.w]);
    aimRect({x: Math.min(...xs) - 40, y: R.y - 40, w: Math.max(...xs) - Math.min(...xs) + 80, h: 1612 - R.y + 40}, 60);
  }
  const N = o.n || 9, span = 0.15;
  R.drv.textContent = kind === "read" ? "driver · 4 tasks → 4 executors" : "driver · 4 write tasks";
  let longest = 0;
  ord.forEach((t, i) => {
    const b = R.blades[i], yh = SBUS + dir * (1.5 - i) * 5.5;
    let pts = [[b.cx, R.y + R.h - 16], [b.cx, yh], [t.x, yh], [t.x, t.tb.top + 50]];
    if (kind === "read") pts = pts.slice().reverse();
    const cum = polyLen(pts), dur = 0.75 + cum[cum.length - 1] / 1500;
    longest = Math.max(longest, dur + (N - 1) * span + i * 0.06);
    later(i * 0.06, () => { bladeOn(b, 1); t.tb.n[t.s]++; t.tb.slots[t.s].classList.add(kind === "read" ? "on" : "onw"); });
    for (let n = 0; n < N; n++) parts.push({pts, cum, t0: now + i * 0.06 + n * span, dur, col, r: 6.4});
    lanes.push({pts, col, t0: now + i * 0.06, t1: now + i * 0.06 + dur + (N - 1) * span + 0.3});
    scene.fromTo(b.fill, {attr: {width: 0}}, {attr: {width: 49}, duration: dur + (N - 1) * span, ease: "none"}, scene.time() + i * 0.06);
    later(dur + (N - 1) * span + i * 0.06 + 0.25, () => {
      bladeOn(b, -1); b.fill.setAttribute("width", 0);
      if (--t.tb.n[t.s] <= 0) { t.tb.n[t.s] = 0; t.tb.slots[t.s].classList.remove("on", "onw"); }
    });
  });
  later(longest + 0.3, () => { R.drv.textContent = "driver · plans, splits into tasks"; });
  return wait(longest + 0.35);
}
// rows landing in one table from a managed service (Zerobus): a short stream down one rail
const stream = (from, key, n = 6, col = "#e0a53a") => {
  const r = route(from, "tbl." + key), cum = polyLen(r.pts), tb = TABLE[key];
  tb.slots.forEach((s) => s.classList.add("onw"));
  for (let i = 0; i < n; i++) parts.push({pts: r.pts, cum, t0: now + i * 0.16, dur: 1.5, col, r: 6});
  lanes.push({pts: r.pts, col, t0: now, t1: now + 1.5 + n * 0.16 + 0.3});
  later(1.5 + n * 0.16 + 0.4, () => tb.slots.forEach((s) => s.classList.remove("onw")));
  return wait(1.5 + n * 0.16);
};

// every decision of Unity Catalog is audited: a small packet down the audit rail. In reality the
// record reaches system.access.audit later; the packet is slow on purpose and the log says so.
const audit = (ok = true) => {
  fly("uc.L", "sys.L", {fam: ok ? "plat" : "no", small: true, v: 340, cam: false}).then(() => {
    const s = TABLE.audit.slots[Math.floor(Math.random() * 4)];
    s.classList.add("on");
    later(0.9, () => s.classList.remove("on"));
  });
};

// ----- the event log -----
const logEl = $("log");
let dayMin = 9 * 60;
const hhmm = () => `${String(Math.floor(dayMin / 60) % 24).padStart(2, "0")}:${String(Math.floor(dayMin % 60)).padStart(2, "0")}`;
const say = (html, cls = "") => {
  const li = document.createElement("li");
  li.className = cls;
  li.innerHTML = `<time>${hhmm()}</time>${html}`;
  logEl.prepend(li);                     // the newest line on top
  while (logEl.children.length > 6) logEl.lastChild.remove();
};
// story time: in the whole day one second is two minutes, 09:00 to 18:00, then the next day
function storyClock(dt) {
  dayMin += dt * (mode === "day" ? 2 : 0.5);
  if (dayMin >= 18 * 60) dayMin = 9 * 60;
  const s = hhmm();
  if ($("clock").textContent !== s) $("clock").textContent = s;
}
