# /// script
# requires-python = ">=3.11"
# dependencies = ["playwright==1.48.0"]
# ///
"""Fixed-geometry SVG for the request-path figure (Cauchy Pattern G).

Four columns, left to right: your side (browser, laptop, GitHub Actions, outside every cloud frame),
then, inside the frame "Your Databricks account · run by Databricks, on AWS us-west-2", the control plane, the serverless
compute plane and storage. A dashed, muted frame below holds the classic-workspace ghosts.

Text is measured in headless Chrome (Playwright, channel "chrome"), every card and path is derived
from geometry, and the readability checks run before anything is written: on a failure the script
prints every problem and exits without touching the fragment.

Usage: uv run gen_request_path.py [output.html]
"""

# ruff: noqa: E501  -- the SVG and CSS strings stay one element per line, so the output reads like the figure

import html
import math
import pathlib
import sys

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "request-path.html"

FID, P = "request-path", "rp"
CLAIM = (
    "An action you take runs in three places that are not your machine: the control plane and the "
    "serverless compute plane, both in Databricks' cloud account, and storage. Data is read where it "
    "lives, in parallel; the result comes back through the control plane or, when large, as files "
    "downloaded straight from storage."
)
SVG_ROLE = "group"  # role="img" would make the role="button" nodes presentational to assistive tech

NUNITO = "Nunito, system-ui, sans-serif"
FIRA = "'Fira Code', ui-monospace, monospace"
# the page tokens (PLATFORM-INFRASTRUCTURE.html :root), as literal hex
INK, BODY, MUTED = "#1a1a1a", "#6b6b6b", "#9a9a9a"
LINE = "#e0dfdd"
EDGE = "#b5b3b0"
LINK = "#337FF9"

KIND = {  # fill, stroke, stroke width, dash, title colour, line colour
    "person": ("#ffffff", "#e0dfdd", 1, None, INK, BODY),
    "service": ("#f0f4fb", "#cdd8ed", 1, None, INK, BODY),
    "compute": ("#f0f4fb", "#506fa0", 1.4, None, INK, BODY),
    "data": ("#f0f5f2", "#c8dad2", 1, None, INK, BODY),
    "ghost": ("#ffffff", "#e0dfdd", 1.2, "4 3", MUTED, MUTED),
}

# text styles: family, size, weight, colour, line height, letter-spacing (em)
ST = {
    "title": ("nunito", 13, 600, INK, 18, 0),
    "sub": ("nunito", 11, 400, BODY, 15, 0),
    "lane": ("nunito", 11, 600, BODY, 14, 0.06),
    "frame": ("nunito", 12, 600, BODY, 16, 0),
    "frame-muted": ("nunito", 11, 600, MUTED, 14, 0),
    "elabel": ("nunito", 11, 400, BODY, 14, 0),
}
FAM = {"nunito": NUNITO, "fira": FIRA}

# ---------------- measurement (headless Chrome) ----------------
_pw = sync_playwright().start()
_browser = _pw.chromium.launch(channel="chrome")
_page = _browser.new_page()
_page.set_content(
    '<!doctype html><html><head><meta charset="utf-8">'
    '<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">'
    "</head><body></body></html>",
    wait_until="networkidle",
)
_fonts_ok = _page.evaluate(
    "Promise.all(['400 11px Nunito','600 11px Nunito','600 12px Nunito','600 13px Nunito'].map(f=>document.fonts.load(f)))"
    ".then(()=>document.fonts.ready).then(()=>document.fonts.check('600 13px Nunito')&&document.fonts.check('400 11px Nunito'))"
)
if not _fonts_ok:
    sys.exit("the fonts did not load in Chrome: measurement would be wrong, nothing written")
_cache = {}


def _css(st):
    f, s, w, _, _, ls = ST[st]
    return f"font-family:{FAM[f]};font-size:{s}px;font-weight:{w};letter-spacing:{ls}em;white-space:pre"


def measure_many(items):
    todo = [(t, st) for t, st in dict.fromkeys(items) if (t, st) not in _cache]
    if not todo:
        return
    widths = _page.evaluate(
        "(items)=>items.map(([t,css])=>{const s=document.createElement('span');s.style.cssText=css;"
        "s.textContent=t;document.body.appendChild(s);const w=s.getBoundingClientRect().width;s.remove();return w;})",
        [[t, _css(st)] for t, st in todo],
    )
    for key, wd in zip(todo, widths, strict=True):
        _cache[key] = wd


def tw(t, st):
    measure_many([(t, st)])
    return _cache[(t, st)]


def wrap(text, st, maxw):
    words = text.split(" ")
    measure_many(
        [
            (" ".join(words[i:j]), st)
            for i in range(len(words))
            for j in range(i + 1, len(words) + 1)
        ]
    )
    lines, i = [], 0
    while i < len(words):
        j = i + 1
        while j < len(words) and tw(" ".join(words[i : j + 1]), st) <= maxw:
            j += 1
        lines.append(" ".join(words[i:j]))
        i = j
    return lines


