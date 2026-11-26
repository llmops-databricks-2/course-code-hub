// ---------- scene 2: the same change, done properly ----------
// Eight beats: a pull request, CI with a dry run, the plan that catches the error, the fix and the
// review, then dev, acc and, after an approval, prd. The users work in prd from the first second
// to the last and never see a failure.

// the plan of a dry run, as a card beside the CI tile
const planCard = (rows, foot, ok) => {
  const x = 302, w = 372, h = 50 + rows.length * 23 + 40, py = G.gh.checks[2].y;
  const y = Math.max(G.planTop, py - h + 36);                 // the pointer leaves the card near its foot
  const g = el("g", {}, L.top), inner = el("g", {}, g);
  el("rect", {x: x + 2, y: y + 5, width: w - 4, height: h, rx: 14, class: "sh1"}, inner);
  el("path", {d: `M${x + 1} ${py - 9}L${x - 12} ${py}L${x + 1} ${py + 9}Z`, class: "plan"}, inner);
  el("rect", {x, y, width: w, height: h, rx: 13, class: "plan"}, inner);
  el("path", {d: `M${x} ${py - 8}v16`, class: "plan-seam"}, inner);
  txt(x + 18, y + 30, "Dry run: the plan", "tt big", inner);
  const lines = rows.map(([sign, verb, what, bad], i) => {
    const ly = y + 60 + i * 23, lg = el("g", {opacity: 0}, inner);
    if (bad) el("rect", {x: x + 10, y: ly - 17, width: w - 20, height: 23, rx: 5, class: "plan-bad"}, lg);
    txt(x + 18, ly, sign, "mono b " + (bad ? "no" : "ink"), lg);
    txt(x + 38, ly, verb, "mono b " + (bad ? "no" : "ink"), lg);
    txt(x + 118, ly, what, "mono " + (bad ? "no" : "ink"), lg);
    return lg;
  });
  const fy = y + h - 16, fg = el("g", {opacity: 0}, inner);
  el("line", {x1: x + 14, y1: fy - 24, x2: x + w - 14, y2: fy - 24, stroke: "#e6e3de"}, fg);
  mark(fg, x + 27, fy - 6, ok, 9);
  txt(x + 44, fy, foot, "tt " + (ok ? "ok" : "no"), fg);
  gsap.set(inner, {opacity: 0, scale: 0.6, svgOrigin: `${x - 12} ${py}`});
  return {g: inner, lines, foot: fg, x, y, w, h};
};
// a dashed red outline: "this would be gone"
const wouldGo = (o, pad = 4) => el("rect", {x: o.x - pad, y: o.y - pad, width: o.w + 2 * pad, height: o.h + 2 * pad + (o.cyls ? 22 : 0), rx: 10, class: "would", opacity: 0}, L.fx);
const blink = (t, node) => { fade(t, node, 1, 0.12); tl.to(node, {opacity: 0.25, duration: 0.3, yoyo: true, repeat: 5, ease: "sine.inOut"}, t + 0.15); fade(t + 2.1, node, 0, 0.3); };

