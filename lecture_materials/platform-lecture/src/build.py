"""Assemble lecture_materials/platform-lecture/index.html from the parts in src/.

    python3 lecture_materials/platform-lecture/src/build.py            # loads GSAP and the fonts from the CDN
    python3 lecture_materials/platform-lecture/src/build.py --bundle   # also writes index.bundled.html

page.html is the skeleton, css/*.css the styles and js/*.js the deck (both concatenated in name
order; the JavaScript into one function scope). data/ui-as-code.json is the research file part 2
shows, inlined as it is. data/course-assistant-links.json is the list of GitHub links the deck may
use: the build stops on a link that is not in it. The Databricks product icons and the GitHub,
Actions, Python and Databricks marks are read from ../day-on-the-platform/src/assets/ (never
copied), and assets/day-still.jpg is the still of that scene behind part 1's beats (still.py).

The default page loads the pinned GSAP file from cdnjs with subresource integrity, and the fonts
from Google Fonts, so it needs the network when it opens. --bundle writes a second page for a room
without internet: it downloads the same pinned file (checked against the same hash) and the two
fonts once, into src/vendor/, inlines them, and points part 1's frame at the sibling folder's own
bundled page. Never edit a built page by hand.
"""

from __future__ import annotations

import base64
import hashlib
import json
import re
import sys
import urllib.request
from pathlib import Path

SRC = Path(__file__).resolve().parent
ROOT = SRC.parent
OUT = ROOT / "index.html"
BUNDLED = ROOT / "index.bundled.html"
VENDOR = SRC / "vendor"
DAY = ROOT.parent / "day-on-the-platform"
PART4 = ROOT / "part4"

GSAP_VERSION = "3.15.1"
CDN = f"https://cdnjs.cloudflare.com/ajax/libs/gsap/{GSAP_VERSION}/"
LIBS = {  # file -> the sha512 cdnjs publishes for it (api.cdnjs.com/libraries/gsap/3.15.1?fields=sri)
    "gsap.min.js": "sha512-VMHB/Dy1/3d+djJPdMhxbplbZgbfPNHy+yWCxB1MSrwUEcNE+gnviL/DwlGsh9wwobnRTiQc6ChK2ZoJamshXA==",
}
FONTS_CSS = "https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap"
FONT_LINKS = (
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
    f'<link rel="stylesheet" href="{FONTS_CSS}">'
)
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
GITHUB = "https://github.com/llmops-databricks-2/course-assistant/blob/main/"


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310 (fixed https URLs)
        return response.read()


def vendored_lib(name: str) -> str:
    """The pinned library file, downloaded once and checked against its published hash."""
    VENDOR.mkdir(exist_ok=True)
    path = VENDOR / f"{name[:-3]}-{GSAP_VERSION}.js"
    if not path.exists():
        path.write_bytes(fetch(CDN + name))
    data = path.read_bytes()
    digest = "sha512-" + base64.b64encode(hashlib.sha512(data).digest()).decode()
    if digest != LIBS[name]:
        path.unlink()
        raise SystemExit(f"build: {name} does not match its pinned hash; nothing was bundled")
    return data.decode("utf-8")


def vendored_fonts() -> str:
    """Google's stylesheet with the latin woff2 files inlined as data URIs."""
    VENDOR.mkdir(exist_ok=True)
    css_path = VENDOR / "fonts.css"
    if not css_path.exists():
        css = fetch(FONTS_CSS).decode("utf-8")
        blocks = re.findall(r"/\* ([a-z-]+) \*/\s*(@font-face\s*{[^}]*})", css)
        kept = []
        for subset, block in blocks:
            if subset != "latin":
                continue
            url = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+\.woff2)\)", block)
            if not url:
                raise SystemExit("build: a font block has no woff2 url")
            data = base64.b64encode(fetch(url.group(1))).decode()
            kept.append(block.replace(url.group(1), f"data:font/woff2;base64,{data}"))
        if not kept:
            raise SystemExit("build: no latin font blocks found")
        css_path.write_text("\n".join(kept))
    return css_path.read_text()


