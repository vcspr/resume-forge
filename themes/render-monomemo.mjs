#!/usr/bin/env node
/**
 * render-monomemo.mjs — "Mono Memo" résumé theme (monospace developer résumé:
 * Courier/SF-Mono/Menlo body + labels, paired with a contrasting bold serif name;
 * left-margin small-caps grey section labels in a gutter, content in the wide right
 * body; right-aligned contact block; warm white paper; monochrome). A theme alongside
 * render-editorial.mjs (clean sans) and render-vic-style.mjs (APEX mono).
 *
 * Reads the same overlay (baseResume + tailored overlay), so it renders any variant.
 * Usage: node bridge/render-monomemo.mjs --in <overlay.json> --name <slug> [--outdir output] [--no-pdf]
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

// ── Contact block (right-aligned, monospace) ──────────────────────────────────
const contactBits = [];
if (d.portfolio) contactBits.push(`<a href="https://${esc(d.portfolio)}">${esc(d.portfolio)}</a>`);
if (d.email) contactBits.push(esc(d.email));
if (d.phone) contactBits.push(esc(d.phone));
if (d.linkedin) contactBits.push(esc(d.linkedin));

// ── Education ─────────────────────────────────────────────────────────────────
const eduEntries = (d.education || []).filter((e) => e.title || e.org).map((e) => {
  const parts = (e.detail || "").split(" · ");
  const dates = parts[0] || "", extra = parts.slice(1).join(" · ");
  return `<div class="job">
    <div class="jobhead"><span class="title">${esc(e.title)}</span>${e.org ? ` <span class="at">@</span> <span class="org">${esc(e.org)}</span>` : ""}${dates ? `<span class="dates">, ${esc(dates)}</span>` : ""}</div>
    ${extra ? `<div class="line">${esc(extra)}</div>` : ""}
  </div>`;
}).join("");

// ── Experience (inline "Title @ Company, dates" + achievement lines) ──────────
const expEntries = (d.experience || []).filter((j) => j.org || j.role).map((j) => {
  const { title, loc } = splitRole(j.role);
  return `<div class="job">
    <div class="jobhead"><span class="title">${esc(title)}</span>${j.org ? ` <span class="at">@</span> <span class="org">${esc(j.org)}</span>` : ""}${j.dates ? `<span class="dates">, ${esc(j.dates)}</span>` : ""}</div>
    ${loc ? `<div class="loc">${esc(loc)}</div>` : ""}
    ${clean(j.bullets).map((b) => `<div class="line"><span class="b">▸</span>${esc(b)}</div>`).join("")}
  </div>`;
}).join("");

// ── References ────────────────────────────────────────────────────────────────
const refEntries = (d.showReferences ? (d.references || []) : []).filter((r) => r.name).map((r) =>
  `<div class="ref"><span class="title">${esc(r.name)}</span>${r.title ? ` <span class="rmeta">— ${esc(r.title)}</span>` : ""}${r.contact ? ` <span class="rmeta">· ${esc(r.contact)}</span>` : ""}</div>`
).join("");

// ── Section wrapper (left grey gutter label + right body) ─────────────────────
const section = (label, inner) => `<section class="sec"><div class="label">${label}</div><div class="body">${inner}</div></section>`;
const proseSection = (label, text) => `<section class="sec"><div class="label">${label}</div><div class="body"><div class="prose">${esc(text)}</div></div></section>`;

// ── Tools / expertise as a small multi-column grid ────────────────────────────
const grid = (items) => `<div class="grid">${items.map((t) => `<div class="gitem">${esc(t.replace(/\s*·\s*/g, "  ·  "))}</div>`).join("")}</div>`;
const skillsSection = (label, expertise, tools) => {
  const cols = [];
  if (expertise.length) cols.push(`<div class="skillcol"><div class="skhead">Expertise</div>${grid(expertise)}</div>`);
  if (tools.length) cols.push(`<div class="skillcol"><div class="skhead">Tools</div>${grid(tools)}</div>`);
  return `<section class="sec"><div class="label">${label}</div><div class="body"><div class="skills">${cols.join("")}</div></div></section>`;
};

