# /// script
# dependencies = ["playwright==1.48.0"]
# ///
"""Drive the built page in headless Chrome: no JavaScript errors, every chapter plays to its end,
the whole day runs, pause and off-screen stop the clock, and screenshots land in <out>.

    uv run lecture_materials/day-on-the-platform/src/verify.py <page.html> <out-dir> [1440x900] [chapters]

It needs the network for the CDN unless the page is the bundled build. The scene clock is run
faster than real time (the scene's own timeScale), so a pass takes a few minutes.
"""

import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

page_path = Path(sys.argv[1]).resolve()
out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
vw, vh = (int(v) for v in (sys.argv[3] if len(sys.argv) > 3 else "1440x900").split("x"))
only = [int(c) for c in sys.argv[4].split(",")] if len(sys.argv) > 4 else None
tag = f"{vw}x{vh}"
SPEED = 3.0  # scene seconds per real second while shooting
EVERY = 2.2  # real seconds between screenshots

# counts every animation frame the page asks for, from before any library loads
RAF_COUNTER = """(() => { const raf = window.requestAnimationFrame.bind(window); window.__raf = 0;
  window.requestAnimationFrame = (f) => { window.__raf++; return raf(f); }; })()"""
RAF_PROBE = "() => new Promise((done) => { const n = window.__raf; setTimeout(() => done(window.__raf - n), 3000); })"

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome")
    page = browser.new_page(viewport={"width": vw, "height": vh})
    errors: list[str] = []
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: m.type == "error" and errors.append(f"console: {m.text}"))
    page.add_init_script(RAF_COUNTER)
    page.goto(page_path.as_uri())
    page.wait_for_function("window.__day && document.fonts.status === 'loaded'", timeout=20000)
    page.wait_for_timeout(1200)
    n_ch = page.evaluate("window.__day.CH.length")
    report = {"viewport": tag, "chapters": {}}

    for ch in range(n_ch + 1):
        if only is not None and ch not in only:
            continue
        page.evaluate(
            f"() => {{ window.__day.show({ch}); window.__day.scene.timeScale({SPEED}); }}"
        )
        shots, ended = 0, False
        limit = 14 if ch == n_ch else 60
        while shots < limit and not ended:
            page.wait_for_timeout(int(EVERY * 1000))
            shots += 1
            name = (
                f"{tag}-ch{ch + 1:02d}-{shots:02d}.png"
                if ch < n_ch
                else f"{tag}-day-{shots:02d}.png"
            )
            page.screenshot(path=str(out / name))
            ended = page.evaluate(
                "(document.querySelector('#log li') || {textContent: ''}).textContent.includes('End of the')"
            )
        log = page.evaluate("[...document.querySelectorAll('#log li')].map((l) => l.textContent)")
        report["chapters"][ch + 1 if ch < n_ch else "day"] = {
            "shots": shots,
            "ended": ended or ch == n_ch,
            "last": log[:1],
        }
        print(ch + 1 if ch < n_ch else "day", shots, ended, flush=True)

    if only is None:
        # paused: the scene clock stops and GSAP's ticker goes to sleep, so no frames are requested
        page.evaluate("() => { window.__day.scene.timeScale(1); }")
        page.click("#bPlay")
        page.wait_for_timeout(3500)
        report["raf_in_3s_paused"] = page.evaluate(RAF_PROBE)
        t0 = page.evaluate("window.__day.scene.time()")
        page.wait_for_timeout(600)
        report["clock_moved_while_paused"] = page.evaluate("window.__day.scene.time()") - t0
        page.click("#bPlay")
        page.wait_for_timeout(400)
        report["raf_in_3s_playing"] = page.evaluate(RAF_PROBE)
        # off screen: scroll the stage away
        page.evaluate(
            "document.querySelector('.foot').style.marginTop = '2000px'; window.scrollTo(0, 99999)"
        )
        page.wait_for_timeout(3500)
        report["raf_in_3s_offscreen"] = page.evaluate(RAF_PROBE)
        page.evaluate("document.querySelector('.foot').style.marginTop = ''; window.scrollTo(0, 0)")
        page.wait_for_timeout(600)

        # click a part: the camera zooms in and the explanation opens
        page.evaluate("() => { window.__day.show(0); }")
        page.wait_for_timeout(1500)
        page.click("#bPlay")
        page.click("#zFit")
        page.wait_for_timeout(900)
        box = page.evaluate(
            "(() => { const r = document.querySelector('[data-zone=uc]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()"
        )
        page.mouse.click(box[0], box[1])
        page.wait_for_timeout(1100)
        report["info_open"] = page.evaluate(
            "!document.getElementById('info').hidden && document.getElementById('info').textContent.slice(0, 60)"
        )
        report["resume_shown"] = page.evaluate("!document.getElementById('bResume').hidden")
        page.screenshot(path=str(out / f"{tag}-click-zoom.png"))
        # drag to pan, wheel to zoom
        k0 = page.evaluate("[window.__day.cam.x, window.__day.cam.k]")
        page.mouse.move(vw / 2, vh / 2)
        page.mouse.down()
        page.mouse.move(vw / 2 - 200, vh / 2 - 40, steps=6)
        page.mouse.up()
        page.wait_for_timeout(1100)
        page.mouse.wheel(0, -400)
        page.wait_for_timeout(300)
        k1 = page.evaluate("[window.__day.cam.x, window.__day.cam.k]")
        report["pan_zoom"] = {"before": k0, "after": k1}
        page.click("#bResume")
        page.click("#bPlay")
        # keys and present mode
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(500)
        report["chapter_after_arrow"] = page.evaluate("window.__day.chap + 1")
        page.keyboard.press("f")
        page.wait_for_timeout(1500)
        report["presenting"] = page.evaluate("window.__day.state().presenting")
        page.wait_for_timeout(6000)
        page.screenshot(path=str(out / f"{tag}-present.png"))
        page.keyboard.press("f")
        page.wait_for_timeout(800)
        report["presenting_after_leave"] = page.evaluate("window.__day.state().presenting")
        # the Jump to menu follows the chapter and jumps; Space toggles once; [ and ] change the speed
        controls = {"jump_follows_arrow": page.evaluate("document.getElementById('jump').value")}
        page.select_option("#jump", "6")
        page.wait_for_timeout(400)
        controls["chapter_after_jump"] = page.evaluate("window.__day.chap + 1")
        controls["jump_released_focus"] = page.evaluate("document.activeElement.id !== 'jump'")
        page.keyboard.press("Space")
        controls["paused_by_space"] = page.evaluate(
            "!window.__day.state().playing && document.getElementById('bPlay').classList.contains('paused')"
        )
        page.focus("#bPlay")
        page.keyboard.press("Space")  # on the focused button: one toggle, not two
        controls["playing_after_space_on_button"] = page.evaluate("window.__day.state().playing")
        page.evaluate("document.activeElement.blur()")
        page.keyboard.press("]")
        page.keyboard.press("]")
        page.keyboard.press("[")
        controls["speed_after_keys"] = page.evaluate(
            "[window.__day.state().speed, document.getElementById('speedOut').textContent]"
        )
        page.keyboard.press("[")
        report["controls"] = controls
        # the minimum size of the drawing's text, in screen pixels, at a chapter's zoom
        report["min_text_px_at_chapter_zoom"] = (
            page.evaluate("""(() => { const k = window.__day.cam.k; let m = 99;
          document.querySelectorAll('#sv text').forEach((t) => { const f = parseFloat(getComputedStyle(t).fontSize); if (f) m = Math.min(m, f); });
          return [m, k, Math.round(m * k * 10) / 10]; })()""")
        )
    report["errors"] = errors
    (out / f"report-{tag}.json").write_text(json.dumps(report, indent=1))
    print(json.dumps(report, indent=1))
    browser.close()
    if errors:
        raise SystemExit(1)
