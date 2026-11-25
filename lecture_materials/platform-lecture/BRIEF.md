# Brief: the platform lecture as an interactive deck

A standalone brief for the agents building this deck. Read it whole before you start.

## 1. What we are building

The lecture **Platform infrastructure** of an LLMOps-on-Databricks course is rebuilt as one
**interactive deck** that the lecturer presents in a browser. It replaces the slide deck
`presentation_prep/platform/platform.html`; keep that file until he has chosen.

The deck tells one story in five parts:

1. **The platform is complex.** Behind the workspace UI sit identities, a control plane, compute,
   storage, Unity Catalog, pipelines and many people at once. Managing that by hand is slow and
   risky, which is why we manage it as code.
2. **Everything you click is code.** A mock of the workspace UI and of the account console. Every
   item opens its three representations: Terraform, Python SDK and REST.
3. **What you need to run infrastructure as code**: access, a code versioning platform, and compute
   for the deployment. Each is shown in our own project.
4. **dev → acc → prd for infrastructure.** An animated story of the same change pushed straight to
   production, then through pull requests and environments. It ends on a static close-up of our
   GitHub setup, with links to the code.
5. **The LLMOps onboarding automation**: a drawing of the course's onboarding, with every step
   linked to the code that does it.

The audience are ML engineers in the sixth week of the course. They know the workspace, notebooks,
bundles and Unity Catalog, but not what sits underneath.

## 2. Where it lives, and the look

**Files.**
- Folder: `lecture_materials/platform-lecture/` on the branch `victor/platform-infrastructure-lecture`
  of `/Users/victorkuznetsov/Repos/course-code-hub-platform-lecture`.
- The deck: `index.html`, with its sources under `src/` and a `README.md` (the rebuild command,
  libraries, licences, and the network note).
- Do not commit.

**Tooling.** No limits. Libraries from a CDN (cdnjs, jsDelivr, unpkg) are allowed if pinned to an
exact version: GSAP and its plugins, for example. Offer a bundled offline build as well, as
`lecture_materials/day-on-the-platform/` does (`src/build.py --bundle`).

**Navigation.**
- A deck that fills the screen, one part at a time, with sub-steps inside a part.
- Keys: → and Space for next, ← for back, Esc for the overview, F for full screen.
- A slim progress bar showing parts 1–5.
- An overview grid of all steps, to jump anywhere.
- Speaker notes on N, as in the course's earlier decks (`presentation_prep/lecture4/`).
- Every interactive piece also works with the mouse.

**Look.**
- The Cauchy palette and type: the `:root` tokens and fonts of
  `lecture_materials/src/platform-infrastructure/head.html` (Nunito, Fira Code).
- Restrained warmth: orange `#f24b37` is the logo accent, and life comes from motion and depth.
- **Exception:** the workspace and account-console mocks in part 2 are dark, as Databricks' UI is.
  Mark each one plainly as an illustration ("a mock of the Databricks UI, not the product").
- Use the official Databricks product icons already downloaded and sanitized in
  `lecture_materials/day-on-the-platform/src/assets/` (see that README for the source and licence),
  and the Cauchy sprite for GitHub, Actions and Python.

**Legibility.** At least 16 px text on a 1280×800 screen; nothing overlaps.

## 3. The parts in detail

### Part 1. The platform is complex
1. **Open on the "day on the platform" animation.**
   - Embed `lecture_materials/day-on-the-platform/index.html` as it is, in an iframe that fills
     the step. Do not copy or edit its code.
   - The lecturer drives it with its own controls.
   - Its perimeters follow Databricks' architecture picture: your Databricks account, your cloud
     account, your resources, users outside.
2. **Next step: name the problem**, in a few animated beats over a dimmed still of that scene:
   - **How much there is:** for this course, hundreds of objects: ~57 students × (a user, 3
     schemas, a warehouse, a usage policy, 3 experiments, a repository, 3 deploy principals and
     their federation policies, Lakebase databases), plus groups, grants, jobs and dashboards.
     Take the real counts from the facts in § 5; never invent a number.
   - **What goes wrong by hand:**
     - clicks nobody can repeat;
     - drift between environments;
     - no review, no history, no rollback;
     - one wrong permission exposes data;
     - a lost workspace means rebuilding from memory.

     On 2 November 2026 the course's first workspace was banned and rebuilt from code the same
     day. Say so; the facts are in the course-assistant map of § 5.
   - **The answer:** infrastructure as code. It is declared, reviewed, versioned, repeatable, and
     testable before it touches production.

### Part 2. Everything you click is code
- **A clickable mock of the Databricks workspace UI**, dark, like the product:
  - a top bar with the logo, a workspace switcher and the user avatar;
  - a left sidebar with **New**, **Workspace**, **Recents**, **Catalog**, **Jobs & Pipelines**,
    **Compute**, **Discover** and **Marketplace**;
  - Analytics: **Dashboards**, **Genie Agents**, **Alerts**, **Visual Data Prep**;
  - Lakehouse: **SQL Editor**, **Queries**, **Query History**, **SQL Warehouses**;
  - Data Engineering: **Runs**, **Data Ingestion**;
  - AI/ML: **Playground**, **Agents**, **AI Gateway**, **Experiments**, **Features**, **Models**,
    **Serving**;
  - a welcome page.
