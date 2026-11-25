// ----- Part 4. dev → acc → prd: two full-step frames of the sibling module in part4/ -----
// The module is built separately. The deck talks to it by postMessage only (part4/README.md):
//   from the module: {type: "part4", event: "ready", ok}, {event: "scene-end", scene}, {event: "scene", scene},
//                    {event: "beat", scene}, and {event: "key", key, shiftKey} for a key it does not use itself
//   to the module:   {type: "part4", cmd: "scene", n}, {cmd: "play"}, {cmd: "pause"}, {cmd: "step"}
// A frame that never says "ready" and whose file was missing at build time shows a placeholder.
(() => {
  const LAST_SCENE = 2; // scene 1: straight to main; scene 2: the same change, done properly

  function slot(id, cfg, {title, file, what, drive}) {
    let frame = null, hole = null, layer = null, ready = false, active = false;
    const st = {scene: 1, ended: new Set()};
    const post = (msg) => { if (frame && frame.contentWindow) frame.contentWindow.postMessage(Object.assign({type: "part4"}, msg), "*"); };

    function placeholder(on) {
      if (!on) { if (hole) hole.hidden = true; return; }
      if (!hole) {
        hole = el(`<div class="hole"><div class="hole-c"><span class="eyebrow">Part 4 · placeholder</span><h3>${esc(title)}</h3>
<p>This step shows <code>${esc(file)}</code> in a frame that fills the step: ${what}</p>
<p>The file was not there when the deck was built, and the frame has not answered. Part 4 is built separately, in <code>part4/</code>.</p>
<div class="row"><button data-again>Try again</button><button data-anyway>Show the frame anyway</button></div></div></div>`);
        hole.addEventListener("click", (e) => {
          if (e.target.closest("[data-again]")) { ready = false; frame.src = cfg.src; }
          else if (e.target.closest("[data-anyway]")) placeholder(false);
        });
        layer.append(hole);
      }
      hole.hidden = false;
    }

    window.addEventListener("message", (e) => {
      const d = e.data;
      if (!frame || e.source !== frame.contentWindow || !d || d.type !== "part4") return;
      if (d.event === "ready") {
        // ok: false is the module saying it could not start (its own page says why): nothing to drive
        ready = d.ok !== false;
        placeholder(false);
        if (d.scene) st.scene = Number(d.scene);
        st.ended.clear();
      } else if (d.event === "scene-end") {
        st.scene = Number(d.scene) || st.scene;
        st.ended.add(st.scene);
      } else if (d.event === "scene" || d.event === "beat") {   // a scene chosen or replayed inside the frame
        st.scene = Number(d.scene) || st.scene;
        st.ended.delete(st.scene);
      } else if (d.event === "key") {
        // a key the focused module does not use: → after its last scene leaves part 4; Esc, F, N and the rest go to the deck
        if (!active) return;
        if (d.key === "ArrowRight" || d.key === "PageDown") Deck.next(true);
        else Deck.key(d.key, !!d.shiftKey);
      }
    });

    Deck.scene(id, {
      kind: "frame",
      skippable: !!drive,
      build(l) {
        layer = l;
        frame = el(`<iframe title="${esc(title)}" src="${esc(cfg.src)}" allow="fullscreen" allowfullscreen></iframe>`);
        layer.append(frame);
        if (!cfg.found) placeholder(true);
      },
      show() { active = true; },                                   // the lecturer starts the scene: → or its own Play
      hide() { active = false; if (ready && drive) post({cmd: "pause"}); },
      // →: past part 4 when its last scene has ended; into the next scene when this one has; else one beat of the scene
      onNext: !drive ? null : () => {
        if (!ready) return false;
        if (st.ended.has(st.scene)) {
          if (st.scene >= LAST_SCENE) return false;
          st.scene += 1;
          post({cmd: "scene", n: st.scene});
        }
        post({cmd: "step"});
        return true;
      },
    });
  }

  slot("p4scenes", BUILD.part4.scenes, {
    title: "dev → acc → prd for infrastructure", file: "part4/index.html", drive: true,
    what: "the animated story of one change pushed straight to production, then through a pull request, checks and three environments.",
  });
  slot("p4github", BUILD.part4.github, {
    title: "Our GitHub setup, close up", file: "part4/github.html", drive: false,
    what: "the still close-up of the course's GitHub setup, in two columns: the student template, and the platform's own repository.",
  });

  Deck.step({
    part: 4, scene: "p4scenes", title: "One change, two ways", kind: "animation, in a frame",
    notes: `<p><b>Scene 1</b>: one environment, a change straight to <code>main</code>. Users are at work; a developer thinks "let me change one small thing", commits to main, and while "Deploying…" runs, storage is deleted, permissions are revoked, compute burns, dashboards break. Let it stop on its frozen frame: one environment, no checks.</p>
<p><b>Scene 2</b>: the same change through a pull request. CI runs pre-commit, the unit tests and a dry run; a check catches the critical error; the fix goes in, a reviewer approves, and the change goes to dev, then acc, then prd after an approval. The users never notice.</p>
<p>Keys: with the deck holding the keys, → steps the running scene, starts scene 2 when scene 1 has ended, and leaves part 4 when scene 2 has ended. <b>Skip ›</b> in the bar, or Shift →, leaves at once. Click inside the frame and its own controls take the keys.</p>`,
  });
  Deck.step({
    part: 4, scene: "p4github", title: "Our GitHub setup, honestly", kind: "close-up, in a frame",
    notes: `<p>Scene 2 is the ideal. This still says which parts of it the course has today, in two columns.</p>
<p><b>The student template</b> has the real environments: three catalogs (<code>llmops_dev</code>, <code>llmops_acc</code>, <code>llmops_prd</code>), three deploy principals per student each with its own federation policy, three GitHub environments per repository, and <code>prd</code> needs the student's approval. Its deployment workflow is not in the template yet: deployment comes in a later lecture, so say "the environments are real, the pipeline that uses them is next".</p>
<p><b>The platform's own repository</b>, <code>course-assistant</code>, has no dev → acc → prd: one workspace, one bundle target (<code>dev</code>, in production mode), and a merge to <code>main</code> deploys straight into the cohort workspace. <code>main</code> has no branch protection and no rulesets (a Free organisation's private repository), and no environments. What stands in: pre-commit and pytest locally before every push, a pull request by convention, CI that a red check does not block, the evals check, integration tests by hand in scratch catalogs, dry runs, filtered runs, reconcile in report mode, and the paid-resource guard.</p>
<p>Name the gaps plainly: branch protection or rulesets, an acc target for the platform itself, and bundle validation on pull requests.</p>`,
  });
})();
