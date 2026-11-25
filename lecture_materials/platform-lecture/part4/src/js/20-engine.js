// ---------- the engine: the scene clock and what is placed on it ----------
// tl is the scene clock, a paused GSAP timeline. Every helper below takes the second at which its
// motion starts and adds tweens at that second; it returns the second at which it ends. Nothing
// here runs a callback that changes the drawing, so the clock can be sought to any second.

let tl = null, G = null, beats = [];
const SPEED = 540;                       // units per second of a packet at 1×
let seed = 1;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };   // the same flicker on every build

const beat = (t, title, text) => { beats.push({t, title, text}); return t; };

// the seconds at which a packet at `speed` passes each point of a polyline
const times = (t, pts, speed = SPEED) => { let d = 0; return pts.map((p, i) => (i ? (d += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1])) : 0, t + d / speed)); };
const dedupe = (pts) => pts.filter((p, i) => !i || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);

// a packet: a disc with a halo, flown along a polyline at a steady speed
const fly = (t, pts, o = {}) => {
  pts = dedupe(pts);
  const col = o.col || FAM.user, r = o.r || 6.5;
  const g = el("g", {opacity: 0}, L.pk);
  el("circle", {r: r + 4.5, fill: col, opacity: 0.22}, g);
  el("circle", {r, fill: col, class: "pk-disc"}, g);
  gsap.set(g, {x: pts[0][0], y: pts[0][1]});
  const dur = pathLen(pts) / (o.speed || SPEED);
  tl.set(g, {opacity: 1}, t);
  if (pts.length === 2) tl.to(g, {x: pts[1][0], y: pts[1][1], duration: dur, ease: "none"}, t);
  else tl.to(g, {motionPath: {path: pts.slice(1).map(([x, y]) => ({x, y})), curviness: 0}, duration: dur, ease: "none"}, t);
  tl.to(g, {opacity: 0, duration: 0.12}, t + dur);
  return t + dur;
};

// a ring that opens where something happens
const ring = (t, x, y, col, r0 = 8, r1 = 26) => {
  const c = el("circle", {cx: x, cy: y, r: r0, fill: "none", stroke: col, "stroke-width": 3, opacity: 0}, L.fx);
  tl.set(c, {opacity: 0.9}, t);
  tl.to(c, {attr: {r: r1}, opacity: 0, duration: 0.6, ease: "power2.out"}, t);
};

// a tile's border lights for a moment
const pulse = (t, o, col = FAM.plat, d = 0.5) => {
  tl.to(o.face, {stroke: col, strokeWidth: 3, duration: 0.1}, t);
  tl.to(o.face, {stroke: "#d9d6d1", strokeWidth: 1.5, duration: 0.3}, t + d);
};
const shake = (t, target, amp = 4) => {
  tl.to(target, {x: amp, duration: 0.05, ease: "none"}, t);
  tl.to(target, {x: -amp, duration: 0.07, yoyo: true, repeat: 4, ease: "none"}, t + 0.05);
  tl.to(target, {x: 0, duration: 0.05, ease: "none"}, t + 0.4);
};