- **Clicking an item** shows a plausible page for it, built from the course's real names
  (`llmops_dev`, `wh-llmops-<name>`, `job-guard-llmops`, `course_ops.gateway.chat` and so on). Beside
  it, a panel with three tabs: **Terraform**, **Python SDK**, **REST API**. Each tab holds that
  item's code, syntax-highlighted, with a link to its docs.
  - Items that are only a view (Recents, Discover, Query History…) say so honestly: "a view, not an
    object", with their closest code form, such as a list call or a system table.
- **A switch to the account console.** It is dark too, with its own top bar ("LLMOps Cauchy Cohort
  2", "Select workspace"), and a sidebar:
  - Governance: **Data**, **AI**, **Cost**, **Tags**;
  - Admin: **Workspaces**, **Catalog**, **Genie Ontology**, **Usage**, **User management**,
    **Security**, **Cloud resources**, **Previews**, **Settings**;
  - a Workspaces page that lists the course's workspace.

  The same three-tab behaviour applies, with the account-level provider and `AccountClient`.
- **Accuracy: a concept, not reference documentation.** The lecturer presents the idea that
  everything clicked is code; he is not publishing official docs. Take the code from the research
  file `/private/tmp/claude-501/-Users-victorkuznetsov-Repos-course-assistant/036fd855-da71-4ba3-bdaa-6637af4af5e1/scratchpad/lecture-facts/ui-as-code.json`.
  - Items marked UNCONFIRMED keep their snippet with a small, quiet "see the docs" link.
  - Items with no code form say so in one line.
  - Do not spend effort verifying further. Never invent a resource or method that the file does not
    name.
- **The mock's look.** Use the visual language of the product, but do not copy Databricks' logo
  artwork beyond the official mark in the icon set. Keep a small "mock" badge in a corner.

### Part 3. What you need to run IaC
1. **Three tiles appear:** **Access** to the systems you manage as code, a **code versioning
   platform**, and **compute** to run the deployment code.
2. **Each Next reveals one tile's counterpart in our project**, with a short animation: the tile
   moves up and its "in our project" card slides in under it. Choose the motion that reads best.
   - **Access:** the service principal `sp-onboarding-llmops`, with the account admin, billing
     admin and workspace admin roles and a GitHub OIDC federation policy on `main` of
     `course-assistant`. No secret: the workflow's `DATABRICKS_CLIENT_ID` names it, and GitHub's
     token is exchanged for a Databricks token. The one-time setup is `scripts/setup_cohort.py`.
   - **Code versioning:** GitHub, the repository `course-assistant`, its layout, and the Python SDK
     code that creates the resources (the `ensure_*` modules).
   - **Compute:** a GitHub Actions job: `onboarding.yml` runs daily, and `deploy.yml` deploys the
     bundle.

   Every card links to the real file on GitHub, with its lines.
3. **A last step** shows the three cards together, as one small diagram:
   GitHub Actions → OIDC → Databricks account and workspace.

### Part 4. dev → acc → prd for infrastructure
Reuse the approach and the drawing language of the "day on the platform" scenes: developers on the
left, users on the right, the platform in the middle, packets that fly, thought bubbles.

**Scene 1: one environment, a change straight to main.**
1. Users are happily at work: requests fly in and answers come back, with a smile or a 👍 in their
   bubbles.
2. A developer on the left thinks *"let me change one small thing…"*, commits straight to `main`,
   and the change goes to production.
3. "Deploying…" runs. While it runs:
   - storage is deleted, tables vanish;
   - permissions are revoked;
   - compute goes up in flames;
   - dashboards break;
   - the users' bubbles turn to panic: "?!", "my dashboard!", "access denied", 🔥.
4. It is chaotic but readable, and it stops on a frozen frame: "one environment, no checks".

**Scene 2: the same change, done properly.**
1. The developer opens a pull request.
2. CI runs: pre-commit, unit tests, a dry run (the plan of what would change).
3. **A check catches a critical error.** For example, the plan shows a schema would be dropped, or
   a grant revoked. The PR turns red, and the developer's bubble says *"Oh! This is so nice I took
   the LLMOps course!"*
4. The fix goes in, then CI is green, and a reviewer approves.
5. The change goes to **dev**, then **acc**: environments drawn side by side, with smoke checks
   passing in each. Then **prd** after an approval.
6. Users keep working the whole time, and at the end their bubbles say *"Oh! The system became so
   much better!"*

Keep the timing presentable: each scene about 30–60 s, with play/pause, a step mode and a speed
control.

**Static close-up: our GitHub setup.** A still of the same scene, zoomed onto GitHub, with labelled
links to what the course actually has:
- the workflows;
- the unit and integration tests;
- the pre-commit hooks;
- dry runs and filtered runs;
- verify objects;
- the paid-resource guard;
- branch protection.

**Be honest. The facts (course-assistant map, read on 2026-11-23) settle it:**
- **The platform's own repository, `course-assistant`, has no dev → acc → prd.**
  - It has one workspace and one bundle target, `dev`, run in production mode; a merge to `main`
    deploys straight into the cohort workspace.
  - `main` has no branch protection and no rulesets: GitHub refuses both on the Free organisation's
    private repository. It has no GitHub environments either.
  - What stands in for that:
    - pre-commit and pytest run locally before every push;
    - a pull request, by convention, is the only way to `main`;
    - pull-request CI runs pre-commit and the unit tests (about 2,360 of them); a red check does not
      block a merge;
    - an `evals` check runs on assessment changes;
    - about 53 integration tests run by hand in scratch catalogs `course_ops_verify_<key>`;
    - dry runs: `setup_cohort.py` without `--apply`, and `onboarding.yml` with `dry_run` defaulting
      to true;
    - filtered runs (`only=`, `projects_only=`);
    - reconcile in `report` mode;
    - the paid-resource guard.
- **dev → acc → prd is real in the students' project template.**
  - There are three catalogs (`llmops_dev`, `llmops_acc`, `llmops_prd`) and three deploy principals
    per student, each with its own federation policy.
  - Each student repository has three GitHub environments, and `prd` needs the student's approval.

So the close-up has **two columns**:
1. **The student template**: the real three-environment pipeline, linked.
2. **The platform's own repository**: its safety net as it is, linked, with its gaps named plainly
   next to what a full setup adds. The gaps are branch protection or rulesets (a paid plan), an
   acc workspace or target for the platform itself, and bundle validation on pull requests. Link
   GitHub's docs on protected branches, rulesets and environments.

Scene 2 of the animation is the ideal; the close-up says which parts of it the course has today.

### Part 5. The LLMOps onboarding automation
A drawing of the onboarding run: intake from the sheet, merge into the registry, then the steps in
order (user, policy, catalog, warehouse, experiment, repo, principals, membership, first deploys,
Lakebase, credentials, materials), the report, and the reconcile.
- Each box links to the module and function that does it. The links come from the course-assistant
  map of § 5.
- Show who runs it (`sp-onboarding-llmops` by OIDC from `onboarding.yml`) and where the state lives
  (`course_ops` tables).
- You may reuse the existing figures of course-assistant (`lecture_materials/src/platform-infrastructure/figures/`).
  The drawing must be the deck's own, in its look.

## 4. Architecture correctness (all parts)
- **Perimeters** follow https://docs.databricks.com/aws/en/getting-started/high-level-architecture:
  - your Databricks account (control plane and serverless compute plane) is one perimeter;
  - your cloud account (classic compute plane, workspace storage bucket) is another;
  - your resources are a third;
  - users and applications are outside.

  No cloud-provider frame wraps the Databricks account. The course uses a serverless workspace by
  express setup, so it has no cloud account of its own.
- **Request order:** every request is authenticated at identity and auth, then authorized by
  workspace ACLs (workspace objects) or Unity Catalog (data and AI assets), before compute touches
  storage. See `lecture_materials/src/platform-infrastructure/SCENE-BRIEF.md` § 6.

## 5. Facts to build on
- **UI as code:** `/private/tmp/claude-501/-Users-victorkuznetsov-Repos-course-assistant/036fd855-da71-4ba3-bdaa-6637af4af5e1/scratchpad/lecture-facts/ui-as-code.json` and `ui-as-code.md`.
- **Our codebase:** `/private/tmp/claude-501/-Users-victorkuznetsov-Repos-course-assistant/036fd855-da71-4ba3-bdaa-6637af4af5e1/scratchpad/lecture-facts/course-assistant-map.md` and `course-assistant-links.json`.
- **The existing scenes, for reuse of their language** (read, do not edit):
  - `lecture_materials/day-on-the-platform/`
  - `lecture_materials/src/platform-infrastructure/scene.js`
- **The study guide**, for the narrative already written: `lecture_materials/src/platform_infrastructure_pages.py`.

Build only on these facts. Where they do not settle something, keep it general or ask.

## 6. How to work
- **Models.** Only the builders run on the most capable model. Every subagent a builder spawns
  (research, review) passes model `sonnet` explicitly.
- **Verify.**
  - Headless Chrome via Playwright (`uv run`, `playwright==1.48.0`, `channel="chrome"`).
  - No JavaScript errors.
  - Screenshots of every step at 1440×900 and 1280×800, looked at and fixed. Keep them in
    `/private/tmp/claude-501/-Users-victorkuznetsov-Repos-course-assistant/036fd855-da71-4ba3-bdaa-6637af4af5e1/scratchpad/lecture-deck/`.
- **Review.** When done, a read-only review subagent on `sonnet` checks:
  - every code snippet against the facts file;
  - every link resolves to an existing file on `main`;
  - every architecture claim against § 4.

  Fix, re-review the fix, and include the verdict in the report.
