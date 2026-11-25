// ---------- the tour, the whole day, and everything the viewer can touch ----------
const report = (e) => {
  console.error(e);
  const b = $("err");
  b.hidden = false;
  b.textContent = "The scene stopped on an error: " + ((e && e.message) || e);
};

// back to a clean drawing: nothing in flight, nothing lit, every loop of the old story abandoned
function resetWorld() {
  epoch++;
  clearScene();
  lastTick = scene.time();
  [Lpk, Ltop, Lhot].forEach((l) => (l.textContent = ""));
  livePk.clear(); trails.clear();
  parts.length = sparks.length = rings.length = lanes.length = 0;
  Object.values(RACK).forEach((r) => {
    r.blades.forEach((b) => { b.n = 0; b.el.classList.remove("on"); b.fill.setAttribute("width", 0); });
    r.drv.textContent = "driver · plans, splits into tasks";
  });
  Object.values(TABLE).forEach((t) => { t.n = [0, 0, 0, 0]; t.slots.forEach((s) => s.classList.remove("on", "onw")); });
  Object.values(T).forEach((t) => { t.g.classList.remove("lit"); if (t.sub) t.sub.textContent = t.sub0; gsap.set(t.g, {x: 0}); });
  Object.values(P).forEach((p) => { p.st.textContent = ""; gsap.set(p.bust, {y: 0}); gsap.set(p.flash, {opacity: 0}); gsap.set(p.glow, {opacity: 0.5}); });
  ["acc", "gate", "prd"].forEach((k) => cdSet(k, "idle"));
  Object.values(ENV).forEach((r) => r.setAttribute("fill", "none"));
  GATES.forEach((g) => { gsap.set(g.g, {scale: 1}); g.g.firstChild.removeAttribute("style"); });
  PERIMS.forEach((q) => q.z.classList.remove("crossed"));
  for (const k in vdCount) vdCount[k] = 0;
  for (const k in gates) gates[k].length = 0;
  graph.reset();
  logEl.textContent = "";
  follow = null;
  prNo = 41;
  $("bNext").classList.remove("ready");
}

// ----- play and pause: the scene clock runs only while playing and on screen -----
let playing = true, visible = false, started = false, presenting = false;
const setLive = () => {
  const live = playing && visible && !document.hidden;
  ticking = live;
  scene.paused(!live);
};
const setPlaying = (v) => {
  playing = v;
  const b = $("bPlay");
  b.innerHTML = playing ? '<span aria-hidden="true">❚❚</span> Pause' : '<span aria-hidden="true">▶</span> Play';
  b.classList.toggle("paused", !playing);
  b.setAttribute("aria-pressed", String(!playing));
  theater.classList.toggle("paused", !playing);
  setLive();
};
// ----- speed: 1× is the pace the stories were timed at; the slider scales the scene clock -----
const PACE = 0.8;
let speed = 1;
const setSpeed = (v) => {
  speed = clamp(Math.round(v * 4) / 4, 0.25, 3);
  $("speed").value = String(speed);
  $("speedOut").textContent = speed + "×";
  scene.timeScale(PACE * speed);
};

