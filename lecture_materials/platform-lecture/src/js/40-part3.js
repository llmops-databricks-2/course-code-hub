// ----- Part 3. What you need to run IaC: three tiles, each with its counterpart in our project, then one diagram -----
(() => {
  const X = [30, 497, 964], W = 446;
  const MID = {y: 232, h: 330}, UP = {y: 90, h: 118};
  const TILES = [
    {key: "access", tint: "warm", glyph: "key", title: "Access", line: "to the systems you manage as code", q: "Who may change the platform, and how do they prove who they are?"},
    {key: "code", tint: "sage", glyph: "doc", title: "Code versioning", line: "a platform that keeps the code and its history", q: "Where is the truth kept, and who saw it change?"},
    {key: "compute", tint: "blue", glyph: "serve", title: "Compute", line: "to run the deployment code", q: "Which machine runs the change, and when?"},
  ];

  const row = (label, body) => `<div class="k-row"><span class="k-l">${label}</span><div class="k-b">${body}</div></div>`;
  const CARDS = [
    // Access: the onboarding principal
    `<div class="k-name">${ic("mk-databricks")}<div><b class="mono">${L("scripts/setup_cohort.py#L643-L674", "sp-onboarding-llmops")}</b><span>a service principal, not a person</span></div></div>
${row("Roles", `<div class="chips">${L("scripts/setup_cohort.py#L791-L815", "account admin")}${L("scripts/setup_cohort.py#L818-L858", "billing admin")}${L("scripts/setup_cohort.py#L643-L674", "workspace admin")}</div>`)}
${row(`${L("scripts/setup_cohort.py#L685-L742", "Federation policy")}: GitHub OIDC`, `<p>issuer ${L("scripts/setup_cohort.py#L234", "<code>token.actions.githubusercontent.com</code>")}</p><p>subject ${L("src/course_assistant/adapters/github.py#L492-L500", "<code>repo:…:ref:refs/heads/main</code>")} of <code>course-assistant</code></p>`)}
${row("No secret", `<p>The workflow's ${L(".github/workflows/onboarding.yml#L69-L71", "<code>DATABRICKS_CLIENT_ID</code>")} names the principal. GitHub's token is exchanged for a Databricks token.</p>`)}
${row("One-time setup, by hand", `<p>${L("scripts/setup_cohort.py#L1-L130", "<code>scripts/setup_cohort.py</code>")}: a dry run unless ${L("scripts/setup_cohort.py#L3378", "<code>--apply</code>")}.</p>`)}`,
    // Code versioning: the repository
    `<div class="k-name">${ic("mk-github")}<div><b class="mono">course-assistant</b><span>a private repository on GitHub</span></div></div>
<ul class="k-tree">
  <li class="h"><code>src/course_assistant/</code></li>
  <li class="in">${L("src/course_assistant/contract/cohort.py#L1-L60", "<code>contract/</code>")}<span>the three contracts</span></li>
  <li class="in">${L("src/course_assistant/adapters/databricks.py#L1-L60", "<code>adapters/</code>")}<span>SDK, GitHub, Sheets</span></li>
  <li class="in">${L("src/course_assistant/onboarding/run.py#L1-L75", "<code>onboarding/</code>")}<span>the <code>ensure_*</code> modules</span></li>
  <li class="in">${L("src/course_assistant/monitoring/guard.py#L1-L40", "<code>monitoring/</code>")}<span>the marts, the guard</span></li>
  <li>${L("src/tasks/onboard.py#L1-L60", "<code>src/tasks/</code>")}<span>thin entry points</span></li>
  <li>${L("scripts/setup_cohort.py#L1-L60", "<code>scripts/</code>")}<span>run by hand</span></li>
  <li>${L("tests/conftest.py#L1-L60", "<code>tests/</code>")}<span>mirror the tree</span></li>
  <li>${L("databricks.yml#L1-L30", "<code>databricks.yml</code>")}<span>the bundle</span></li>
  <li>${L(".github/workflows/ci.yml#L1-L12", "<code>.github/workflows/</code>")}<span>five workflows</span></li>
</ul>
${row(`The SDK code: ${L("docs/TECHNICAL-DESIGN.md#L1659-L1684", "one pattern")}`, `<p class="k-pat">look up by name <i>→</i> create only what is missing <i>→</i> report</p>
<div class="chips">${L("src/course_assistant/onboarding/identity.py#L33", "ensure_user", "mono")}${L("src/course_assistant/onboarding/catalogs.py#L78", "ensure_catalog", "mono")}${L("src/course_assistant/onboarding/warehouses.py#L65", "ensure_warehouse", "mono")}</div>`)}`,
    // Compute: GitHub Actions
    `<div class="k-name">${ic("mk-githubactions")}<div><b>GitHub Actions</b><span>a GitHub-hosted runner, <code>ubuntu-latest</code></span></div></div>
${row(`${L(".github/workflows/onboarding.yml#L1-L100", "<code>onboarding.yml</code>")}`, `<ul class="k-ul">
  <li>${L(".github/workflows/onboarding.yml#L26-L28", "daily at 06:00 UTC")}, or ${L(".github/workflows/onboarding.yml#L29-L47", "by hand")}, where <code>dry_run</code> defaults to true</li>
  <li>job <code>onboard</code>: ${L(".github/workflows/onboarding.yml#L53-L62", "120 minutes, one run at a time")}</li>
  <li>runs ${L(".github/workflows/onboarding.yml#L82-L90", "<code>src/tasks/onboard.py</code>")} as <code>sp-onboarding-llmops</code></li></ul>`)}
${row(`${L(".github/workflows/deploy.yml#L1-L88", "<code>deploy.yml</code>")}`, `<ul class="k-ul">
  <li>on a ${L(".github/workflows/deploy.yml#L8-L19", "push to <code>main</code>")} that touches the bundle</li>
  <li>${L(".github/workflows/deploy.yml#L67-L71", "<code>bundle validate</code>, then <code>bundle deploy</code>")}, as <code>sp-monitoring-llmops</code></li></ul>`)}
${row("And three more", `<p>${L(".github/workflows/ci.yml#L1-L80", "<code>ci.yml</code>")}, ${L(".github/workflows/evals.yml#L1-L63", "<code>evals.yml</code>")}, ${L(".github/workflows/publish-template.yml#L1-L94", "<code>publish-template.yml</code>")}</p>`)}`,
  ];

  // the last step: the three, joined. Coordinates are canvas pixels.
  const N = {
    g1: {x: 30, y: 322, w: 290, h: 168}, g2: {x: 366, y: 322, w: 290, h: 168},
    id: {x: 730, y: 322, w: 310, h: 168}, az: {x: 1078, y: 322, w: 306, h: 168},
    t1: {x: 730, y: 606, w: 310, h: 190}, t2: {x: 1078, y: 606, w: 306, h: 190},
  };
  const box = (k) => `left:${N[k].x}px;top:${N[k].y}px;width:${N[k].w}px;height:${N[k].h}px`;
  const cy = (k) => N[k].y + N[k].h / 2, right = (k) => N[k].x + N[k].w, midx = (k) => N[k].x + N[k].w / 2;
  const P = { // the packet's roads
    push: [[right("g1"), cy("g1")], [N.g2.x, cy("g2")]],
    jwt: [[right("g2"), cy("g2")], [N.id.x, cy("id")]],
    az: [[right("id"), cy("id")], [N.az.x, cy("az")]],
    ws: [[midx("az"), N.az.y + N.az.h], [midx("t2"), N.t2.y]],
    ac: [[N.az.x + 60, N.az.y + N.az.h], [N.az.x + 60, 548], [midx("t1"), 548], [midx("t1"), N.t1.y]],
  };
  const d = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");

  let root, tiles, cards, dia, loop = null;

  function runLoop() {
    stopLoop();
    if (REDUCED) return;
    const dot = (cls) => $(`.pk.${cls}`, dia);
    const move = (tl, cls, pts, dur, at) => {
      const c = dot(cls);
      tl.set(c, {attr: {cx: pts[0][0], cy: pts[0][1]}, autoAlpha: 1}, at);
      pts.slice(1).forEach((p, i) => tl.to(c, {attr: {cx: p[0], cy: p[1]}, duration: dur / (pts.length - 1), ease: i === pts.length - 2 ? "power1.out" : "none"}, i === 0 ? at : ">"));
      tl.set(c, {autoAlpha: 0}, ">");
    };
    const say = (tl, n, at) => tl.call(() => $$(".story li", dia).forEach((li, i) => li.classList.toggle("on", i === n)), null, at);
    const tick = (tl, key, at) => tl.fromTo($(`.nd-${key} .tick`, dia), {scale: 0, autoAlpha: 0}, {scale: 1, autoAlpha: 1, duration: 0.35, ease: "back.out(3)"}, at);
    loop = gsap.timeline({repeat: -1, repeatDelay: 1.6, delay: 0.9});
    loop.set($$(".tick", dia), {autoAlpha: 0, scale: 0}, 0);
    say(loop, 0, 0);
    move(loop, "dev", P.push, 0.7, 0.1);
    move(loop, "gold", P.jwt, 0.9, 1.0);
    say(loop, 1, 1.9);
    tick(loop, "id", 2.0);
    move(loop, "back", [P.jwt[1], P.jwt[0]], 0.8, 2.6);
    say(loop, 2, 3.6);
    move(loop, "call", P.jwt, 0.6, 3.7);
    move(loop, "call", P.az, 0.4, 4.35);
    tick(loop, "az", 4.75);
    move(loop, "call", P.ws, 0.6, 5.2);
    move(loop, "call2", P.ac, 0.9, 5.2);
    loop.to({}, {duration: 1.4});
  }
  function stopLoop() { if (loop) { loop.kill(); loop = null; } if (dia) { gsap.set($$(".pk", dia), {autoAlpha: 0}); $$(".story li", dia).forEach((li) => li.classList.remove("on")); } }

  function apply(beat, instant) {
    const dur = instant ? 0 : 0.65;
    TILES.forEach((t, i) => {
      const up = beat >= i + 1;
      tiles[i].classList.toggle("up", up);
      tiles[i].classList.toggle("now", beat === i + 1);
      gsap.to(tiles[i], {y: up ? UP.y : MID.y, height: up ? UP.h : MID.h, duration: dur, ease: "power3.inOut", overwrite: true});
      const on = up && beat <= 3;
      gsap.to(cards[i], {autoAlpha: on ? 1 : 0, y: on ? 0 : 40, duration: on ? dur : dur * 0.5, delay: on && !instant && beat === i + 1 ? 0.3 : 0, ease: "power2.out", overwrite: true});
    });
    gsap.to(dia, {autoAlpha: beat === 4 ? 1 : 0, duration: dur, delay: beat === 4 && !instant ? 0.3 : 0, overwrite: true});
    if (beat === 4) {
      if (!instant) gsap.fromTo($$(".nd, .peri, .story", dia), {autoAlpha: 0, y: 16}, {autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.08, delay: 0.35, ease: "power2.out"});
      runLoop();
    } else stopLoop();
  }

  Deck.scene("needs", {
    kind: "canvas",
    build(layer, canvas) {
      root = canvas;
      canvas.classList.add("p3");
      canvas.innerHTML = `<header class="p3-h"><span class="eyebrow">Part 3</span><h2>What you need to run infrastructure as code</h2></header>
${TILES.map((t, i) => `<button class="tile t-${t.tint}" style="left:${X[i]}px;width:${W}px" data-tile="${i}" aria-label="${esc(t.title)}: show it in our project">
  <span class="tile-h"><span class="no">${i + 1}</span>${gl(t.glyph)}<span class="tt"><b>${t.title}</b><span>${t.line}</span></span></span>
  <span class="q">${t.q}</span></button>`).join("")}
${CARDS.map((html, i) => `<article class="kcard t-${TILES[i].tint}" style="left:${X[i]}px;width:${W}px"><span class="eyebrow">In our project</span>${html}</article>`).join("")}
<div class="dia">
  <svg class="dia-s" viewBox="0 0 1440 850" aria-hidden="true">
    <defs><marker id="p3arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#8a8a8a"/></marker></defs>
    ${Object.values(P).map((pts) => `<path class="edge" d="${d(pts)}" marker-end="url(#p3arr)"/>`).join("")}
    <circle class="pk dev" r="8"/><circle class="pk gold" r="8"/><circle class="pk back" r="8"/><circle class="pk call" r="8"/><circle class="pk call2" r="8"/>
  </svg>
  <div class="peri" style="left:702px;top:236px;width:708px;height:586px"><span>${ic("mk-databricks")}Your Databricks account</span></div>
  <span class="outside" style="left:30px;top:244px">Outside: GitHub</span>
  <div class="nd nd-g1 t-sage" style="${box("g1")}"><span class="tag">2</span>${ic("mk-github")}<b class="mono">course-assistant</b><p>The code, versioned, on <code>main</code>.</p></div>
  <div class="nd nd-g2 t-blue" style="${box("g2")}"><span class="tag">3</span>${ic("mk-githubactions")}<b>A GitHub Actions job</b><p><code>onboarding.yml</code>, on a GitHub-hosted runner.</p></div>
  <div class="nd nd-id t-warm" style="${box("id")}"><span class="tag">1</span><i class="tick">✓</i><b>Identity and auth</b><p>The federation policy checks the token: issuer, subject, audience.</p></div>
  <div class="nd nd-az" style="${box("az")}"><i class="tick">✓</i><b>Authorization</b><p>Workspace ACLs or Unity Catalog; account roles for account calls. Before anything changes.</p></div>
  <div class="nd nd-t1" style="${box("t1")}">${ic("dbx-enterprise-security")}<b>The account</b><p>Users, service principals, federation policies, usage policies.</p><code>AccountClient</code></div>
  <div class="nd nd-t2" style="${box("t2")}">${ic("dbx-workspace")}<b>The workspace</b><p>Schemas, warehouses, experiments, grants.</p><code>WorkspaceClient</code></div>
  <span class="elabel gold" style="left:${(right("g2") + N.id.x) / 2}px;top:${N.g2.y - 48}px">OIDC token →</span>
  <span class="elabel back" style="left:${(right("g2") + N.id.x) / 2}px;top:${N.g2.y + N.g2.h + 8}px">← Databricks token</span>
  <ol class="story" style="left:30px;top:556px;width:626px">
    <li>The job starts and asks GitHub for an <b>OIDC token</b>: a signed statement of which repository and branch is running.</li>
    <li>Databricks checks it against the <b>federation policy</b> of <code>sp-onboarding-llmops</code> and answers with a Databricks token. No secret is stored.</li>
    <li>Every SDK call is then <b>authorized</b> before it changes the account or the workspace.</li>
  </ol>
</div>`;
      tiles = $$(".tile", canvas); cards = $$(".kcard", canvas); dia = $(".dia", canvas);
      tiles.forEach((t, i) => t.addEventListener("click", () => Deck.goId(`3.${i + 2}`)));
      gsap.set(cards, {autoAlpha: 0, y: 40});
      gsap.set(dia, {autoAlpha: 0});
    },
    show(beat, ctx) {
      apply(beat, ctx.instant || ctx.entered);
      if (ctx.entered && !ctx.instant && beat === 0) gsap.fromTo(tiles, {autoAlpha: 0, scale: 0.92}, {autoAlpha: 1, scale: 1, duration: 0.55, stagger: 0.16, ease: "back.out(1.4)"});
      else gsap.set(tiles, {autoAlpha: 1, scale: 1});
    },
    hide() { stopLoop(); },
  });

  Deck.step({
    part: 3, scene: "needs", beat: 0, title: "Three things you need", kind: "three tiles",
    notes: `<p>Whatever the tool, running infrastructure as code needs three things: <b>access</b> to the systems you manage, a <b>code versioning platform</b>, and <b>compute</b> that runs the deployment code. Ask the room which one they think is the hardest. It is almost always access.</p>
<p>Each Next shows one of them in our own project. A click on a tile does the same.</p>`,
  });
  Deck.step({
    part: 3, scene: "needs", beat: 1, title: "Access: sp-onboarding-llmops", kind: "tile and project card",
    notes: `<p>Access is a <b>service principal</b>, <code>sp-onboarding-llmops</code>: account admin, billing admin and workspace admin. Nobody holds a password or a token for it.</p>
<p>It has one <b>federation policy</b>: GitHub's OIDC issuer, and the subject of <code>main</code> of <code>course-assistant</code>. The workflow only says who it wants to be, through <code>DATABRICKS_CLIENT_ID</code>; GitHub's token is exchanged for a Databricks token. A pull request from a fork gets no token at all.</p>
<p>The principal, its roles and its policy are themselves made by code, once, by hand: <code>scripts/setup_cohort.py</code>, which only reads and prints unless you pass <code>--apply</code>.</p>`,
  });
  Deck.step({
    part: 3, scene: "needs", beat: 2, title: "Code versioning: the repository", kind: "tile and project card",
    notes: `<p>The code lives in one private repository on GitHub, <code>course-assistant</code>. Walk the layout: the contracts, the adapters, the onboarding with one <code>ensure_*</code> module per resource, the monitoring, the thin task files, the scripts run by hand, the tests, the bundle, the workflows.</p>
<p>Every <code>ensure_*</code> follows one pattern: look the object up by name, create only what is missing, report what happened. That is what makes a second run safe; part 5 comes back to it.</p>`,
  });
  Deck.step({
    part: 3, scene: "needs", beat: 3, title: "Compute: a GitHub Actions job", kind: "tile and project card",
    notes: `<p>The compute is a GitHub-hosted runner. <code>onboarding.yml</code> runs every day at 06:00 UTC, or by hand, where <code>dry_run</code> defaults to true; one run at a time, 120 minutes at most. <code>deploy.yml</code> runs on a push to <code>main</code> that touches the bundle: validate, then deploy, as <code>sp-monitoring-llmops</code>.</p>
<p>Three more workflows: <code>ci.yml</code> (pre-commit and the unit tests on every pull request), <code>evals.yml</code>, and <code>publish-template.yml</code>. No self-hosted runner, and no machine of ours to keep alive.</p>`,
  });
  Deck.step({
    part: 3, scene: "needs", beat: 4, title: "The three, joined", kind: "diagram, animated",
    notes: `<p>Put together: the code on <code>main</code> starts a job on GitHub's runner. The job asks GitHub for an OIDC token and presents it to Databricks. <b>Identity and auth</b> checks it against the federation policy (issuer, subject, audience) and answers with a Databricks token for <code>sp-onboarding-llmops</code>.</p>
<p>From then on every SDK call is <b>authorized</b> (account roles, workspace ACLs, Unity Catalog) before it changes the account or the workspace. Same order as in the animated map: authenticated first, authorized second, then the work.</p>
<p>GitHub is outside; the account console and the workspace are inside your Databricks account. There is no cloud account of ours anywhere in this picture.</p>`,
  });
})();