// a verdict: the visible moment of a check. A disc with a tick or a cross, a ring, a tag.
// The disc sits on the tile's top edge, near its right corner; the tag stands above the tile, its
// right edge on the disc's (dy moves it: the tags of identity and auth and of the two authorizers
// hang under their tiles, clear of the front door and of the plane's label). hold: seconds before
// it fades (Infinity: it stays)
const verdict = (t, x, y, ok, text, o = {}) => {
  const col = ok ? FAM.ok : FAM.no, r = o.r || 11.5;
  const g = el("g", {transform: `translate(${x},${y})`}, L.top);
  const rg = el("circle", {r, fill: "none", stroke: col, "stroke-width": 3, opacity: 0}, g);
  let tag = null;
  if (text) {
    const w = textW(text, F.bold) + 24, dy = o.dy == null ? -27 : o.dy;
    tag = el("g", {opacity: 0}, g);
    el("rect", {x: r - w, y: dy - 14, width: w, height: 28, rx: 14, class: "vd-tag", stroke: col}, tag);
    txt(r - w / 2, dy + 6, text, "vd-t", tag, {"text-anchor": "middle", fill: ok ? INK_OK : INK_NO});
  }
  const inner = el("g", {}, g);
  el("circle", {r, fill: col, class: "vd-disc"}, inner);
  el("path", {d: ok ? "M-5 0l3.5 4.2l6.8-8.4" : "M-4.5-4.5l9 9M4.5-4.5l-9 9", class: "vd-mark"}, inner);
  gsap.set(inner, {scale: 0, svgOrigin: "0 0"});
  tl.to(inner, {scale: 1, duration: 0.32, ease: "back.out(2.6)"}, t);
  tl.set(rg, {opacity: 0.9}, t + 0.05);
  tl.to(rg, {attr: {r: r * 2.7}, opacity: 0, duration: 0.7, ease: "power2.out"}, t + 0.05);
  if (tag) tl.to(tag, {opacity: 1, duration: 0.22}, t + 0.08);
  const hold = o.hold == null ? 1.25 : o.hold;
  if (hold !== Infinity) tl.to(g, {opacity: 0, duration: 0.28}, t + hold);
  return t + (o.wait == null ? 0.3 : o.wait);
};
const corner = (o) => [o.x + o.w - 22, o.y];

// a state disc or any small thing that pops in, and out
const hidden = (...nodes) => nodes.forEach((n) => gsap.set(n, {scale: 0, svgOrigin: "0 0"}));
const pop = (t, node) => tl.to(node, {scale: 1, duration: 0.3, ease: "back.out(2.4)"}, t);
const unpop = (t, node) => tl.to(node, {scale: 0, duration: 0.16, ease: "power1.in"}, t);
const fade = (t, node, to, d = 0.22) => tl.to(node, {opacity: to, duration: d}, t);
const swap = (t, from, to) => { fade(t, from, 0, 0.15); fade(t + 0.12, to, 1, 0.2); };
const turn = (t, node, secs) => tl.to(node, {rotation: "+=" + 360 * Math.max(1, Math.round(secs / 0.9)), duration: secs, ease: "none", svgOrigin: "0 0"}, t);

// ----- bubbles: what a person says, or thinks -----
// at: the bubble's top corner on the side it is aligned to (with o.bottom, at[1] is the highest it
// may start and the bubble stands on o.bottom); to: the head it belongs to
const bubble = (at, lines, o = {}) => {
  const w = Math.max(...lines.map((l) => textW(l, F.bold))) + 28, h = lines.length * 21 + 15;
  const x = o.align === "L" ? at[0] : at[0] - w, y = o.bottom == null ? at[1] : Math.max(at[1], o.bottom - h);
  const g = el("g", {}, L.top), inner = el("g", {}, g), [hx, hy] = o.to;
  const cls = "bub " + (o.cls || "");
  const ax = Math.min(x + w - 18, Math.max(x + 18, hx));
  el("rect", {x: x + 1, y: y + 3, width: w - 2, height: h, rx: 15, class: "sh1"}, inner);
  if (o.think) {
    const bx = hx < x ? x + 14 : ax, by = y + h;
    [[0.4, 5.5], [0.8, 3.6]].forEach(([f, r]) => el("circle", {cx: bx + (hx - bx) * f, cy: by + 3 + (hy - by - 3) * f, r, class: cls}, inner));
  } else {
    const tip = Math.min(y + h + 11, Math.max(y + h + 5, hy - 2));
    el("path", {d: `M${ax - 8} ${y + h - 2}L${ax + (hx - ax) * 0.3} ${tip}L${ax + 8} ${y + h - 2}Z`, class: cls + " tail"}, inner);
  }
  el("rect", {x, y, width: w, height: h, rx: 14, class: cls}, inner);
  if (!o.think) el("path", {d: `M${ax - 7} ${y + h - 0.6}h14`, class: "bub-seam " + (o.cls || "")}, inner);
  lines.forEach((l, i) => txt(x + w / 2, y + 27 + i * 21, l, "bub-t " + (o.cls || ""), inner, {"text-anchor": "middle"}));
  gsap.set(inner, {opacity: 0, scale: 0.7, svgOrigin: `${ax} ${y + h}`});
  return {g: inner, x, y, w, h};
};
const bshow = (t, b) => tl.to(b.g, {opacity: 1, scale: 1, duration: 0.28, ease: "back.out(1.8)"}, t);
const bhide = (t, b) => tl.to(b.g, {opacity: 0, scale: 0.85, duration: 0.18}, t);
const say = (t, b, hold) => { bshow(t, b); bhide(t + hold, b); };
// a bubble of one of the users, above their head
const ubub = (u, lines, cls) => bubble([1258, u.top], lines, {to: u.head, bottom: u.head[1] - 13, cls});
// the developer's thought: above his head where the stage is tall enough, else to the right of it
const think = (lines, cls) => bubble(G.dev.head[1] >= 124 ? [282, 42] : [298, 14], lines, {to: G.dev.head, think: true, cls});

