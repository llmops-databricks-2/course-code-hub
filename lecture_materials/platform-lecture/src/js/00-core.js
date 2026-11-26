// ----- helpers, the data the build inlines, the link and icon shorthands -----
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

// the research file of part 2 (src/data/ui-as-code.json) and what the build knows
const UI_AS_CODE = /*UI_AS_CODE*/[];
const BUILD = /*BUILD*/{};

// Every link into course-assistant goes through U() or L(): build.py refuses a path that the
// facts (src/data/course-assistant-links.json) do not list.
const GH = "https://github.com/llmops-databricks-2/course-assistant/blob/main/";
const U = (path) => GH + path;
const L = (path, label, cls = "") => `<a class="gh ${cls}" href="${GH + path}" target="_blank" rel="noopener">${label}</a>`;
const ext = (url, label, cls = "") => `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener">${label}</a>`;

// sprites: dbx-* are the official Databricks product icons, mk-* the Cauchy sprite's marks
const ic = (id, cls = "") => `<svg class="ic ${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;

// line glyphs drawn for this deck (20 x 20, stroke only): the mock's sidebar and a few cards
const GLYPH = {
  plus: "M10 4v12M4 10h12",
  folder: "M2.5 5.5h5l1.5 2h8.5v8h-15z",
  clock: "M10 3a7 7 0 1 0 0 14a7 7 0 0 0 0-14M10 6v4l3 2",
  book: "M4 3h9l3 3v11H4zM7 8h6M7 11h6M7 14h4",
  flow: "M3 4h5v4H3zM12 12h5v4h-5zM5.5 8v6h6.5",
  cloud: "M6 15a3.5 3.5 0 0 1-.5-7a5 5 0 0 1 9.6 1.2A3 3 0 0 1 14.5 15z",
  compass: "M10 3a7 7 0 1 0 0 14a7 7 0 0 0 0-14M12.5 7.5l-1.5 3.5l-3.5 1.5l1.5-3.5z",
  store: "M3 8l1.5-4h11L17 8M4 8v8h12V8M3 8h14M8 16v-4h4v4",
  chart: "M3 17V3M3 17h14M7 14v-4M11 14V7M15 14v-6",
  spark: "M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6zM15.5 13.5l.6 1.4l1.4.6l-1.4.6l-.6 1.4l-.6-1.4l-1.4-.6l1.4-.6z",
  bell: "M5 14V9a5 5 0 0 1 10 0v5l1.5 1.5h-13zM8.5 17.5h3",
  wand: "M4 16L14 6M12.5 4.5l3 3M5 4v3M3.5 5.5h3M15 12v3M13.5 13.5h3",
  sql: "M3 4h14v12H3zM6 8l2.5 2L6 12M10.5 12.5h3.5",
  file: "M5 3h7l3 3v11H5zM12 3v3h3M7.5 10h5M7.5 13h5",
  history: "M4 10a6.5 6.5 0 1 1 2 4.7M4 10V6.5M4 10h3.5M10.5 7v3.2l2.3 1.5",
  drum: "M4 5.5c0-1.4 2.7-2.5 6-2.5s6 1.1 6 2.5v9c0 1.4-2.7 2.5-6 2.5s-6-1.1-6-2.5zM4 5.5C4 6.9 6.7 8 10 8s6-1.1 6-2.5M4 10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5",
  runs: "M4 5h8M4 10h12M4 15h6M15 3.5l2 1.5l-2 1.5z",
  ingest: "M10 3v9M6.5 8.5L10 12l3.5-3.5M3.5 13v3.5h13V13",
  chat: "M3 4h14v9H9l-4 3.5V13H3z",
  robot: "M5 7h10v8H5zM10 7V4M8 11h.01M12 11h.01M3 10v3M17 10v3",
  gate: "M3 10h4M13 10h4M7 5h6v10H7zM9 8.5h2M9 11.5h2",
  flask: "M8 3h4M8.5 3v5L4.5 15.5a1 1 0 0 0 .9 1.5h9.2a1 1 0 0 0 .9-1.5L11.5 8V3M6.5 13h7",
  grid: "M3.5 3.5h5v5h-5zM11.5 3.5h5v5h-5zM3.5 11.5h5v5h-5zM11.5 11.5h5v5h-5z",
  cube: "M10 2.5l6.5 3.7v7.6L10 17.5l-6.5-3.7V6.2zM3.5 6.2L10 10l6.5-3.8M10 10v7.5",
  serve: "M3 5h14v4H3zM3 11h14v4H3zM6 7h.01M6 13h.01",
  coin: "M10 3a7 7 0 1 0 0 14a7 7 0 0 0 0-14M12.5 7.8c-.4-.8-1.3-1.3-2.5-1.3c-1.5 0-2.5.8-2.5 1.9c0 2.4 5 1 5 3.4c0 1.1-1 1.9-2.5 1.9c-1.2 0-2.1-.5-2.5-1.3M10 5v1.5M10 13.7V15",
  tag: "M3 3.5h6.5l7 7l-6 6l-7-7zM6.5 7h.01",
  nodes: "M10 3.5a2 2 0 1 0 0 4a2 2 0 0 0 0-4M4.5 12.5a2 2 0 1 0 0 4a2 2 0 0 0 0-4M15.5 12.5a2 2 0 1 0 0 4a2 2 0 0 0 0-4M9 7.3L5.5 12.6M11 7.3l3.5 5.3M6.5 14.5h7",
  users: "M7.5 9a3 3 0 1 0 0-6a3 3 0 0 0 0 6M2.5 17c0-3 2.2-5 5-5s5 2 5 5M13.5 9a2.5 2.5 0 1 0 0-5M14.5 12c2 .5 3.2 2.3 3.2 4.6",
  shield: "M10 2.5l6 2.3v4.7c0 3.7-2.5 6.6-6 8c-3.5-1.4-6-4.3-6-8V4.8zM7.3 10l2 2l3.5-4",
  gear: "M10 7a3 3 0 1 0 0 6a3 3 0 0 0 0-6M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4",
  key: "M7 9.5a3.5 3.5 0 1 0 0 .01M10.5 9.5H17M14.5 9.5v3M17 9.5V12",
  repeat: "M4 8a6 6 0 0 1 10.5-2.5M16 4v3.5h-3.5M16 12a6 6 0 0 1-10.5 2.5M4 16v-3.5h3.5",
  split: "M4 4v5a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v1M4 4l-1.5 2M4 4l1.5 2M10 12v4",
  eye: "M2.5 10c2-3.7 4.5-5.5 7.5-5.5s5.500 1.800 7.500 5.500c-2 3.700-4.500 5.500-7.500 5.500s-5.500-1.800-7.500-5.500M10 7.500a2.500 2.500 0 1 0 0 5a2.500 2.500 0 0 0 0-5",
  lock: "M5 9h10v8H5zM7 9V6.5a3 3 0 0 1 6 0V9M10 12v2",
  ghost: "M4 17V9a6 6 0 0 1 12 0v8l-2-1.500l-2 1.500l-2-1.500l-2 1.500l-2-1.500zM8 9h.01M12 9h.01",
  doc: "M5 3h10v14H5zM8 7h4M8 10h4M8 13h2",
  check: "M4 10.500l4 4l8-9",
  rocket: "M10 2.500c3 2 4 5 3.500 9h-7C6 7.500 7 4.500 10 2.500M6.500 11.500L4 14h3M13.500 11.500L16 14h-3M8.500 15v2.500M11.500 15v2.500M10 6.500v2",
  mail: "M3 5h14v10H3zM3 5l7 6l7-6",
  table: "M3 4h14v12H3zM3 8h14M3 12h14M8 4v12",
};
const gl = (name, cls = "") => `<svg class="gl ${cls}" viewBox="0 0 20 20" aria-hidden="true"><path d="${GLYPH[name] || GLYPH.doc}"/></svg>`;

// ----- a small syntax highlighter for the three forms: HCL, Python, and an HTTP request with a JSON body -----
const HL_RX = {
  hcl: /(?<c>#[^\n]*)|(?<s>"(?:[^"\\\n]|\\.)*")|(?<k>\b(?:resource|data|variable|true|false|null)\b)|(?<n>\b\d+(?:\.\d+)?\b)|(?<a>\b[a-z_][a-z0-9_]*(?=\s*=[^=]))|(?<f>\b[a-z_][a-z0-9_]*(?=\s*\{))/g,
  py: /(?<c>#[^\n]*)|(?<s>"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(?<k>\b(?:from|import|for|in|True|False|None)\b)|(?<n>\b\d+(?:\.\d+)?\b)|(?<f>\b[A-Za-z_][A-Za-z0-9_]*(?=\())|(?<a>\b[a-z_][a-z0-9_]*(?==))/g,
  http: /(?<k>^(?:GET|POST|PUT|PATCH|DELETE)\b)|(?<p>\/api\/[^\s]*)|(?<a>"(?:[^"\\\n]|\\.)*"(?=\s*:))|(?<s>"(?:[^"\\\n]|\\.)*")|(?<n>-?\b\d+(?:\.\d+)?\b)|(?<f>\b(?:true|false|null)\b)/gm,
};
function highlight(code, lang) {
  let out = "", last = 0;
  for (const m of code.matchAll(HL_RX[lang])) {
    out += esc(code.slice(last, m.index));
    const kind = Object.keys(m.groups).find((g) => m.groups[g] !== undefined);
    out += `<span class="t-${kind}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(code.slice(last));
}
