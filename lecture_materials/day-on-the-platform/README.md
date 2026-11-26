# A day on the platform

The standalone, unconstrained version of the animated map that opens the Platform infrastructure
lecture: `index.html`. It follows the brief in
`lecture_materials/day-on-the-platform/SCENE-BRIEF.md` (the rules in § 6, the scenarios in
§ 7, the review findings in § 11).

Open `index.html` in a browser. Ten chapters (Back, Next, Replay), then the whole day. Drag to pan,
click the map and scroll to zoom, click a part to read what it is, `F` to present.

| Control | What it does | Key |
|---|---|---|
| Back, Next, Replay | walk the chapters | `←` `→` |
| Jump to | a menu of the chapters, grouped by who does the job (developers, platform users, the platform, everything); it follows the current chapter | |
| ❚❚ Pause, ▶ Play | stops and restarts the scene clock; the button is dark while paused | `Space` |
| Speed | 0.25× to 3× in steps of 0.25; 1× is the pace the stories were timed at | `[` `]` |
| +, −, Fit all | zoom | `+` `-` `0` |
| Present | full screen | `F`, `Esc` |

## What the ground says

The tints say where a part runs, as in Databricks' own architecture picture
(https://docs.databricks.com/aws/en/getting-started/high-level-architecture). Outside: the
developers, GitHub and the platform users. Your Databricks account, the big central perimeter: the
account console, the control plane, the serverless compute plane and default storage. Beside it,
outside it, two smaller perimeters, dashed and empty: your cloud account (the classic compute plane
and the workspace storage bucket of a classic workspace; the course has no cloud account) and your
resources (external storage and data sources; the course connects none). No frame wraps them: "runs on AWS, us-west-2" is a small note
inside the Databricks account, never a perimeter around it. A packet that crosses the Databricks
account's border lights it; no rail enters the dashed perimeters.

Each developer's laptop is wired by a short stub to one small trunk that runs into the "On each
laptop" box, and every developer action leaves through that box: a commit through pre-commit to
GitHub, a sign-in through the CLI profile and Spark through Databricks Connect to the front door.

## Rebuild

```
python3 lecture_materials/day-on-the-platform/src/build.py            # writes index.html
python3 lecture_materials/day-on-the-platform/src/build.py --bundle   # also writes index.bundled.html
```

Never edit `index.html` by hand. The build needs Python 3.9 or later and nothing else.

## Network

`index.html` loads GSAP from cdnjs and the fonts from Google Fonts, so **the CDN must be reachable
when the page opens**. Without it the page says so instead of drawing.

For a room without internet, build the bundled page: `build.py --bundle` downloads the same pinned
GSAP files once (checked against the same SHA-512 hashes the page pins) and the latin subsets of
the two fonts into `src/vendor/`, and inlines them into `index.bundled.html`, which opens from disk
with no network at all. `src/vendor/` and `index.bundled.html` are ignored by git: rebuild them
where you need them.

## Verify

```
uv run lecture_materials/day-on-the-platform/src/verify.py lecture_materials/day-on-the-platform/index.html <out-dir> 1440x900
```

Headless Chrome through Playwright: plays every chapter to its end and the whole day, fails on any
JavaScript error, checks that a paused or off-screen scene requests no animation frames, clicks a
part, pans, zooms, enters Present mode, and writes screenshots and `report-<size>.json` to
`<out-dir>`.

## Sources

| File | What it holds |
|---|---|
| `src/page.html` | the page skeleton: header with the legend, caption and event log, stage, controls, footer |
| `src/scene.css` | the styles, on the Cauchy palette of the course pages |
| `src/js/00-core.js` | SVG helpers, tiles, zones, and the rail graph with its shortest-path router |
| `src/js/05-people.js` | the eight people: looks (skin, hair, clothing, pose) and the shapes they are drawn from |
| `src/js/10-world.js` | the drawing: perimeters, tiles, racks, tables, people, and every rail |
| `src/js/15-info.js` | the text of the overlay that opens when a part is clicked |
| `src/js/20-engine.js` | camera, the scene clock, packets, verdicts (✓ and ✗), particles, the event log |
| `src/js/30-stories.js` | the scenarios, hop by hop, the ten chapters and the whole day |
| `src/js/40-ui.js` | tour, the Jump to menu, play and speed, pan and zoom, minimap, Present mode, keys |
| `src/assets/*.svg` | the sanitized sprites the page inlines (written by `prepare_assets.py`) |
| `src/prepare_assets.py` | sanitizes downloaded artwork into `src/assets/` |
| `src/build.py`, `src/verify.py` | the build and the check |

One clock drives all motion: every tween and every wait of the story is a child of one GSAP
timeline. Pausing it, or scrolling the stage out of view, stops everything and lets GSAP's ticker
sleep, so the page uses no CPU.

## Libraries

| Library | Version | Loaded from | Licence |
|---|---|---|---|
| GSAP core | 3.15.1 | `cdnjs.cloudflare.com/ajax/libs/gsap/3.15.1/gsap.min.js`, with subresource integrity | GSAP standard "no charge" licence (https://gsap.com/community/standard-license/): free for commercial use, all plugins included since 3.13; proprietary, not open source; keep the licence comment in the files |
| GSAP MotionPathPlugin | 3.15.1 | `.../gsap/3.15.1/MotionPathPlugin.min.js`, with subresource integrity | same |
| Nunito, Fira Code | current | Google Fonts | SIL Open Font License 1.1 |

GSAP moves the packets along the rails (MotionPathPlugin), draws the verdicts, eases the camera and
is the scene clock. The pan, zoom and inertia are a few lines on top of it; the trails and the
particle streams are a plain 2D canvas. No other library is used.

## Assets

| Asset | Source | Licence |
|---|---|---|
| 22 Databricks product icons (`src/assets/dbx-icons.svg`) | `oieduardorabelo/databricks-architecture-icons`, `icons/svg/<name>.svg` at `HEAD`, downloaded 2026-11-22 | The repository is MIT (packaging). The artwork is official Databricks artwork; Databricks and its product names are trademarks of Databricks, Inc., and the MIT licence grants no trademark rights |
| 8 people | drawn for this page in `src/js/05-people.js`: flat figures with no facial features, from no illustration pack and no download | this repository |
| GitHub, GitHub Actions, Python and Databricks marks (`src/assets/marks.svg`) | the Cauchy sprite, `brand/assets/icons.svg` of the `cauchy` plugin 1.1.2 | marks of their owners |
| Everything else (desks, laptops, racks, tables, glyphs, the Cauchy lockup) | drawn in `src/js/10-world.js` and `src/js/20-engine.js` | this repository |

`src/assets/peeps.svg` holds the earlier people (Open Peeps by Pablo Stanley, CC0 1.0, composed with
DiceBear 9.x). The page no longer inlines it and nothing reads it.

Icons used: `unity-catalog`, `genie`, `genie-one`, `sql-warehouse`, `notebooks`, `lakeflow-jobs`,
`model-serving`, `databricks-apps`, `unity-ai-gateway`, `zerobus-ingest`, `lakebase`, `ai-search`,
`rest-api`, `workspace`, `enterprise-security`, `databricks-cli`, `databricks-connect`,
`system-tables`, `delta-lake`, `serverless-compute`. `asset-bundles` and `mlflow` are in the sprite,
unused.

### Refreshing the artwork

Downloads are untrusted. Put them in a new, empty folder outside the repository, as
`<downloads>/dbx-icons/*.svg`, then:

```
python3 -I lecture_materials/day-on-the-platform/src/prepare_assets.py <downloads>
```

The script parses each file, keeps only a whitelist of drawing elements and attributes, prefixes
every id, and stops on a DTD, an entity, a script, a `foreignObject`, an `on*` attribute, an `href`
or any external `url()`. Nothing downloaded is ever executed.

## Where the docs overruled the brief

The scenarios were checked against docs.databricks.com (AWS) on 2026-11-22. Three points differ
from the brief, and the page follows the docs:

- **Genie.** The asker needs the Genie space's ACL (`CAN VIEW` or `CAN RUN`) and `SELECT` on the
  tables, not `CAN USE` on the warehouse: the warehouse is used with the compute credentials the
  space's author embedded, and Unity Catalog evaluates the data access as the asker. (The docs now
  call a Genie space a Genie Agent.)
- **Audit latency.** The docs give no figure for `system.access.audit`; they say system tables "do
  not support real-time monitoring". The page says "later, not in real time", not "minutes later".
- **Workspace storage.** In a serverless workspace it is kept in the workspace's default storage,
  so it is drawn as an item of the default storage box.
