// ----- Part 1. The platform is complex: the sibling animation in a frame, then three beats over its still -----
frameScene("day", {src: BUILD.day, title: "A day on the platform: the animated map"});

Deck.step({
  part: 1, scene: "day", title: "A day on the platform", kind: "animation, in a frame",
  notes: `<p>Open on the animated map and drive it with <b>its own controls</b>: Back, Next, Replay, Jump to, Pause, Speed. Click inside it and its keys work too (← → chapters, Space pause, [ ] speed); the bar above then says the keys belong to the frame, and a click on the bar gives them back to the deck.</p>
<p>Read the ground first: developers and GitHub outside on the left, platform users outside on the right, <b>your Databricks account</b> in the middle (account console, control plane, serverless compute plane, default storage). The two dashed perimeters, your cloud account and your resources, are empty: the course's workspace is serverless, by express setup.</p>
<p>Every request takes the same road: the front door, <b>authenticated</b> at identity and auth, <b>authorized</b> by workspace ACLs or Unity Catalog, and only then compute reads storage.</p>`,
});

(() => {
  const STUDENT = [ // [count, what, detail, tint]: what the daily run makes for one student
    [1, "workspace user", "in <code>grp-students-llmops</code>", "blue"],
    [3, "schemas", "one per catalog: dev, acc, prd", "sage"],
    [1, "SQL warehouse", "<code>wh-llmops-&lt;name&gt;</code>", "warm"],
    [1, "usage policy", "<code>pol-llmops-&lt;name&gt;</code>", "ink"],
    [3, "MLflow experiments", "one per environment", "blue"],
    [1, "GitHub repository", "with three environments", "sage"],
    [3, "deploy principals", "<code>sp-deploy-&lt;name&gt;-&lt;env&gt;</code>", "warm"],
    [3, "federation policies", "one per deploy principal", "ink"],
  ];
  const PER = STUDENT.reduce((n, r) => n + r[0], 0); // 16
  const STUDENTS = 57; // "about 57": the brief's figure, shown as about
  const TINT = {blue: "#506fa0", sage: "#4e7566", warm: "#b8915a", ink: "#3a3a3a"};
  const WRONG = [
    ["repeat", "Clicks nobody can repeat", "What was clicked, and in which order, is written nowhere."],
    ["split", "Drift between environments", "dev, acc and prd stop matching, one hand-made fix at a time."],
    ["eye", "No review, no history, no rollback", "Nobody saw the change before it was live, and there is nothing to go back to."],
    ["lock", "One wrong permission exposes data", "A grant on the wrong group, and everyone in it can read."],
    ["ghost", "A lost workspace means rebuilding from memory", "Hundreds of objects, and the only copy was the workspace."],
  ];
  const ANSWER = [
    ["Declared", "The code says what must exist. The run makes it so."],
    ["Reviewed", "A pull request shows the change before it is live."],
    ["Versioned", "Every change has an author, a date and a way back."],
    ["Repeatable", "The same run gives the same platform, again."],
    ["Testable", "Tests and a dry run, before it touches production."],
  ];

  let root, tl = null;
  function matrix() {
    const P = 13.5, R = 4.6;
    let cols = "";
    for (let c = 0; c < STUDENTS; c++) {
      let dots = "", r = 0;
      for (const [n, , , tint] of STUDENT) for (let i = 0; i < n; i++, r++) dots += `<circle cx="${c * P + R + 1}" cy="${r * P + R + 1}" r="${R}" fill="${TINT[tint]}"/>`;
      cols += `<g class="mx-col">${dots}</g>`;
    }
    return `<svg class="mx" viewBox="0 0 ${STUDENTS * P + 2} ${PER * P + 2}" role="img" aria-label="A grid of dots: one column per student, sixteen objects each">${cols}</svg>`;
  }

  Deck.scene("problem", {
    kind: "canvas",
    build(layer, canvas) {
      layer.prepend(el(`<div class="still" aria-hidden="true"></div>`));
      root = canvas;
      canvas.classList.add("p1");
      canvas.innerHTML = `
<section class="beat b-much" data-beat="0">
  <header class="p1-h"><span class="eyebrow">Name the problem · 1 of 3</span><h2>How much there is</h2></header>
  <div class="card one">
    <span class="eyebrow">For one student</span>
    <ul class="one-l">${STUDENT.map(([n, what, detail, tint]) => `<li><b class="cnt" style="--c:${TINT[tint]}">${n}</b><span class="w">${what}</span><span class="d">${detail}</span></li>`).join("")}</ul>
    <p class="one-f"><b>${PER} objects</b>, made by the ${L("src/course_assistant/contract/cohort.py#L128-L149", "20 steps")} of the daily run. Add a Lakebase database and credentials per environment.</p>
  </div>
  <div class="card many">
    <div class="many-h"><div><span class="big" id="p1n">0</span><span class="unit">objects</span></div><p>about <b>${STUDENTS} students</b> × <b>${PER}</b> each: one column per student</p></div>
    ${matrix()}
    <div class="once"><span class="eyebrow">And once per cohort</span>
      <div class="chips"><span>3 catalogs</span><span><code>course_ops</code>, 5 schemas</span><span>3 shared service principals</span><span>account groups</span><span>grants</span><span>jobs, dashboards, alerts</span><span>${L("scripts/setup_cohort.py#L3273-L3297", "23 parts")} of one-time setup</span></div>
    </div>
  </div>
</section>
<section class="beat b-wrong" data-beat="1">
  <header class="p1-h"><span class="eyebrow">Name the problem · 2 of 3</span><h2>What goes wrong by hand</h2></header>
  <div class="wrong">${WRONG.map(([g, t, d]) => `<article class="card w-c">${gl(g)}<h3>${t}</h3><p>${d}</p></article>`).join("")}</div>
  <div class="card incident">
    <div class="when"><b>2 Nov</b><span>2026</span></div>
    <div><h3>It happened to this course</h3><p>The course's first workspace was <b>banned</b>. The cohort moved to a second account and a new workspace, <b>rebuilt from code the same day</b>.</p></div>
  </div>
</section>
<section class="beat b-answer" data-beat="2">
  <header class="p1-h"><span class="eyebrow">Name the problem · 3 of 3</span><h2>The answer</h2></header>
  <div class="iac"><span class="iac-k">Infrastructure</span><span class="iac-k">as</span><span class="iac-k code">code</span></div>
  <div class="answer">${ANSWER.map(([t, d], i) => `<article class="card a-c"><span class="no">${i + 1}</span><h3>${t}</h3><p>${d}</p></article>`).join("")}</div>
  <p class="p1-next">Which starts with one idea: everything you click is already code.</p>
</section>`;
    },
    show(beat, ctx) {
      if (tl) tl.kill();
      const beats = $$(".beat", root);
      beats.forEach((b) => { b.hidden = Number(b.dataset.beat) !== beat; });
      const b = beats[beat];
      gsap.set($$("*", b), {clearProps: "opacity,visibility,transform"});
      if (beat === 0) $("#p1n").textContent = `≈ ${Math.round((STUDENTS * PER) / 100) * 100}`;
      if (ctx.instant) return;
      tl = gsap.timeline({defaults: {ease: "power2.out"}});
      tl.from($(".p1-h", b), {autoAlpha: 0, y: 14, duration: 0.4});
      if (beat === 0) {
        const n = {v: 0};
        tl.from($(".one", b), {autoAlpha: 0, x: -30, duration: 0.5}, 0.1)
          .from($$(".one-l li", b), {autoAlpha: 0, x: -14, duration: 0.3, stagger: 0.07}, 0.35)
          .from($(".one-f", b), {autoAlpha: 0, duration: 0.3}, ">")
          .from($(".many", b), {autoAlpha: 0, x: 30, duration: 0.5}, 0.9)
          .from($$(".mx-col", b), {autoAlpha: 0, y: -8, duration: 0.25, stagger: 0.028}, 1.3)
          .to(n, {v: STUDENTS * PER, duration: STUDENTS * 0.028 + 0.25, ease: "none",
            onUpdate() { $("#p1n").textContent = String(Math.round(n.v / PER) * PER); },
            onComplete() { $("#p1n").textContent = `≈ ${Math.round((STUDENTS * PER) / 100) * 100}`; }}, 1.3)
          .from($$(".once .chips span", b), {autoAlpha: 0, y: 10, duration: 0.3, stagger: 0.06}, ">-0.1");
      } else if (beat === 1) {
        tl.from($$(".w-c", b), {autoAlpha: 0, y: 34, rotation: () => gsap.utils.random(-3, 3), duration: 0.5, stagger: 0.16, ease: "back.out(1.5)"}, 0.15)
          .from($(".incident", b), {autoAlpha: 0, y: 30, duration: 0.55}, ">0.25")
          .from($(".when", b), {scale: 0.6, duration: 0.5, ease: "back.out(2)"}, "<0.1");
      } else {
        tl.from($$(".iac-k", b), {autoAlpha: 0, y: 30, duration: 0.5, stagger: 0.12}, 0.1)
          .from($$(".a-c", b), {autoAlpha: 0, y: 26, duration: 0.45, stagger: 0.13}, 0.6)
          .from($(".p1-next", b), {autoAlpha: 0, duration: 0.5}, ">0.1");
      }
    },
    hide() { if (tl) tl.kill(); },
  });

  Deck.step({
    part: 1, scene: "problem", beat: 0, title: "How much there is", kind: "beat over the still",
    notes: `<p>Count it for one student first: a workspace user, a schema in each of the three catalogs, a warehouse, a usage policy, three experiments, a repository with three environments, three deploy principals and a federation policy for each. <b>Sixteen objects</b>, before the Lakebase databases, the credentials and the invitations.</p>
<p>The cohort is <b>about 57 students</b>, so close to nine hundred objects, made by the twenty steps of the daily run. On top, once per cohort: three catalogs, <code>course_ops</code> with its schemas, three shared service principals, the groups, the grants, and the bundle's jobs, dashboards and alerts.</p>
<p>The point is not the exact number. It is that nobody keeps this in their head.</p>`,
  });
  Deck.step({
    part: 1, scene: "problem", beat: 1, title: "What goes wrong by hand", kind: "beat over the still",
    notes: `<p>Five ways it fails when it is clicked together: nobody can repeat the clicks; the environments drift apart; there is no review, no history and no rollback; one wrong permission exposes data; and a lost workspace has to be rebuilt from memory.</p>
<p>The last one is not hypothetical. On <b>2 November 2026</b> the course's first workspace was banned, with its compute and apps blocked. The cohort moved to a second account and a new workspace, and it was rebuilt from code the same day.</p>`,
  });
  Deck.step({
    part: 1, scene: "problem", beat: 2, title: "The answer: infrastructure as code", kind: "beat over the still",
    notes: `<p>Infrastructure as code: the platform is <b>declared</b> in files, <b>reviewed</b> in a pull request, <b>versioned</b> in Git, <b>repeatable</b> because the same run gives the same result, and <b>testable</b> before it touches production.</p>
<p>Bridge to part 2: before any tool, one idea. Everything you click in the workspace is already an API call, so it can already be written as code.</p>`,
  });
})();