# ---------------- model ----------------
PAD_X, PAD_Y, RX = 12, 11, 8
OFF = 5  # exec: two cards behind the front one, each offset down and right by OFF
PS = 14  # spacing of the ports on one side of a card
LEG = 16  # the shortest last leg, so the chevron sits on a straight line
LG = 10  # an edge label's centre sits LG above or below its line
nodes = {}
texts = []  # free texts: dict(x, y, t, st, anchor, cls)
edges = []  # dict(id, frm, to, pts, back)
elabels = []  # dict(x, y, t, anchor, edge)
problems = []

SPEC = [  # key, kind, column, title, subtitle (one line each, from SPEC.md § Nodes)
    ("browser", "person", 1, "Your browser", "workspace UI, notebooks, SQL editor"),
    ("client", "person", 1, "Your laptop", "SQL connector, CLI, SDK"),
    ("github", "person", 1, "GitHub Actions", "your CD workflow"),
    ("webapp", "service", 2, "Web application and REST APIs", "sign-in, workspace objects"),
    ("scheduler", "service", 2, "Jobs service", "triggers and schedules runs"),
    ("uc", "service", 2, "Unity Catalog", "privileges, lineage, audit"),
    ("cpresults", "data", 2, "Small results", "kept in the control plane"),
    ("driver", "compute", 3, "Driver or SQL warehouse", "plans the work, Photon"),
    ("exec", "compute", 3, "Executors", "tasks run in parallel"),
    ("data", "data", 4, "Your tables and volumes", "Delta and Parquet files"),
    ("wsstore", "data", 4, "Workspace storage", "job results, large results"),
    ("classic", "ghost", 3, "Classic compute", "clusters in your VPC"),
    ("bucket", "ghost", 4, "Your S3 bucket", "workspace storage, classic"),
]
WRAP_TITLE = {"webapp"}  # the one title allowed to wrap: the card is tall for its ports anyway
LABEL = {  # SPEC.md § Edges
    "e_ui": "HTTPS: UI and REST",
    "e_sql": "HTTPS: host + http_path",
    "e_cd": "REST call as a principal",
    "e_sched": "create a run",
    "e_run": "start the job's compute",
    "e_cmd": "command or query (cloud backbone)",
    "e_auth": "may this identity read it?",
    "e_tasks": "split into tasks",
    "e_read": "read files in parallel",
    "e_small": "small result",
    "e_reply_ui": "result in the page",
    "e_reply_cli": "result rows",
    "e_large": "large result as files",
    "e_fetch": "presigned URL download (Cloud Fetch)",
    "e_large_ui": "read back for the page",
}


def col_width(c):
    """Narrowest width that keeps every subtitle and every non-wrapping title of column c on one line."""
    need = 0
    for key, _, col, title, sub in SPEC:
        if col != c:
            continue
        need = max(need, tw(sub, "sub"))
        if key not in WRAP_TITLE:
            need = max(need, tw(title, "title"))
    return math.ceil(need) + 2 * PAD_X


def card(key, w):
    _, kind, col, title, sub = next(s for s in SPEC if s[0] == key)
    inner = w - 2 * PAD_X
    rows = [(line, "title") for line in wrap(title, "title", inner)]
    rows += [(line, "sub") for line in wrap(sub, "sub", inner)]
    h = 2 * PAD_Y + sum(ST[st][4] for _, st in rows)
    n = dict(key=key, kind=kind, col=col, title=title, rows=rows, x=0, y=0, w=w, h=h, ch=h)
    nodes[key] = n
    return n


def rect(n):
    return (n["x"], n["y"], n["x"] + n["w"], n["y"] + n["h"])


def cy(n):
    return n["y"] + n["h"] / 2


def cxm(n):
    return n["x"] + n["w"] / 2


def right(n):
    return n["x"] + n["w"]


def bottom(n):
    return n["y"] + n["h"]


def edge(eid, frm, to, pts, back=False):
    clean = [pts[0]]
    for p in pts[1:]:
        if p != clean[-1]:
            clean.append(p)
    edges.append(dict(id=eid, frm=frm, to=to, pts=clean, back=back))


def elabel(eid, x, y, anchor="start"):
    elabels.append(dict(edge=eid, x=x, y=y, t=LABEL[eid], anchor=anchor))


def text(x, y, t, st, anchor="start", cls=""):
    texts.append(dict(x=x, y=y, t=t, st=st, anchor=anchor, cls=cls))


def text_box(x, y, t, st, anchor):
    w = tw(t, st)
    h = ST[st][1] * 1.3
    x0 = x if anchor == "start" else x - w / 2 if anchor == "middle" else x - w
    return (x0, y - h / 2, x0 + w, y + h / 2)


def lw(*eids):
    return math.ceil(max(tw(LABEL[e], "elabel") for e in eids))


