#!/usr/bin/env node
/**
 * render-indigo.mjs — "Indigo Storyteller" résumé theme (FULL COLOR; tinted
 * lavender/periwinkle page with saturated indigo ink; single-column flowing
 * sections with bold colored headings; pipe-delimited entry lines; italic
 * pull-quote profile; 3-column footer mapping Expertise / Tools / Worked With).
 * Friendly rounded sans, personable/narrative tone. Reproduces a reference
 * design. A theme alongside render-editorial.mjs (Editorial) et al.
 *
 * Reads the same overlay (baseResume + tailored overlay), so it renders any variant.
 * Usage: node bridge/render-indigo.mjs --in <overlay.json> --name <slug> [--outdir output] [--no-pdf]
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

// Contact line under the name (inline, separated by gaps)
const contactBits = [];
if (d.email) contactBits.push(esc(d.email));
if (d.phone) contactBits.push(esc(d.phone));
if (d.portfolio) contactBits.push(`<a href="https://${esc(d.portfolio)}">${esc(d.portfolio)}</a>`);
if (d.linkedin) contactBits.push(`<a href="https://${esc(d.linkedin)}">${esc(d.linkedin)}</a>`);

// WORK: pipe-delimited header line "dates | role | org", bullets flow beneath.
const expEntries = (d.experience || []).filter((j) => j.org || j.role).map((j) => {
  const { title } = splitRole(j.role);
  const head = [j.dates, title, j.org].filter(Boolean).map((p, i) =>
    i === 1 ? `<em>${esc(p)}</em>` : `<b>${esc(p)}</b>`).join('<span class="pipe">|</span>');
  return `<div class="entry">
    <div class="eline">${head}</div>
    ${clean(j.bullets).map((b) => `<div class="bullet">${esc(b)}</div>`).join("")}
  </div>`;
}).join("");

// EDUCATION: "title | org | dates" pipe lines (detail = "dates · extra").
const eduEntries = (d.education || []).filter((e) => e.title || e.org).map((e) => {
  const parts = (e.detail || "").split(" · ");
  const dates = parts[0] || "", extra = parts.slice(1).join(" · ");
  const segs = [];
  if (e.title) segs.push(`<b>${esc(e.title)}</b>`);
  if (e.org) segs.push(`<span class="muted">${esc(e.org)}</span>`);
  if (extra) segs.push(`<span class="muted">${esc(extra)}</span>`);
  if (dates) segs.push(`<b>${esc(dates)}</b>`);
  return `<div class="eduline">${segs.join('<span class="pipe">|</span>')}</div>`;
}).join("");

// References (optional) — rendered as compact pipe lines in their own section.
const refEntries = (d.showReferences ? (d.references || []) : []).filter((r) => r.name).map((r) => {
  const segs = [`<b>${esc(r.name)}</b>`];
  if (r.title) segs.push(`<span class="muted">${esc(r.title)}</span>`);
  if (r.contact) segs.push(`<span class="muted">${esc(r.contact)}</span>`);
  return `<div class="eduline">${segs.join('<span class="pipe">|</span>')}</div>`;
}).join("");

const sectionH = (label) => `<h2 class="sec">${label}</h2>`;

// Footer: 3 columns. Languages←Expertise, Skills←Tools, Software←Worked With.
const fcol = (label, items) => items.length
  ? `<div class="fcol"><div class="flabel">${label}</div>${items.map((x) => `<div>${esc(x)}</div>`).join("")}</div>`
  : "";
const expertiseItems = clean(d.expertise);
const toolItems = clean(d.tools).map((t) => t.replace(/\s*·\s*/g, ", "));
const workedWithItems = clean(d.workedWith);

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.name)} — Résumé</title>
<style>
@page { size: letter; margin: 0; }
* { margin:0; padding:0; box-sizing:border-box; }
html { background:#E7E5F7; }
body {
  background:#E7E5F7; color:#352F8C;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
  font-family:"SF Pro Rounded","Nunito","Varela Round",-apple-system,"Helvetica Neue",Arial,sans-serif;
  font-size:8.2pt; line-height:1.32;
  padding:0.54in 0.66in 0.4in;
}
a { color:#352F8C; text-decoration:none; }
b { font-weight:800; }

/* Header */
.name { font-size:17pt; font-weight:800; letter-spacing:0.01em; text-transform:uppercase; line-height:1.02; }
.headline { font-size:9pt; font-weight:600; margin-top:4px; }
.contact { font-size:8pt; margin-top:3px; }
.contact span.sep { opacity:0.5; padding:0 7px; }
.profile { font-style:italic; font-size:8.6pt; line-height:1.38; margin-top:10px; max-width:62%; }
.mark { float:right; font-size:13pt; opacity:0.85; margin:-2px 2px 0 0; }

/* Sections */
.sec { font-size:12.5pt; font-weight:800; text-transform:uppercase; letter-spacing:0.01em; margin:14px 0 6px; }
.entry { margin-bottom:7px; }
.eline { margin-bottom:1.5px; }
.eline em { font-style:italic; font-weight:700; }
.pipe { opacity:0.45; padding:0 6px; font-weight:400; }
.bullet { padding-left:11px; text-indent:-11px; }
.bullet::before { content:"• "; }
.eduline { margin-bottom:2.5px; }
.muted { opacity:0.82; font-weight:500; }

/* Footer — 3 columns */
.footer { display:grid; grid-template-columns:1fr 1fr 1fr; gap:0 22px; margin-top:14px; }
.flabel { font-weight:800; text-transform:uppercase; letter-spacing:0.02em; margin-bottom:3px; font-size:8.4pt; }
.fcol { font-size:8pt; line-height:1.42; }
</style></head><body>
<div class="mark">✦</div>
<div class="name">${esc(d.name)}</div>
<div class="headline">${esc(d.headline)}</div>
<div class="contact">${contactBits.join('<span class="sep">·</span>')}</div>
${d.profile ? `<div class="profile">${esc(d.profile)}</div>` : ""}
${expEntries ? sectionH("Work") + expEntries : ""}
${eduEntries ? sectionH("Education") + `<div class="entry">${eduEntries}</div>` : ""}
${refEntries ? sectionH("References") + `<div class="entry">${refEntries}</div>` : ""}
<div class="footer">
  ${fcol("Expertise", expertiseItems)}
  ${fcol("Tools", toolItems)}
  ${fcol("Worked With", workedWithItems)}
</div>
</body></html>`;

mkdirSync(OUTDIR, { recursive: true });
const stem = join(OUTDIR, `Resume_${name}_indigo`);
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