// ----- what a laptop shows -----
const flash = (t, p) => { tl.to(p.flash, {opacity: 0.85, duration: 0.08}, t); tl.to(p.flash, {opacity: 0, duration: 0.35}, t + 0.1); };
const nod = (t, p) => tl.to(p.bust, {y: -3.5, duration: 0.14, yoyo: true, repeat: 1, ease: "power1.out"}, t);
const typing = (t, p, secs) => { for (let i = 0; i < secs / 0.45; i++) flash(t + i * 0.45, p); };

// ----- what happens to the things of an environment -----
const lightRack = (t, r, d = 0.9) => r.blades.forEach((b, i) => { fade(t + i * 0.07, b.lit, 1, 0.1); fade(t + d + i * 0.05, b.lit, 0, 0.25); });
const hitTables = (t, tb) => tb.cyls.forEach((c, i) => { fade(t + i * 0.06, c.hit, 1, 0.1); fade(t + 0.5 + i * 0.06, c.hit, 0, 0.3); });
const star = (t, x, y, s = 1, col = FAM.token) => {
  const g = el("g", {transform: `translate(${x},${y})`}, L.fx), inner = el("g", {}, g);
  el("path", {d: "M0-12l3 8.5l8.5 3.5l-8.5 3.5l-3 8.5l-3-8.5l-8.5-3.5l8.5-3.5z", fill: col, transform: `scale(${s})`}, inner);
  hidden(inner);
  tl.to(inner, {scale: 1, rotation: 40, duration: 0.3, ease: "back.out(2)"}, t);
  tl.to(inner, {scale: 0, rotation: 90, duration: 0.3, ease: "power1.in"}, t + 0.45);
};
// storage is deleted: the tables shake, then are gone; their outlines stay
const dropTables = (t, tb) => {
  tb.cyls.forEach((c, i) => {
    const t0 = t + i * 0.16;
    shake(t0, c.inner, 3);
    tl.to(c.inner, {scale: 0, opacity: 0, duration: 0.3, ease: "back.in(2)", svgOrigin: `${c.cx} ${c.cy}`}, t0 + 0.42);
    fade(t0 + 0.5, c.ghost, 1, 0.2);
    c.puffs.forEach((p, j) => {
      tl.set(p, {opacity: 0.75}, t0 + 0.62);
      tl.to(p, {x: (j % 2 ? 1 : -1) * (8 + j * 3), y: -6 - j * 3, attr: {r: 9}, opacity: 0, duration: 0.6, ease: "power2.out"}, t0 + 0.62);
    });
  });
  swap(t + 0.9, tb.name, tb.gone);
  return t + 1.3;
};
// a permission is revoked
const revoke = (t, gr) => { shake(t, gr.g, 3); swap(t + 0.3, gr.ok, gr.no); return t + 0.6; };
// compute goes up in flames, and burns until `until`
const burn = (t, r, until) => {
  fade(t, r.fire, 1, 0.3);
  fade(t + 0.1, r.char, 0.5, 0.8);
  shake(t, r.g, 3);
  r.flames.forEach((f, i) => {
    gsap.set(f, {scaleY: 0.2, scaleX: 0.8, svgOrigin: "0 0"});
    const d = 0.15 + rnd() * 0.12, t0 = t + i * 0.08;
    tl.to(f, {scaleY: 1, scaleX: 1, duration: 0.3, ease: "back.out(2)"}, t0);
    tl.to(f, {scaleY: 0.78 + rnd() * 0.1, scaleX: 1.1, duration: d, yoyo: true, repeat: Math.max(1, Math.floor((until - t0 - 0.3) / d) - 1), ease: "sine.inOut"}, t0 + 0.3);
  });
  r.smoke.forEach((s, i) => {
    const t0 = t + 0.4 + i * 0.5, d = 1.5, n = Math.max(0, Math.floor((until - t0) / d) - 1);
    tl.fromTo(s, {y: 0, opacity: 0.55}, {y: -30 - i * 6, opacity: 0, duration: d, repeat: n, ease: "power1.out", immediateRender: false}, t0);
  });
  return t + 0.6;
};
// a dashboard breaks: its bars fall, its face cracks
const breakDash = (t, d) => {
  shake(t, d.g, 4);
  d.bars.forEach((b, i) => tl.to(b, {scaleY: 0.1, duration: 0.3, ease: "bounce.out", svgOrigin: `0 ${d.by}`}, t + 0.1 + i * 0.05));
  fade(t + 0.35, d.broken, 1, 0.25);
  return t + 0.7;
};
// the change lands well: a green border for a moment and a star
const update = (t, o) => { pulse(t, o, FAM.ok, 0.7); star(t, o.x + o.w - 4, o.y + 2, 0.8); };
const improve = (t, d) => {
  update(t, d);
  tl.to(d.trend, {attr: {"stroke-dashoffset": 0}, duration: 0.6, ease: "power2.out"}, t + 0.1);
  fade(t + 0.6, d.star, 1, 0.2);
};

