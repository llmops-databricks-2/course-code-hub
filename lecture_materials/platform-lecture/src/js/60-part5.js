// ----- Part 5. The LLMOps onboarding automation: one run, in order; every box opens the code that does it -----
(() => {
  const ON = "src/course_assistant/onboarding/";
  // who runs it: [key, icon, title, mono?, sub, link, detail, width]
  const ACTORS = [
    ["wf", "mk-githubactions", "onboarding.yml", true, "daily 06:00 UTC, or by hand", ".github/workflows/onboarding.yml#L1-L100", "The workflow. Scheduled every day (the variable ONBOARDING_SCHEDULE gates it) or started by hand, where dry_run defaults to true. It runs the entry point, then lists the running apps and the experiments.", 270],
    ["sp", "mk-databricks", "sp-onboarding-llmops", true, "signs in by OIDC: no secret", "scripts/setup_cohort.py#L643-L674", "The identity of the run: an account admin and workspace admin, signed in from main of this repository through its federation policy. No Databricks secret is stored in GitHub.", 300],
    ["py", "mk-python", "src/tasks/onboard.py", true, "the thin entry point", "src/tasks/onboard.py#L28-L60", "The entry point: parses --dry-run, --only and --projects-only, and calls run.run. Nothing domain-specific lives here.", 290],
    ["run", "", "run.run", true, "builds the clients", ON + "run.py#L1219-L1292", "The orchestrator: builds the clients, reads the run's identity, calls onboard, writes the job summary and posts the Teams card.", 200],
    ["onb", "", "run.onboard", true, "one run, in order", ON + "run.py#L831-L950", "One run: the ten stages below. A finally completes the run row whatever happened.", 216],
  ];
  // the run: [n, title, function, link, detail, extra links]
  const STAGES = [
    [1, "Cohort tables", "ensure_cohort", ON + "cohort_setup.py#L161", "Creates the tables and views, the row filters, the identities and the group members. Skipped in a dry run.", []],
    [2, "Run row", "_start_run", ON + "run.py#L875", "One row in audit.onboarding_runs, with state running.", []],
    [3, "Teachers' projects", "ensure_projects", ON + "projects.py#L176", "The cohort file's shared projects: a schema and a Lakebase project. Skipped when only is set.", []],
    [4, "Intake: the sheet", "read_students", ON + "intake.py#L198-L208", "Reads the Google Sheet with a service account (students.json for a corporate cohort), matches the headers, validates each row and assigns the names. Returns the students, and the refused, excluded and duplicate rows.", [["src/course_assistant/adapters/sheets.py#L45", "sheets.read_rows"], [ON + "intake.py#L210", "take_in"]]],
    [5, "Merge: the registry", "merge_students", ON + "state.py#L291", "One MERGE on uc_name into course_ops.registry.students. A dry run skips it and works out what it would take.", [[ON + "state.py#L327", "read_registry"], [ON + "run.py#L913-L916", "the call"]]],
    [6, "The steps", "take_steps", ON + "run.py#L658", "For every student, the open steps of their plan, in STEPS order. Each result is one row in audit.onboarding_steps; a failed step holds its dependents for that run.", [[ON + "run.py#L486", "take_step"], [ON + "run.py#L462-L483", "STEP_CALLS"], [ON + "state.py#L412", "write_step"], [ON + "run.py#L174-L243", "STEP_PREREQUISITES"]]],
    [7, "Identities, again", "write_identities", ON + "run.py#L981-L1012", "Rewrites the row-filter lookup registry.identities, so that this run's new principals and addresses reach it.", [[ON + "cohort_setup.py#L354", "ensure_identities"]]],
    [8, "Reconcile", "reconcile", ON + "reconcile.py#L467", "Plans the removals for students who left or whose plan shrank, in reverse step order. In report mode it prints them; apply removes, in a later run. Today the cohort file says report.", [[ON + "reconcile.py#L199", "plan_removals"], [ON + "reconcile.py#L412", "apply_removals"]]],
    [9, "Report", "report.summary", ON + "report.py#L310", "Reads the tables back, writes the job summary, and posts a card to Teams when something is open, failed or planned. A dry run posts nothing.", [[ON + "report.py#L416", "write_summary"], [ON + "report.py#L456", "notify_teams"]]],
    [10, "End", "finally", ON + "run.py#L975-L978", "Completes the run row once: succeeded or failed, with the error and the counts.", []],
  ];
  // the steps of STEPS: [name, times, what, link, detail, wrapper link]
  const STEPS = [
    ["user", 1, "workspace user", ON + "identity.py#L33", "identity.ensure_user: a workspace user with the entitlements, a member of grp-students-llmops.", ON + "run.py#L340"],
    ["policy", 1, "usage policy", ON + "policies.py#L59", "policies.ensure_policy: the usage policy pol-llmops-<name>, tagged student and cohort.", ON + "run.py#L344"],
    ["catalog", 1, "3 schemas", ON + "catalogs.py#L78", "catalogs.ensure_catalog: a schema in each of llmops_dev, llmops_acc and llmops_prd, the arxiv_files volume, and the grants per environment.", ON + "run.py#L348"],
    ["warehouse", 1, "SQL warehouse", ON + "warehouses.py#L65", "warehouses.ensure_warehouse: a 2X-Small serverless warehouse wh-llmops-<name>, stopped, with CAN USE for the student.", ON + "run.py#L352"],
    ["experiment", 1, "MLflow, UC traces", ON + "experiments.py#L336", "experiments.ensure_experiments: the student's MLflow experiments, with Unity Catalog trace tables.", ON + "run.py#L356"],
    ["repo", 1, "3 environments", ON + "repos.py#L282", "repos.ensure_repo: the repository llmops-<name>, rendered from template/, with three environments and a protected main.", ON + "run.py#L360"],
    ["principal", 3, "deploy principal", ON + "principals.py#L184", "principals.ensure_principal, for dev, acc and prd: sp-deploy-<name>-<env>, its federation policy on the repository's environment, its grants, and DATABRICKS_CLIENT_ID_<ENV> on the repository.", ON + "run.py#L370-L390"],
    ["membership", 1, "invitations", ON + "repos.py#L432", "repos.ensure_membership: the organisation invitation and the repository invitation.", ON + "run.py#L393"],
    ["first_deploy", 2, "dev, then acc", ON + "repos.py#L569", "repos.ensure_first_deploy: dispatches the student's deploy.yml for dev, then acc. prd waits for the student's approval.", ON + "run.py#L400-L414"],
    ["lakebase", 3, "Postgres database", ON + "lakebase.py#L112", "lakebase.ensure_lakebase, per environment: the Postgres roles and the student's database, with vector.", ON + "run.py#L417-L433"],
    ["credentials", 3, "per environment", ON + "credentials.py#L240", "credentials.ensure_student_credentials: the student's credentials, per environment.", ON + "run.py#L436-L454"],
    ["materials", 1, "course materials", ON + "materials.py#L53", "materials.ensure_materials: read access to the course materials repository.", ON + "run.py#L457"],
    ["discord", 1, "Discord role", ON + "discord.py#L27", "discord.ensure_discord: the configured Discord role.", ON + "run.py#L482"],
  ];
  const TABLES = [["registry.students", "5"], ["audit.onboarding_runs", "2 · 10"], ["audit.onboarding_steps", "6"], ["registry.identities", "1 · 7"]];
  const DEFAULTS = [
    `<b>One run, in order.</b> It runs as <code>sp-onboarding-llmops</code>, signed in by OIDC from <code>onboarding.yml</code>, and keeps its state in the <code>course_ops</code> tables: the repository holds none. Point at a box to read what it does. Click it to open the code that does it.`,
    `<b>Twenty steps for every student</b>, taken in ${L("src/course_assistant/contract/cohort.py#L128-L149", "<code>STEPS</code>")} order; fourteen for a cohort without the Lakebase instances, which drops the Lakebase and credentials steps. A ${L("src/course_assistant/contract/cohort.py#L189-L192", "plan")} takes a subset. Each step is one <code>ensure_*</code> and leaves one row in <code>audit.onboarding_steps</code>; a failed step holds only its ${L(ON + "run.py#L174-L243", "dependents")}, for that run.`,
    `<b>Why a second run is safe.</b> Each <code>ensure_*</code> looks the object up by name first and creates only what is missing; a half-made object is completed. The second run changes nothing. ${L(ON + "reconcile.py#L467", "Reconcile")} only reports removals until the cohort file says <code>apply</code>: today it says <code>report</code>. The scheduled run succeeded every day from 15 to 22 November 2026. ${L("docs/TECHNICAL-DESIGN.md#L1686-L1698", "The design: idempotency and failure")}.`,
  ];
  const DETAIL = {}; // data-d -> html of the strip
  const file = (link) => link.split("#")[0];
  const detail = (key, title, link, text, extra = []) => {
    DETAIL[key] = `<b>${title}</b> <code>${file(link)}</code><br>${esc(text)}${extra.length ? ` <span class="more">Also: ${extra.map(([p, l]) => L(p, `<code>${l}</code>`)).join(", ")}</span>` : ""}`;
  };

  let root, strip, loop = null, beatNow = 0;
  const say = (html) => { strip.innerHTML = html; };

  function run(beat) {
    if (loop) { loop.kill(); loop = null; }
    $$(".hot", root).forEach((e) => e.classList.remove("hot"));
    if (REDUCED || beat === 2) return;
    const seq = beat === 0 ? $$(".act, .stg, .o-steps", root) : $$(".stp", root);
    loop = gsap.timeline({repeat: -1, repeatDelay: 1.2, delay: 1.4});
    seq.forEach((e) => {
      loop.call(() => { $$(".hot", root).forEach((x) => x.classList.remove("hot")); e.classList.add("hot"); });
      loop.to({}, {duration: beat === 0 ? 0.62 : 0.42});
    });
    loop.call(() => $$(".hot", root).forEach((x) => x.classList.remove("hot")));
  }

  Deck.scene("onboarding", {
    kind: "canvas",
    build(layer, canvas) {
      root = canvas;
      canvas.classList.add("p5");
      for (const [key, , title, , , link, text] of ACTORS) detail("a-" + key, title, link, text);
      for (const [n, title, , link, text, extra] of STAGES) detail("s-" + n, `${n}. ${title}`, link, text, extra);
      for (const [name, times, , link, text, wrap] of STEPS) detail("t-" + name, `${name}${times > 1 ? ` × ${times}` : ""}`, link, text, [[wrap, "the wrapper in run.py"]]);
      const arrow = `<i class="arr" aria-hidden="true">→</i>`;
      const stage = ([n, title, fn, link]) => `<a class="bx stg${n === 6 ? " ghost" : ""}" data-d="s-${n}" href="${U(link)}" target="_blank" rel="noopener"><span class="t"><i class="no">${n}</i>${title}</span><code>${fn}</code></a>`;
      canvas.innerHTML = `
<header class="p5-h"><h2>The LLMOps onboarding, one run</h2><p>Every box opens its code on GitHub ↗</p></header>
<span class="lbl" style="top:68px">Who runs it</span>
<div class="rowx o-act" style="top:94px">${ACTORS.map(([key, icon, title, , sub, link, , w], i) => `${i ? (i === 1 ? `<i class="arr oidc" aria-hidden="true">→</i>` : arrow) : ""}<a class="bx act" style="width:${w}px" data-d="a-${key}" href="${U(link)}" target="_blank" rel="noopener"><span class="t">${icon ? ic(icon) : ""}<code>${title}</code></span><span class="s">${sub}</span></a>`).join("")}</div>
<span class="lbl" style="top:184px">The run, in order</span>
<div class="rowx o-r1" style="top:210px">${STAGES.slice(0, 5).map((s, i) => (i ? arrow : "") + stage(s)).join("")}</div>
<i class="vl" style="left:1282px;top:290px"></i>
<section class="o-steps" style="top:304px">
  <header>${stage(STAGES[5])}<p>for every student, in <code>STEPS</code> order: <b>20 steps</b>, each one <code>ensure_*</code></p></header>
  <div class="o-grid">${STEPS.map(([name, times, what, link]) => `<a class="bx stp" data-d="t-${name}" href="${U(link)}" target="_blank" rel="noopener"><span class="t"><code>${name}</code>${times > 1 ? `<i class="x">× ${times}</i>` : ""}</span><span class="s">${what}</span></a>`).join("")}
    <span class="bx note"><span class="t">${gl("table")}one row each</span><span class="s">in the audit table</span></span></div>
</section>
<i class="vl" style="left:190px;top:522px"></i>
<div class="rowx o-r3" style="top:536px">${STAGES.slice(6).map((s, i) => (i ? arrow : "") + stage(s)).join("")}</div>
<div class="o-state" style="top:630px"><span class="st-t">State in ${L("docs/TECHNICAL-DESIGN.md#L1308-L1406", "<code>course_ops</code>")}:</span>
  ${TABLES.map(([t, n]) => `<span class="tb"><i>${n}</i><code>${t}</code></span>`).join("")}</div>
<div class="o-strip" aria-live="polite"></div>`;
      strip = $(".o-strip", canvas);
      canvas.addEventListener("pointerover", (e) => { const b = e.target.closest("[data-d]"); if (b) say(DETAIL[b.dataset.d]); });
      canvas.addEventListener("focusin", (e) => { const b = e.target.closest("[data-d]"); if (b) say(DETAIL[b.dataset.d]); });
      canvas.addEventListener("pointerout", (e) => { const b = e.target.closest("[data-d]"); if (b && !b.contains(e.relatedTarget)) say(DEFAULTS[beatNow]); });
    },
    show(beat, ctx) {
      beatNow = beat;
      root.dataset.beat = String(beat);
      say(DEFAULTS[beat]);
      const all = $$(".o-act, .o-r1, .o-steps, .o-r3, .o-state, .o-strip, .lbl, .vl", root);
      gsap.killTweensOf([all, $$(".stp", root)]);
      gsap.set([all, $$(".stp", root)], {clearProps: "opacity,visibility,transform"});
      if (!ctx.instant) {
        if (ctx.entered) gsap.from(all, {autoAlpha: 0, y: 18, duration: 0.45, stagger: 0.07, ease: "power2.out", clearProps: "opacity,visibility,transform"});
        if (beat === 1) gsap.from($$(".stp", root), {autoAlpha: 0, scale: 0.8, duration: 0.3, stagger: 0.07, ease: "back.out(1.8)", delay: ctx.entered ? 0.6 : 0.1, clearProps: "opacity,visibility,transform"});
        if (!ctx.entered) gsap.fromTo(strip, {autoAlpha: 0, y: 10}, {autoAlpha: 1, y: 0, duration: 0.4});
      }
      run(beat);
    },
    hide() { if (loop) { loop.kill(); loop = null; } },
  });

  Deck.step({
    part: 5, scene: "onboarding", beat: 0, title: "One run, in order", kind: "drawing, every box a link",
    notes: `<p>This is what makes the nine hundred objects of part 1. <b>Who runs it:</b> the workflow <code>onboarding.yml</code>, every day at 06:00 UTC or by hand, signed in as <code>sp-onboarding-llmops</code> by OIDC. It starts one thin file, <code>src/tasks/onboard.py</code>, which calls <code>run.run</code>, which calls <code>run.onboard</code>.</p>
<p><b>The run:</b> make sure the cohort tables exist, open a run row, the teachers' projects, read the sheet, merge the students into the registry, take every student's open steps, rewrite the identities, reconcile, report, and close the run row in a <code>finally</code>.</p>
<p>Every box is a link to the module and function that does it. Point at one to read it in the strip at the bottom.</p>`,
  });
  Deck.step({
    part: 5, scene: "onboarding", beat: 1, title: "Twenty steps per student", kind: "the steps, lit in order",
    notes: `<p>The heart of the run: for every student, the open steps of their plan, in the order of <code>STEPS</code>. User, usage policy, the three schemas, the warehouse, the experiments, the repository; then three deploy principals, the invitations, the first deploys to dev and acc, the Lakebase databases, the credentials, the course materials, Discord. Twenty names in all.</p>
<p>Each step is one <code>ensure_*</code> function and writes one row to <code>audit.onboarding_steps</code>. A failed step holds only the steps that depend on it, for that run; tomorrow's run takes them again. <code>prd</code> is never deployed by the run: it waits for the student's approval.</p>`,
  });
  Deck.step({
    part: 5, scene: "onboarding", beat: 2, title: "Why a second run is safe", kind: "the close",
    notes: `<p>The run is idempotent, step by step. Each <code>ensure_*</code> looks the object up by name first and creates only what is missing, so a second run changes nothing and only reports what is still pending.</p>
<p>The state is in the <code>course_ops</code> tables, never in the repository: the registry says who and what exists, the audit says what the system did. Removals are planned and printed, and nothing is removed until the cohort file says <code>apply</code>; today it says <code>report</code>.</p>
<p>Close the loop to part 1: this is why a banned workspace could be rebuilt in a day. And to part 4: the platform's own repository has the tests and the dry runs, but not yet the gates.</p>`,
  });
})();
