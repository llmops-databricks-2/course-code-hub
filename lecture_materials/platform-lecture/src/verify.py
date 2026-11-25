# /// script
# dependencies = ["playwright==1.48.0"]
# ///
"""Drive the built deck in headless Chrome: no JavaScript errors, every step shot, the mocks clicked,
keys, overview and notes tried, every course-assistant link checked against the facts' list.

    uv run lecture_materials/platform-lecture/src/verify.py <page.html> <out-dir> [1512x982]

It needs the network for the CDN unless the page is the bundled build.
"""

import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

page_path = Path(sys.argv[1]).resolve()
out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
vw, vh = (int(v) for v in (sys.argv[3] if len(sys.argv) > 3 else "1512x982").split("x"))
tag = f"{vw}x{vh}"
SRC = Path(__file__).resolve().parent
GITHUB = "https://github.com/llmops-databricks-2/course-assistant/blob/main/"
ALLOWED = {row["url"] for row in json.loads((SRC / "data/course-assistant-links.json").read_text())}
WS_ITEMS = [
    "Catalog",
    "SQL Warehouses",
    "Jobs & Pipelines",
    "Recents",
    "AI Gateway",
    "Experiments",
    "Dashboards",
    "Playground",
    "SQL Editor",
    "New",
    "Compute",
    "Alerts",
]
AC_ITEMS = [
    "Workspaces",
    "User management",
    "Security",
    "Cost",
    "Cloud resources",
    "Tags",
    "Data",
    "Usage",
    "Genie Ontology",
    "Settings",
]

report: dict = {
    "viewport": tag,
    "steps": [],
    "errors": [],
    "small_text": [],
    "bad_links": [],
    "overflow": [],
}

# text under 16 px that is drawn, and elements that stick out of the canvas
AUDIT = """() => {
  const k = window.__deck.k, small = [], over = [];
  const layer = [...document.querySelectorAll('.layer')].find((l) => !l.hidden);
  if (!layer || layer.classList.contains('layer-frame')) return {small, over};
  const cr = (layer.querySelector('.canvas') || layer).getBoundingClientRect();
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent.trim(); if (!text) continue;
    const e = n.parentElement, cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    let hidden = false; for (let p = e; p && p !== layer; p = p.parentElement) { const s = getComputedStyle(p); if (s.visibility === 'hidden' || Number(s.opacity) === 0 || s.display === 'none') { hidden = true; break; } }
    if (hidden) continue;
    const px = parseFloat(cs.fontSize) * k;
    if (px < 15.95) small.push(`${px.toFixed(1)}px ${e.tagName}.${e.className} "${text.slice(0, 30)}"`);
    if (r.right > cr.right + 2 || r.bottom > cr.bottom + 2 || r.left < cr.left - 2) over.push(`${e.tagName}.${e.className} "${text.slice(0, 30)}"`);
  }
  return {small: [...new Set(small)].slice(0, 12), over: [...new Set(over)].slice(0, 12)};
}"""
CLIPPED = """() => [...document.querySelectorAll('.layer:not([hidden]) .m-page, .layer:not([hidden]) .code-panel, .layer:not([hidden]) .m-side, .layer:not([hidden]) .kcard, .layer:not([hidden]) .o-strip, .layer:not([hidden]) .nd, .layer:not([hidden]) .bx, .layer:not([hidden]) .tile, .layer:not([hidden]) .card')]
  .filter((e) => getComputedStyle(e).visibility !== 'hidden' && (e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2))
  .map((e) => `${e.className} ${e.scrollWidth}x${e.scrollHeight} in ${e.clientWidth}x${e.clientHeight}`)"""
