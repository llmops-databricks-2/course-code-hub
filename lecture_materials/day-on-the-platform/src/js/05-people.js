// ---------- the people ----------
// Eight calm, flat figures, drawn here and taken from no illustration pack: a head shape with hair,
// shoulders, two arms. No eyes and no mouth: the turn of the head towards the laptop says enough.
// The coordinates are the vignette's (10-world.js): the desk's back edge is y = 84 and the laptop
// stands on the right, so everyone is drawn turned to the right; the users' column mirrors them.
// Clothing: the developers wear the warm family of their traffic, the users the violet one.
const LOOK = {
  ada: {skin: "#e8b89a", hair: "#4a2f23", style: "bun", shirt: "#c9705f", pose: "type"},
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
  el("path", {d: "M38 92C38 75 44 64.5 57 61.5L67 59H83L91 61.5C102 64.5 108 75 108 92Z", fill: k.shirt}, g);
  el("rect", {x: 69.5, y: 44, width: 11, height: 18, rx: 5.5, fill: k.skin}, g);
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
    el("path", {d, class: "arm", stroke: k.shirt}, g);
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
