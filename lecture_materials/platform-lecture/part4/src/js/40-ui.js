// ---------- the page: build, controls, keys, the postMessage protocol ----------
// The deck embeds this page in an iframe and drives it with messages (README.md has the protocol):
//   in:  {type: "part4", cmd: "scene", n: 1|2}, {cmd: "play"}, {cmd: "pause"}, {cmd: "step"}
//   out: {type: "part4", event: "ready"}, {type: "part4", event: "scene-end", scene: 1|2}
const SCENES = {1: scene1, 2: scene2};
let cur = 1, H = 0, stopAt = null, ended = false, curBeat = -1, speed = 1, quiet = false, started = false;
const EPS = 0.02;      // a step stops this long before the next beat, so the caption still names the beat just played

const stageH = () => {
  const r = stage.getBoundingClientRect();
  if (!r.width || !r.height) return 640;                       // built while hidden: a middle height, rebuilt when shown
  return Math.max(HMIN, Math.min(HMAX, Math.round((W * r.height) / r.width)));
};

function build(n, at = 0) {
  if (tl) tl.kill();
  quiet = true;
  cur = n; H = stageH(); beats = []; seed = 7; avatarN = 0;
  G = buildWorld(n, H);
  tl = gsap.timeline({paused: true, onUpdate: tick, onComplete: done});
  const end = SCENES[n]();
  tl.to({}, {duration: 0.01}, end);
  tl.timeScale(speed);
  ended = false; stopAt = null; curBeat = -1;
  $("dots").replaceChildren(...beats.map((b, i) => {
    const d = document.createElement("button");
    d.textContent = i + 1;
    d.title = b.title;
    d.setAttribute("aria-label", `Beat ${i + 1}: ${b.title}`);
    d.onclick = () => { seek(i); step(); };
    return d;
  }));
  [1, 2].forEach((k) => $("s" + k).setAttribute("aria-selected", String(k === n)));
  svg.setAttribute("aria-label", n === 1
    ? "Scene 1. A developer on the left pushes a change straight to main on GitHub; it deploys into the only environment, inside your Databricks account, while the platform users on the right are at work."
    : "Scene 2. The same change goes through a pull request, CI with a dry run, a review, then dev, acc and prd side by side inside your Databricks account, while the platform users on the right keep working.");
  if (at > 0) tl.time(Math.min(at, tl.duration()));
  quiet = false;
  tick();
}

function tick() {
  if (!tl) return;
  let t = tl.time();
  if (stopAt != null && t >= stopAt && !tl.paused()) { t = stopAt; stopAt = null; tl.pause(); tl.time(t); }
  let b = 0;
  beats.forEach((x, i) => { if (t >= x.t - 1e-3) b = i; });
  if (b !== curBeat) {
    curBeat = b;
    $("capN").textContent = `${b + 1} / ${beats.length}`;
    $("capP").replaceChildren(Object.assign(document.createElement("b"), {textContent: beats[b].title + (/[….!?]$/.test(beats[b].title) ? "" : ".")}), " " + beats[b].text);
    [...$("dots").children].forEach((d, i) => { d.classList.toggle("now", i === b); d.classList.toggle("past", i < b); });
    if (!quiet) post({event: "beat", scene: cur, beat: b + 1, of: beats.length, title: beats[b].title});
  }
  const playing = !tl.paused() && !ended;
  $("bPlay").textContent = ended ? "↻ Replay" : playing ? "❚❚ Pause" : "▶ Play";
  $("bPlay").setAttribute("aria-pressed", String(playing));
  $("big").hidden = started || t > 0;
}
function done() {
  if (quiet || ended) return;
  ended = true; stopAt = null;
  tick();
  post({event: "scene-end", scene: cur});
}

function show(n, at = 0) {
  n = Number(n) === 2 ? 2 : 1;
  const changed = n !== cur;
  started = false;
  build(n, at);
  if (changed) post({event: "scene", scene: n});
}
function play() {
  started = true;
  if (ended) { ended = false; tl.time(0); }
  stopAt = null;
  tl.play();
  tick();
}
function pause() { tl.pause(); stopAt = null; tick(); }
function toggle() { (tl.paused() || ended ? play : pause)(); }
// one beat: play to the end of the beat the clock is in, and stop there
function step() {
  if (ended) return false;
  started = true;
  const t = tl.time(), next = beats.find((b) => b.t - EPS > t + 0.05);
  stopAt = next ? next.t - EPS : null;
  tl.play();
  tick();
  return true;
}
// to the start of a beat, paused
function seek(i) {
  i = Math.max(0, Math.min(beats.length - 1, i));
  ended = false; stopAt = null; started = true;
  tl.pause();
  tl.time(i ? beats[i].t - EPS : 0);
  tick();
}
function back() {
  const t = tl.time();
  let i = 0;
  beats.forEach((b, k) => { if (b.t - EPS < t - 0.4) i = k; });
  seek(i);
}
function setSpeed(v) {
  speed = Math.max(0.5, Math.min(3, Math.round(Number(v) * 4) / 4 || 1));
  $("speed").value = speed;
  $("speedOut").textContent = speed + "×";
  if (tl) tl.timeScale(speed);
}

