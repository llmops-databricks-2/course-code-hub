# Part 4: dev → acc → prd for infrastructure

Two pages that the platform lecture's deck embeds in iframes
(`lecture_materials/platform-lecture/BRIEF.md` § 3, part 4):

| Page | What it is |
|---|---|
| `index.html` | The animation. Scene 1, "one environment, straight to main"; scene 2, "PR, checks, dev → acc → prd". Eight beats each, 44 s and 56 s at 1×. |
| `github.html` | The static close-up: the scene zoomed onto GitHub, with the student template in one column and the platform's own repository in the other, and every part 4 link of the fact sheet. |

Both fill their iframe. They are laid out for the lecturer's screen, 1512×982, and for an iframe a
little lower than that; the root font size follows the window's width, so a wider screen shows the
same picture, larger.

## Rebuild

```
python3 lecture_materials/platform-lecture/part4/src/build.py            # index.html, github.html
python3 lecture_materials/platform-lecture/part4/src/build.py --bundle   # also index.bundled.html, github.bundled.html
uv run lecture_materials/platform-lecture/part4/src/verify.py <out-dir> [1512x982] [--bundled]
```

Never edit a built page by hand. The default pages need the network when they open: `index.html`
loads GSAP from cdnjs, and both load the fonts from Google Fonts. `--bundle` writes a second copy of
each page that carries everything, for a room without internet; the deck can point its iframes at
`index.bundled.html` and `github.bundled.html` instead. The bundled pages and `src/vendor/` are not
committed (`.gitignore`); `--bundle` downloads the pinned files again when `src/vendor/` is empty
and checks GSAP against its published hashes.

`verify.py` drives the built pages in headless Chrome (Playwright 1.48.0, `channel="chrome"`): no
JavaScript error, every text at least 16 CSS px, both scenes to their end, the step mode, the
protocol below from `src/harness.html`, a stage that changes shape mid-scene, a page built while
hidden, and the close-up fitting its screen. It keeps a screenshot of the middle and the end of
every beat.

## The protocol with the deck

All messages are `postMessage` objects with `type: "part4"`. The pages post to `window.parent`
with target origin `"*"` (the deck is usually opened from `file://`), and accept a command from any
window that sends one. Every message a page posts also carries `page`, `"index"` or `"github"`.

### What a page posts

| Message | When |
|---|---|
| `{type: "part4", event: "ready", page: "index" \| "github", ok: true}` | The page is built and listens. `index.html` adds `scene` (the scene it shows), `scenes: 2` and `beats` (how many the scene has). `ok: false` means GSAP did not load; the page says so on screen. |
| `{type: "part4", event: "scene-end", scene: 1 \| 2}` | A scene has played to its last frame. `index.html` only. |

Extras, which the deck may ignore: `{event: "scene", scene}` whenever the scene shown changes (the
page's tabs, the keys 1 and 2, → at the end of scene 1, and also the deck's own `scene` command); `{event: "beat", scene, beat, of, title}` when
the clock enters a beat; `{event: "key", key, shiftKey, scene, ended}` for a key the page does not
use, pressed while the iframe has the focus, so the deck can keep Esc, F and N working. → at the end
of scene 2 arrives as such a `key` event, with `ended: true`.

### What a page accepts

