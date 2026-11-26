"""Sanitize the downloaded artwork into the sprites the page inlines.

    python3 -I lecture_materials/day-on-the-platform/src/prepare_assets.py <downloads>

<downloads> is a scratch folder outside the repository holding dbx-icons/*.svg (from
oieduardorabelo/databricks-architecture-icons, icons/svg). The people are not downloaded: they are
drawn in js/05-people.js.
Downloads are untrusted: each file is parsed, only whitelisted elements and attributes survive,
every id is prefixed, and anything that looks like script, an event handler or an external
reference stops the run. The vendor marks come from the Cauchy sprite on this machine.
Writes src/assets/{dbx-icons,marks}.svg. Run with -I so nothing next to the data is imported.
"""

from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "assets"
SVG = "http://www.w3.org/2000/svg"
CAUCHY_SPRITE = Path.home() / ".claude/plugins/cache/cauchy/cauchy/1.1.2/brand/assets/icons.svg"
MARKS = ["github", "githubactions", "python", "databricks"]

ELEMENTS = {
    "svg",
    "symbol",
    "g",
    "path",
    "rect",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
    "defs",
    "clipPath",
    "mask",
    "linearGradient",
    "radialGradient",
    "stop",
}
DROPPED = {"title", "desc", "metadata"}
ATTRS = {
    "d",
    "fill",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-miterlimit",
    "stroke-dasharray",
    "fill-rule",
    "clip-rule",
    "opacity",
    "fill-opacity",
    "stroke-opacity",
    "transform",
    "x",
    "y",
    "width",
    "height",
    "rx",
    "ry",
    "cx",
    "cy",
    "r",
    "x1",
    "y1",
    "x2",
    "y2",
    "points",
    "id",
    "clip-path",
    "mask",
    "offset",
    "stop-color",
    "stop-opacity",
    "gradientUnits",
    "gradientTransform",
    "maskUnits",
    "viewBox",
}
IGNORED_ATTRS = {"role", "aria-label", "shape-rendering", "version"}
STYLE_PROPS = {
    "fill",
    "stroke",
    "fill-rule",
    "fill-opacity",
    "stroke-opacity",
    "stroke-width",
    "opacity",
}
BAD = re.compile(r"javascript:|data:|https?:|//|@import|expression\(|<|&", re.I)


def local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def clean(node: ET.Element, prefix: str, where: str) -> ET.Element | None:
    name = local(node.tag)
    if name in DROPPED:
        return None
    if name not in ELEMENTS:
        raise SystemExit(f"{where}: element <{name}> is not allowed")
    out = ET.Element(name)
    for key, value in node.attrib.items():
        attr = local(key)
        if attr == "style":
            # a style attribute is unpacked into the presentation attributes it sets, nothing else
            for decl in filter(None, (d.strip() for d in value.split(";"))):
                prop, _, val = (part.strip() for part in decl.partition(":"))
                if prop not in STYLE_PROPS or BAD.search(val) or "url(" in val:
                    raise SystemExit(f"{where}: style declaration {prop} is not allowed")
                out.set(prop, val)
            continue
        if attr in IGNORED_ATTRS:
            continue
        if attr.startswith("on") or attr == "href" or attr not in ATTRS:
            raise SystemExit(f"{where}: attribute {attr}= on <{name}> is not allowed")
        if BAD.search(value):
            raise SystemExit(f"{where}: suspicious value in {attr}=")
        if attr == "id":
            value = prefix + value
        value = re.sub(r"url\(\s*#([^)]+)\)", lambda m: f"url(#{prefix}{m.group(1)})", value)
        if "url(" in value and "url(#" not in value:
            raise SystemExit(f"{where}: external url() in {attr}=")
        out.set(attr, value)
    for child in node:
        kept = clean(child, prefix, where)
        if kept is not None:
            out.append(kept)
    return out


def symbol(path: Path, sym_id: str) -> str:
    text = path.read_text(encoding="utf-8")
    if re.search(r"<!DOCTYPE|<!ENTITY|<\?xml-stylesheet|<script|<foreignObject", text, re.I):
        raise SystemExit(f"{path.name}: DTD, entity, stylesheet, script or foreignObject found")
    root = ET.fromstring(text)
    if local(root.tag) != "svg":
        raise SystemExit(f"{path.name}: not an SVG")
    cleaned = clean(root, sym_id + "-", path.name)
    assert cleaned is not None
    cleaned.tag = "symbol"
    view = cleaned.get("viewBox") or f"0 0 {root.get('width')} {root.get('height')}"
    for attr in list(cleaned.attrib):
        del cleaned.attrib[attr]
    cleaned.set("id", sym_id)
    cleaned.set("viewBox", view)
    return ET.tostring(cleaned, encoding="unicode")


def sprite(symbols: list[str], note: str) -> str:
    # zero-sized, not display:none: gradients inside a display:none svg do not paint in every browser
    head = f'<svg xmlns="{SVG}" width="0" height="0" style="position:absolute" aria-hidden="true">\n<!-- {note} -->\n'
    return head + "\n".join(symbols) + "\n</svg>\n"


def cauchy_marks() -> str:
    root = ET.fromstring(CAUCHY_SPRITE.read_text(encoding="utf-8"))
    found = []
    for node in root.iter():
        if local(node.tag) == "symbol" and node.get("id", "").replace("icon-", "", 1) in MARKS:
            name = node.get("id").replace("icon-", "", 1)
            cleaned = clean(node, f"mk-{name}-", f"cauchy:{name}")
            assert cleaned is not None
            cleaned.set("id", f"mk-{name}")
            found.append(ET.tostring(cleaned, encoding="unicode"))
    if len(found) != len(MARKS):
        raise SystemExit("the Cauchy sprite misses a mark")
    return sprite(
        found,
        "GitHub, GitHub Actions, Python and Databricks marks, from the Cauchy sprite (brand/assets/icons.svg)",
    )


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    src = Path(sys.argv[1])
    OUT.mkdir(exist_ok=True)
    icons = [symbol(p, f"dbx-{p.stem}") for p in sorted((src / "dbx-icons").glob("*.svg"))]
    (OUT / "dbx-icons.svg").write_text(
        sprite(
            icons,
            "Databricks product icons: official Databricks artwork, via oieduardorabelo/databricks-architecture-icons (MIT). Trademarks of Databricks, Inc.",
        )
    )
    (OUT / "marks.svg").write_text(cauchy_marks())
    print(f"icons {len(icons)}, marks {len(MARKS)}")


if __name__ == "__main__":
    ET.register_namespace("", SVG)
    main()
