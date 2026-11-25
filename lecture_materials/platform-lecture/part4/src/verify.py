# /// script
# dependencies = ["playwright==1.48.0"]
# ///
"""Drive the built pages of part 4 in headless Chrome and keep the screenshots.

    uv run lecture_materials/platform-lecture/part4/src/verify.py <out-dir> [1512x982] [--bundled]

What it checks, and fails on:
- no JavaScript error and no console error on any page;
- every text is at least 16 CSS px (the SVG's own scale counted in);
- both scenes play to their end and post "scene-end";
- the postMessage protocol, from src/harness.html, which iframes the page as the deck does:
  ready, scene, play, pause, step, scene-end;
- a stage that changes shape mid-scene is redrawn at the same second;
- a page built while its iframe is hidden draws itself correctly once shown;
- the close-up fits its screen: neither column scrolls.

Screenshots: the middle and the end of every beat of both scenes, the close-up, one of its cards,
its list of links, and both pages inside the harness. The default pages need the network (the CDN
and the fonts); --bundled checks the offline copies instead.
"""

import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

args = [a for a in sys.argv[1:] if not a.startswith("--")]
bundled = "--bundled" in sys.argv
out = Path(args[0])
out.mkdir(parents=True, exist_ok=True)
vw, vh = (int(v) for v in (args[1] if len(args) > 1 else "1512x982").split("x"))
tag = f"{vw}x{vh}" + ("-bundled" if bundled else "")
ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / ("index.bundled.html" if bundled else "index.html")
GITHUB = ROOT / ("github.bundled.html" if bundled else "github.html")
HARNESS = ROOT / "src" / "harness.html"
failures: list[str] = []

# the smallest text on the page, in CSS px: an SVG text's size is scaled by its svg
SMALLEST = """() => {
  let min = 1e9, who = "";
  const seen = (px, el) => { if (px < min) { min = px; who = (el.textContent || "").trim().slice(0, 40); } };
  for (const t of document.querySelectorAll("svg text")) {
    const svg = t.ownerSVGElement, vb = svg.viewBox.baseVal, r = svg.getBoundingClientRect();
    if (!r.width || !t.textContent.trim()) continue;
    const k = Math.min(r.width / vb.width, r.height / vb.height);
    for (const n of [t, ...t.querySelectorAll("tspan")]) seen(parseFloat(getComputedStyle(n).fontSize) * k, n);
  }
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const el = n.parentElement;
    if (!n.textContent.trim() || el.closest("svg, script, style, [hidden]") || !el.getClientRects().length) continue;
    seen(parseFloat(getComputedStyle(el).fontSize), el);
  }
  return {min: Math.round(min * 100) / 100, who};
}"""


def check(ok: bool, what: str) -> None:
    print(("ok   " if ok else "FAIL ") + what, flush=True)
    if not ok:
        failures.append(what)


def watch(page, name: str) -> None:
    page.on("pageerror", lambda e: failures.append(f"{name}: pageerror: {e}"))
    page.on(
        "console", lambda m: m.type == "error" and failures.append(f"{name}: console: {m.text}")
    )


