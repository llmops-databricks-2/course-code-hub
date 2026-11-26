// The static close-up of part 4: the scene zoomed onto GitHub, two columns. The left one is the
// student template, where dev → acc → prd is real; the right one is the platform's own repository,
// its safety net as it is and its gaps next to what a full setup adds. The content is closeup.json,
// with every link resolved by build.py against the facts file. A row's title opens its first link;
// the row itself opens a card with what the facts say and every link.
//
// The page speaks the same protocol as the animation, so the deck can treat both alike:
//   out: {type: "part4", event: "ready"}
//   in:  {cmd: "scene", n: 1|2} puts the light on a column, {cmd: "step"} moves it on (both columns,
//        the first, the second, both), {cmd: "play"} and {cmd: "pause"} do nothing: nothing moves here.
const D = JSON.parse(document.getElementById("data").textContent);
const $ = (id) => document.getElementById(id);
const post = (msg) => { if (window.parent !== window) window.parent.postMessage({type: "part4", page: "github", ...msg}, "*"); };
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const md = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");
const STATE = {auto: "runs or holds by itself", hand: "by hand, or by convention", gap: "missing today"};
const ext = 'target="_blank" rel="noopener"';

const LOCK = '<svg class="lk" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7.5" rx="1.5" stroke="none"/><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke-width="2"/></svg>';
const flow = (items) => '<ol class="flow">' + items.map((f, i) =>
  `${i && f.arrow !== false && !f.lab ? '<li class="arr" aria-hidden="true">→</li>' : ""}${f.br ? '<li class="br" aria-hidden="true"></li>' : ""}` + (f.lab ? `<li class="lab">${esc(f.lab)}</li>` : `<li class="${f.state || ""}"${f.state ? ` title="${STATE[f.state]}"` : ""}>${f.lock ? LOCK : f.state && f.state !== "auto" ? `<i class="dot ${f.state}"></i>` : ""}<b${f.code ? ' class="mono"' : ""}>${esc(f.t)}</b>${f.n ? `<span>${esc(f.n)}</span>` : ""}</li>`)).join("") + "</ol>";
const link = (l) => `<a href="${esc(l.url)}" ${ext}>${esc(l.label)}</a>`;
const count = (r) => r.links.length + r.docs.length;
const more = (r) => `<button class="more" data-id="${r.id}" aria-label="${esc(r.title.replace(/`/g, ""))}: what the facts say, and all ${count(r)} links">${count(r)} links</button>`;
const row = (r) =>
  `<li class="row ${r.state}" data-id="${r.id}"><i class="dot ${r.state}" title="${STATE[r.state]}"></i>` +
  `<p><a class="row-t" href="${esc(r.links[0].url)}" ${ext} title="${esc(r.links[0].path)}, lines ${r.links[0].lines}">${md(r.title)}</a><span class="row-s">${md(r.short)}</span></p>${more(r)}</li>`;
const gap = (g) =>
  `<li class="gaprow" data-id="${g.id}"><div class="g-t"><i class="dot gap" title="${STATE.gap}"></i><p><a class="row-t" href="${esc(g.links[0].url)}" ${ext} title="${esc(g.links[0].path)}, lines ${g.links[0].lines}">${md(g.title)}</a></p>${more(g)}</div>` +
  `<p class="today">${md(g.today)}</p>` +
  `<p class="full">${md(g.full)}${g.docs.length ? `<span class="docs">GitHub Docs: ${g.docs.map((d) => `<a href="${esc(d.url)}" ${ext} title="${esc(d.label)}">${esc(d.short)}</a>`).join(", ")}</span>` : ""}</p></li>`;