// ----- the tour -----
let chap = 0, camTween = null;
const storyCam = (f) => { const ks = kStory(), t = fitRect(f, 20); t.k = clamp(t.k, ks * 0.84, ks * 1.12); return t; };
function show(i) {
  chap = clamp(i, 0, CH.length);
  resetWorld();
  const whole = chap === CH.length, c = whole ? WHOLE : CH[chap];
  mode = whole ? "day" : "tour";
  theater.classList.toggle("whole", whole);
  $("capN").textContent = whole ? "all day" : `${chap + 1} / ${CH.length}`;
  $("capT").textContent = c.t;
  $("capP").innerHTML = c.c;
  $("bBack").disabled = chap === 0;
  $("bNext").disabled = whole;
  $("bWhole").disabled = whole;
  $("jump").value = String(chap);
  free = false;
  $("bResume").hidden = true;
  closeInfo();
  dayMin = 9 * 60 + (whole ? 0 : chap * 52);
  if (whole) {
    aim.on = false;
    camTween = camTo(fitRect(ALL, 8), 1);
    startDay().forEach((p) => p.catch(report));
  } else {
    if (c.setup) c.setup();
    const t = storyCam(c.f);
    aim.x = t.x; aim.y = t.y; aim.k = t.k; aim.on = true;
    camTween = camTo(t, 0.9);
    const my = epoch;
    later(1.1, () => c.play().then(() => {
      if (my !== epoch) return;
      say(chap < CH.length - 1 ? "End of the chapter. Press Next →" : "End of the tour. Press Next for the whole day", "ok");
      $("bNext").classList.add("ready");
    }).catch(report));
  }
  setLive();
}
const takeOver = () => {
  if (mode === "tour" && !free) { free = true; $("bResume").hidden = false; }
  $("hint").classList.add("gone");
};
$("bBack").onclick = () => show(chap - 1);
$("bNext").onclick = () => show(chap + 1);
$("bReplay").onclick = () => show(chap);
$("bWhole").onclick = () => show(CH.length);
$("bResume").onclick = () => { free = false; $("bResume").hidden = true; closeInfo(); camTween = camTo({x: aim.x, y: aim.y, k: aim.k}, 0.7); };
// the Jump to menu: straight to a chapter; it lets go of the focus so the keys reach the scene again
$("jump").onchange = (e) => { show(+e.target.value); e.target.blur(); };
$("bPlay").onclick = () => setPlaying(!playing);
$("speed").oninput = (e) => setSpeed(+e.target.value);
$("speed").onchange = (e) => e.target.blur();
setSpeed(1);
// a button clicked with the mouse (in the bar, or the zoom buttons on the map) lets go of the focus
// too, so Space after it pauses the scene instead of pressing that button again; a button reached
// with Tab keeps it
theater.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b && e.detail > 0) b.blur(); });
$("tDevs").onchange = (e) => setOn("devs", e.target.checked);
$("tUsers").onchange = (e) => setOn("users", e.target.checked);
$("tSched").onchange = (e) => setOn("sched", e.target.checked);

// ----- the explanation overlay -----
const info = $("info");
function closeInfo() { info.hidden = true; stage.classList.remove("info-open"); }
function openInfo(id) {
  const z = INFO[id];
  if (!z) return false;
  info.innerHTML = `<button class="x" aria-label="Close">×</button><h3>${z[0]}</h3><p>${z[1]}</p>` +
    (z[2] ? `<p class="who"><b>Who uses it:</b> ${z[2]}</p>` : "") + (z[3] ? `<p class="simp"><b>Simplified:</b> ${z[3]}</p>` : "");
  info.hidden = false;
  stage.classList.add("info-open");
  info.querySelector(".x").onclick = closeInfo;
  return true;
}
const clickPart = (target) => {
  const z = target && target.closest ? target.closest("[data-zone]") : null;
  if (!z || !openInfo(z.getAttribute("data-zone"))) { closeInfo(); return; }
  takeOver();
  const bb = z.getBBox(), big = bb.width > 900 || bb.height > 700;
  const f = fitRect({x: bb.x, y: bb.y, w: bb.width, h: bb.height}, big ? 30 : 170);
  f.k = Math.min(f.k, 1.7);
  if (sw > 900 && !big) f.x += 190 / f.k;        // leave the right of the stage to the overlay
  camTween = camTo(f, 0.7);
};
svg.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.closest("[data-zone]")) { e.preventDefault(); e.stopPropagation(); clickPart(e.target); } });

