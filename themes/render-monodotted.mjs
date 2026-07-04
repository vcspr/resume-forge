#!/usr/bin/env node
/**
 * render-monodotted.mjs — "Monospace Dotted" résumé theme (French design language,
 * English labels). Monospace EVERYTHING incl. a large mono name; large mono contact
 * block at right; 1.5px dotted horizontal rules; far-left bold-italic uppercase
 * section labels (EXPERIENCE / EDUCATION / SKILLS / REFERENCES) with content laid
 * out in two columns; each entry has a bold-italic uppercase header + bold-italic
 * dates + regular mono description lines. Monochrome black on white.
 *
 * Shares the same overlay contract as the other bridge themes (baseResume + tailored
 * overlay), so it renders any variant.
 * Usage: node bridge/render-monodotted.mjs --in <overlay.json> --name <slug> [--outdir output] [--no-pdf]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(__dirname, "..");
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const flag = (n) => argv.includes(n);

const inPath = opt("--in");
const name = opt("--name", "tailored").replace(/[^\w.-]+/g, "_");
const OUTDIR = resolve(PROJECT, opt("--outdir", "output"));
const BASE = resolve(PROJECT, opt("--base", "data/base.json"));
const wantPdf = !flag("--no-pdf");

const loadBase = (f) => JSON.parse(readFileSync(f, "utf8"));
const merge = (b, o) => { const out = Array.isArray(b) ? [...b] : { ...b }; for (const [k, v] of Object.entries(o || {})) out[k] = (v && typeof v === "object" && !Array.isArray(v) && b[k] && typeof b[k] === "object" && !Array.isArray(b[k])) ? merge(b[k], v) : v; return out; };
const esc = (s) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clean = (a) => (a || []).map((x) => (x || "").trim()).filter(Boolean);
const splitRole = (r) => { const p = (r || "").split(" · "); return p.length > 1 ? { title: p.slice(0, -1).join(" · "), loc: p[p.length - 1] } : { title: r || "", loc: "" }; };

const d = merge(loadBase(BASE), inPath ? JSON.parse(readFileSync(resolve(inPath), "utf8")) : {});

/* ── Contact block (right side of header, large mono) ── */
const contactBits = [];
if (d.portfolio) contactBits.push(`<a href="https://${esc(d.portfolio)}">${esc(d.portfolio)}</a>`);
if (d.phone) contactBits.push(esc(d.phone));
if (d.email) contactBits.push(esc(d.email));
if (d.linkedin) contactBits.push(esc(d.linkedin));

/* ── Experience entries (split across the two content columns) ── */
const expJobs = (d.experience || []).filter((j) => j.org || j.role).map((j) => {
  const { title, loc } = splitRole(j.role);
  const sub = [title, loc].filter(Boolean).join(" · ");
  return `<div class="entry">
    <div class="erow"><span class="eorg">${esc(j.org)}</span><span class="edates">${esc(j.dates)}</span></div>
    ${sub ? `<div class="erole">${esc(sub)}</div>` : ""}
    ${clean(j.bullets).map((b) => `<div class="eline">${esc(b)}</div>`).join("")}
  </div>`;
});
const half = Math.ceil(expJobs.length / 2);
const expColA = expJobs.slice(0, half).join("");
const expColB = expJobs.slice(half).join("");
const expBody = `<div class="cols"><div class="col">${expColA}</div><div class="col">${expColB}</div></div>`;

/* ── Education (left column) + Skills-as-Education-mate is separate; edu fills 2 cols ── */
const eduEntries = (d.education || []).filter((e) => e.title || e.org).map((e) => {
  const parts = (e.detail || "").split(" · ");
  const dates = parts[0] || "", extra = parts.slice(1).join(" · ");
  return `<div class="entry">
    <div class="erow"><span class="eorg">${esc(e.org)}</span>${dates ? `<span class="edates">${esc(dates)}</span>` : ""}</div>
    <div class="erole">${esc(e.title)}</div>
    ${extra ? `<div class="eline">${esc(extra)}</div>` : ""}
  </div>`;
});
const eduBody = `<div class="cols"><div class="col">${eduEntries.join("")}</div><div class="col"></div></div>`;

/* ── Skills: Expertise list (col A) + Tools list (col B), each a bold-italic group head ── */
const listGroup = (head, items) =>
  `<div class="entry"><div class="ghead">${head}</div>${clean(items).map((t) => `<div class="eline">${esc(t.replace(/\s*·\s*/g, ", "))}</div>`).join("")}</div>`;
const skillsBody = (clean(d.expertise).length || clean(d.tools).length)
  ? `<div class="cols"><div class="col">${clean(d.expertise).length ? listGroup("Expertise", d.expertise) : ""}</div><div class="col">${clean(d.tools).length ? listGroup("Tools", d.tools) : ""}</div></div>`
  : "";