LINKS = "() => [...document.querySelectorAll('a[href]')].map((a) => a.href)"

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome")
    page = browser.new_page(viewport={"width": vw, "height": vh})
    page.on("pageerror", lambda e: report["errors"].append(f"pageerror: {e}"))
    page.on(
        "console", lambda m: m.type == "error" and report["errors"].append(f"console: {m.text}")
    )
    page.goto(page_path.as_uri())
    page.wait_for_function("window.__deck && document.fonts.status === 'loaded'", timeout=20000)
    page.wait_for_timeout(600)
    steps = page.evaluate(
        "window.__deck.steps.map((s) => ({id: s.id, title: s.title, scene: s.scene}))"
    )
    links: set[str] = set()

    def audit(name: str) -> None:
        res = page.evaluate(AUDIT)
        clipped = page.evaluate(CLIPPED)
        links.update(page.evaluate(LINKS))
        if res["small"]:
            report["small_text"].append({name: res["small"]})
        if res["over"] or clipped:
            report["overflow"].append({name: res["over"] + clipped})

    def shoot(name: str, wait: int = 0) -> None:
        if wait:
            page.wait_for_timeout(wait)
        page.screenshot(path=str(out / f"{tag}-{name}.png"))

    for i, s in enumerate(steps):
        page.evaluate(f"window.__deck.go({i})")
        frame = s["scene"] in ("day", "p4scenes", "p4github")
        name = f"{s['id'].replace('.', '-')}-{s['scene']}"
        shoot(name, 6500 if s["scene"] == "day" else 4200 if s["id"] in ("1.2", "3.5") else 2600)
        if not frame:
            audit(name)
        report["steps"].append(s["id"])
        if s["scene"] == "mock":
            items = WS_ITEMS if s["id"] == "2.1" else AC_ITEMS
            for item in items:
                page.click(f'.m-side [data-item="{item}"]')
                page.wait_for_timeout(450)
                for tab in ("terraform", "sdk", "rest"):
                    page.click(f'.c-tabs [data-tab="{tab}"]')
                    page.wait_for_timeout(120)
                    slug = item.lower().replace(" & ", "-").replace(" ", "-")
                    shoot(f"{name}-{slug}-{tab}")
                    audit(f"{name}-{slug}-{tab}")
            if s["id"] == "2.1":
                page.click(".m-av")
                page.click("[data-settings]")
                for sub in ("Users and groups", "Entitlements", "Usage policies", "Tokens"):
                    page.click(f'.m-setnav [data-item="Settings: {sub}"]')
                    page.wait_for_timeout(400)
                    shoot(f"{name}-settings-{sub.lower().replace(' ', '-')}")
                    audit(f"{name}-settings-{sub}")
                page.click("[data-home]")
                page.wait_for_timeout(300)
        if s["scene"] == "onboarding" and s["id"] == "5.1":
            page.hover('[data-d="s-5"]')
            shoot(f"{name}-hover-merge", 500)
            audit(f"{name}-hover")
            page.hover('[data-d="t-principal"]')
            shoot(f"{name}-hover-principal", 500)
            page.mouse.move(5, vh - 5)

    # keys, overview, notes, the mock's switch
    page.evaluate("window.__deck.go(0)")
    page.wait_for_timeout(500)
    keys = {}
    page.keyboard.press("ArrowRight")
    page.wait_for_timeout(500)
    keys["right"] = page.evaluate("window.__deck.cur") == 1
    page.keyboard.press("Space")
    page.wait_for_timeout(500)
    keys["space"] = page.evaluate("window.__deck.cur") == 2
    page.keyboard.press("ArrowLeft")
    page.wait_for_timeout(500)
    keys["left"] = page.evaluate("window.__deck.cur") == 1
    page.keyboard.press("n")
    page.wait_for_timeout(300)
    keys["notes"] = page.evaluate(
        "!document.querySelector('#notes').hidden && document.querySelector('#notesB').textContent.length > 40"
    )
    shoot("notes")
    page.keyboard.press("n")
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    keys["overview"] = page.evaluate("!document.querySelector('#over').hidden")
    shoot("overview")
    page.keyboard.press("ArrowRight")
    page.keyboard.press("ArrowRight")
    page.keyboard.press("Enter")
    page.wait_for_timeout(600)
    keys["overview_jump"] = page.evaluate("window.__deck.cur") == 3 and page.evaluate(
        "document.querySelector('#over').hidden"
    )
    page.keyboard.press("3")
    page.wait_for_timeout(500)
    keys["part_key"] = page.evaluate("window.__deck.step_.id") == "3.1"
    for _ in range(4):
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(250)
    keys["part3_beats"] = page.evaluate("window.__deck.step_.id") == "3.5"
    page.evaluate("window.__deck.goId('2.1')")
    page.wait_for_timeout(400)
    page.click('.sw [data-console="account"]')
    page.wait_for_timeout(500)
    keys["switch"] = page.evaluate("window.__deck.step_.id") == "2.2"
    page.evaluate("window.__deck.goId('3.1')")
    page.wait_for_timeout(400)
    page.click('[data-tile="1"]')
    page.wait_for_timeout(900)
    keys["tile_click"] = page.evaluate("window.__deck.step_.id") == "3.3"
    # part 4, when its module is there: → steps a scene, starts scene 2 after scene 1, leaves after scene 2;
    # a click inside the frame gives it the keys, and it hands back the ones it does not use
    page.evaluate("window.__deck.goId('4.1')")
    page.wait_for_timeout(3500)
    fr = next((f for f in page.frames if "part4/index" in f.url), None)
    if fr and fr.evaluate("!!window.__part4"):
        state = lambda: fr.evaluate("window.__part4.state()")  # noqa: E731
        to_end = "() => { const s = window.__part4.state(); window.__part4.at(s.duration - 0.3); window.__part4.play(); }"
        p4 = {}
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(1500)
        p4["right_steps_the_scene"] = (
            state()["time"] > 0.5 and page.evaluate("window.__deck.step_.id") == "4.1"
        )
        fr.evaluate(to_end)
        page.wait_for_timeout(1500)
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(1500)
        p4["right_starts_scene_2"] = (
            state()["scene"] == 2 and page.evaluate("window.__deck.step_.id") == "4.1"
        )
        shoot("4-1-p4scenes-scene2")
        fr.evaluate(to_end)
        page.wait_for_timeout(1500)
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(1200)
        p4["right_leaves_after_scene_2"] = page.evaluate("window.__deck.step_.id") == "4.2"
        page.keyboard.press("ArrowLeft")
        page.wait_for_timeout(1200)
        p4["leaving_pauses_the_module"] = state()["paused"]
        page.mouse.click(vw // 2, vh // 2)
        page.wait_for_timeout(600)
        p4["frame_takes_the_keys"] = page.evaluate("document.body.classList.contains('in-frame')")
        shoot("4-1-p4scenes-focus")
        page.keyboard.press("n")
        page.wait_for_timeout(500)
        p4["frame_hands_n_back"] = page.evaluate("!document.querySelector('#notes').hidden")
        page.keyboard.press("n")
        page.mouse.click(vw // 2, 20)
        page.wait_for_timeout(400)
        p4["bar_takes_the_keys_back"] = not page.evaluate(
            "document.body.classList.contains('in-frame')"
        )
        report["part4"] = p4
        keys.update({f"part4_{k}": v for k, v in p4.items()})
    else:
        report["part4"] = "the module did not load: placeholder"
    report["keys"] = keys
    report["bad_links"] = sorted(
        u for u in links if u.startswith("https://github.com/") and u not in ALLOWED
    )
    report["links_checked"] = len([u for u in links if u.startswith(GITHUB)])
    browser.close()

(out / f"report-{tag}.json").write_text(json.dumps(report, indent=1))
print(json.dumps({k: v for k, v in report.items() if k != "steps"}, indent=1))
print("steps:", len(report["steps"]))
sys.exit(1 if report["errors"] or report["bad_links"] or not all(report["keys"].values()) else 0)