| Command | `index.html` | `github.html` |
|---|---|---|
| `{type: "part4", cmd: "scene", n: 1 \| 2}` | Shows that scene at its first frame, **paused**. Add `play: true` to start it at once. | Puts the light on column 1 (the student template) or 2 (the platform's own repository). `n: 0` lights both. |
| `{type: "part4", cmd: "play"}` | Plays on from where the clock is; after a scene's end, plays it again from the start. | Nothing: nothing moves on this page. |
| `{type: "part4", cmd: "pause"}` | Stops the clock. | Nothing. |
| `{type: "part4", cmd: "step"}` | Plays to the end of the beat the clock is in, then stops. At a scene's end it does nothing. | Moves the light on: both columns, the first, the second, both. |

Extras for `index.html`: `{cmd: "back"}` (to the start of the beat, or of the one before),
`{cmd: "beat", n}` (to the start of beat `n`, paused), `{cmd: "replay"}`, `{cmd: "speed", value}`
(0.5 to 3). The page pauses itself when its document is hidden.

A deck step for a scene is therefore: send `scene`, then `play` (or `step` on each Next), and wait
for `scene-end`.

### Query string

`index.html?scene=2`, `?autoplay=1`, `?speed=1.5`; `github.html?scene=1|2`.

### Keys, when the iframe has the focus

| Key | `index.html` |
|---|---|
| `→`, `PageDown` | one beat: play to the end of the beat, then stop. At the end of scene 1 it goes on to scene 2. |
| `←`, `PageUp` | back one beat |
| `Space`, `K` | play or pause |
| `R` | replay the scene |
| `1`, `2` | the scene |
| `[`, `]` | slower, faster |

`github.html`: `1`, `2`, `0` for the light, `A` for the list of all links, `Esc` closes a card.

## The beats

**Scene 1, one environment.** (1) Happy users: requests in, answers back, a 👍 in a bubble.
(2) One small thing: Victor thinks "let me change one small thing…" and commits straight to
`main`; no pull request, no checks, no approval. (3) Deploying…: the pipeline signs in and is
authenticated, then authorized. (4) Storage is deleted and the tables vanish: "?!". (5) Permissions
are revoked: "access denied". (6) Compute goes up in flames: 🔥. (7) Dashboards break: "my
dashboard!". (8) The frozen frame: "one environment, no checks".

**Scene 2, the same change done properly.** (1) A pull request. (2) CI runs: pre-commit, unit
tests, a dry run. (3) The plan catches it: a schema dropped, a grant revoked, a warehouse replaced;
the pull request turns red; "Oh! This is so nice I took the LLMOps course!". (4) Fixed, green,
approved, merged. (5) Deploy to dev, smoke check. (6) Then acc, smoke check. (7) prd after an
approval, smoke check. (8) "Oh! The system became so much better!". The users work in prd from the
first second to the last.

## What the drawing claims

The perimeters follow Databricks' architecture picture
(https://docs.databricks.com/aws/en/getting-started/high-level-architecture). Outside: the
developer, GitHub and the platform users. Your Databricks account, one perimeter: the control
plane, the serverless compute plane and default storage. Under it, outside it, dashed and empty:
your cloud account and your resources, marked "not used here": the course's serverless workspace
has no cloud account of its own. No cloud-provider frame wraps the Databricks account.

Every request, a user's or the pipeline's, takes the same order: (1) the front door, (2) identity
and auth, where it is authenticated, (3) one authorizer, workspace ACLs for a workspace object or
Unity Catalog for data and AI assets, and only then compute, which reads storage. Inside the
account the planes are rows and the environments are columns; from top to bottom an environment
holds a dashboard, its grants, a warehouse and its tables, the order a request touches them.

Simplifications, named: one request path is drawn where the platform has many. A dashboard request
is drawn through workspace ACLs and then past the grant of its environment, which stands for Unity
Catalog's check of the data it reads. The dry run's read and the smoke check are one packet each.
The schema names of scene 1 (`sales`, `features`, `agent`) and the change itself (a rename that the
tool reads as drop and create) are an illustration; the catalogs of scene 2 are the course's
(`llmops_dev`, `llmops_acc`, `llmops_prd`). Scene 2 is the ideal: `github.html` says which parts of
it the course has today.

## The close-up's facts

`src/closeup.json` holds the page's statements. Each comes from the course-assistant fact sheet
read on 2026-11-23 (its sections 3 and 4 and its five findings). Every link is a path and a line
range in `llmops-databricks-2/course-assistant` on `main`, a private repository.
`src/facts/course-assistant-links.json` is a copy of the fact sheet's link list; `build.py` refuses
a link that the list does not have, and refuses to build while one of the list's 68 part 4 links
is not on the page. The page also shows nineteen links that the list files under parts 3 and 5 (the
five workflow files, the functions of the student column). The three GitHub Docs links (protected
branches, rulesets, environments) are the only ones from outside the list; the brief asks for them.

### Where the repository overruled the fact sheet

The page was reviewed against `origin/main` of course-assistant at the commit the facts were read
from (`24797fd`). Two points differ from the fact sheet, and the page follows the repository:

- **The student template has no deployment workflow yet.** The fact sheet says the onboarding
  dispatches each student's `deploy.yml` for `dev`, then `acc`. On `main` the template ships
  `ci.yml` only, and `cohorts/llmops-2/cohort.yml` leaves `first_deploy` and `first_deploy_acc` out
  of the plan with the note "Deployment is introduced in a later lecture". So the left column says
  what is real today (three catalogs, three deploy principals with their federation policies,
  three GitHub environments, `prd` needing the student's approval, a protected `main`) and marks the
  deployment workflow "missing today". The fact sheet's source, `docs/TECHNICAL-DESIGN.md`, is
  stale on this point.
- **Three line ranges** of the list were wrong on that commit; `CORRECTED` in `src/build.py` holds
  them. `scripts/setup_cohort.py#L3379-L3381` is the `--skip` argument, and `--probe-policy` is at
  L3390-L3392. `tests/conftest.py#L858-L880` and `#L806-L880` ran past the end of the 875-line file;
  the page links L856-L875 and L803-L875.

Also from the repository, not the fact sheet: the admins of a student repository, the student among
them, are not held to the one-approving-review rule (`protect_branch` sets `enforce_admins=False`).

## Sources

| Path | What it is |
|---|---|
| `src/page.html`, `src/scene.css` | the animation's skeleton and styles |
| `src/js/00-core.js` … `40-ui.js` | the scene: helpers, people, the world laid out for a stage height, the engine, the two scenes beat by beat, the controls and the protocol |
| `src/github.page.html`, `src/github.css`, `src/github.js`, `src/closeup.json` | the close-up |
| `src/base.css` | the Cauchy tokens and the type both pages share |
| `src/assets/dbx-icons.svg`, `src/assets/marks.svg` | the sprites; only the symbols a page uses are inlined |
| `src/facts/course-assistant-links.json` | the fact sheet's links |
| `src/build.py`, `src/verify.py`, `src/harness.html` | the build, the check, and a stand-in for the deck |

One clock drives a scene: every motion is a child of one paused GSAP timeline, built whole before
it plays, and nothing changes the drawing from a callback. So the clock can be paused, stepped,
sought back, and rebuilt for another stage height at the same second, which is what happens when
the deck goes full screen.

## Libraries

| Library | Version | Loaded from | Licence |
|---|---|---|---|
| GSAP core | 3.15.1 | `cdnjs.cloudflare.com/ajax/libs/gsap/3.15.1/gsap.min.js`, with subresource integrity | GSAP standard "no charge" licence (https://gsap.com/community/standard-license/): free for commercial use, proprietary, not open source; keep the licence comment in the files |
| GSAP MotionPathPlugin | 3.15.1 | `.../gsap/3.15.1/MotionPathPlugin.min.js`, with subresource integrity | same |
| Nunito, Fira Code | current | Google Fonts | SIL Open Font License 1.1 |

`github.html` uses no library. Playwright 1.48.0 (Apache 2.0) is used by `verify.py` only.

## Assets

| Asset | Source | Licence |
|---|---|---|
| Databricks product icons (`src/assets/dbx-icons.svg`) | copied from `lecture_materials/day-on-the-platform/src/assets/`, which took them from `oieduardorabelo/databricks-architecture-icons` and sanitized them (see that folder's README) | The repository is MIT (packaging). The artwork is official Databricks artwork; Databricks and its product names are trademarks of Databricks, Inc., and the MIT licence grants no trademark rights |
| GitHub, GitHub Actions and Databricks marks (`src/assets/marks.svg`) | copied from the same folder; the Cauchy sprite, `brand/assets/icons.svg` of the `cauchy` plugin 1.1.2 | marks of their owners |
| The people | `src/js/05-people.js`, copied from `lecture_materials/day-on-the-platform/src/js/05-people.js` and the vignette of its `10-world.js`: flat figures drawn for that page, from no illustration pack. Victor, the developer, is drawn here: short hair, broad shoulders, a collared shirt in the colour of developer traffic | this repository |
| Everything else (tiles, racks, tables, flames, bubbles, the plan card) | drawn in `src/js/` | this repository |

Icons used: `rest-api`, `enterprise-security`, `unity-catalog`, `workspace`, `genie-one` (the
dashboard), `sql-warehouse`, `lakeflow-jobs`, `notebooks`.
