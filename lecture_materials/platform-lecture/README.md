# Platform infrastructure: the lecture deck

The lecture as one interactive deck, presented in a browser: `index.html`. It follows `BRIEF.md` in
this folder. Five parts, sixteen steps.

| Part | Steps | What it is |
|---|---|---|
| 1. The platform is complex | 1.1 to 1.4 | the animated map "A day on the platform" in a frame, then three beats over its still: how much there is, what goes wrong by hand, the answer |
| 2. Everything you click is code | 2.1, 2.2 | a mock of the workspace UI and of the account console; every item opens its page and three tabs: Terraform, Python SDK, REST API |
| 3. What you need to run IaC | 3.1 to 3.5 | three tiles, one "in our project" card per step, then the three joined in one diagram |
| 4. dev → acc → prd for infrastructure | 4.1, 4.2 | the module in `part4/`, in two frames: the animation and the GitHub close-up |
| 5. The LLMOps onboarding automation | 5.1 to 5.3 | the onboarding run as one drawing; every box links to the module and function that does it |

## Presenting

Open `index.html` in Chrome. It is laid out for one screen of 1512×982 and scales to any other.

| Key | What it does | Mouse |
|---|---|---|
| `→`, `Space`, `PageDown` | next step | `›` in the bar |
| `←`, `PageUp` | back | `‹` |
| `Esc` or `O` | the overview of all steps: arrows to move, `Enter` to jump | **Overview**, then a card |
| `N` | speaker notes for the step, over the bottom of the stage | **Notes** |
| `F` | full screen | **Full screen** |
| `1` to `5` | the first step of that part | the numbers in the bar |
| `Shift` `→` | leave the step now, whatever its frame is doing | **Skip ›** (part 4 only) |

The bar is the progress: the five parts, the current one with its title, each underlined as far as
its steps have been taken. The address ends in the step (`#3.2`), so a reload stays where it was.

**Frames and the keyboard.** Parts 1 and 4 are pages of their own inside a frame. Once you click
inside one, the keys go to it (in the animated map, `←` `→` walk its chapters and `Space` pauses).
The bar then says so; a click anywhere on the bar gives the keys back to the deck.

## Parts 1 and 4 are frames of the sibling folders

- **Part 1** shows `../day-on-the-platform/index.html` as it is. Nothing of it is copied or edited;
  the frame is hidden while the deck is elsewhere, so the map's own clock stops. The picture behind
  the next three steps is a still of that page, `src/assets/day-still.jpg`, taken by `src/still.py`.
- **Part 4** shows `part4/index.html` and `part4/github.html`, built separately in `part4/`. The
  deck and the module talk by `postMessage` only:

  | Direction | Message | The deck's part |
  |---|---|---|
  | module → deck | `{type: "part4", event: "ready", ok}` | the frame is live; a placeholder, if one is up, goes away |
  | module → deck | `{event: "scene-end", scene}` | remembers that the scene has ended |
  | module → deck | `{event: "scene", scene}`, `{event: "beat", scene}` | remembers which scene is on, and that it is running again |
  | module → deck | `{event: "key", key, shiftKey}` | a key the focused module does not use: `→` leaves part 4, the rest (`Esc`, `F`, `N`, …) act as the deck's keys |
  | deck → module | `{type: "part4", cmd: "step"}` | `→` while a scene is running: one beat |
  | deck → module | `{cmd: "scene", n: 2}` then `{cmd: "step"}` | `→` after scene 1 has ended |
  | deck → module | `{cmd: "pause"}` | the deck left the step |

  `→` leaves part 4's animation when scene 2 has ended. If a file of `part4/` was missing when the
  deck was built and its frame does not say `ready`, the step shows a placeholder with **Try again**
  and **Show the frame anyway**; rebuild the deck once the file is there.

## Rebuild

```
python3 lecture_materials/platform-lecture/src/build.py            # writes index.html
python3 lecture_materials/platform-lecture/src/build.py --bundle   # also writes index.bundled.html
uv run lecture_materials/platform-lecture/src/still.py             # retakes src/assets/day-still.jpg (only when the map changes)
```

Never edit `index.html` by hand. The build needs Python 3.9 or later and nothing else; `still.py`
and `verify.py` need `uv` and Chrome.

The build stops on a GitHub link that `src/data/course-assistant-links.json` does not list.

## Network

`index.html` loads GSAP from cdnjs and the fonts from Google Fonts, so **the network must be
reachable when the page opens**. Without it the page says so instead of drawing. The frame of
part 1 loads the same library from the same CDN.

