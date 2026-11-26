// ---------- scene 1: one environment, a change straight to main ----------
// Eight beats. The users' requests take the full path every time (door, identity and auth, an
// authorizer, compute, storage); the deployment takes the same door and passes the same checks,
// which is the point: the deploy principal may make the change, so only a process in front of it
// can stop it.
function scene1() {
  const [dana, fay, gus] = G.users, [s0, s1, s2] = G.stacks, gh = G.gh;
  hidden(gh.commit);

  // 1. happy users
  beat(0, "Happy users", "Requests fly in and answers come back. Each one is authenticated at identity and auth, then authorized by Unity Catalog or the workspace ACLs, before compute touches storage.");
  happy(0.3, fay, s1, "acl", ubub(fay, ["👍"], "good"));
  happy(1.2, dana, s0, "uc", ubub(dana, ["works!"], "good"));
  happy(2.2, gus, s2, "uc", ubub(gus, ["🙂"], "good"));
  happy(6.9, fay, s1, "acl");
  happy(7.6, dana, s0, "uc", ubub(dana, ["👍"], "good"));
  happy(9.2, gus, s2, "uc");
  happy(13.2, fay, s1, "acl", ubub(fay, ["🙂"], "good"));
  happy(13.6, dana, s0, "uc");
  happy(15.6, gus, s2, "uc", ubub(gus, ["👍"], "good"));

  // 2. one small thing: straight to main
  let t = beat(6.4, "One small thing", "Victor commits straight to main. No pull request, no check and no approval stand between his laptop and production.");
  say(t + 0.3, think(["let me change", "one small", "thing…"]), 3.6);
  typing(t + 0.8, G.dev, 2.4);
  nod(t + 3.3, G.dev);
  let e = fly(t + 3.5, G.pPush, {col: FAM.dev, speed: 300});
  pop(e, gh.commit);
  ring(e, 216, gh.repo.y + 54, FAM.dev, 8, 24);
  pulse(e, gh.repo, FAM.dev, 0.8);
  gh.skips.forEach((s, i) => {
    const ts = e + 0.5 + i * 0.42;
    shake(ts, s.g, 3);
    tl.to(s.x, {stroke: FAM.no, duration: 0.15}, ts);
    tl.to(s.r, {stroke: FAM.no, duration: 0.15}, ts);
    tl.to(s.t, {fill: INK_NO, duration: 0.15}, ts);
  });
  const tDeploy = e + 1.9, END = 44;
  swap(tDeploy, gh.idle, gh.busy);
  pulse(tDeploy, gh.act, FAM.dev, 1);
  turn(tDeploy, gh.spin, END - tDeploy);
  tl.to(gh.bar, {attr: {width: 214}, duration: END - tDeploy, ease: "none"}, tDeploy);

  // 3. Deploying…: the pipeline signs in, and is allowed
  t = beat(12.8, "Deploying…", "The pipeline signs in. It is authenticated, then authorized: the deploy principal may change all of this, so the platform does what it is told.");
  signIn(t + 0.3, gh.out, {hold: 3});

  // 4. storage is deleted, tables vanish
  t = beat(17.8, "Storage is deleted", "The change drops the schemas, and the tables vanish with them. The next query finds nothing.");
  [s0, s1, s2].forEach((s, i) => dropTables(deployTo(t + 0.1 + i * 0.4, gh.out, "uc", s, s.tab), s.tab));
  e = request(t + 1.9, dana, s0, {fail: "authz", tag: "table not found"});
  fade(e, dana.alarm, 1); shake(e, dana.bust, 3);
  const b1 = ubub(dana, ["?!"], "bad");
  bshow(e + 0.05, b1);

  // 5. permissions are revoked
  t = beat(23.6, "Permissions are revoked", "The grants are revoked too. Unity Catalog now refuses the same people it allowed a minute ago.");
  [s0, s1, s2].forEach((s, i) => revoke(deployTo(t + 0.1 + i * 0.4, gh.out, "uc", s, s.grant), s.grant));
  e = request(t + 1.1, gus, s2, {fail: "authz", tag: "access denied"});
  fade(e, gus.alarm, 1); shake(e, gus.bust, 3);
  bshow(e + 0.05, ubub(gus, ["access denied"], "bad"));

  // 6. compute goes up in flames
  t = beat(29.6, "Compute goes up in flames", "The compute is torn down and replaced while queries are running on it.");
  let lit = 0;
  [s2, s1, s0].forEach((s, i) => { lit = deployTo(t + 0.1 + i * 0.3, gh.out, "acl", s, s.rack); burn(lit, s.rack, END); });
  bhide(lit + 0.3, b1);
  bshow(lit + 0.5, ubub(dana, ["🔥"], "bad"));
  shake(lit + 0.5, dana.bust, 3);

  // 7. dashboards break
  t = beat(34.4, "Dashboards break", "A dashboard is only as alive as its warehouse, its grants and its tables.");
  [s1, s2, s0].forEach((s, i) => breakDash(deployTo(t + 0.1 + i * 0.3, gh.out, "acl", s, s.dash), s.dash));
  e = request(t - 0.4, fay, s1, {via: "acl", fail: "dash", tag: "query failed"});
  fade(e, fay.alarm, 1); shake(e, fay.bust, 3);
  bshow(e + 0.05, ubub(fay, ["my dashboard!"], "bad"));

  // 8. the frozen frame
  t = beat(Math.max(40, e + 0.9), "One environment, no checks", "Nothing stood between one small change and production: no review, no dry run, no environment to break first.");
  bshow(t + 0.3, think(["…oops"], "bad"));
  shake(t + 0.3, G.dev.bust, 3);
  stamp(t + 1.1, ["ONE ENVIRONMENT,", "NO CHECKS"], FAM.no);
  return END;
}