# ---------------- columns (x) ----------------
XF = 6  # the track of e_fetch, left of your side: it reaches the laptop without crossing GitHub's edge
C1X = XF + LEG
C1W, C2W, C3W, C4W = (col_width(c) for c in (1, 2, 3, 4))
c1r = C1X + C1W
L12 = lw("e_ui", "e_reply_ui", "e_sql", "e_reply_cli", "e_cd")
T_CD = (
    c1r + 8 + lw("e_cd") + 8
)  # e_cd climbs here, right of GitHub's label (its vertical stays below the laptop)
WALL_L = max(
    T_CD + 12, c1r + 8 + L12 + 6
)  # the Databricks frame's left wall, clear of every label of your side
T_COL = WALL_L + 12  # collector: e_back and e_large_ui climb into the web application here
C2X = T_COL + LEG
c2r = C2X + C2W
L23 = lw("e_run", "e_auth", "e_small")
PT = 12  # spacing of parallel tracks in a gutter
T_RUN = c2r + 8 + L23 + 8  # g23 tracks, inner to outer: e_run, e_auth, e_small
T_AUTH = T_RUN + PT
T_SMALL = T_AUTH + PT
C3X = T_SMALL + LEG
C3R = C3X + C3W + 2 * OFF  # the executor stack is wider than the driver by its offsets
L34 = lw("e_read")
C4X = C3R + 8 + L34 + 8
c4r = C4X + C4W
T_R = c4r + LEG  # e_large goes round the right of the data card into workspace storage
WALL_R = T_R + 12
W = int(math.ceil(WALL_R + 6))

# ---------------- cards ----------------
for k in ("browser", "client", "github"):
    card(k, C1W)
for k in ("webapp", "scheduler", "uc", "cpresults"):
    card(k, C2W)
for k in ("driver", "exec"):
    card(k, C3W)
for k in ("data", "wsstore"):
    card(k, C4W)
card("classic", C3W)
card("bucket", C4W)
browser, client, github = nodes["browser"], nodes["client"], nodes["github"]
webapp, scheduler, uc, cpresults = (nodes[k] for k in ("webapp", "scheduler", "uc", "cpresults"))
driver, exe, data, wsstore = (nodes[k] for k in ("driver", "exec", "data", "wsstore"))
classic, bucket = nodes["classic"], nodes["bucket"]

# ---------------- rows (y) ----------------
FRAME_TOP = 8
FT_Y = FRAME_TOP + 18  # frame titles
LANE_Y = FT_Y + 30
HAIR_Y = LANE_Y + 11
Y0 = HAIR_Y + 15
G1, G2, G3, G4 = 16, 24, 28, 16  # vertical gap per column; G2 and G3 hold a label beside a vertical

y = Y0
for n in (browser, client, github):
    n["x"], n["y"] = C1X, y
    y = bottom(n) + G1

# the web application's left side, top to bottom: each return edge sits just under its outbound twin
p_ui, p_rui = cy(browser) - PS / 2, cy(browser) + PS / 2
p_sql, p_rcli = cy(client) - PS / 2, cy(client) + PS / 2
p_cd = p_rcli + PS
p_back = p_cd + PS
webapp["x"], webapp["y"] = C2X, Y0
webapp["h"] = max(webapp["ch"], p_back + RX + 6 - Y0)
y = bottom(webapp) + G2
for n in (scheduler, uc, cpresults):
    n["x"], n["y"] = C2X, y
    y = bottom(n) + G2

# driver: the command arrives on its top, so its long label lies over the gutter and the compute column;
# three left ports (run, auth, small result) and one right port (large result)
Y_CMD = Y0 + 12
driver["h"] = max(driver["ch"], 2 * PS + 2 * (RX + 4))
driver["x"], driver["y"] = C3X, Y_CMD + 22
P2, P3, P4 = cy(driver) - PS, cy(driver), cy(driver) + PS
exe["x"], exe["y"] = C3X, bottom(driver) + G3
exe["fh"] = exe["h"]  # the front card; the node's box includes the two cards behind it
exe["fw"] = exe["w"]
exe["w"], exe["h"] = exe["fw"] + 2 * OFF, exe["fh"] + 2 * OFF
Y_READ = exe["y"] + 2 * OFF + exe["fh"] / 2  # e_read leaves the back card's right side

data["x"], data["y"] = C4X, Y_READ - data["h"] / 2  # e_read is one straight line
wsstore["x"], wsstore["y"] = C4X, bottom(data) + G4

Y_RUN1 = max(bottom(n) for n in nodes.values() if n["kind"] != "ghost") + 28  # e_large_ui
Y_RUN2 = Y_RUN1 + PS  # e_fetch, along the bottom of the frame
FRAME_BOTTOM = Y_RUN2 + 16
dbx = dict(x=WALL_L, y=FRAME_TOP, w=WALL_R - WALL_L, h=FRAME_BOTTOM - FRAME_TOP)

CL_TOP = FRAME_BOTTOM + 20
CL_X = C3X - 16
CL_TITLE_Y = CL_TOP + 17
for n, x in ((classic, C3X), (bucket, C4X)):
    n["x"], n["y"] = x, CL_TOP + 32