// ----- pan, zoom, pinch -----
const ptrs = new Map();
let moved = 0, downTarget = null, pinch = null, vel = {x: 0, y: 0, t: 0};
const zoomAt = (cx, cy, f) => {
  const r = stage.getBoundingClientRect(), px = cx - r.left - sw / 2, py = cy - r.top - sh / 2;
  const wx = cam.x + px / cam.k, wy = cam.y + py / cam.k;
  cam.k = clamp(cam.k * f, kFit() * 0.85, 3.2);
  cam.x = wx - px / cam.k; cam.y = wy - py / cam.k;
  applyCam();
};
stage.addEventListener("pointerdown", (e) => {
  if (e.target.closest(".hud")) return;
  stage.focus({preventScroll: true});
  ptrs.set(e.pointerId, {x: e.clientX, y: e.clientY});
  if (ptrs.size === 1) { moved = 0; downTarget = e.target; vel = {x: 0, y: 0, t: performance.now()}; }
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  gsap.killTweensOf(cam);
  try { stage.setPointerCapture(e.pointerId); } catch (_) { /* a synthetic pointer */ }
});
stage.addEventListener("pointermove", (e) => {
  const p = ptrs.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch);
    pinch = d; moved = 99; takeOver();
    return;
  }
  moved += Math.abs(dx) + Math.abs(dy);
  if (moved < 6) return;
  stage.classList.add("drag");
  cam.x -= dx / cam.k; cam.y -= dy / cam.k;
  const t = performance.now(), dt = Math.max(1, t - vel.t);
  vel = {x: vel.x * 0.6 + (dx / dt) * 0.4, y: vel.y * 0.6 + (dy / dt) * 0.4, t};
  applyCam(); takeOver();
});
const pointerEnd = (e) => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  pinch = null;
  if (ptrs.size) return;
  stage.classList.remove("drag");
  if (moved < 6) { if (e.type === "pointerup") clickPart(downTarget); return; }
  // inertia: the map keeps gliding for a moment
  if (!reduced && performance.now() - vel.t < 80 && Math.hypot(vel.x, vel.y) > 0.15)
    gsap.to(cam, {x: cam.x - (vel.x * 260) / cam.k, y: cam.y - (vel.y * 260) / cam.k, duration: 0.9, ease: "power3.out", onUpdate: applyCam});
};
stage.addEventListener("pointerup", pointerEnd);
stage.addEventListener("pointercancel", pointerEnd);
stage.addEventListener("wheel", (e) => {
  if (e.target.closest(".hud-info")) return;
  const focused = stage.contains(document.activeElement) || presenting;
  if (!(focused || e.ctrlKey || e.metaKey)) return;       // unfocused: the page scrolls
  e.preventDefault();
  gsap.killTweensOf(cam);
  zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0016)));
  takeOver();
}, {passive: false});
const zoomBy = (f) => { takeOver(); camTween = camTo({x: cam.x, y: cam.y, k: clamp(cam.k * f, kFit() * 0.85, 3.2)}, 0.3); };
$("zIn").onclick = () => zoomBy(1.35);
$("zOut").onclick = () => zoomBy(1 / 1.35);
const fitAll = () => { takeOver(); closeInfo(); camTween = camTo(fitRect(ALL, 8), 0.7); };
$("zFit").onclick = fitAll;

// ----- the minimap -----
const mini = $("mini");
mini.setAttribute("viewBox", `0 0 ${W} ${H}`);
[["m-o", 0, 0, W, H, 0], ["m-u", 30, 30, 540, 670, 30], ["m-g", 36, 730, 528, 830, 80], ["m-u", 2420, 24, 560, 1642, 30], ["m-d", DBX.x, DBX.y, DBX.w, DBX.h, 34],
  ["m-y", YOURS.x, YOURS.y, YOURS.w, YOURS.h, 24], ["m-y", RES.x, RES.y, RES.w, RES.h, 24], ["m-p", 696, 154, 1420, 148, 24], ["m-p", 696, 322, 1420, 558, 24], ["m-p", 696, 930, 1420, 400, 24], ["m-s", 696, 1400, 1420, 250, 24]]
  .forEach(([c, x, y, w, h, rx]) => el("rect", {class: c, x, y, width: w, height: h, rx}, mini));
