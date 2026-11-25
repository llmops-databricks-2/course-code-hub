"""Assemble part 4 of the platform lecture from the parts in src/.

    python3 lecture_materials/platform-lecture/part4/src/build.py            # index.html, github.html
    python3 lecture_materials/platform-lecture/part4/src/build.py --bundle   # also *.bundled.html

index.html is the animation: page.html (the skeleton), base.css and scene.css, js/*.js
(concatenated in name order into one function scope) and the symbols of assets/*.svg that the
scene uses. github.html is the static close-up: github.page.html, base.css and github.css,
github.js, and closeup.json with every link resolved against facts/course-assistant-links.json.

The build refuses a close-up link that the facts file does not list, and refuses to build while a
part 4 link of the facts file is not on the page. CORRECTED holds the three line ranges of the facts
file that were wrong on the commit it was read from.

The default pages load the pinned GSAP files from cdnjs with subresource integrity (index.html
only) and the fonts from Google Fonts, so they need the network when they open. --bundle writes a
second copy of each page for a room without internet: the same pinned GSAP files, checked against
the same hashes, and the two fonts, kept in src/vendor/ and inlined. Never edit a built page by hand.
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
OUT = SRC.parent
VENDOR = SRC / "vendor"

GSAP_VERSION = "3.15.1"
CDN = f"https://cdnjs.cloudflare.com/ajax/libs/gsap/{GSAP_VERSION}/"
LIBS = {  # file -> the sha512 cdnjs publishes for it (api.cdnjs.com/libraries/gsap/3.15.1?fields=sri)
    "gsap.min.js": "sha512-VMHB/Dy1/3d+djJPdMhxbplbZgbfPNHy+yWCxB1MSrwUEcNE+gnviL/DwlGsh9wwobnRTiQc6ChK2ZoJamshXA==",
    "MotionPathPlugin.min.js": "sha512-UY+C2Ml/WmSOCNGlHkf8Lxir2mqkiwsOOOw5p3Wnl6nXSiZZBDqu+xgWvCbhTn5wC7m3YIU9mXhWt9lYDV/EDA==",
}
FONTS_CSS = "https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600&family=Fira+Code:wght@400;500&display=swap"
FONT_LINKS = (
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
    f'<link rel="stylesheet" href="{FONTS_CSS}">'
)
ICON = (
    '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 '
    "viewBox=%220 0 422 422%22%3E%3Cpath fill=%22%23f24b37%22 d=%22M 211,0 A 211,211 0 0 0 0,211 a 211,211 0 0 0 "
    "211,211 211,211 0 0 0 211,-211 211,211 0 0 0 -13.275,-73.662 l -106.328,61.391 a 87.5,87.5 0 0 1 0.586,10.109 "
    "87.5,87.5 0 0 1 -87.5,87.5 87.5,87.5 0 0 1 -87.5,-87.5 87.5,87.5 0 0 1 87.5,-87.5 87.5,87.5 0 0 1 50.463,16.018 "
    'L 372.853,75.633 A 211,211 0 0 0 211,0 Z%22/%3E%3C/svg%3E">'
)
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
REPO = "https://github.com/llmops-databricks-2/course-assistant/blob/main/"
# Line ranges of the facts file that do not hold on the commit it was read from (24797fd), found by
# reading the lines: the page links the right-hand range, and the left-hand link counts as shown.
CORRECTED = {
    "scripts/setup_cohort.py#L3379-L3381": "scripts/setup_cohort.py#L3390-L3392",  # was --skip; --probe-policy is here
    "tests/conftest.py#L858-L880": "tests/conftest.py#L856-L875",  # the fixture starts at 856; the file has 875 lines
    "tests/conftest.py#L806-L880": "tests/conftest.py#L803-L875",  # _scratch_catalog starts at 803
}


def read(rel: str) -> str:
    return (SRC / rel).read_text(encoding="utf-8")


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
        kept = []
        for subset, block in re.findall(r"/\* ([a-z-]+) \*/\s*(@font-face\s*{[^}]*})", css):
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


def sprites(*sources: str) -> str:
    """The symbols of assets/*.svg that the given sources name, in one hidden svg."""
    wanted = set(re.findall(r"\b((?:dbx|mk)-[a-z-]+)\b", " ".join(sources)))
    kept = []
    for name in ("dbx-icons", "marks"):
        for symbol, sym_id in re.findall(
            r'(<symbol id="([^"]+)".*?</symbol>)', read(f"assets/{name}.svg"), re.S
        ):
            if sym_id in wanted:
                kept.append(symbol)
                wanted.discard(sym_id)
    if wanted:
        raise SystemExit(f"build: no symbol for {sorted(wanted)}")
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true">\n'
        + "\n".join(kept)
        + "\n</svg>"
    )


def fill(page: str, marks: dict[str, str]) -> str:
    for mark, value in marks.items():
        if mark not in page:
            raise SystemExit(f"build: the skeleton lost its {mark} mark")
        page = page.replace(mark, value, 1)
    return page


def script(js: str) -> str:
    js = '(() => {\n"use strict";\n' + js + "\n})();"
    if "</script" in js.lower():
        raise SystemExit("build: the JavaScript contains a closing script tag")
    return js


def animation(bundle: bool) -> str:
    js = "\n".join(p.read_text(encoding="utf-8") for p in sorted((SRC / "js").glob("*.js")))
    if bundle:
        libs = "\n".join(
            "<script>\n" + vendored_lib(n).replace("</script", "<\\/script") + "\n</script>"
            for n in LIBS
        )
    else:
        libs = "\n".join(
            f'<script src="{CDN}{n}" integrity="{sri}" crossorigin="anonymous" referrerpolicy="no-referrer"></script>'
            for n, sri in LIBS.items()
        )
    return fill(
        read("page.html"),
        {
            "<!--ICON-->": ICON,
            "<!--FONTS-->": f"<style>\n{vendored_fonts()}\n</style>" if bundle else FONT_LINKS,
            "/*CSS*/": read("base.css") + read("scene.css"),
            "<!--SPRITES-->": sprites(js),
            "<!--LIBS-->": libs,
            "/*JS*/": script(js),
        },
    )