const column = (c, hid) =>
  `<header class="col-h"><span class="num">${c.n}</span><h2 id="${hid}">${esc(c.title)}</h2><code>${esc(c.repo)}</code><span class="badge ${c.gaps ? "warn" : "good"}">${esc(c.badge)}</span></header>` +
  `<p class="lede">${md(c.lede)}</p>${flow(c.flow)}` +
  `<h3>${esc(c.heading)}</h3><ul class="rows${c.gaps ? " two" : ""}">${c.rows.map(row).join("")}</ul>` +
  (c.gaps ? `<h3>${esc(c.gaps_heading)}</h3><ul class="gaps"><li class="gaphead" aria-hidden="true"><span>The gap</span><span>Today</span><span>A full setup adds</span></li>${c.gaps.map(gap).join("")}</ul><p class="foot">${md(c.foot)}</p>` : "");
$("colA").innerHTML = column(D.student, "hA");
$("colB").innerHTML = column(D.platform, "hB");
$("readOn").textContent = D.read_on;
$("nAll").textContent = D.count;

// ----- the card of a row, and the list of every link -----
const ALL = [...D.student.rows, ...D.platform.rows, ...D.platform.gaps];
const dlg = $("dlg");
const linkList = (r) => '<ul class="links">' +
  r.links.map((l) => `<li>${link(l)}<code>${esc(l.path)}</code><span>lines ${l.lines}</span></li>`).join("") +
  r.docs.map((d) => `<li><a href="${esc(d.url)}" ${ext}>${esc(d.label)}</a><code>docs.github.com</code><span>GitHub Docs</span></li>`).join("") + "</ul>";
const open = (html) => { $("dlgB").innerHTML = html; if (!dlg.open) dlg.showModal(); $("dlgB").scrollTop = 0; };
const card = (id) => {
  const r = ALL.find((x) => x.id === id);
  if (!r) return;
  const state = r.state || "gap";
  open(`<p class="state"><i class="dot ${state}"></i>${STATE[state]}</p><h2 id="dlgT">${md(r.title)}</h2>` +
    (r.today ? `<p class="today"><b>Today</b>${md(r.today)}</p><p class="full"><b>A full setup adds</b>${md(r.full)}</p>` : "") +
    `<p>${md(r.text)}</p>${linkList(r)}`);
};
const everything = () => open(`<h2 id="dlgT">All ${D.count} links</h2><p>Each one opens the file on <code>main</code> of <code>llmops-databricks-2/course-assistant</code>, a private repository, at the lines read on ${D.read_on}; a later commit can move them.</p>` +
  [D.student, D.platform].map((c) => `<h3>${esc(c.title)}</h3>` + [...c.rows, ...(c.gaps || [])].map((r) => `<h4>${md(r.title)}</h4>${linkList(r)}`).join("")).join(""));
document.addEventListener("click", (e) => {
  if (e.target.closest("a")) return;
  const hit = e.target.closest("[data-id]");
  if (hit && !dlg.contains(hit)) card(hit.dataset.id);
  else if (e.target === dlg) dlg.close();          // a click on the backdrop
});
$("bAll").onclick = everything;
$("dlgX").onclick = () => dlg.close();

// ----- the light on a column -----
let focus = 0;
const light = (n) => { focus = [0, 1, 2].includes(Number(n)) ? Number(n) : 0; $("cloud").dataset.focus = focus; };
document.querySelectorAll(".col-h").forEach((h, i) => { h.title = "Click to put the light on this column"; h.onclick = () => light(focus === i + 1 ? 0 : i + 1); });
window.addEventListener("message", (e) => {
  const m = e.data;
  if (!m || m.type !== "part4" || typeof m.cmd !== "string") return;
  if (m.cmd === "scene") light(m.n);
  else if (m.cmd === "step") light((focus + 1) % 3);
});
document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || dlg.open) return;
  if (e.key === "1" || e.key === "2") light(Number(e.key));
  else if (e.key === "0") light(0);
  else if (e.key === "a") everything();
  else if (e.key.length > 1 && e.key !== "Tab" && e.key !== "Enter" && e.key !== "Shift" || /^[a-z]$/i.test(e.key)) post({event: "key", key: e.key, shiftKey: e.shiftKey});
});
light(new URLSearchParams(location.search).get("scene"));
window.__part4 = {light, card, everything, state: () => ({focus, links: D.count})};
post({event: "ready", ok: true});
