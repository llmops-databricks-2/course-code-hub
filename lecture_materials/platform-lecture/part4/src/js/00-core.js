// Part 4 of the platform lecture: "dev → acc → prd for infrastructure", two animated scenes.
// The drawing language is the one of lecture_materials/day-on-the-platform (developers on the
// left, GitHub below them, your Databricks account in the middle, the platform users on the right;
// white tiles with depth, packets that fly along rails, verdict discs), redrawn here for a stage
// that is always whole on screen: a world 1280 units wide and 580 to 740 high, so one unit is at
// least one CSS pixel on a 1280-wide screen and every label is 16 units or more.
//
// The files of src/js are concatenated in name order into one function scope by build.py:
// 00-core (helpers), 05-people (the figures), 10-world (the drawing, laid out for a height),
// 20-engine (the scene clock, packets, verdicts, bubbles, effects), 30-scene1 and 35-scene2 (the
// two stories, beat by beat), 40-ui (controls, keys, the postMessage protocol).
//
// One clock: every motion of a scene is a child of one paused GSAP timeline, built whole before it
// plays. Nothing is changed from a callback, so the timeline can be paused, stepped, sought back
// and rebuilt for another stage height at the same second.

const NS = "http://www.w3.org/2000/svg";
const $ = (id) => document.getElementById(id);
const post = (msg) => { if (window.parent !== window) window.parent.postMessage({type: "part4", page: "index", ...msg}, "*"); };
if (!window.gsap || !window.MotionPathPlugin) {
  // the CDN did not answer: say so instead of showing an empty stage
  const b = $("err");
  b.hidden = false;
  b.textContent = "This page loads GSAP from cdnjs.cloudflare.com and could not reach it. Open it with a network connection, or use index.bundled.html, which carries everything.";
  post({event: "ready", ok: false});
  return;
}
gsap.registerPlugin(MotionPathPlugin);
const svg = $("sv"), stage = $("stage");
const W = 1280, HMIN = 580, HMAX = 740;
const FAM = {dev: "#c9705f", token: "#d9a441", user: "#6b5fb0", plat: "#506fa0", data: "#4e7566", ok: "#3f9b6b", no: "#d64545"};
const INK_OK = "#1f6b46", INK_NO = "#a12b2b";

const el = (tag, attrs, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};
const txt = (x, y, s, cls, parent, attrs = {}) => {
  // a fill is set as a style: a fill attribute would lose to the stylesheet's rule for text
  const {fill, ...rest} = attrs;
  const t = el("text", {x, y, class: cls, ...rest}, parent);
  if (fill) t.style.fill = fill;
  t.textContent = s;
  return t;
};
const use = (id, x, y, size, parent, attrs = {}) => el("use", {href: "#" + id, x, y, width: size, height: size, ...attrs}, parent);

// text is measured on a canvas, not in the SVG: the page may be built while its iframe is hidden,
// and a hidden SVG measures every text as zero
const meas = document.createElement("canvas").getContext("2d");
const textW = (s, font) => { meas.font = font; return meas.measureText(s).width; };
const F = {
  body: '500 17px "Nunito", system-ui, sans-serif',
  bold: '600 17px "Nunito", system-ui, sans-serif',
  mono: '500 16px "Fira Code", ui-monospace, monospace',
};

// an orthogonal polyline's length, and its points as GSAP wants them
const pathLen = (pts) => pts.reduce((n, p, i) => (i ? n + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
const rev = (pts) => pts.slice().reverse();
const polyD = (pts) => "M" + pts.map((p) => p[0] + " " + p[1]).join("L");