cl_bottom = max(bottom(classic), bottom(bucket)) + 14
cls_frame = dict(x=CL_X, y=CL_TOP, w=WALL_R - CL_X, h=cl_bottom - CL_TOP)
H = int(math.ceil(cl_bottom + 8))

# ---------------- edges ----------------
edge("e_ui", "browser", "webapp", [(right(browser), p_ui), (C2X, p_ui)])
edge("e_reply_ui", "webapp", "browser", [(C2X, p_rui), (right(browser), p_rui)], back=True)
edge("e_sql", "client", "webapp", [(right(client), p_sql), (C2X, p_sql)])
edge("e_reply_cli", "webapp", "client", [(C2X, p_rcli), (right(client), p_rcli)], back=True)
edge(
    "e_cd",
    "github",
    "webapp",
    [(right(github), cy(github)), (T_CD, cy(github)), (T_CD, p_cd), (C2X, p_cd)],
)
edge(
    "e_sched", "webapp", "scheduler", [(cxm(webapp), bottom(webapp)), (cxm(webapp), scheduler["y"])]
)
edge("e_cmd", "webapp", "driver", [(c2r, Y_CMD), (cxm(driver), Y_CMD), (cxm(driver), driver["y"])])
edge(
    "e_run",
    "scheduler",
    "driver",
    [(c2r, cy(scheduler)), (T_RUN, cy(scheduler)), (T_RUN, P2), (C3X, P2)],
)
edge(
    "e_auth", "driver", "uc", [(C3X, P3), (T_AUTH, P3), (T_AUTH, cy(uc)), (c2r, cy(uc))], back=True
)
edge(
    "e_small",
    "driver",
    "cpresults",
    [(C3X, P4), (T_SMALL, P4), (T_SMALL, cy(cpresults)), (c2r, cy(cpresults))],
    back=True,
)
fx = exe["x"] + exe["fw"] / 2
edge("e_tasks", "driver", "exec", [(fx, bottom(driver)), (fx, exe["y"])])
edge("e_read", "exec", "data", [(right(exe), Y_READ), (C4X, Y_READ)])
edge(
    "e_large",
    "driver",
    "wsstore",
    [(right(driver), cy(driver)), (T_R, cy(driver)), (T_R, cy(wsstore)), (c4r, cy(wsstore))],
)
edge(
    "e_back",
    "cpresults",
    "webapp",
    [(C2X, cy(cpresults)), (T_COL, cy(cpresults)), (T_COL, p_back), (C2X, p_back)],
    back=True,
)
x_lui, x_fetch = cxm(wsstore) - PS / 2, cxm(wsstore) + PS / 2
edge(
    "e_large_ui",
    "wsstore",
    "webapp",
    [(x_lui, bottom(wsstore)), (x_lui, Y_RUN1), (T_COL, Y_RUN1), (T_COL, p_back), (C2X, p_back)],
    back=True,
)
edge(
    "e_fetch",
    "wsstore",
    "client",
    [
        (x_fetch, bottom(wsstore)),
        (x_fetch, Y_RUN2),
        (XF, Y_RUN2),
        (XF, cy(client)),
        (C1X, cy(client)),
    ],
    back=True,
)

# ---------------- edge labels (gutters only) ----------------
LX1 = c1r + 8
elabel("e_ui", LX1, p_ui - LG)
elabel("e_reply_ui", LX1, p_rui + LG)
elabel("e_sql", LX1, p_sql - LG)
elabel("e_reply_cli", LX1, p_rcli + LG)
elabel("e_cd", LX1, cy(github) - LG)
elabel("e_sched", cxm(webapp) + 8, bottom(webapp) + G2 / 2)
elabel("e_cmd", c2r + 8, Y_CMD - LG)
elabel("e_run", c2r + 8, cy(scheduler) - LG)
elabel("e_auth", c2r + 8, cy(uc) - LG)
elabel("e_small", c2r + 8, cy(cpresults) - LG)
elabel("e_tasks", fx + 8, bottom(driver) + G3 / 2)
elabel("e_read", C3R + 8, Y_READ - LG)
elabel("e_large", right(driver) + 8, cy(driver) - LG)
elabel("e_large_ui", T_COL + 10, Y_RUN1 - LG)
elabel("e_fetch", C1X, Y_RUN2 - LG)

# ---------------- free texts ----------------
text(C1X, FT_Y, "Your machine and GitHub", "frame", cls=f"{P}-ftitle")
text(
    WALL_L + 14,
    FT_Y,
    "Your Databricks account · run by Databricks, on AWS us-west-2",
    "frame",
    cls=f"{P}-ftitle",
)
text(
    CL_X + 14,
    CL_TITLE_Y,
    "Your cloud account (classic workspaces only; not used in the course)",
    "frame-muted",
    cls=f"{P}-ftitle {P}-ftitle-muted",
)
LANES = [
    ("YOUR SIDE", C1X, c1r),
    ("CONTROL PLANE", C2X, c2r),
    ("SERVERLESS COMPUTE PLANE", C3X, C3R),
    ("STORAGE", C4X, c4r),
]
for t, x, _ in LANES:
    text(x, LANE_Y, t, "lane", cls=f"{P}-lane")