// ----- the ways through the platform -----
// A user's request, in the order every request takes: the front door, identity and auth, one
// authorizer (workspace ACLs for a dashboard, Unity Catalog for data), then the grant, the compute
// and the storage of the environment. o.fail names where it is refused or breaks.
const request = (t, u, s, o = {}) => {
  const via = o.via || "uc", zt = via === "uc" ? G.uc : G.acl, col = FAM.user;
  const zx = zt.cx, B = G.BUS;
  let e = fly(t, G.pUser(u), {col});
  ring(e - 0.42, ...G.cross.R, col);
  pulse(e, G.door, col, 0.4);
  e = fly(e, G.pDoorAuth("R"), {col});
  pulse(e, G.auth, FAM.ok);
  e = verdict(e, ...corner(G.auth), true);
  e = fly(e, G.pAuthTo(via), {col});
  let fwd = [...G.pUser(u), ...G.pDoorAuth("R"), ...G.pAuthTo(via)];
  const back = (at, ok) => fly(at, rev(dedupe(fwd)), {col: ok ? FAM.ok : FAM.no, speed: 1000});
  if (o.fail === "authz") {
    pulse(e, zt, FAM.no, 0.9);
    shake(e, zt.g, 3);
    verdict(e, ...corner(zt), false, o.tag, {dy: 54, hold: 2.4});
    return back(e + 0.55, false);
  }
  pulse(e, zt, FAM.ok);
  e = verdict(e, ...corner(zt), true);
  // down the lane: past the dashboard (asked through workspace ACLs), the grant, the compute, to the tables
  const stops = [s.dash, s.grant, s.rack, s.tab], last = o.fail === "dash" ? 0 : o.fail === "rack" ? 2 : 3;
  const first = via === "acl" ? 0 : 1;
  const down = [[zx, 118], [zx, B], [s.gx, B], ...stops.slice(0, last + 1).map((p) => [s.gx, p.cy]), [s.x + 4, stops[last].cy]];
  const at = times(e, down);
  fwd = fwd.concat(down);
  stops.slice(0, last + 1).forEach((p, i) => {
    if (i < first) return;
    const ti = i === last ? at[at.length - 1] : at[3 + i];
    if (i === last && o.fail) { verdict(ti, ...corner(p), false, o.tag, {hold: 2.4}); return; }
    if (p === s.dash) pulse(ti, p, col);
    else if (p === s.grant) pulse(ti, p, FAM.token, 0.4);
    else if (p === s.rack) lightRack(ti, p);
    else hitTables(ti, p);
  });
  e = fly(e, down, {col});
  return back(e + (o.fail ? 0.5 : 0.35), !o.fail);
};
// a happy user: a request, the answer on the laptop, a bubble
const happy = (t, u, s, via, b) => {
  const e = request(t, u, s, {via});
  flash(e, u); nod(e, u);
  if (b) say(e + 0.05, b, 1.7);
  return e;
};