// ----- controls -----
$("s1").onclick = () => show(1);
$("s2").onclick = () => show(2);
$("bPlay").onclick = toggle;
$("big").onclick = play;
$("bStep").onclick = () => { if (!step() && cur === 1) { show(2); step(); } };
$("bBack").onclick = back;
$("bReplay").onclick = () => { show(cur); play(); };
$("speed").oninput = (e) => setSpeed(e.target.value);

// Keys, when this page has the focus. What it does not use goes to the deck as a "key" event, so
// Esc, F and N keep working while the iframe is focused.
document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = e.target.tagName, onInput = tag === "INPUT", onButton = tag === "BUTTON";
  const k = e.key;
  let used = true;
  if (k === "ArrowRight" || k === "PageDown") {
    if (onInput) return;
    if (!step()) {
      if (cur === 1) { show(2); step(); }
      else { used = false; }
    }
  } else if (k === "ArrowLeft" || k === "PageUp") { if (onInput) return; back(); }
  else if (k === " " || k === "k") { if (onButton && k === " ") return; toggle(); }
  else if (k === "r") { show(cur); play(); }
  else if (k === "1" || k === "2") show(Number(k));
  else if (k === "[") setSpeed(speed - 0.25);
  else if (k === "]") setSpeed(speed + 0.25);
  else used = false;
  if (used) e.preventDefault();
  else if (k.length > 1 || /^[a-z0-9]$/i.test(k)) post({event: "key", key: k, shiftKey: e.shiftKey, scene: cur, ended});
});

// ----- the protocol -----
window.addEventListener("message", (e) => {
  const m = e.data;
  if (!m || m.type !== "part4" || typeof m.cmd !== "string" || !tl) return;
  if (m.cmd === "scene") { show(m.n, 0); if (m.play) play(); }
  else if (m.cmd === "play") play();
  else if (m.cmd === "pause") pause();
  else if (m.cmd === "step") step();
  else if (m.cmd === "back") back();
  else if (m.cmd === "beat") seek(Number(m.n) - 1);
  else if (m.cmd === "replay") { show(cur); play(); }
  else if (m.cmd === "speed") setSpeed(m.value);
});
document.addEventListener("visibilitychange", () => { if (document.hidden && tl && !tl.paused()) pause(); });

// the stage changed shape (the deck went full screen, the window was resized): draw the world for
// the new height and put the clock back where it was
let rz = 0;
new ResizeObserver(() => {
  clearTimeout(rz);
  rz = setTimeout(() => {
    if (!tl || Math.abs(stageH() - H) < 4) return;
    const t = tl.time(), playing = !tl.paused(), sa = stopAt, was = ended, st = started;
    build(cur, t);
    started = st; stopAt = sa; ended = was;
    if (playing && !was) tl.play();
    tick();
  }, 120);
}).observe(stage);

// ----- start -----
const q = new URLSearchParams(location.search);
if (q.get("speed")) setSpeed(q.get("speed"));
const fonts = document.fonts ? Promise.all([document.fonts.load('600 17px "Nunito"'), document.fonts.load('500 17px "Nunito"'), document.fonts.load('500 16px "Fira Code"')]) : Promise.resolve();
Promise.race([fonts, new Promise((r) => setTimeout(r, 2500))]).catch(() => {}).then(() => {
  build(q.get("scene") === "2" ? 2 : 1);
  window.__part4 = {show, play, pause, step, back, seek, setSpeed, at: (t) => { ended = false; stopAt = null; started = true; tl.pause(); tl.time(t); tick(); }, state: () => ({scene: cur, time: tl.time(), duration: tl.duration(), paused: tl.paused(), ended, beat: curBeat + 1, beats: beats.map((b) => ({t: b.t, title: b.title})), H})};
  post({event: "ready", ok: true, scene: cur, scenes: 2, beats: beats.length});
  if (q.get("autoplay") === "1") play();
});