# ---------------- checks ----------------
def fail(msg):
    problems.append(msg)


def inter(a, b, eps=0.0):
    return a[0] < b[2] - eps and b[0] < a[2] - eps and a[1] < b[3] - eps and b[1] < a[3] - eps


def seg_hits_rect(p, q, r, eps=0.5):
    """True when segment pq enters the interior of rect r (touching the border is allowed)."""
    x0, y0_, x1, y1 = r[0] + eps, r[1] + eps, r[2] - eps, r[3] - eps
    if p[1] == q[1]:
        yy = p[1]
        a, b = sorted((p[0], q[0]))
        return y0_ < yy < y1 and a < x1 and b > x0
    xx = p[0]
    a, b = sorted((p[1], q[1]))
    return x0 < xx < x1 and a < y1 and b > y0_


def on_border(p, r, rr):
    x, y_ = p
    on_v = (abs(x - r[0]) < 0.01 or abs(x - r[2]) < 0.01) and r[1] + rr <= y_ <= r[3] - rr
    on_h = (abs(y_ - r[1]) < 0.01 or abs(y_ - r[3]) < 0.01) and r[0] + rr <= x <= r[2] - rr
    return on_v or on_h


def segs(e):
    return list(zip(e["pts"], e["pts"][1:], strict=False))


def frame_lines(fr):
    x0, y0_, x1, y1 = fr["x"], fr["y"], fr["x"] + fr["w"], fr["y"] + fr["h"]
    return [
        ((x0, y0_), (x1, y0_)),
        ((x1, y0_), (x1, y1)),
        ((x0, y1), (x1, y1)),
        ((x0, y0_), (x0, y1)),
    ]


card_list = list(nodes.values())
all_rects = [(n["key"], rect(n)) for n in card_list]
dbx_rect = (dbx["x"], dbx["y"], dbx["x"] + dbx["w"], dbx["y"] + dbx["h"])
cls_rect = (
    cls_frame["x"],
    cls_frame["y"],
    cls_frame["x"] + cls_frame["w"],
    cls_frame["y"] + cls_frame["h"],
)

# 1. nothing overlaps; each card sits in the frame that holds it
for i, a in enumerate(card_list):
    for b in card_list[i + 1 :]:
        if inter(rect(a), rect(b)):
            fail(f"cards overlap: {a['key']} / {b['key']}")


def inside(r, fr, pad=8):
    return (
        fr[0] + pad <= r[0] and r[2] <= fr[2] - pad and fr[1] + pad <= r[1] and r[3] <= fr[3] - pad
    )


for n in card_list:
    r = rect(n)
    where = "classic" if n["kind"] == "ghost" else "dbx" if n["col"] > 1 else "none"
    if where == "dbx" and not inside(r, dbx_rect):
        fail(f"{n['key']} not inside the Databricks frame")
    if where == "classic" and not inside(r, cls_rect):
        fail(f"{n['key']} not inside the classic frame")
    if where != "dbx" and inter(r, dbx_rect):
        fail(f"{n['key']} intersects the Databricks frame")
    if where != "classic" and inter(r, cls_rect):
        fail(f"{n['key']} intersects the classic frame")
if cls_rect[1] < dbx_rect[3] + 12:
    fail("the classic frame is not below the Databricks frame")
if HAIR_Y + 12 > Y0:
    fail("lane hairline too close to the cards")

# 2. columns and rows: one x and width per column (the executor stack by its front card), one gap per column
cols = {}
for n in card_list:
    if n["kind"] != "ghost":
        cols.setdefault(n["col"], []).append(n)
for c, ns in cols.items():
    if len({(n["x"], n.get("fw", n["w"])) for n in ns}) != 1:
        fail(f"column {c}: cards do not share x and width")
    ns = sorted(ns, key=lambda n: n["y"])
    gaps = {round(b["y"] - bottom(a), 2) for a, b in zip(ns, ns[1:], strict=False)}
    if len(gaps) > 1:
        fail(f"column {c}: uneven gaps {sorted(gaps)}")
    if gaps and min(gaps) < 12:
        fail(f"column {c}: gap {min(gaps)} under 12")
if (classic["x"], classic["w"]) != (driver["x"], driver["w"]) or (bucket["x"], bucket["w"]) != (
    data["x"],
    data["w"],
):
    fail("the classic ghosts are not on the compute and storage columns")

# 3. text fits its card on the lines planned, and is 11px or more
for n in card_list:
    for t, st in n["rows"]:
        if tw(t, st) > n.get("fw", n["w"]) - 2 * PAD_X:
            fail(f"text does not fit {n['key']}: {t!r} needs {tw(t, st):.1f}")
    subs = [t for t, st in n["rows"] if st == "sub"]
    if len(subs) != 1:
        fail(f"{n['key']}: the subtitle wraps to {len(subs)} lines")
    if n["key"] not in WRAP_TITLE and sum(st == "title" for _, st in n["rows"]) != 1:
        fail(f"{n['key']}: the title wraps")