// A call of the deployment: from GitHub Actions through the same front door, authenticated, then
// authorized, then down to the object it changes. Returns the second it arrives.
const deployTo = (t, from, via, s, obj, o = {}) => {
  const zt = via === "uc" ? G.uc : G.acl, zx = zt.cx, col = o.col || FAM.dev, speed = o.speed || 760;
  const pts = dedupe([...G.pTrunk(from), [640, G.RAIL_Y], [640, 118], [zx, 118], [zx, G.BUS], [s.gx, G.BUS], [s.gx, obj.cy], [s.x + 4, obj.cy]]);
  const at = times(t, pts, speed);
  ring(at[2] + 7 / speed, ...G.cross.L, col);
  pulse(at[3], G.door, col, 0.3);
  pulse(at[5], G.auth, FAM.ok, 0.3);
  pulse(at[6], zt, FAM.ok, 0.3);
  return fly(t, pts, {col, speed, r: o.r});
};
// the first call of a deployment, shown slowly: the token, the two verdicts
const signIn = (t, from, o = {}) => {
  let e = fly(t, G.pTrunk(from), {col: FAM.token, speed: 620});
  ring(e - 0.35, ...G.cross.L, FAM.token);
  pulse(e, G.door, FAM.token, 0.4);
  e = fly(e, G.pDoorAuth("L"), {col: FAM.token, speed: 620});
  pulse(e, G.auth, FAM.ok, 1.2);
  e = verdict(e, ...corner(G.auth), true, o.who || "authenticated", {dy: 54, hold: o.hold || 2.6, wait: 0.5});
  fly(e, G.pAuthTo("uc"), {col: FAM.dev, speed: 620});
  const e2 = fly(e, G.pAuthTo("acl"), {col: FAM.dev, speed: 620});
  pulse(e2, G.uc, FAM.ok, 1); pulse(e2, G.acl, FAM.ok, 1);
  verdict(e2, ...corner(G.uc), true, o.quiet ? "" : "authorized", {dy: 54, hold: (o.hold || 2.6) - 0.9});
  return verdict(e2, ...corner(G.acl), true, o.quiet ? "" : "authorized", {dy: 54, hold: (o.hold || 2.6) - 0.9, wait: 0.6});
};

// the stamp that closes a scene
const stamp = (t, lines, col) => {
  const [cx, cy] = G.mid, w = Math.max(...lines.map((l) => textW(l, '600 30px "Nunito", system-ui, sans-serif') * 1.09)) + 56, h = lines.length * 38 + 26;
  const g = el("g", {transform: `translate(${cx},${cy})`}, L.top), inner = el("g", {}, g);
  el("rect", {x: -w / 2, y: -h / 2, width: w, height: h, rx: 14, fill: "#fff", opacity: 0.94}, inner);
  el("rect", {x: -w / 2, y: -h / 2, width: w, height: h, rx: 14, fill: "none", stroke: col, "stroke-width": 4}, inner);
  el("rect", {x: -w / 2 + 7, y: -h / 2 + 7, width: w - 14, height: h - 14, rx: 9, fill: "none", stroke: col, "stroke-width": 1.5}, inner);
  lines.forEach((l, i) => txt(0, -h / 2 + 49 + i * 38, l, "stamp-t", inner, {"text-anchor": "middle", fill: col}));
  gsap.set(inner, {opacity: 0, scale: 2.2, rotation: -4, svgOrigin: "0 0"});
  tl.to(inner, {opacity: 1, scale: 1, duration: 0.3, ease: "power3.in"}, t);
  shake(t + 0.3, L.top, 3);
  return t + 0.8;
};