def closeup_data() -> dict:
    """closeup.json with every link resolved, checked against the facts file both ways."""
    facts = json.loads(read("facts/course-assistant-links.json"))
    label_of: dict[str, str] = {}
    for part in (4, 3, 5):  # a part 4 label wins where a link is listed twice
        for item in facts:
            if item["part"] == part:
                label_of.setdefault(item["url"], item["label"])
    data = json.loads(read("closeup.json"))
    used: set[str] = set()

    def resolve(ref: str) -> dict:
        url = REPO + ref
        if url not in label_of:
            raise SystemExit(f"build: {ref} is not a link of the facts file")
        used.add(url)
        path, _, lines = CORRECTED.get(ref, ref).partition("#")
        return {
            "url": f"{REPO}{path}#{lines}",
            "label": label_of[url],
            "path": path,
            "lines": lines.replace("L", "").replace("-", "–"),
        }

    for side in ("student", "platform"):
        for row in data[side]["rows"] + data[side].get("gaps", []):
            row["links"] = [resolve(ref) for ref in row["links"]]
            row["docs"] = [data["docs"][key] for key in row.get("docs", [])]
    missing = sorted({item["url"] for item in facts if item["part"] == 4} - used)
    if missing:
        raise SystemExit(
            "build: part 4 links of the facts file that the close-up does not show:\n  "
            + "\n  ".join(missing)
        )
    del data["_comment"]
    data["count"] = len(used) + len(data["docs"])
    return data


def closeup(bundle: bool) -> str:
    js = read("github.js")
    data = json.dumps(closeup_data(), ensure_ascii=False).replace("</", "<\\/")
    return fill(
        read("github.page.html"),
        {
            "<!--ICON-->": ICON,
            "<!--FONTS-->": f"<style>\n{vendored_fonts()}\n</style>" if bundle else FONT_LINKS,
            "/*CSS*/": read("base.css") + read("github.css"),
            "<!--SPRITES-->": sprites("mk-github mk-githubactions mk-databricks"),
            "/*DATA*/": data,
            "/*JS*/": script(js),
        },
    )


def main() -> None:
    bundle = "--bundle" in sys.argv[1:]
    for name, make in (("index", animation), ("github", closeup)):
        out = OUT / f"{name}.html"
        out.write_text(make(False), encoding="utf-8")
        print(f"wrote {out.name}: {out.stat().st_size} bytes")
        if bundle:
            out = OUT / f"{name}.bundled.html"
            out.write_text(make(True), encoding="utf-8")
            print(
                f"wrote {out.name}: {out.stat().st_size} bytes (fonts{' and GSAP ' + GSAP_VERSION if name == 'index' else ''} inlined)"
            )


if __name__ == "__main__":
    main()
