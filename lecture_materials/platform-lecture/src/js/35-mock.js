// ----- Part 2. Everything you click is code: the two mocks and the three-tab code panel -----
(() => {
  const TABS = [["terraform", "Terraform"], ["sdk", "Python SDK"], ["rest", "REST API"]];
  const state = {console: "workspace", item: {workspace: null, account: "Workspaces"}, tab: "terraform"};
  let root, mock, panel;

  const itemOf = (cons, label) => UI_AS_CODE.find((d) => d.console === cons && d.item === (ITEM_KEY[`${cons}/${label}`] || label));
  const unconfirmed = (d) => JSON.stringify(d).includes("UNCONFIRMED");
  const docsIn = (text) => { const m = /docs\.databricks\.com\/[\w\-/.]*\w/.exec(text || ""); return m ? "https://" + m[0] : null; };
  const anyUrl = (d, first) => first || d.terraform.url || d.sdk.url || d.rest.url || docsIn(d.notes);
  const codeWords = (text) => esc(text).replace(/\b(databricks_[a-z0-9_*]+|[aw]\.[a-z_0-9.]+(?:\([^)]*\))?)/g, "<code>$1</code>");

  // ----- the mock -----
  function sidebar(cons) {
    return NAV[cons].map(([head, items]) => `${head ? `<h4>${head}</h4>` : ""}${items.map(([label, glyph]) =>
      `<button class="m-i${label === "New" ? " m-new" : ""}" data-item="${esc(label)}">${gl(glyph)}<span>${label}</span></button>`).join("")}`).join("");
  }
  function topbar(cons) {
    const mark = `<svg class="m-mark" aria-label="Databricks"><use href="#mk-databricks"/></svg>`;
    const badge = `<span class="m-badge" title="A mock of the Databricks UI, not the product">mock</span>`;
    return cons === "workspace"
      ? `<button class="m-home" data-home aria-label="Home">${mark}</button>${badge}<span class="m-gap"></span>
         <div class="m-dd"><button class="m-sw" data-menu="ws">workspace <i>▾</i></button><div class="m-menu-pop" data-pop="ws" hidden><span class="cur">✓ workspace</span><button data-console="account">Manage account →</button></div></div>
         <div class="m-dd"><button class="m-av" data-menu="av" aria-label="User menu">J</button><div class="m-menu-pop" data-pop="av" hidden><span>jane.doe@example.com</span><button data-settings>Settings</button></div></div>`
      : `<button class="m-home" data-home aria-label="Home">${mark}</button><b class="m-acct">LLMOps Cauchy Cohort 2</b>${badge}<span class="m-gap"></span>
         <div class="m-dd"><button class="m-sw" data-menu="ws">Select workspace <i>▾</i></button><div class="m-menu-pop" data-pop="ws" hidden><button data-console="workspace">workspace →</button></div></div>
         <span class="m-av" aria-hidden="true">V</span>`;
  }
  function home() {
    return `<div class="m-homep"><h3>Welcome to Databricks</h3>
<div class="m-askbox">${gl("spark")}<span>Ask anything…</span></div>
<div class="m-rec"><h5>Recents</h5>${[["flow", "job-guard-llmops", "Job"], ["chart", "dash-cohort-llmops", "Dashboard"], ["spark", "genie-cohort-llmops", "Genie Agent"], ["book", "llmops_dev.jane_doe", "Schema"]]
      .map(([g, n, t]) => `<div class="m-rr">${gl(g)}<span class="nm">${n}</span><em>${t}</em></div>`).join("")}</div></div>`;
  }
  function pageHtml(cons, item) {
    if (!item) return home();
    if (item.startsWith("Settings: ") && cons === "workspace") {
      const p = PAGES[`${cons}/${item}`];
      return `<header class="m-ph"><h3>Settings</h3></header><div class="m-setnav">${WS_SETTINGS.map((s) => `<button class="${"Settings: " + s === item ? "on" : ""}" data-item="Settings: ${s}">${s}</button>`).join("")}</div><div class="m-pb">${p.body}</div>`;
    }
    const p = PAGES[`${cons}/${item}`];
    return `<header class="m-ph"><h3>${p.title}</h3>${p.btn ? `<span class="m-btn pri">${p.btn}</span>` : ""}</header><div class="m-pb">${p.body}</div>`;
  }
  function paintMock(animate) {
    const cons = state.console, item = state.item[cons];
    mock.dataset.cons = cons;
    $(".m-top", mock).innerHTML = topbar(cons);
    $(".m-side", mock).innerHTML = sidebar(cons);
    $$(".m-side .m-i", mock).forEach((b) => b.classList.toggle("on", b.dataset.item === item));
    const page = $(".m-page", mock);
    page.innerHTML = pageHtml(cons, item);
    $$(".sw button", root).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.console === cons)));
    if (animate && !REDUCED) gsap.fromTo(page.children, {autoAlpha: 0, y: 10}, {autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.05, ease: "power2.out"});
  }

  // ----- the code panel -----
  function tabBody(d, tab, key) {
    const quiet = (url) => (unconfirmed(d) && anyUrl(d, url) ? ext(anyUrl(d, url), "a sketch, not checked line by line · see the docs ↗", "quiet") : "");
    const docs = (url, label) => (url ? ext(url, `${label} ↗`, "docs") : "");
    const foot = (url, label) => `<footer class="c-foot">${docs(url, label)}${quiet(url)}</footer>`;
    if (tab === "terraform") {
      const t = d.terraform, none = /^none/.test(t.resource);
      const level = {workspace: "workspace-level provider", account: "account-level provider", "workspace (or account)": "workspace-level or account-level provider"}[t.provider_level];
      return `<div class="c-meta">${level ? `<span class="c-chip">${level}</span>` : ""}<p>${none ? `<b>No Terraform resource.</b> ${codeWords(t.resource.replace(/^none\s*\(?/, "").replace(/\)$/, ""))}` : codeWords(t.resource)}</p></div>
${t.code ? `<pre class="c-code"><code>${highlight(t.code, "hcl")}</code></pre>` : ""}${foot(t.url, "Terraform registry")}`;
    }
    if (tab === "sdk") {
      const s = d.sdk, account = /\ba\.[a-z_]+/.test(s.call + s.code) && !/\bw\.[a-z_]+\./.test(s.code);
      const none = /^(UI only|UNCONFIRMED)/.test(s.call);
      const call = s.call.replace("w.consumer_installations.list_all? / ", "");
      const says = /^UNCONFIRMED/.test(call) ? "<b>No SDK service</b> was found for this page." : none ? `<b>UI only.</b> ${codeWords(call.replace(/^UI only\s*\(?/, "").replace(/\)$/, ""))}` : `<span class="c-call">${esc(call)}</span>`;
      return `<div class="c-meta">${none ? "" : `<span class="c-chip">${account ? "AccountClient, as <code>a</code>" : "WorkspaceClient, as <code>w</code>"}</span>`}<p>${says}</p></div>
${s.code ? `<pre class="c-code"><code>${highlight(s.code, "py")}</code></pre>` : ""}${foot(s.url, "SDK reference")}`;
    }
    const r = d.rest;
    if (!r.method) return `<div class="c-meta"><p><b>No REST endpoint:</b> this page is UI only.</p></div>${foot(null, "")}`;
    let body = r.body;
    if (body && typeof body === "object" && "note" in body) { body = Object.assign({}, body); delete body.note; }
    const text = `${r.method} ${r.path}` + (body ? "\n" + JSON.stringify(body, null, 2) : "");
    return `<div class="c-meta"><span class="c-chip">${/\/accounts\//.test(r.path) ? "the account host" : "the workspace host"}</span><p>One REST call behind this page. Every click, resource and SDK call ends up as calls like it.</p></div>
<pre class="c-code"><code>${highlight(text, "http")}</code></pre>${foot(r.url, "REST API reference")}`;
  }
  function intro() {
    return `<div class="c-intro"><span class="eyebrow">Part 2</span><h2>Everything you click is code</h2>
<p>Click any item in the mock. On the left, the page you know. Here, the same object three ways.</p>
<ol class="c-three">
  <li><b>Terraform</b><span>You declare the object. The provider works out which calls to make.</span></li>
  <li><b>Python SDK</b><span><code>WorkspaceClient</code> and <code>AccountClient</code>: you make the call yourself. The course's platform is written this way.</span></li>
  <li><b>REST API</b><span>The calls underneath: a click, a resource and an SDK call all end up as REST calls.</span></li>
</ol>
<p class="c-hint">Some items are only a view, or have no code form. They say so.</p></div>`;
  }
  function paintPanel(animate) {
    const cons = state.console, item = state.item[cons];
    if (!item) { panel.innerHTML = intro(); return; }
    const d = itemOf(cons, item);
    const key = `${cons}/${item}`;
    const say = SAY[key];
    panel.innerHTML = `<header class="c-head"><span class="eyebrow">${cons === "workspace" ? "Workspace" : "Account console"} › ${esc(item.replace("Settings: ", "Settings › "))}</span>
<p class="c-what">${esc(d.what)}</p>${say ? `<p class="c-say">${esc(say)}</p>` : ""}</header>
<div class="c-tabs" role="tablist">${TABS.map(([id, label]) => `<button role="tab" data-tab="${id}" aria-selected="${id === state.tab}">${label}</button>`).join("")}</div>
<div class="c-body" role="tabpanel">${tabBody(d, state.tab, key)}</div>`;
    if (animate && !REDUCED) gsap.fromTo([$(".c-head", panel), $(".c-body", panel)], {autoAlpha: 0, x: 14}, {autoAlpha: 1, x: 0, duration: 0.32, stagger: 0.06, ease: "power2.out"});
  }
  function pick(item) { state.item[state.console] = item; paintMock(true); paintPanel(true); }

  Deck.scene("mock", {
    kind: "canvas",
    build(layer, canvas) {
      root = canvas;
      canvas.classList.add("p2");
      canvas.innerHTML = `
<div class="p2-l">
  <div class="p2-strip"><div class="sw" role="group" aria-label="Which console"><button data-console="workspace">Workspace</button><button data-console="account">Account console</button></div>
    <span class="p2-note">A mock of the Databricks UI, not the product</span></div>
  <div class="mock"><div class="m-top"></div><div class="m-body"><nav class="m-side" aria-label="Sidebar of the mock"></nav><section class="m-page"></section></div></div>
</div>
<aside class="p2-r code-panel" aria-live="polite"></aside>`;
      mock = $(".mock", canvas); panel = $(".code-panel", canvas);
      canvas.addEventListener("click", (e) => {
        const t = e.target;
        const menu = t.closest("[data-menu]");
        $$(".m-menu-pop", mock).forEach((p) => { if (!menu || p.dataset.pop !== menu.dataset.menu) p.hidden = true; });
        if (menu) { const pop = $(`[data-pop="${menu.dataset.menu}"]`, mock); pop.hidden = !pop.hidden; return; }
        const cons = t.closest("[data-console]");
        if (cons) { Deck.goId(cons.dataset.console === "workspace" ? "2.1" : "2.2"); return; }
        if (t.closest("[data-open-ws]")) { Deck.goId("2.1"); return; }
        if (t.closest("[data-settings]")) { pick("Settings: Users and groups"); return; }
        if (t.closest("[data-home]")) { pick(state.console === "workspace" ? null : "Workspaces"); return; }
        const item = t.closest("[data-item]");
        if (item) { pick(item.dataset.item); return; }
        const tab = t.closest("[data-tab]");
        if (tab) { state.tab = tab.dataset.tab; paintPanel(false); $(`[data-tab="${state.tab}"]`, panel).focus(); }
      });
    },
    show(beat, ctx) {
      state.console = beat === 0 ? "workspace" : "account";
      paintMock(!ctx.instant);
      paintPanel(!ctx.instant);
    },
  });

  Deck.step({
    part: 2, scene: "mock", beat: 0, title: "The workspace, as code", kind: "clickable mock",
    notes: `<p>This is a <b>mock</b> of the workspace, not the product. Click through what the students use every week and open the three tabs each time. Good ones to click: <b>Catalog</b> (catalog, schema, grants), <b>SQL Warehouses</b>, <b>Jobs &amp; Pipelines</b>, <b>Experiments</b>, <b>AI Gateway</b>, <b>Dashboards</b>.</p>
<p>Then click two that are <b>not</b> objects: <b>Recents</b> or <b>Query History</b> are views, read through a list call; <b>Playground</b> and <b>Visual Data Prep</b> are UI only. Saying so is part of the lesson.</p>
<p>The avatar opens <b>Settings</b>: users and groups, entitlements, usage policies. The workspace switcher leads to the account console, as in the product. Where a snippet is marked as a sketch, it was not checked line by line: the docs link is the reference.</p>`,
  });
  Deck.step({
    part: 2, scene: "mock", beat: 1, title: "The account console, as code", kind: "clickable mock",
    notes: `<p>One level up: the account. Same idea, with the <b>account-level provider</b> in Terraform and <b>AccountClient</b> in the SDK. Click <b>Workspaces</b> (the course's one workspace: serverless only, default storage), <b>User management</b> (the service principals of the course), <b>Security</b> (the federation policy that part 3 comes back to), <b>Cost</b>.</p>
<p><b>Cloud resources</b> is empty on purpose: a serverless workspace made by express setup has no cloud account of its own. <b>AI</b>, <b>Catalog</b>, <b>Genie Ontology</b> and <b>Previews</b> have no code form of their own.</p>
<p>The course's platform uses the Python SDK for all of this, not Terraform. Part 3 says what that needs.</p>`,
  });
})();
