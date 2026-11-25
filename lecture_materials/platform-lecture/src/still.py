# /// script
# dependencies = ["playwright==1.48.0"]
# ///
"""Take the still of the animated map that part 1's beats sit on: src/assets/day-still.jpg.

    uv run lecture_materials/platform-lecture/src/still.py [1512x938]

Opens ../day-on-the-platform/index.html in headless Chrome at the size of the deck's stage, lets
the whole day run for a moment, and saves one JPEG. Nothing of that page is copied or changed; the
build inlines the picture, dimmed by the deck's own CSS. Run it again when the map changes.
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

SRC = Path(__file__).resolve().parent
DAY = SRC.parent.parent / "day-on-the-platform" / "index.html"
OUT = SRC / "assets" / "day-still.jpg"
vw, vh = (int(v) for v in (sys.argv[1] if len(sys.argv) > 1 else "1512x938").split("x"))

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome")
    page = browser.new_page(viewport={"width": vw, "height": vh})
    page.goto(DAY.as_uri())
    page.wait_for_function("window.__day && document.fonts.status === 'loaded'", timeout=20000)
    page.wait_for_timeout(1000)
    # the whole day, a little faster than real time, until the map is busy
    page.evaluate(
        "() => { window.__day.show(window.__day.CH.length); window.__day.scene.timeScale(3); }"
    )
    page.wait_for_timeout(9000)
    OUT.parent.mkdir(exist_ok=True)
    page.screenshot(path=str(OUT), type="jpeg", quality=68)
    browser.close()
print(f"wrote {OUT.relative_to(SRC.parent)}: {OUT.stat().st_size} bytes")