def check_links(js: str) -> int:
    """Every GitHub link of the deck is one the facts list.

    A link is a quoted repository path that ends in a line anchor ("scripts/x.py#L1-L9"), given to
    L() or U(); part 5 writes its paths as ON + "file.py#L1".
    """
    allowed = {
        row["url"].removeprefix(GITHUB)
        for row in json.loads(
            (SRC / "data/course-assistant-links.json").read_text(encoding="utf-8")
        )
    }
    prefix = re.search(r'const ON = "([^"]+)";', js)
    used = set(re.findall(r'(?<!ON \+ )"([\w./\-]+#L\d+(?:-L\d+)?)"', js))
    used |= (
        {prefix.group(1) + path for path in re.findall(r'ON \+ "([^"]+)"', js)} if prefix else set()
    )
    unknown = sorted(path for path in used if path not in allowed)
    if unknown:
        raise SystemExit("build: links that the facts do not list:\n  " + "\n  ".join(unknown))
    if "github.com/llmops-databricks-2" in js.replace(GITHUB, ""):
        raise SystemExit("build: a course-assistant link is written outside L() and U()")
    return len(used)


def assemble(bundle: bool) -> str:
    read = lambda rel: (SRC / rel).read_text(encoding="utf-8")  # noqa: E731
    sprites = "".join(
        (DAY / "src/assets" / f"{name}.svg").read_text(encoding="utf-8")
        for name in ("dbx-icons", "marks")
    )
    css = "\n".join(p.read_text(encoding="utf-8") for p in sorted((SRC / "css").glob("*.css")))
    js = "\n".join(p.read_text(encoding="utf-8") for p in sorted((SRC / "js").glob("*.js")))
    links = check_links(js)

    still = SRC / "assets/day-still.jpg"
    still_css = (
        f'url("data:image/jpeg;base64,{base64.b64encode(still.read_bytes()).decode()}")'
        if still.exists()
        else "none"
    )
    day_page = (
        "index.bundled.html" if bundle and (DAY / "index.bundled.html").exists() else "index.html"
    )
    if bundle and day_page == "index.html":
        print(
            "build: ../day-on-the-platform/index.bundled.html is missing; part 1's frame will need the network"
        )
    part4 = {}
    for key, name in (("scenes", "index"), ("github", "github")):
        offline = bundle and (PART4 / f"{name}.bundled.html").exists()
        part4[key] = {
            "src": f"part4/{name}.bundled.html" if offline else f"part4/{name}.html",
            "found": (PART4 / f"{name}.html").exists(),
        }
    build = {
        "bundle": bundle,
        "gsap": GSAP_VERSION,
        "day": f"../day-on-the-platform/{day_page}",
        "part4": part4,
        "links": links,
    }
    ui = json.loads(read("data/ui-as-code.json"))
    js = js.replace("/*UI_AS_CODE*/[]", json.dumps(ui, ensure_ascii=False), 1)
    js = js.replace("/*BUILD*/{}", json.dumps(build), 1)
    js = '(() => {\n"use strict";\n' + js + "\n})();"
    js = js.replace("</script", "<\\/script")

    if bundle:
        libs = "\n".join(
            "<script>\n" + vendored_lib(n).replace("</script", "<\\/script") + "\n</script>"
            for n in LIBS
        )
        fonts = f"<style>\n{vendored_fonts()}\n</style>"
    else:
        libs = "\n".join(
            f'<script src="{CDN}{n}" integrity="{sri}" crossorigin="anonymous" referrerpolicy="no-referrer"></script>'
            for n, sri in LIBS.items()
        )
        fonts = FONT_LINKS
    page = read("page.html")
    for mark, value in (
        ("<!--FONTS-->", fonts),
        ("/*CSS*/", css),
        ("/*STILL*/", still_css),
        ("<!--SPRITES-->", sprites),
        ("<!--LIBS-->", libs),
        ("/*JS*/", js),
    ):
        if mark not in page:
            raise SystemExit(f"build: the page lost its {mark} mark")
        page = page.replace(mark, value, 1)
    return page


def main() -> None:
    OUT.write_text(assemble(bundle=False), encoding="utf-8")
    print(f"wrote {OUT.name}: {OUT.stat().st_size} bytes (GSAP {GSAP_VERSION} from cdnjs)")
    if "--bundle" in sys.argv[1:]:
        BUNDLED.write_text(assemble(bundle=True), encoding="utf-8")
        print(f"wrote {BUNDLED.name}: {BUNDLED.stat().st_size} bytes (GSAP and fonts inlined)")


if __name__ == "__main__":
    main()