for st, v in ST.items():
    if v[1] < 11:
        fail(f"style {st} under 11px")
for t, x0, x1 in LANES:
    if x0 + tw(t, "lane") > x1:
        fail(f"lane title {t!r} wider than its column")

# 4. edges: orthogonal, start and end on an edge, last leg long enough, nothing entered, one direction
EDGE_IDS = [
    "e_ui", "e_sql", "e_cd", "e_sched", "e_run", "e_cmd", "e_auth", "e_tasks", "e_read", "e_small",
    "e_back", "e_reply_ui", "e_reply_cli", "e_large", "e_fetch", "e_large_ui",
]  # fmt: skip
if sorted(e["id"] for e in edges) != sorted(EDGE_IDS):
    fail("the edges drawn are not the edges of the spec")
for e in edges:
    name = e["id"]
    for p, q in segs(e):
        if p[0] != q[0] and p[1] != q[1]:
            fail(f"{name}: diagonal segment {p}->{q}")
    sr, tr = rect(nodes[e["frm"]]), rect(nodes[e["to"]])
    if not on_border(e["pts"][0], sr, RX):
        fail(f"{name}: start {e['pts'][0]} not on the source edge")
    if not on_border(e["pts"][-1], tr, RX):
        fail(f"{name}: end {e['pts'][-1]} not on the target edge")
    (ax, ay), (bx, by) = e["pts"][-2], e["pts"][-1]
    if abs(bx - ax) + abs(by - ay) < LEG:
        fail(f"{name}: last leg under {LEG}px")
    mx, my = (ax + bx) / 2, (ay + by) / 2
    if tr[0] < mx < tr[2] and tr[1] < my < tr[3]:
        fail(f"{name}: arrives from inside the target")
    for p, q in segs(e):
        for k, r in all_rects:
            if seg_hits_rect(p, q, r):
                fail(f"{name}: segment {p}->{q} enters card {k}")
    (sx0, sy0), (ex0, ey0) = e["pts"][0], e["pts"][-1]
    fwd = ex0 > sx0 or (ex0 == sx0 and ey0 > sy0)
    if fwd == e["back"]:
        fail(
            f"{name}: runs {'forward' if fwd else 'back'}, declared {'back' if e['back'] else 'forward'}"
        )
    for line in frame_lines(dbx)[:3] + frame_lines(cls_frame):  # only the left wall may be crossed
        for p, q in segs(e):
            hp, hl = p[1] == q[1], line[0][1] == line[1][1]
            if hp == hl:
                continue
            h_, v_ = ((p, q), line) if hp else (line, (p, q))
            xx, yy = v_[0][0], h_[0][1]
            if min(h_[0][0], h_[1][0]) <= xx <= max(h_[0][0], h_[1][0]) and min(
                v_[0][1], v_[1][1]
            ) <= yy <= max(v_[0][1], v_[1][1]):
                fail(f"{name}: crosses a frame line other than the Databricks frame's left wall")
twin = {e["id"]: e for e in edges}
for out, ret in (("e_ui", "e_reply_ui"), ("e_sql", "e_reply_cli")):
    if not twin[ret]["pts"][0][1] > twin[out]["pts"][-1][1]:
        fail(f"{ret} is not drawn under {out}")
fe = twin["e_fetch"]
if not (
    any(p[1] > dbx_rect[3] - 24 for p in fe["pts"]) and min(p[0] for p in fe["pts"]) < dbx_rect[0]
):
    fail("e_fetch does not run along the bottom of the frame and out of it")


def bundle(a, b):
    return a["frm"] == b["frm"] or a["to"] == b["to"]


# 5. parallel edges 12px apart; shared lines and crossings only inside a bundle
for i, a in enumerate(edges):
    for b in edges[i + 1 :]:
        for p, q in segs(a):
            for s, t in segs(b):
                ha, hb = p[1] == q[1], s[1] == t[1]
                if ha == hb:
                    if ha:
                        d, lo, hi = (
                            abs(p[1] - s[1]),
                            max(min(p[0], q[0]), min(s[0], t[0])),
                            min(max(p[0], q[0]), max(s[0], t[0])),
                        )
                    else:
                        d, lo, hi = (
                            abs(p[0] - s[0]),
                            max(min(p[1], q[1]), min(s[1], t[1])),
                            min(max(p[1], q[1]), max(s[1], t[1])),
                        )
                    if hi - lo > 0.5:
                        if d == 0 and not bundle(a, b):
                            fail(f"{a['id']} and {b['id']} share a line outside a bundle")
                        if 0 < d < 12:
                            fail(f"{a['id']} and {b['id']} run {d:.1f}px apart")
                else:
                    h_, v_ = ((p, q), (s, t)) if ha else ((s, t), (p, q))
                    xx, yy = v_[0][0], h_[0][1]
                    inside_h = min(h_[0][0], h_[1][0]) < xx < max(h_[0][0], h_[1][0])
                    inside_v = min(v_[0][1], v_[1][1]) < yy < max(v_[0][1], v_[1][1])
                    if inside_h and inside_v and not bundle(a, b):
                        fail(f"{a['id']} crosses {b['id']} at {(xx, yy)}")