For a room without internet, build the bundled page: `build.py --bundle` downloads the same pinned
GSAP file once (checked against the same SHA-512 hash the page pins) and the latin subsets of the
two fonts into `src/vendor/`, and inlines them into `index.bundled.html`. That page opens from disk
with no network: its part 1 frame points at `../day-on-the-platform/index.bundled.html` (build it
there with that folder's own `build.py --bundle`), and its part 4 frames at
`part4/index.bundled.html` and `part4/github.bundled.html` when those exist. `src/vendor/` is
ignored by git; `index.bundled.html` is a build product, rebuilt where it is needed.

## Verify

```
uv run lecture_materials/platform-lecture/src/verify.py lecture_materials/platform-lecture/index.html <out-dir> 1512x982
```

Headless Chrome through Playwright 1.48.0: walks every step, clicks twelve items of the workspace
mock and ten of the account console through their three tabs, opens the workspace Settings, points
at boxes of the onboarding drawing, tries the keys, the overview, the notes, the console switch and
a tile. It fails on a JavaScript error, on a key that does not work, or on a GitHub link that the
facts do not list. It also reports text under 16 px and boxes whose content does not fit, and
writes the screenshots and `report-<size>.json` to `<out-dir>`.

## Sources

| File | What it holds |
|---|---|
| `src/page.html` | the page skeleton: the bar, the stage, the notes sheet, the overview |
| `src/css/00-deck.css` | the shell, on the Cauchy palette and type of `lecture_materials/src/platform-infrastructure/head.html` |
| `src/css/10-part1.css` … `40-part5.css` | one file per part |
| `src/js/00-core.js` | helpers, the link and icon shorthands, the line glyphs, the syntax highlighter |
| `src/js/10-deck.js` | scenes and steps, navigation, progress, overview, notes, full screen, frames |
| `src/js/20-part1.js` | part 1: the frame and the three beats |
| `src/js/30-mock-pages.js`, `35-mock.js` | part 2: the two sidebars and a page per item; the mock and the code panel |
| `src/js/40-part3.js` | part 3: tiles, project cards, the joined diagram |
| `src/js/50-part4.js` | part 4: the two frames, the protocol, the placeholder |
| `src/js/60-part5.js` | part 5: the onboarding drawing and its links |
| `src/data/ui-as-code.json` | the research file part 2 shows (45 items), inlined as it is |
| `src/data/course-assistant-links.json` | the GitHub links the deck may use; read by the build and by `verify.py` only |
| `src/assets/day-still.jpg` | the still behind part 1's beats (made by `src/still.py`) |
| `src/build.py`, `src/still.py`, `src/verify.py` | the build, the still, the check |

A scene is one layer of the stage: a canvas of 1440×850 scaled to the window, or a frame that fills
the step. A step is one beat of a scene. Each part's file registers its scenes and steps with
`Deck.scene` and `Deck.step`, with the speaker notes beside the step.

## What part 2 is, and is not

A concept, not reference documentation. The mocks illustrate the Databricks UI and are marked as
mocks; they are not the product. The pages use the course's own names (the bundle's jobs,
dashboards and alerts, the cohort's catalogs and principals) and read nothing from a workspace.
The code in the three tabs is `src/data/ui-as-code.json`, unchanged: where that file marks an item
UNCONFIRMED, the tab keeps the snippet and adds a quiet "a sketch, not checked line by line · see
the docs" link; where an item has no code form, the tab says so in one line. The metastore's name
(`metastore_aws_us_west_2`) and the rows of a few pages (Previews, Usage, Workspace settings, the
one saved query) are illustrations, not read from the course.

## Libraries and assets

| What | Version | Loaded from | Licence |
|---|---|---|---|
| GSAP core | 3.15.1 | `cdnjs.cloudflare.com/ajax/libs/gsap/3.15.1/gsap.min.js`, with subresource integrity | GSAP standard "no charge" licence (https://gsap.com/community/standard-license/): free for commercial use; proprietary, not open source; keep the licence comment in the file |
| Nunito, Fira Code | current | Google Fonts | SIL Open Font License 1.1 |
| Databricks product icons, and the GitHub, GitHub Actions, Python and Databricks marks | as in `../day-on-the-platform/src/assets/` | read from that folder at build time and inlined | see that folder's README: official Databricks artwork packaged under MIT; marks of their owners; no trademark rights granted |
| The sidebar glyphs, the mocks, every drawing | | drawn for this deck in `src/js/` | this repository |

GSAP moves the tiles, the cards, the packets and the beats. The syntax highlighting is a few
lines of the deck's own. No other library is used.