const miniView = el("rect", {class: "m-v", rx: 12}, mini);
onCam = () => {
  const hw = sw / 2 / cam.k, hh = sh / 2 / cam.k;
  miniView.setAttribute("x", cam.x - hw); miniView.setAttribute("y", cam.y - hh);
  miniView.setAttribute("width", hw * 2); miniView.setAttribute("height", hh * 2);
  mini.classList.toggle("off", cam.k <= kFit() * 1.04);     // the whole map is in view: no minimap needed
};
const miniGo = (e) => {
  const r = mini.getBoundingClientRect();
  gsap.killTweensOf(cam);
  cam.x = ((e.clientX - r.left) / r.width) * W; cam.y = ((e.clientY - r.top) / r.height) * H;
  applyCam(); takeOver();
};
mini.addEventListener("pointerdown", (e) => { mini.setPointerCapture(e.pointerId); mini.dataset.on = "1"; miniGo(e); });
mini.addEventListener("pointermove", (e) => { if (mini.dataset.on) miniGo(e); });
mini.addEventListener("pointerup", () => delete mini.dataset.on);
mini.addEventListener("pointercancel", () => delete mini.dataset.on);

// ----- present mode: the Fullscreen API, or a fixed overlay where it is refused -----
const syncPresent = () => {
  presenting = document.fullscreenElement === theater || theater.classList.contains("present");
  $("bPresent").textContent = presenting ? "Leave" : "Present";
  requestAnimationFrame(() => { resize(); if (mode === "day") camTo(fitRect(ALL, 8), 0.4); else if (!free) camTo(storyCamNow(), 0.4); });
};
const storyCamNow = () => { const ks = kStory(); return {x: aim.x, y: aim.y, k: clamp(aim.k, ks * 0.84, ks * 1.12)}; };
const present = async (want) => {
  if (want) {
    try { if (!theater.requestFullscreen) throw new Error("no fullscreen"); await theater.requestFullscreen(); }
    catch (_) { theater.classList.add("present"); }
  } else {
    theater.classList.remove("present");
    if (document.fullscreenElement) await document.exitFullscreen();
  }
  syncPresent();
  stage.focus({preventScroll: true});
};
$("bPresent").onclick = () => present(!presenting);
document.addEventListener("fullscreenchange", syncPresent);

// ----- keys: arrows for chapters, Space to pause, [ ] for the speed, + - 0 to zoom, F to present, Esc to leave -----
document.addEventListener("keydown", (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  const k = e.key;
  if (k === "ArrowRight" || k === "PageDown") { if (chap < CH.length) show(chap + 1); }
  else if (k === "ArrowLeft" || k === "PageUp") { if (chap > 0) show(chap - 1); }
  else if (k === "+" || k === "=") zoomBy(1.35);
  else if (k === "-" || k === "_") zoomBy(1 / 1.35);
  else if (k === "0") fitAll();
  else if (k === "f" || k === "F") present(!presenting);
  else if (k === "Escape") { if (!info.hidden) closeInfo(); else if (theater.classList.contains("present")) present(false); else return; }
  else if (k === " ") {
    // a focused button clicks itself on Space, and a focused part of the drawing opens its text:
    // neither may toggle the scene as well
    if (e.target.tagName === "BUTTON" || (e.target.closest && e.target.closest("[data-zone]"))) return;
    setPlaying(!playing);
  }
  else if (k === "[") setSpeed(speed - 0.25);
  else if (k === "]") setSpeed(speed + 0.25);
  else return;
  e.preventDefault();
});

// ----- start when the scene scrolls into view; stop the clock when it leaves or the tab hides -----
new ResizeObserver(() => {
  resize();
  if (!started) return;
  if (mode === "day" && !free) camTo(fitRect(ALL, 8), 0.2);
}).observe(stage);
new IntersectionObserver((entries) => {
  visible = entries[0].isIntersecting;
  if (visible && !started) { started = true; resize(); cam.k = kFit(); applyCam(); show(0); }
  setLive();
}, {threshold: 0.2}).observe(stage);
document.addEventListener("visibilitychange", setLive);
setTimeout(() => $("hint").classList.add("gone"), 12000);
resize();
cam.k = kFit(); applyCam();
// a hook for the page's own checks (verify.py), not used by the scene
window.__day = {show, scene, cam, CH, route, T, NODE, EDGES, get chap() { return chap; }, get mode() { return mode; }, state: () => ({playing, speed, visible, free, presenting, pk: livePk.size, parts: parts.length})};