# 6. labels and free texts: inside the canvas, clear of cards, edges, frame lines and each other
boxes = [
    (f"label {lb['t']!r}", text_box(lb["x"], lb["y"], lb["t"], "elabel", lb["anchor"]), lb)
    for lb in elabels
]
boxes += [
    (f"text {t['t']!r}", text_box(t["x"], t["y"], t["t"], t["st"], t["anchor"]), None)
    for t in texts
]
fake_lines = [dict(id="frame", pts=[a, b]) for a, b in frame_lines(dbx) + frame_lines(cls_frame)]
for name, b, lb in boxes:
    if b[0] < 2 or b[2] > W - 2 or b[1] < 2 or b[3] > H - 2:
        fail(f"{name} leaves the canvas")
    for k, r in all_rects:
        if inter(b, r, eps=-2):  # 2px clear of every card
            fail(f"{name} touches card {k}")
    for e in edges + fake_lines:
        for p, q in segs(e):
            if seg_hits_rect(p, q, (b[0] - 2, b[1] - 1, b[2] + 2, b[3] + 1), eps=0):
                fail(f"{name} is crossed by {e['id']}")
for i, (na, a, _) in enumerate(boxes):
    for nb, b, _ in boxes[i + 1 :]:
        if inter(a, b):
            fail(f"{na} overlaps {nb}")
for n in card_list:
    if n["x"] < 4 or right(n) > W - 4 or n["y"] < 4 or bottom(n) > H - 4:
        fail(f"card {n['key']} leaves the canvas")
if not 1100 <= W <= 1240:
    fail(f"viewBox width {W} outside 1100-1240")

if problems:
    print(f"refusing to write, {len(problems)} problem(s):")
    for p in problems:
        print("  -", p)
    _browser.close()
    _pw.stop()
    sys.exit(1)


# ---------------- junctions (dots, square corners) ----------------
def directions_at(pt):
    dirs = set()
    for e in edges:
        for p, q in segs(e):
            for a, b in ((p, q), (q, p)):
                if a == pt:
                    dirs.add((((b[0] > a[0]) - (b[0] < a[0])), ((b[1] > a[1]) - (b[1] < a[1]))))
            if p[1] == q[1] == pt[1] and min(p[0], q[0]) < pt[0] < max(p[0], q[0]):
                dirs |= {(1, 0), (-1, 0)}
            if p[0] == q[0] == pt[0] and min(p[1], q[1]) < pt[1] < max(p[1], q[1]):
                dirs |= {(0, 1), (0, -1)}
    return dirs


junctions = {pt for e in edges for pt in e["pts"][1:-1] if len(directions_at(pt)) >= 3}


