// ---------- the people ----------
// Copied from lecture_materials/day-on-the-platform/src/js/05-people.js and the vignette of its
// 10-world.js (drawn for that page, from no illustration pack), so both pages show the same
// people at the same desks. Added here: a tint over the laptop's screen, for the red of a refused
// request, and avatar(), a bust in a disc for the reviewer. The developer of this scene is
// Victor, drawn here for this page: short hair with a sideburn, broad shoulders, a shirt with a
// collar, in the warm colour of developer traffic.
// Eight calm, flat figures, drawn here and taken from no illustration pack: a head shape with hair,
// shoulders, two arms. No eyes and no mouth: the turn of the head towards the laptop says enough.
// The coordinates are the vignette's (10-world.js): the desk's back edge is y = 84 and the laptop
// stands on the right, so everyone is drawn turned to the right; the users' column mirrors them.
// Clothing: the developers wear the warm family of their traffic, the users the violet one.
const LOOK = {
  victor: {skin: "#e8b89a", hair: "#3b2a20", style: "short", shirt: "#c9705f", collar: "#a8503f", pose: "type", build: "broad"},
  bo: {skin: "#a9714b", hair: "#241a14", style: "crop", shirt: "#dcae5a", pose: "mug", glasses: true},
  chen: {skin: "#f0c9a8", hair: "#1f1a18", style: "side", shirt: "#a8766a", pose: "chin"},
  dana: {skin: "#7a4a32", hair: "#2a1c16", style: "curls", shirt: "#6b5fb0", pose: "type"},
  eli: {skin: "#f1cdb0", hair: "#9a5a38", style: "crop", shirt: "#8f84c7", pose: "chin", beard: true},
  fay: {skin: "#c98f6b", hair: "#3a2619", style: "bob", shirt: "#57508f", pose: "type", glasses: true},
  gus: {skin: "#e2ad8c", hair: "#b98a54", style: "quiff", shirt: "#7d8fc4", pose: "mug"},
  tess: {skin: "#f3d6c0", hair: "#b5b1ab", style: "long", shirt: "#a7a0d8", pose: "type"},
};
// the head is an ellipse centred on (75, 28), 15 wide and 17 high, and each style is a cap over it;
// HEAD then enlarges head and hair together, so the figures read as people, not as mannequins
const HEAD = "translate(75 30) scale(1.14) translate(-75 -28)";
const CAP = "M60 32C57.5 15 66 8.5 76 9C85 9.5 91 15 90.8 23C86.5 18.5 80 16.5 73 18C67.5 19.5 64.5 25 64.5 32Z";
const FRINGE = "M59 31C56 12 67 6.5 78 7.5C88.5 8.5 93 16 91.5 24C86 21.5 81 18.5 75 18C70 18.5 67.5 23 67 31Z";
const HAIR = {
  crop: {front: (g, c) => el("path", {d: CAP, fill: c}, g)},
  short: {front: (g, c) => { el("path", {d: CAP, fill: c}, g); el("path", {d: "M66.3 29.5h3.2v5.6c-1.9.2-3.2-1-3.2-2.9z", fill: c}, g); }},
  bun: {front: (g, c) => { el("circle", {cx: 61, cy: 10.5, r: 7, fill: c}, g); el("path", {d: CAP, fill: c}, g); }},
  side: {front: (g, c) => el("path", {d: "M60 32C56.5 13 67 6.5 78 7.5C88.5 8.5 93.5 16 91.5 26C87 21.5 81 20 74.5 20.5C68.5 21 65 26 64.5 32Z", fill: c}, g)},
  quiff: {front: (g, c) => { el("path", {d: CAP, fill: c}, g); el("ellipse", {cx: 81, cy: 11.5, rx: 10, ry: 6, transform: "rotate(-10 81 11.5)", fill: c}, g); }},
  bob: {front: (g, c) => el("path", {d: "M59.5 30C56 12 67 6.5 78 7.5C88.5 8.5 93 16 91.5 24C86 21.5 81 18.5 75 18C70 18.5 67.5 23 67 29C66.8 36 66.5 42 64.5 47.5C60 48.5 56.5 45 57 40C58 37 59 34 59.5 30Z", fill: c}, g)},
  long: {
    back: (g, c) => el("path", {d: "M58.5 26C56.5 38 55.5 45 53.5 51C52.5 55 55 58 59 58H66.5C68 51 68.5 42 67.5 32Z", fill: c}, g),
    front: (g, c) => el("path", {d: FRINGE, fill: c}, g),
  },
  curls: {
    back: (g, c) => [[58.5, 40, 8.5], [60, 48, 6.5]].forEach(([cx, cy, r]) => el("circle", {cx, cy, r, fill: c}, g)),
    front: (g, c) => [[61, 21, 9.5], [66, 13, 9], [75, 9.5, 9], [84, 11, 8.5], [90, 17, 6.5], [57.5, 30.5, 8]].forEach(([cx, cy, r]) => el("circle", {cx, cy, r, fill: c}, g)),
  },
};
// the person's upper body, drawn before the desk, which hides the rest; returns the head, which nods
const personBust = (g, who) => {
  const k = LOOK[who], hair = HAIR[k.style];
  if (hair.back) hair.back(el("g", {transform: HEAD}, g), k.hair);
  const broad = k.build === "broad";
  el("path", {d: broad ? "M31 92C31 73 39 62.5 55 59.5L66.5 57H83.5L96 59.5C109 62.5 115 73 115 92Z" : "M38 92C38 75 44 64.5 57 61.5L67 59H83L91 61.5C102 64.5 108 75 108 92Z", fill: k.shirt}, g);
  el("rect", broad ? {x: 67.8, y: 44, width: 14.4, height: 19, rx: 6.5, fill: k.skin} : {x: 69.5, y: 44, width: 11, height: 18, rx: 5.5, fill: k.skin}, g);
  if (k.collar) el("path", {d: "M66.5 57l8.5 9.5l-5.2 4.2l-6.3-10.5zM83.5 57l-8.5 9.5l5.2 4.2l6.3-10.5z", fill: k.collar}, g);
  const nod = el("g", {}, g), head = el("g", {transform: HEAD}, nod);
  el("ellipse", {cx: 75, cy: 28, rx: 15, ry: 17, fill: k.skin}, head);
  el("ellipse", {cx: 90, cy: 31, rx: 2.4, ry: 3, fill: k.skin}, head);              // the nose: which way they look
  if (k.beard) el("path", {d: "M64.5 34C65 43.5 70 46.5 76.5 45.8C83.5 45 89 41 90 33.5C86.5 37 81.5 38.5 76.5 38.3C71.5 38 67.5 36.5 64.5 34Z", fill: k.hair}, head);
  hair.front(head, k.hair);
  el("ellipse", {cx: 64, cy: 33.5, rx: 2.5, ry: 3.6, fill: k.skin}, head);            // an ear
  if (k.glasses) el("path", {d: "M76 25.5h6a1.6 1.6 0 0 1 1.6 1.6v3a1.6 1.6 0 0 1-1.6 1.6h-6a1.6 1.6 0 0 1-1.6-1.6v-3a1.6 1.6 0 0 1 1.6-1.6zM86.6 25.5h3.6v6.2h-3.6a1.4 1.4 0 0 1-1.4-1.4v-3.4a1.4 1.4 0 0 1 1.4-1.4zM83.6 28h1.6M74.4 28L65 29.5", class: "specs"}, head);
  return nod;
};
// the arms, drawn over the desk and the laptop's base: hands on the keys, on a mug, or under the chin
const personArms = (g, who) => {
  const k = LOOK[who];
  const arm = (d, hx, hy) => {
    el("path", {d, class: "arm arm-sh"}, g);
    const a = el("path", {d, class: "arm", stroke: k.shirt}, g);
    if (k.build === "broad") a.style.strokeWidth = 13.2;
    el("circle", {cx: hx, cy: hy, r: 5.4, fill: k.skin}, g);
  };
  if (k.pose === "mug") {
    el("rect", {x: 62, y: 89, width: 13, height: 15, rx: 2, class: "mug"}, g);
    el("path", {d: "M75 93c5 0 5 8 0 8", class: "mug-h"}, g);
    arm("M48 75C42 85 41 94 46 98L55 100.5", 58, 100.8);
  } else arm("M48 75C42 87 42 98 52 101L84 105", 87.5, 105.3);
  if (k.pose === "chin") arm("M99 75C108 84 113 91 112 96L97 58", 95.5, 53.5);
  else arm("M99 75C108 83 112 90 120 94L137.5 99.3", 141, 100);
};