/* ── References (two columns) or Worked With fallback ── */
const refEntries = (d.showReferences ? (d.references || []) : []).filter((r) => r.name).map((r) =>
  `<div class="entry"><div class="eorg">${esc(r.name)}</div>${r.title ? `<div class="erole">${esc(r.title)}</div>` : ""}${r.contact ? `<div class="eline">${esc(r.contact)}</div>` : ""}</div>`
);
let refLabel = "", refBody = "";
if (refEntries.length) {
  refLabel = "References";
  const rHalf = Math.ceil(refEntries.length / 2);
  refBody = `<div class="cols"><div class="col">${refEntries.slice(0, rHalf).join("")}</div><div class="col">${refEntries.slice(rHalf).join("")}</div></div>`;
} else if (clean(d.workedWith).length) {
  refLabel = "Worked With";
  const ww = clean(d.workedWith);
  const wHalf = Math.ceil(ww.length / 2);
  const wcol = (arr) => arr.map((w) => `<div class="eline">${esc(w)}</div>`).join("");
  refBody = `<div class="cols"><div class="col">${wcol(ww.slice(0, wHalf))}</div><div class="col">${wcol(ww.slice(wHalf))}</div></div>`;
}

const section = (label, body) =>
  `<section class="sec"><div class="label">${label}</div><div class="body">${body}</div></section>`;

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.name)} — Résumé</title>
<style>
@page { size: letter; margin: 0.42in 0.5in; }
* { margin:0; padding:0; box-sizing:border-box; }
:root {
  --ink:#000; --paper:#fff;
  --mono:"SF Mono","SFMono-Regular",Menlo,Monaco,"Courier New",Courier,monospace;
}
html,body { background:var(--paper); }
body {
  font-family:var(--mono); color:var(--ink); font-size:7pt; line-height:1.42;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
/* ── Header: large mono name + location (left), large mono contact (right) ── */
.header { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; padding-bottom:9px; }
.idblock { min-width:0; }
.name { font-family:var(--mono); font-weight:700; font-size:18pt; letter-spacing:-0.02em; line-height:1.02; text-transform:none; }
.loc { font-family:var(--mono); font-size:8pt; margin-top:4px; letter-spacing:0.01em; }
.contact { text-align:right; font-family:var(--mono); font-size:8pt; line-height:1.45; white-space:nowrap; }
.contact .pw { font-weight:700; font-size:9.5pt; letter-spacing:-0.01em; display:block; margin-bottom:2px; }
.contact a { color:var(--ink); text-decoration:none; }
.contact .cline { display:block; }
/* ── Dotted rules ── */
.rule { border:0; border-top:1.5px dotted var(--ink); margin:0; }
/* ── Full-width profile paragraph ── */
.profile { font-family:var(--mono); font-size:7.2pt; line-height:1.5; padding:8px 0; }
/* ── Section grid: far-left bold-italic uppercase label + 2-col body ── */
.sec { display:grid; grid-template-columns:108px 1fr; gap:0 20px; padding:9px 0; }
.label {
  font-family:var(--mono); font-weight:700; font-style:italic; text-transform:uppercase;
  font-size:8pt; letter-spacing:0.04em; line-height:1.2; padding-top:1px;
}
.body { min-width:0; }
.cols { display:grid; grid-template-columns:1fr 1fr; gap:0 22px; }
.col { min-width:0; }
.col:empty { display:none; }
/* ── Entries: bold-italic uppercase org/title header + bold-italic dates + plain lines ── */
.entry { margin-bottom:8px; }
.entry:last-child { margin-bottom:0; }
.erow { display:flex; justify-content:space-between; align-items:baseline; gap:8px; line-height:1.22; }
.eorg { font-weight:700; font-style:italic; text-transform:uppercase; font-size:7.4pt; letter-spacing:0.01em; }
.edates { font-weight:700; font-style:italic; font-size:7pt; white-space:nowrap; }
.erole { font-weight:700; font-style:italic; text-transform:uppercase; font-size:7pt; letter-spacing:0.01em; margin:1px 0 2px; }
.ghead { font-weight:700; font-style:italic; text-transform:uppercase; font-size:7.6pt; letter-spacing:0.02em; margin-bottom:3px; }
.eline { font-weight:400; font-size:6.9pt; line-height:1.4; margin-bottom:1px; }
</style></head><body>
<div class="header">
  <div class="idblock">
    <div class="name">${esc(d.name)}</div>
    ${d.location ? `<div class="loc">${esc(d.location)}</div>` : ""}
  </div>
  <div class="contact">
    <span class="pw">Portfolio</span>
    ${contactBits.map((c) => `<span class="cline">${c}</span>`).join("\n    ")}
  </div>
</div>
<hr class="rule">
<div class="profile">${esc(d.profile)}</div>
<hr class="rule">
${section("Experience", expBody)}
<hr class="rule">
${section("Education", eduBody)}
${skillsBody ? `<hr class="rule">\n${section("Skills", skillsBody)}` : ""}
${refBody ? `<hr class="rule">\n${section(refLabel, refBody)}` : ""}
</body></html>`;

mkdirSync(OUTDIR, { recursive: true });
const stem = join(OUTDIR, `Resume_${name}_monodotted`);
writeFileSync(`${stem}.html`, html);
console.log(`✓ ${stem}.html`);
if (wantPdf) {
  const { chromium } = await import("playwright");
  const b = await chromium.launch();
  try {
    const p = await b.newPage();
    await p.setContent(html, { waitUntil: "networkidle" });
    const h = await p.evaluate(() => document.body.scrollHeight);
    await p.pdf({ path: `${stem}.pdf`, format: "Letter", printBackground: true, preferCSSPageSize: true });
    console.log(`✓ ${stem}.pdf  (~${h}px)`);
  } finally { await b.close(); }
}