with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome")

    # ----- the animation, alone -----
    page = browser.new_page(viewport={"width": vw, "height": vh})
    watch(page, INDEX.name)
    for scene in (1, 2):
        page.goto(INDEX.as_uri() + f"?scene={scene}")
        page.wait_for_function(
            "window.__part4 && document.fonts.status === 'loaded'", timeout=20000
        )
        page.wait_for_timeout(300)
        state = page.evaluate("window.__part4.state()")
        beats = state["beats"]
        print(
            f"scene {scene}: {state['duration']:.1f} s, {len(beats)} beats, stage height {state['H']}",
            flush=True,
        )
        check(
            30 <= state["duration"] <= 60,
            f"scene {scene} lasts 30 to 60 s at 1× ({state['duration']:.1f} s)",
        )
        page.screenshot(path=str(out / f"{tag}-s{scene}-b0-start.png"))
        for i, b in enumerate(beats):
            end = beats[i + 1]["t"] - 0.02 if i + 1 < len(beats) else state["duration"]
            for part, t in (("mid", (b["t"] + end) / 2), ("end", end)):
                page.evaluate(f"window.__part4.at({t})")
                page.wait_for_timeout(120)
                page.screenshot(path=str(out / f"{tag}-s{scene}-b{i + 1}-{part}.png"))
            small = page.evaluate(SMALLEST)
            check(
                small["min"] >= 16,
                f"scene {scene} beat {i + 1}: smallest text {small['min']} px ({small['who']!r})",
            )
        # back to the start, then the real thing: play it through, fast
        page.evaluate(
            "() => { const s = window.__part4; s.show(%d); s.setSpeed(3); s.play(); }" % scene
        )
        page.wait_for_function("window.__part4.state().ended", timeout=40000)
        check(True, f"scene {scene} played to its end")
        # step mode: one beat per step, and it stops before the next
        page.evaluate(
            "() => { const s = window.__part4; s.show(%d); s.setSpeed(3); s.step(); }" % scene
        )
        page.wait_for_function("window.__part4.state().paused", timeout=20000)
        st = page.evaluate("window.__part4.state()")
        check(
            st["beat"] == 1 and abs(st["time"] - (beats[1]["t"] - 0.02)) < 0.05,
            f"scene {scene}: a step plays beat 1 and stops ({st['time']:.2f} s)",
        )
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(300)
        page.wait_for_function("window.__part4.state().paused", timeout=20000)
        st = page.evaluate("window.__part4.state()")
        check(
            st["beat"] == 2,
            f"scene {scene}: the right arrow plays beat 2 and stops ({st['time']:.2f} s)",
        )
        page.keyboard.press("ArrowLeft")
        st = page.evaluate("window.__part4.state()")
        check(
            st["paused"] and st["time"] < beats[1]["t"],
            f"scene {scene}: the left arrow goes back a beat ({st['time']:.2f} s)",
        )
    # the stage changes shape mid-scene
    page.evaluate("() => { const s = window.__part4; s.show(2); s.at(30); }")
    h0 = page.evaluate("window.__part4.state().H")
    page.set_viewport_size({"width": vw, "height": vh - 130})
    page.wait_for_timeout(500)
    st = page.evaluate("window.__part4.state()")
    check(
        st["H"] != h0 and abs(st["time"] - 30) < 0.05,
        f"a lower stage is redrawn at the same second (height {h0} to {st['H']}, {st['time']:.2f} s)",
    )
    page.screenshot(path=str(out / f"{tag}-resized-{vw}x{vh - 130}.png"))
    page.close()

    # ----- the animation in an iframe, driven by messages -----
    page = browser.new_page(viewport={"width": vw, "height": vh})
    watch(page, "harness")
    page.goto(HARNESS.as_uri() + f"?page={INDEX.name}")
    page.wait_for_function("window.__log.some((m) => m.event === 'ready')", timeout=20000)
    ready = page.evaluate("window.__log.find((m) => m.event === 'ready')")
    check(ready.get("type") == "part4" and ready.get("ok") is True, f"ready: {json.dumps(ready)}")
    frame = page.frames[1]
    state = lambda: frame.evaluate("window.__part4.state()")  # noqa: E731
    page.evaluate("send({cmd: 'scene', n: 2})")
    page.wait_for_timeout(300)
    st = state()
    check(
        st["scene"] == 2 and st["paused"] and st["time"] == 0,
        "cmd scene 2: scene 2, at its start, paused",
    )
    page.screenshot(path=str(out / f"{tag}-harness-scene2-start.png"))
    page.evaluate("send({cmd: 'play'})")
    page.wait_for_timeout(1200)
    st = state()
    check(not st["paused"] and st["time"] > 0.8, f"cmd play: playing ({st['time']:.2f} s)")
    page.evaluate("send({cmd: 'pause'})")
    page.wait_for_timeout(200)
    t0 = state()["time"]
    page.wait_for_timeout(400)
    st = state()
    check(st["paused"] and st["time"] == t0, f"cmd pause: stopped at {t0:.2f} s")
    page.screenshot(path=str(out / f"{tag}-harness-scene2-paused.png"))
    page.evaluate("send({cmd: 'speed', value: 3}); send({cmd: 'step'})")
    page.wait_for_timeout(300)
    page.wait_for_function("window.__log.length && true", timeout=1000)
    frame.wait_for_function("window.__part4.state().paused", timeout=20000)
    st = state()
    check(
        st["beat"] == 1 and st["time"] > 6,
        f"cmd step: played to the end of beat 1 and stopped ({st['time']:.2f} s)",
    )
    for scene in (1, 2):
        page.evaluate("send({cmd: 'scene', n: %d}); send({cmd: 'play'})" % scene)
        page.wait_for_function(
            "window.__log.some((m) => m.event === 'scene-end' && m.scene === %d)" % scene,
            timeout=40000,
        )
        check(True, f"scene-end posted for scene {scene}")
        page.screenshot(path=str(out / f"{tag}-harness-scene{scene}-end.png"))
    print(
        "messages:",
        json.dumps([m for m in page.evaluate("window.__log") if m["event"] != "beat"]),
        flush=True,
    )
    # built while hidden, then shown
    page.goto(HARNESS.as_uri() + f"?page={INDEX.name}&hidden=1")
    page.wait_for_function("window.__log.some((m) => m.event === 'ready')", timeout=20000)
    page.wait_for_timeout(2300)
    frame = page.frames[1]
    frame.evaluate("window.__part4.at(3.2)")
    page.wait_for_timeout(200)
    widths = frame.evaluate(
        "[...document.querySelectorAll('#sv rect.bub')].map((r) => +r.getAttribute('width'))"
    )
    check(
        len(widths) > 3 and min(widths) > 30,
        f"built while hidden: bubbles are measured ({min(widths):.0f} to {max(widths):.0f} units)",
    )
    page.screenshot(path=str(out / f"{tag}-harness-shown-after-hidden.png"))
    page.close()

    # ----- the close-up -----
    page = browser.new_page(viewport={"width": vw, "height": vh})
    watch(page, GITHUB.name)
    page.goto(GITHUB.as_uri())
    page.wait_for_function("window.__part4 && document.fonts.status === 'loaded'", timeout=20000)
    page.wait_for_timeout(300)
    page.screenshot(path=str(out / f"{tag}-github.png"))
    small = page.evaluate(SMALLEST)
    check(small["min"] >= 16, f"close-up: smallest text {small['min']} px ({small['who']!r})")
    fit = page.evaluate(
        "[...document.querySelectorAll('.col')].map((c) => [c.scrollHeight, c.clientHeight, c.scrollWidth, c.clientWidth])"
    )
    check(
        all(sh <= ch + 1 and sw <= cw + 1 for sh, ch, sw, cw in fit),
        f"close-up: neither column scrolls {fit}",
    )
    cut = page.evaluate(
        "[...document.querySelectorAll('.rows.two .row p')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent)"
    )
    check(not cut, f"close-up: no row is cut short {cut}")
    links = page.evaluate(
        "[...new Set([...document.querySelectorAll('a[href]')].map((a) => a.href))].length"
    )
    print(
        f"close-up: {links} distinct links on the still, {page.evaluate('window.__part4.state().links')} in all",
        flush=True,
    )
    page.evaluate("window.__part4.card('protection')")
    page.wait_for_timeout(200)
    page.screenshot(path=str(out / f"{tag}-github-card-gap.png"))
    small = page.evaluate(SMALLEST)
    check(small["min"] >= 16, f"close-up card: smallest text {small['min']} px")
    page.keyboard.press("Escape")
    page.evaluate("window.__part4.card('dry')")
    page.wait_for_timeout(200)
    page.screenshot(path=str(out / f"{tag}-github-card-row.png"))
    page.keyboard.press("Escape")
    page.evaluate("window.__part4.everything()")
    page.wait_for_timeout(200)
    page.screenshot(path=str(out / f"{tag}-github-all-links.png"))
    page.close()

    page = browser.new_page(viewport={"width": vw, "height": vh})
    watch(page, "harness")
    page.goto(HARNESS.as_uri() + f"?page={GITHUB.name}")
    page.wait_for_function(
        "window.__log.some((m) => m.event === 'ready' && m.page === 'github')", timeout=20000
    )
    check(True, "close-up: ready posted")
    page.wait_for_timeout(500)
    frame = page.frames[1]
    page.screenshot(path=str(out / f"{tag}-harness-github.png"))
    fit = frame.evaluate(
        "[...document.querySelectorAll('.col')].map((c) => [c.scrollHeight, c.clientHeight])"
    )
    check(
        all(sh <= ch + 1 for sh, ch in fit),
        f"close-up in the harness: neither column scrolls {fit}",
    )
    page.evaluate("send({cmd: 'scene', n: 2})")
    page.wait_for_timeout(400)
    check(
        frame.evaluate("window.__part4.state().focus") == 2,
        "close-up: cmd scene 2 puts the light on the second column",
    )
    page.screenshot(path=str(out / f"{tag}-harness-github-column2.png"))
    for cmd in ("play", "pause", "step"):
        page.evaluate("send({cmd: '%s'})" % cmd)
    page.wait_for_timeout(200)
    check(
        frame.evaluate("window.__part4.state().focus") == 0,
        "close-up: play and pause do nothing, step moves the light on",
    )
    page.close()
    browser.close()

print()
if failures:
    print(f"{len(failures)} FAILED:")
    for f in failures:
        print("  " + f)
    raise SystemExit(1)
print("all checks passed; screenshots in", out)