function scene2() {
  const [dana, fay, gus] = G.users, [dev, acc, prd] = G.stacks, gh = G.gh, st = gh.st, END = 54.5;
  gh.checks.forEach((c) => hidden(c.ok, c.no));
  hidden(gh.revOk, gh.rev2Ok, gh.gateOpen);
  [gh.rev, gh.rev2].forEach((a) => gsap.set(a.inner, {scale: 0, svgOrigin: `${a.cx} ${a.cy}`}));

  // the users, at work in prd the whole time
  const good = (u, l) => ubub(u, [l], "good");
  [[0.4, 1], [7.4, 0], [14.4, 1], [21.4, 0], [28.4, 1], [35.2, 0], [41.8, 1]].forEach(([t, b]) => happy(t, dana, prd, "uc", b ? good(dana, t > 20 ? "👍" : "works!") : null));
  [[2.6, 1], [9.8, 0], [17, 1], [24.2, 0], [31.4, 1], [38.4, 0], [44, 0]].forEach(([t, b]) => happy(t, fay, prd, "acl", b ? good(fay, t > 20 ? "🙂" : "👍") : null));
  [[4.8, 1], [12.2, 0], [19.6, 1], [27, 0], [34.2, 1], [40.8, 0]].forEach(([t, b]) => happy(t, gus, prd, "uc", b ? good(gus, t > 20 ? "👍" : "🙂") : null));

  // 1. a pull request
  let t = beat(0, "The same change, as a pull request", "Victor pushes a branch and opens a pull request. Nothing reaches the platform yet, and the users keep working.");
  say(t + 0.5, think(["same change,", "this time a", "pull request"]), 3.4);
  typing(t + 0.9, G.dev, 2.4);
  nod(t + 3.4, G.dev);
  let e = fly(t + 3.7, G.pPush, {col: FAM.dev, speed: 300});
  swap(e, st.none, st.open);
  pulse(e, gh.pr, FAM.dev, 0.9);
  ring(e, ...gh.repoIn, FAM.dev, 6, 22);

  // 2. CI: pre-commit, unit tests, a dry run
  t = beat(6.4, "CI runs", "pre-commit, the unit tests, then a dry run: the plan of what the change would do, read from the real environment and applied to nothing.");
  const runCheck = (at, c, secs, ok) => {
    fade(at, c.idle, 0, 0.1); fade(at, c.run, 1, 0.15);
    tl.to(c.spin, {rotation: "+=" + 360 * Math.max(1, Math.round(secs / 0.9)), duration: secs, ease: "none", svgOrigin: "0 0"}, at);
    if (ok == null) return at + secs;
    fade(at + secs, c.run, 0, 0.1); pop(at + secs, ok ? c.ok : c.no);
    return at + secs;
  };
  const [c0, c1, c2] = gh.checks;
  pulse(t + 0.2, gh.ci, FAM.token, 0.8);
  e = runCheck(t + 0.3, c0, 1.2, true);
  e = runCheck(e + 0.15, c1, 1.6, true);
  const tPlan = e + 0.15;
  // the dry run reads prd through the same door: authenticated, authorized, and it changes nothing
  e = deployTo(tPlan + 0.2, gh.ciOut, "uc", prd, prd.tab, {col: FAM.plat, speed: 900});
  hitTables(e, prd.tab);
  fly(e + 0.3, rev(dedupe([...G.pTrunk(gh.ciOut), [640, G.RAIL_Y], [640, 118], [G.uc.cx, 118], [G.uc.cx, G.BUS], [prd.gx, G.BUS], [prd.gx, prd.tab.cy], [prd.x + 4, prd.tab.cy]])), {col: FAM.plat, speed: 1100});

  // 3. the plan catches a critical error
  t = beat(13.4, "The plan catches it", "The small change would drop a schema, revoke a grant and replace a warehouse. The check fails, the pull request turns red, and production never noticed.");
  runCheck(tPlan, c2, t + 3.1 - tPlan, false);
  const bad = planCard([["~", "update", "job schedule"], ["-", "drop", "schema + 3 tables", 1], ["-", "revoke", "SELECT from analysts", 1], ["-", "replace", "SQL warehouse", 1]], "3 destructive changes", false);
  tl.to(bad.g, {opacity: 1, scale: 1, duration: 0.35, ease: "back.out(1.6)"}, t + 0.1);
  const ghosts = [null, wouldGo(prd.tab), wouldGo(prd.grant), wouldGo(prd.rack)];
  bad.lines.forEach((l, i) => {
    const tt = t + 0.6 + i * 0.62;
    fade(tt, l, 1, 0.18);
    if (i) { shake(tt, l, 3); blink(tt + 0.1, ghosts[i]); }
  });
  fade(t + 3.1, bad.foot, 1);
  shake(t + 3.1, gh.ci.g, 3);
  swap(t + 3.3, st.open, st.red);
  tl.to(gh.pr.face, {stroke: FAM.no, strokeWidth: 3, duration: 0.15}, t + 3.3);
  shake(t + 3.3, gh.pr.g, 3);
  say(t + 4.1, think(["Oh! This is so", "nice I took the", "LLMOps course!"], "good"), 4.2);
  nod(t + 4.2, G.dev); nod(t + 5.2, G.dev);

  // 4. the fix, green CI, a review
  t = beat(22.2, "Fixed, green, approved", "The fix goes in. The new plan destroys nothing, CI is green and a reviewer approves: the pull request merges.");
  tl.to(bad.g, {opacity: 0, scale: 0.8, duration: 0.25}, t);
  say(t + 0.2, think(["fix: rename,", "don't recreate"]), 2.3);
  typing(t + 0.5, G.dev, 1.6);
  e = fly(t + 2.3, G.pPush, {col: FAM.dev, speed: 300});
  swap(e, st.red, st.open);
  tl.to(gh.pr.face, {stroke: "#d9d6d1", strokeWidth: 1.5, duration: 0.2}, e);
  unpop(e, c0.ok); unpop(e, c1.ok); unpop(e, c2.no);
  [c0, c1, c2].forEach((c) => fade(e + 0.1, c.idle, 1, 0.12));
  e = runCheck(e + 0.4, c0, 0.7, true);
  e = runCheck(e + 0.1, c1, 0.9, true);
  e = runCheck(e + 0.1, c2, 1.1, true);
  const okCard = planCard([["~", "update", "job schedule"], ["~", "rename", "schema, in place"]], "0 destroyed", true);
  tl.to(okCard.g, {opacity: 1, scale: 1, duration: 0.3, ease: "back.out(1.6)"}, e - 0.3);
  okCard.lines.forEach((l, i) => fade(e + i * 0.2, l, 1, 0.15));
  fade(e + 0.45, okCard.foot, 1);
  tl.to(okCard.g, {opacity: 0, scale: 0.8, duration: 0.25}, e + 2.6);
  swap(e + 0.3, st.open, st.green);
  pulse(e + 0.3, gh.pr, FAM.ok, 1);
  tl.to(gh.rev.inner, {scale: 1, duration: 0.35, ease: "back.out(2.2)"}, e + 1);
  pop(e + 1.6, gh.revOk);
  swap(e + 1.7, st.green, st.ok);
  swap(e + 2.6, st.ok, st.merged);
  pulse(e + 2.6, gh.pr, FAM.user, 0.9);

  // 5, 6, 7. dev, then acc, then prd after an approval
  const chip = (at, c, done) => {
    tl.to(c.r, {fill: done ? "#e3f3ea" : "#fdf3d9", stroke: done ? FAM.ok : FAM.token, strokeWidth: 2.5, duration: 0.2}, at);
    tl.to(c.t, {fill: done ? INK_OK : "#7a5a12", duration: 0.2}, at);
    if (!done) ring(at, c.cx, c.cy, FAM.token, 14, 30);
  };
  const deploy = (at, s, first) => {
    const env = s.env, c = gh.chips[env.name];
    chip(at, c, false);
    tl.to(env.pill, {stroke: FAM.dev, strokeWidth: 2.5, duration: 0.2}, at);
    env.cells.forEach((cl) => tl.to(cl, {stroke: FAM.dev, strokeWidth: 2.5, duration: 0.2}, at));
    let go = at + 0.2;
    if (first) go = signIn(at + 0.2, gh.out, {hold: 2.3}) - 0.5;
    const a1 = deployTo(go, gh.out, "acl", s, s.dash);
    const a2 = deployTo(go + 0.3, gh.out, "acl", s, s.rack);
    const a3 = deployTo(go + 0.6, gh.out, "uc", s, s.tab);
    improve(a1, s.dash);
    update(a2, s.rack); lightRack(a2, s.rack, 0.7);
    hitTables(a3, s.tab);
    const done = Math.max(a1, a2, a3);
    swap(done, env.v1, env.v2);
    // the smoke check: one real request through the new version
    const pts = dedupe([...G.pTrunk(gh.out), [640, G.RAIL_Y], [640, 118], [G.uc.cx, 118], [G.uc.cx, G.BUS], [s.gx, G.BUS], [s.gx, s.tab.cy], [s.x + 4, s.tab.cy]]);
    const ps = Math.max(go + 0.95, done + 0.15 - pathLen(pts) / 900), at2 = times(ps, pts, 900);
    fly(ps, pts, {col: FAM.data, speed: 900});
    pulse(at2[5], G.auth, FAM.ok, 0.3); pulse(at2[6], G.uc, FAM.ok, 0.3);
    const land = at2[at2.length - 1];
    pulse(land - 0.3, s.grant, FAM.token, 0.3); lightRack(land - 0.2, s.rack, 0.5); hitTables(land, s.tab);
    fade(land + 0.15, env.smoke, 1);
    ring(land + 0.15, env.x + env.w - 60, 177, FAM.ok, 8, 22);
    chip(land + 0.4, c, true);
    tl.to(env.pill, {stroke: FAM.ok, duration: 0.3}, land + 0.4);
    env.cells.forEach((cl) => tl.to(cl, {stroke: "rgba(80,111,160,.3)", strokeWidth: 1.2, duration: 0.4}, land + 0.6));
    return land + 0.6;
  };
  t = beat(Math.max(31, e + 3.4), "Deploy to dev", "The pipeline signs in as dev's own deploy principal: authenticated, authorized, deployed. A smoke check passes.");
  e = deploy(t + 0.2, dev, true);
  t = beat(e + 0.5, "Then acc", "The same change, the next environment, its own deploy principal. The smoke check passes again.");
  e = deploy(t + 0.2, acc);
  t = beat(e + 0.5, "prd, after an approval", "The prd job waits for a person. Approved, it deploys, and the smoke check passes while the users keep working.");
  tl.fromTo(gh.gateRing, {attr: {r: 14}, opacity: 0.9}, {attr: {r: 27}, opacity: 0, duration: 0.8, repeat: 2, ease: "power2.out", immediateRender: false}, t + 0.1);
  tl.to(gh.note, {fill: "#7a5a12", duration: 0.2}, t + 0.1);
  tl.to(gh.rev2.inner, {scale: 1, duration: 0.35, ease: "back.out(2.2)"}, t + 1.3);
  pop(t + 2, gh.rev2Ok);
  unpop(t + 2.2, gh.gate); pop(t + 2.3, gh.gateOpen);
  tl.to(gh.note, {fill: INK_OK, duration: 0.2}, t + 2.3);
  e = deploy(t + 2.6, prd);
  tl.to(gh.rev2.inner, {scale: 0, duration: 0.2}, e); unpop(e, gh.rev2Ok);

  // 8. the users only see the result
  t = beat(e + 0.6, "So much better", "The users only see the result. The change was wrong once, in a pull request, where it cost nothing.");
  [fay, dana, gus].forEach((u, i) => { bshow(t + 0.3 + i * 0.55, ubub(u, ["Oh! The system became", "so much better!"], "good")); nod(t + 0.4 + i * 0.55, u); flash(t + 0.3 + i * 0.55, u); });
  stamp(t + 2.6, ["PULL REQUEST · CHECKS", "DEV → ACC → PRD"], FAM.ok);
  return Math.max(END, t + 5.6);
}