const SCREEN = {
  code: (g, c) => [[12, 14, 30, c], [18, 22, 44, "#9aa3b5"], [18, 30, 36, "#9aa3b5"], [24, 38, 28, "#3f9b6b"], [18, 46, 40, "#9aa3b5"], [12, 54, 22, c]].forEach(([x, y, w, col]) => el("rect", {x, y: y - 2, width: w, height: 4, rx: 2, fill: col}, g)),
  nb: (g, c) => { [12, 34].forEach((y) => el("rect", {x: 10, y, width: 80, height: 18, rx: 3, fill: "#fff", stroke: "#c6d1e6"}, g)); [[16, 19, 34, c], [16, 25, 50, "#9aa3b5"], [16, 41, 44, "#9aa3b5"], [16, 47, 26, "#3f9b6b"]].forEach(([x, y, w, col]) => el("rect", {x, y: y - 1.5, width: w, height: 3, rx: 1.5, fill: col}, g)); },
  chat: (g, c) => { el("rect", {x: 10, y: 12, width: 48, height: 16, rx: 8, fill: c}, g); el("rect", {x: 36, y: 34, width: 54, height: 20, rx: 8, fill: "#fff", stroke: "#c6d1e6"}, g); [[42, 41, 40], [42, 47, 28]].forEach(([x, y, w]) => el("rect", {x, y: y - 1.5, width: w, height: 3, rx: 1.5, fill: "#9aa3b5"}, g)); },
  chart: (g, c) => { [[14, 26], [30, 16], [46, 34], [62, 22], [78, 30]].forEach(([x, hh]) => el("rect", {x, y: 54 - hh, width: 10, height: hh, rx: 2, fill: c}, g)); el("rect", {x: 10, y: 54, width: 80, height: 2, fill: "#9aa3b5"}, g); },
  sql: (g, c) => { el("rect", {x: 10, y: 10, width: 80, height: 12, rx: 3, fill: c, opacity: 0.85}, g); for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) el("rect", {x: 10 + k * 28, y: 26 + r * 8, width: 24, height: 5, rx: 1.5, fill: r % 2 ? "#c6d1e6" : "#dfe7f4"}, g); },
};
// a person behind a desk with an open laptop: the base lies on the desk, the screen leans back and
// is turned half to the person and half to us, so both see what is on it
const vignette = (parent, x, y, s, flip, who, kind, colour) => {
  const outer = el("g", {transform: `translate(${x},${y}) scale(${s})`}, parent);
  const m = flip ? el("g", {transform: "translate(240,0) scale(-1,1)"}, outer) : outer;
  el("ellipse", {cx: 115, cy: 152, rx: 124, ry: 8, fill: "#1a1a1a", opacity: 0.07}, m);
  const head = personBust(el("g", {}, m), who);
  el("rect", {x: 8, y: 130, width: 9, height: 22, class: "desk-leg"}, m);
  el("rect", {x: 213, y: 130, width: 9, height: 22, class: "desk-leg"}, m);
  el("rect", {x: 6, y: 131, width: 218, height: 13, class: "desk-panel"}, m);
  el("polygon", {points: "18,84 212,84 236,124 -6,124", class: "desk-top"}, m);
  el("rect", {x: -6, y: 124, width: 242, height: 9, rx: 2, class: "desk-front"}, m);
  // the laptop's lead to the edge of the desk, where the rail to the laptop setup takes over
  if (!flip) el("line", {x1: 190, y1: 106, x2: 226, y2: 106, class: "lead"}, m);
  const glow = el("polygon", {points: "159,35 154,83 96,80 86,20", fill: "url(#gGlow)", class: "glow"}, m);
  el("ellipse", {cx: 164, cy: 112, rx: 44, ry: 9, fill: "#1a1a1a", opacity: 0.1}, m);
  el("polygon", {points: "124,100 166,123 166,127 124,104", class: "lap-side"}, m);
  el("polygon", {points: "166,123 196,106 196,110 166,127", class: "lap-side"}, m);
  el("polygon", {points: "124,100 166,123 196,106 154,83", class: "lap-base"}, m);
  const kb = el("g", {transform: "matrix(0.42,0.23,0.5,-0.2833,124,100)"}, m);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) el("rect", {x: 9 + c * 9.2, y: 26 + r * 9, width: 7, height: 6, rx: 1, class: "lap-key"}, kb);
  el("rect", {x: 38, y: 8, width: 24, height: 12, rx: 2, class: "lap-key"}, kb);
  personArms(el("g", {}, m), who);
  el("polygon", {points: "159,35 201,58 204,56 162,33", class: "lap-edge"}, m);
  el("polygon", {points: "154,83 196,106 201,58 159,35", class: "lap-lid"}, m);
  const scr = el("g", {transform: "matrix(0.42,0.23,-0.078,0.75,159,35)"}, m);
  el("rect", {x: 5, y: 5, width: 90, height: 54, rx: 3, class: "lap-scr"}, scr);
  SCREEN[kind](scr, colour);
  const flash = el("rect", {x: 5, y: 5, width: 90, height: 54, rx: 3, fill: "#fff", opacity: 0}, scr);
  const alarm = el("g", {opacity: 0}, scr);
  el("rect", {x: 5, y: 5, width: 90, height: 54, rx: 3, fill: "#f6d0cd"}, alarm);
  el("path", {d: "M38 20l24 24M62 20l-24 24", fill: "none", stroke: "#d64545", "stroke-width": 7, "stroke-linecap": "round"}, alarm);
  // where the laptop's lead starts, in the world: the right corner of its base
  return {bust: head, glow, flash, alarm, px: Math.round(x + (flip ? 240 - 196 : 196) * s), py: Math.round(y + 106 * s)};
};
// a bust in a disc: the reviewer, who has no desk in this scene
let avatarN = 0;
const avatar = (parent, cx, cy, r, who) => {
  const id = "av" + ++avatarN, g = el("g", {}, parent), inner = el("g", {}, g);
  el("circle", {cx, cy, r}, el("clipPath", {id}, g));
  el("circle", {cx, cy, r, fill: "#f4eee2"}, inner);
  const k = (r * 2) / 76, body = el("g", {"clip-path": "url(#" + id + ")"}, inner);
  personBust(el("g", {transform: "translate(" + (cx - 73 * k) + "," + (cy - 44 * k) + ") scale(" + k + ")"}, body), who);
  el("circle", {cx, cy, r, fill: "none", stroke: "#fff", "stroke-width": 2.5}, inner);
  el("circle", {cx, cy, r: r + 1.2, fill: "none", stroke: "#cfc8ba", "stroke-width": 1.2}, inner);
  return {g, inner, cx, cy, r};
};
