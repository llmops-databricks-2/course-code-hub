// ----- the deck shell: scenes and steps, navigation, the parts as progress, overview, notes, full screen -----
// A scene is one layer of the stage (a scaled canvas or a full-step frame); a step is one beat of a
// scene. Next walks the beats, then the scenes. Each part's file registers its scenes and steps.
const PARTS = [
  {n: 1, title: "The platform is complex"},
  {n: 2, title: "Everything you click is code"},
  {n: 3, title: "What you need to run IaC"},
  {n: 4, title: "dev → acc → prd for infrastructure"},
  {n: 5, title: "The LLMOps onboarding automation"},
];

const Deck = (() => {
  const stage = $("#stage");
  const scenes = {};
  const steps = [];
  let cur = -1;
  let overSel = 0;

  // def: {kind: "canvas" | "frame", build(layer, canvas), show(beat, ctx), hide(), onNext(), skippable}
  function scene(id, def) { scenes[id] = Object.assign({id, built: false, layer: null}, def); }
  // def: {part, scene, beat, title, kind, notes}
  function step(def) {
    const inPart = steps.filter((s) => s.part === def.part).length + 1;
    steps.push(Object.assign({id: `${def.part}.${inPart}`, beat: 0, kind: ""}, def));
  }

  function mount(sc) {
    if (sc.built) return;
    sc.layer = el(`<section class="layer layer-${sc.kind}" data-scene="${sc.id}" hidden></section>`);
    let canvas = null;
    if (sc.kind === "canvas") { canvas = el(`<div class="canvas"></div>`); sc.layer.append(canvas); }
    stage.append(sc.layer);
    sc.build(sc.layer, canvas);
    sc.built = true;
  }

  function fit() {
    const k = Math.min(stage.clientWidth / 1440, stage.clientHeight / 850);
    document.documentElement.style.setProperty("--k", String(k));
    Deck.k = k;
  }

  function go(i, opt = {}) {
    i = clamp(i, 0, steps.length - 1);
    if (i === cur && !opt.force) return;
    const from = steps[cur], to = steps[i];
    const dir = cur < 0 ? 1 : Math.sign(i - cur) || 1;
    const old = from ? scenes[from.scene] : null, next = scenes[to.scene];
    // the keys come back to the deck whenever it moves
    if (document.activeElement && document.activeElement.tagName === "IFRAME") { document.activeElement.blur(); window.focus(); }
    mount(next);
    const instant = opt.instant || REDUCED || !old;
    cur = i;
    if (old !== next) {
      for (const s of Object.values(scenes)) if (s.built && s !== old && s !== next) { gsap.killTweensOf(s.layer); s.layer.hidden = true; }
      next.layer.hidden = false;
      gsap.killTweensOf(next.layer);
      if (old) {
        gsap.killTweensOf(old.layer);
        if (old.hide) old.hide();
        if (instant) old.layer.hidden = true;
        else gsap.to(old.layer, {autoAlpha: 0, duration: 0.3, ease: "power1.out", onComplete() { old.layer.hidden = true; }});
      }
      if (instant) gsap.set(next.layer, {autoAlpha: 1});
      else gsap.fromTo(next.layer, {autoAlpha: 0}, {autoAlpha: 1, duration: 0.45, ease: "power1.out"});
      next.show(to.beat, {dir, instant, from: null, entered: true});
    } else {
      next.show(to.beat, {dir, instant: opt.instant || REDUCED, from: from.beat, entered: false});
    }
    paint();
    try { history.replaceState(null, "", "#" + to.id); } catch (e) { /* a file page may refuse it */ }
  }

  // Next asks the scene first: a frame may want the key (part 4 passes it to its module)
  function next(force) {
    const sc = scenes[steps[cur].scene];
    if (!force && sc.onNext && sc.onNext(steps[cur].beat)) return;
    go(cur + 1);
  }
  const prev = () => go(cur - 1);
  const goId = (id) => { const i = steps.findIndex((s) => s.id === id); if (i >= 0) go(i); };
  const goPart = (n) => { const i = steps.findIndex((s) => s.part === n); if (i >= 0) go(i); };

  // ----- the bar -----
  const partsEl = $("#parts");
  function buildBar() {
    partsEl.innerHTML = PARTS.map((p) => `<button class="part" data-part="${p.n}" title="Part ${p.n}: ${esc(p.title)} (key ${p.n})"><span class="n">${p.n}</span><span class="t">${esc(p.title)}</span><span class="track"><i class="fill"></i></span></button>`).join("");
    $$(".part", partsEl).forEach((b) => b.addEventListener("click", () => { closeOver(); goPart(Number(b.dataset.part)); }));
  }
  function paint() {
    const s = steps[cur];
    $("#count").textContent = `${cur + 1} / ${steps.length}`;
    $("#bPrev").disabled = cur === 0;
    $("#bNext").disabled = cur === steps.length - 1;
    $("#bSkip").hidden = !scenes[s.scene].skippable;
    for (const b of $$(".part", partsEl)) {
      const n = Number(b.dataset.part);
      const mine = steps.filter((x) => x.part === n);
      const at = mine.indexOf(s);
      b.classList.toggle("on", n === s.part);
      b.classList.toggle("done", n < s.part);
      $(".fill", b).style.width = n < s.part ? "100%" : n > s.part ? "0%" : `${((at + 1) / mine.length) * 100}%`;
      if (n === s.part) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    }
    document.title = `${s.id} ${s.title} · Platform infrastructure`;
    if (!$("#notes").hidden) paintNotes();
    if (!$("#over").hidden) paintOver();
  }

  // ----- speaker notes -----
  function paintNotes() {
    const s = steps[cur], n = steps[cur + 1];
    $("#notesT").textContent = `${s.id} · ${s.title}`;
    $("#notesNext").textContent = n ? `Next: ${n.id} ${n.title}` : "The last step";
    $("#notesB").innerHTML = s.notes || "<p>No notes for this step.</p>";
  }
  function toggleNotes(on) {
    const box = $("#notes");
    box.hidden = on === undefined ? !box.hidden : !on;
    $("#bNotes").setAttribute("aria-pressed", String(!box.hidden));
    if (!box.hidden) paintNotes();
  }

  // ----- overview -----
  function buildOver() {
    $("#overG").innerHTML = PARTS.map((p) => `<section class="over-p"><h3><small>PART ${p.n}</small>${esc(p.title)}</h3><div class="over-s">${
      steps.map((s, i) => s.part !== p.n ? "" : `<button class="over-c" data-i="${i}"><span class="id">${s.id}</span><span class="tt">${esc(s.title)}</span><span class="kd">${esc(s.kind)}</span></button>`).join("")
    }</div></section>`).join("");
    $$(".over-c").forEach((c) => c.addEventListener("click", () => { closeOver(); go(Number(c.dataset.i)); }));
  }
  function paintOver() {
    $$(".over-c").forEach((c) => {
      const i = Number(c.dataset.i);
      c.classList.toggle("cur", i === cur);
      c.classList.toggle("sel", i === overSel);
    });
  }
  function openOver() {
    overSel = cur;
    $("#over").hidden = false;
    $("#bOver").setAttribute("aria-pressed", "true");
    paintOver();
    const sel = $(`.over-c[data-i="${overSel}"]`);
    if (sel) sel.scrollIntoView({block: "nearest"});
  }
  function closeOver() { $("#over").hidden = true; $("#bOver").setAttribute("aria-pressed", "false"); }
  const toggleOver = () => ($("#over").hidden ? openOver() : closeOver());
  function overKey(e) {
    const k = e.key;
    const cards = $$(".over-c");
    const cols = (() => { // how many cards share the selected card's row
      const sel = cards[overSel]; if (!sel) return 1;
      const top = sel.getBoundingClientRect().top;
      return cards.filter((c) => c.parentElement === sel.parentElement && Math.abs(c.getBoundingClientRect().top - top) < 4).length || 1;
    })();
    if (k === "ArrowRight") overSel = clamp(overSel + 1, 0, steps.length - 1);
    else if (k === "ArrowLeft") overSel = clamp(overSel - 1, 0, steps.length - 1);
    else if (k === "ArrowDown") overSel = clamp(overSel + cols, 0, steps.length - 1);
    else if (k === "ArrowUp") overSel = clamp(overSel - cols, 0, steps.length - 1);
    else if (k === "Home") overSel = 0;
    else if (k === "End") overSel = steps.length - 1;
    else if (k === "Enter" || k === " ") { closeOver(); go(overSel); e.preventDefault(); return; }
    else if (k === "Escape" || k === "o" || k === "O") { closeOver(); return; }
    else return;
    e.preventDefault();
    paintOver();
    cards[overSel].scrollIntoView({block: "nearest"});
  }

  // ----- full screen -----
  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  }
  document.addEventListener("fullscreenchange", () => { $("#bFull").setAttribute("aria-pressed", String(!!document.fullscreenElement)); fit(); });

  // ----- keys: → Space next, ← back, Esc overview, F full screen, N notes, 1-5 the parts -----
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
    if (!$("#over").hidden) { overKey(e); return; }
    const onControl = t.closest && t.closest("button, a, [role=button]");
    if (e.key === " " && onControl) return;
    if (key(e.key, e.shiftKey)) e.preventDefault();
  });
  // one key, by name: the keydown above, and the keys a frame hands back to the deck
  function key(k, shift) {
    if (k === "ArrowRight" || k === "PageDown" || k === " ") next(shift);
    else if (k === "ArrowLeft" || k === "PageUp") prev();
    else if (k === "Escape" || k === "o" || k === "O") toggleOver();
    else if (k === "f" || k === "F") toggleFull();
    else if (k === "n" || k === "N") toggleNotes();
    else if (k === "Home") go(0);
    else if (k === "End") go(steps.length - 1);
    else if (/^[1-5]$/.test(k)) goPart(Number(k));
    else return false;
    return true;
  }

  // ----- a frame that holds the keys: say so, and take them back on a click of the bar -----
  const chip = $("#keysChip");
  function frameFocus() {
    const inFrame = !!document.activeElement && document.activeElement.tagName === "IFRAME";
    document.body.classList.toggle("in-frame", inFrame);
    chip.hidden = !inFrame;
    if (inFrame) chip.textContent = "The keys drive the frame now · click this bar to give them back to the deck";
  }
  window.addEventListener("blur", () => setTimeout(frameFocus, 0));
  window.addEventListener("focus", () => setTimeout(frameFocus, 0));
  $("#bar").addEventListener("pointerdown", () => {
    if (document.activeElement && document.activeElement.tagName === "IFRAME") { document.activeElement.blur(); window.focus(); setTimeout(frameFocus, 0); }
  });

  function start() {
    buildBar();
    buildOver();
    $("#bPrev").addEventListener("click", prev);
    $("#bNext").addEventListener("click", () => next(false));
    $("#bSkip").addEventListener("click", () => next(true));
    $("#bOver").addEventListener("click", toggleOver);
    $("#bNotes").addEventListener("click", () => toggleNotes());
    $("#notesX").addEventListener("click", () => toggleNotes(false));
    $("#bFull").addEventListener("click", toggleFull);
    new ResizeObserver(fit).observe(stage);
    fit();
    const want = decodeURIComponent(location.hash.slice(1));
    const at = steps.findIndex((s) => s.id === want);
    go(at >= 0 ? at : 0, {instant: true});
    window.addEventListener("hashchange", () => goId(decodeURIComponent(location.hash.slice(1))));
  }

  return {scene, step, go, goId, goPart, next, prev, start, key, toggleNotes, toggleOver, steps, scenes, k: 1, get cur() { return cur; }, get step_() { return steps[cur]; }};
})();

// ----- a full-step frame: loaded on its first show, hidden (so its own clock stops) when the deck is elsewhere -----
function frameScene(id, {src, title, onLoad}) {
  let frame = null;
  Deck.scene(id, {
    kind: "frame",
    build(layer) {
      frame = el(`<iframe title="${esc(title)}" src="${esc(src)}" allow="fullscreen" allowfullscreen loading="eager"></iframe>`);
      layer.append(frame);
      if (onLoad) frame.addEventListener("load", () => onLoad(frame));
    },
    show() {},
    hide() {},
  });
  return () => frame;
}