const expertise = clean(d.expertise);
const tools = clean(d.tools);

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.name)} — Résumé</title>
<style>
@page { size: letter; margin: 0.46in 0.52in; }
* { margin:0; padding:0; box-sizing:border-box; }
:root {
  --ink:#1c1a17; --soft:#55504a; --faint:#8a847c; --line:#d8d2c8;
  --paper:#ffffff; --mono:"SF Mono","SFMono-Regular",Menlo,Monaco,"Courier New",Courier,monospace;
}
html,body { background:var(--paper); }
body {
  font-family:var(--mono); color:var(--ink); font-size:7.5pt; line-height:1.36;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
/* ── Header: bold serif name + right-aligned mono contact ── */
.header { display:flex; justify-content:space-between; align-items:flex-end; gap:24px; padding-bottom:6px; }
.name { font-family:Georgia,"Times New Roman",serif; font-weight:700; font-size:22pt; letter-spacing:-0.01em; line-height:0.96; color:var(--ink); }
.headline { font-family:var(--mono); font-size:7.8pt; color:var(--soft); margin-top:5px; letter-spacing:0.02em; }
.contact { text-align:right; font-size:7.3pt; color:var(--soft); line-height:1.55; white-space:nowrap; }
.contact a { color:var(--ink); text-decoration:none; }
.rule { border:0; border-top:1.4px solid var(--ink); margin-bottom:9px; }
/* ── Section grid: grey gutter label (left) + body (right) ── */
.sec { display:grid; grid-template-columns:94px 1fr; gap:0 22px; padding:6px 0; border-top:1px solid var(--line); }
.sec:first-of-type { border-top:0; padding-top:0; }
.label {
  font-size:6.9pt; letter-spacing:0.14em; text-transform:uppercase; color:var(--faint);
  font-weight:400; padding-top:1.5px;
}
.body { min-width:0; }
.prose { font-size:7.5pt; color:var(--ink); }
/* ── Job entries: inline Title @ Company, dates + achievement lines ── */
.job { margin-bottom:5.5px; }
.job:last-child { margin-bottom:0; }
.jobhead { font-size:7.7pt; line-height:1.28; }
.jobhead .title { font-weight:700; color:var(--ink); }
.jobhead .at { color:var(--faint); }
.jobhead .org { font-weight:700; color:var(--ink); }
.jobhead .dates { color:var(--soft); font-weight:400; }
.loc { color:var(--faint); font-size:7.2pt; margin:0 0 2px; }
.line { padding-left:13px; text-indent:-13px; margin-bottom:1.5px; color:var(--soft); }
.line .b { color:var(--ink); display:inline-block; width:13px; text-indent:0; }
/* ── Skills grid (multi-column) ── */
.skills { display:grid; grid-template-columns:1fr 1fr; gap:0 26px; }
.skillcol { min-width:0; }
.skhead { font-weight:700; color:var(--ink); font-size:7.7pt; margin-bottom:3px; }
.grid { display:flex; flex-direction:column; gap:0.5px; }
.gitem { color:var(--soft); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
/* ── References ── */
.ref { margin-bottom:2px; font-size:7.6pt; }
.ref .title { font-weight:700; color:var(--ink); }
.ref .rmeta { color:var(--soft); }
</style></head><body>
<div class="header">
  <div><div class="name">${esc(d.name)}</div><div class="headline">${esc(d.headline)}</div></div>
  <div class="contact">${contactBits.join("<br>")}</div>
</div>
<hr class="rule">
${(d.profileShort || d.profile) ? proseSection("Profile", d.profileShort || d.profile) : ""}
${(expertise.length || tools.length) ? skillsSection("Workflow", expertise, tools) : ""}
${expEntries ? section("Experience", expEntries) : ""}
${eduEntries ? section("Education", eduEntries) : ""}
${refEntries ? section("References", refEntries) : ""}
</body></html>`;

mkdirSync(OUTDIR, { recursive: true });
const stem = join(OUTDIR, `Resume_${name}_monomemo`);
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