# ---------------- render ----------------
def f(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")


def path_d(pts, r=7):
    d = f"M{f(pts[0][0])} {f(pts[0][1])}"
    for i in range(1, len(pts) - 1):
        (x0, y0_), (x1, y1), (x2, y2) = pts[i - 1], pts[i], pts[i + 1]
        if (x1, y1) in junctions:
            d += f" L{f(x1)} {f(y1)}"
            continue
        l1 = abs(x1 - x0) + abs(y1 - y0_)
        l2 = abs(x2 - x1) + abs(y2 - y1)
        rr = min(r, l1 / 2, l2 / 2)
        ux, uy = (x1 - x0) / l1, (y1 - y0_) / l1
        vx, vy = (x2 - x1) / l2, (y2 - y1) / l2
        ax, ay = x1 - ux * rr, y1 - uy * rr
        bx, by = x1 + vx * rr, y1 + vy * rr
        sweep = 1 if ux * vy - uy * vx > 0 else 0
        d += f" L{f(ax)} {f(ay)} A{f(rr)} {f(rr)} 0 0 {sweep} {f(bx)} {f(by)}"
    d += f" L{f(pts[-1][0])} {f(pts[-1][1])}"
    return d


def svg_text(x, y, t, st, anchor="start", cls="", attrs="", fill=None):
    fam, s, w, col, _, ls = ST[st]
    a = f' text-anchor="{anchor}"' if anchor != "start" else ""
    l_ = f' letter-spacing="{ls}em"' if ls else ""
    ff = f' font-family="{html.escape(FIRA, quote=True)}"' if fam == "fira" else ""
    c = f' class="{cls}"' if cls else ""
    return (
        f'<text{c}{attrs} x="{f(x)}" y="{f(y)}"{a}{ff} font-size="{s}" font-weight="{w}" fill="{fill or col}"{l_}'
        f' dominant-baseline="central">{html.escape(t)}</text>'
    )


ARROW = "M0 0 L8 4 L0 8 L2.2 4 Z"
o = [f'<div class="dg dg-{FID}">']
o.append(
    "<style>"
    f".dg-{FID}{{margin:0}}"
    f".dg-{FID} svg.{P}-diagram{{display:block;width:100%;max-width:{W}px;height:auto;font-family:{NUNITO}}}"
    f".dg-{FID} .{P}-edge{{fill:none;stroke:{EDGE};stroke-width:1.4;stroke-linejoin:round;stroke-linecap:butt}}"
    f".dg-{FID} .{P}-dot{{fill:{EDGE}}}"
    f".dg-{FID} .{P}-node{{cursor:pointer}}"
    f".dg-{FID} .{P}-frame{{fill:none;stroke:{LINE};stroke-width:1}}"
    f".dg-{FID} .{P}-frame-classic{{stroke-dasharray:4 4}}"
    f".dg-{FID} .{P}-hair{{stroke:{LINE};stroke-width:1}}"
    "</style>"
)
o.append(
    f'<svg class="diagram {P}-diagram" viewBox="0 0 {W} {H}" role="{SVG_ROLE}" aria-label="{html.escape(CLAIM, quote=True)}" '
    f'font-family="{NUNITO}" xmlns="http://www.w3.org/2000/svg">'
)
# no <title>: browsers show it as a tooltip over the whole figure; aria-label carries the claim
o.append(
    "<defs>"
    f'<marker id="{P}-arrow" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="{ARROW}" fill="{EDGE}"/></marker>'
    f'<marker id="{P}-arrow-hot" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="{ARROW}" fill="{LINK}"/></marker>'
    "</defs>"
)

# frames, titles, lanes
o.append(
    f'<rect class="{P}-frame" data-frame="databricks" x="{f(dbx["x"])}" y="{f(dbx["y"])}" width="{f(dbx["w"])}" height="{f(dbx["h"])}" rx="12"/>'
)
o.append(
    f'<rect class="{P}-frame {P}-frame-classic" data-frame="classic" x="{f(cls_frame["x"])}" y="{f(cls_frame["y"])}" '
    f'width="{f(cls_frame["w"])}" height="{f(cls_frame["h"])}" rx="12"/>'
)
for t in texts:
    o.append(svg_text(t["x"], t["y"], t["t"], t["st"], cls=t["cls"]))
for _, x0, x1 in LANES:
    o.append(
        f'<line class="{P}-hair" x1="{f(x0)}" y1="{f(HAIR_Y)}" x2="{f(x1)}" y2="{f(HAIR_Y)}"/>'
    )

# edges (under the cards), in the spec's order
for eid in EDGE_IDS:
    e = twin[eid]
    o.append(
        f'<path class="{P}-edge" data-edge="{eid}" data-from="{e["frm"]}" data-to="{e["to"]}" d="{path_d(e["pts"])}" marker-end="url(#{P}-arrow)"/>'
    )
for x, y_ in sorted(junctions):
    o.append(f'<circle class="{P}-dot" cx="{f(x)}" cy="{f(y_)}" r="2.5"/>')
for lb in elabels:
    e = twin[lb["edge"]]
    attrs = f' data-edge="{lb["edge"]}" data-from="{e["frm"]}" data-to="{e["to"]}"'
    o.append(
        svg_text(
            lb["x"], lb["y"], lb["t"], "elabel", anchor=lb["anchor"], cls=f"{P}-elabel", attrs=attrs
        )
    )

# nodes
for n in card_list:
    fill, stroke, sw_, dash, tcol, lcol = KIND[n["kind"]]
    da = f' stroke-dasharray="{dash}"' if dash else ""
    o.append(
        f'<g class="{P}-node {P}-k-{n["kind"]}" data-node="{n["key"]}" tabindex="0" role="button" '
        f'aria-label="{html.escape(n["title"], quote=True)}">'
    )
    fw, fh = n.get("fw", n["w"]), n.get("fh", n["h"])
    layers = [2 * OFF, OFF, 0] if n["key"] == "exec" else [0]
    for d_ in layers:
        o.append(
            f'<rect class="{P}-box" x="{f(n["x"] + d_)}" y="{f(n["y"] + d_)}" width="{f(fw)}" height="{f(fh)}" rx="{RX}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{sw_}"{da}/>'
        )
    content_h = sum(ST[st][4] for _, st in n["rows"])
    yy = n["y"] + (fh - content_h) / 2  # a card stretched for its ports keeps its text centred
    for t, st in n["rows"]:
        lh = ST[st][4]
        is_title = st == "title"
        o.append(
            svg_text(
                n["x"] + PAD_X,
                yy + lh / 2,
                t,
                st,
                cls=f"{P}-title" if is_title else f"{P}-line",
                fill=tcol if is_title else lcol,
            )
        )
        yy += lh
    o.append("</g>")
o.append("</svg></div>")

_browser.close()
_pw.stop()
OUT.write_text("\n".join(o) + "\n")
print(f"ok {W}x{H} -> {OUT}")
print(f"edges {len(edges)}, junction dots {len(junctions)}, cards {len(card_list)}")
