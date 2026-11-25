# The request-path drawing

The first figure of the platform lecture: view 1 of `PLATFORM-INFRASTRUCTURE.html`, also embedded
by the study guide and the slides.

| File | Holds |
|---|---|
| `SPEC.md` | the drawing's spec: the claim, the columns and frames, every node and edge with its label |
| `gen_request_path.py` | the generator: it measures the text in headless Chrome, lays out the cards and paths, runs the readability checks, and writes `request-path.html` |
| `request-path.html` | the generated fragment: one `<div class="dg dg-request-path">` with its `<style>` and one inline `<svg>`, no script |

Never edit `request-path.html` by hand: change `gen_request_path.py` and run it again.

## Regenerate

```bash
uv run lecture_materials/src/platform-infrastructure/gen_request_path.py
```

The script carries its own dependencies (uv inline metadata, `playwright==1.48.0`) and drives the
installed Google Chrome (`channel="chrome"`), so no `playwright install` is needed. It loads Nunito
from Google Fonts to measure, so it needs the network; it stops without writing if the fonts do not
load. It writes no cache. With no change, it reproduces the committed fragment byte for byte.

When a check fails, it prints every problem and writes nothing. The checks: no two cards overlap;
each card sits in its frame (your side outside every frame, the classic ghosts in the dashed frame
below the Databricks frame); one x, width and gap per column; every title and subtitle fits its card
on one line (only the web application's title may wrap), text is 11px or more; every edge is
right-angled, starts and ends on a card edge with a last leg of at least 16px, enters no card, and
runs in its declared direction (outbound left to right or down, return right to left or up); the
return edges sit under their outbound twins; only the Databricks frame's left wall is crossed;
parallel edges are 12px apart and share a line or cross only when they share a source or a target;
every label sits in a gutter, clear of cards, lines, frames and other labels; the viewBox is
1100 to 1240px wide.

## Hooks for the page

- `data-node="<id>"` on each node group (`rp-node`), with `tabindex="0"` and `role="button"`. The
  executors are one node drawn as three offset cards; all three rects carry `rp-box`.
- `data-edge`, `data-from`, `data-to` on each edge path (`rp-edge`), grey `#b5b3b0` by default.
- `data-edge` (and `data-from`, `data-to`) on each edge label (`rp-elabel`). `e_back` has no label.
- The page adds `hot` and `cold` (and its own states) to paths and labels. The fragment defines a
  blue marker, `#rp-arrow-hot`, for a lit path's `marker-end`; the default is `#rp-arrow`.
- The one junction dot (`rp-dot`) is where `e_back` joins `e_large_ui` on its way into the web
  application.
