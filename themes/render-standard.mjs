#!/usr/bin/env node
/**
 * render-standard.mjs — "Standard" two-column résumé theme (classic clean recruiter layout:
 * full-width header with bold name + right-aligned contact, a WIDE left Experience column
 * and a NARROW right rail for Education / Skills / Worked With, hairline rules under each
 * section heading, monochrome Helvetica/Arial on white). A 4th theme alongside
 * render-editorial.mjs, render-vic-style.mjs (APEX mono) and render-ats.mjs (plain ATS).
 *
 * Reads the same overlay (baseResume + tailored overlay), so it renders any variant.
 * Usage: node bridge/render-standard.mjs --in <overlay.json> --name <slug> [--outdir output] [--no-pdf]
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

/* ============================== THEME: STANDARD TWO-COLUMN ============================== */

// Header contact lines (right-aligned, stacked). Portfolio first, then email, phone, linkedin.
const contactLines = [];
if (d.portfolio) contactLines.push(`<a href="https://${esc(d.portfolio)}">${esc(d.portfolio)}</a>`);
if (d.email) contactLines.push(esc(d.email));
if (d.phone) contactLines.push(esc(d.phone));
if (d.linkedin) contactLines.push(`<a href="https://${esc(d.linkedin)}">${esc(d.linkedin)}</a>`);
if (d.location) contactLines.push(esc(d.location));

// Experience: org/title/dates stacked at left edge of each entry, description to the right.
const expEntries = (d.experience || []).filter((j) => j.org || j.role).map((j) => {
  const { title, loc } = splitRole(j.role);
  const meta = [j.dates, loc].filter(Boolean).map((m) => esc(m)).join("<br>");
  const bullets = clean(j.bullets);
  return `<div class="exp-entry">
    <div class="exp-left">
      <div class="exp-org">${esc(j.org)}</div>
      ${title ? `<div class="exp-title">${esc(title)}</div>` : ""}
      ${meta ? `<div class="exp-meta">${meta}</div>` : ""}
    </div>
    <div class="exp-right">${bullets.map((b) => `<div class="exp-bullet">${esc(b)}</div>`).join("")}</div>
  </div>`;
}).join("");

// Education (right rail): degree title in bold, org + detail beneath.
const eduEntries = (d.education || []).filter((e) => e.title || e.org).map((e) => {
  const parts = (e.detail || "").split(" · ");
  const dates = parts[0] || "", extra = parts.slice(1).join(" · ");
  return `<div class="rail-entry">
    <div class="rail-org">${esc(e.org)}</div>
    ${e.title ? `<div class="rail-line">${esc(e.title)}</div>` : ""}
    ${dates ? `<div class="rail-meta">${esc(dates)}</div>` : ""}
    ${extra ? `<div class="rail-meta">${esc(extra)}</div>` : ""}
  </div>`;
}).join("");

// Skills (right rail): Expertise + Tools as compact labelled groups.
const skillGroups = [];
if (clean(d.expertise).length) skillGroups.push(`<div class="skill-group"><div class="skill-label">Expertise</div><div class="skill-body">${clean(d.expertise).join(", ")}</div></div>`);
if (clean(d.tools).length) skillGroups.push(`<div class="skill-group"><div class="skill-label">Tools</div><div class="skill-body">${clean(d.tools).map((t) => t.replace(/\s*·\s*/g, ", ")).join(", ")}</div></div>`);

// Worked With (right rail): plain comma list.
const workedWith = clean(d.workedWith);

// References (right rail, only if showReferences): name bold, title + contact beneath.
const refEntries = (d.showReferences ? (d.references || []) : []).filter((r) => r.name).map((r) =>
  `<div class="rail-entry">
    <div class="rail-org">${esc(r.name)}</div>
    ${r.title ? `<div class="rail-meta">${esc(r.title)}</div>` : ""}
    ${r.contact ? `<div class="rail-meta">${esc(r.contact)}</div>` : ""}
  </div>`
).join("");

const railSection = (label, inner) => inner ? `<div class="rail-section"><div class="rail-heading">${label}</div>${inner}</div>` : "";

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.name)} — Résumé</title>
<style>
@page { size: letter; margin: 0.5in 0.55in; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:"Helvetica Neue", Helvetica, Arial, sans-serif; color:#111; font-size:8.6pt; line-height:1.34; -webkit-print-color-adjust:exact; print-color-adjust:exact; }

/* Header: bold name left, contact stack right */
.header { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; padding-bottom:16px; }
.name { font-size:25pt; font-weight:700; letter-spacing:-0.01em; line-height:1; }
.headline { font-size:9pt; color:#555; margin-top:6px; }
.contact { text-align:right; font-size:8.2pt; color:#333; line-height:1.5; white-space:nowrap; }
.contact a { color:#333; text-decoration:none; }

/* Body grid: wide left (Experience) + narrow right rail */
.body { display:grid; grid-template-columns:1fr 1.9in; gap:0 28px; }

/* Section heading with hairline rule beneath */
.col-heading, .rail-heading { font-size:7.6pt; font-weight:700; text-transform:uppercase; letter-spacing:0.07em; color:#222; padding-bottom:3px; border-bottom:0.75pt solid #bdbdbd; margin-bottom:9px; }

/* Experience (left column) */
.exp-entry { display:grid; grid-template-columns:1.55in 1fr; gap:0 16px; align-items:start; margin-bottom:13px; }
.exp-entry:last-child { margin-bottom:0; }
.exp-org { font-weight:700; font-size:8.7pt; }
.exp-title { font-size:8.4pt; color:#222; margin-top:0.5px; }
.exp-meta { font-size:7.7pt; color:#777; margin-top:3px; line-height:1.4; }
.exp-right { padding-top:0.5px; }
.exp-bullet { position:relative; padding-left:11px; margin-bottom:3px; }
.exp-bullet:last-child { margin-bottom:0; }
.exp-bullet::before { content:""; position:absolute; left:1px; top:0.45em; width:2.5px; height:2.5px; border-radius:50%; background:#222; }

/* Right rail sections */
.rail-section { margin-bottom:15px; }
.rail-section:last-child { margin-bottom:0; }
.rail-entry { margin-bottom:9px; }
.rail-entry:last-child { margin-bottom:0; }
.rail-org { font-weight:700; font-size:8.5pt; }
.rail-line { font-size:8.3pt; color:#222; margin-top:1px; }
.rail-meta { font-size:7.8pt; color:#777; margin-top:1.5px; line-height:1.38; }
.skill-group { margin-bottom:8px; }
.skill-group:last-child { margin-bottom:0; }
.skill-label { font-weight:700; font-size:8.3pt; margin-bottom:1.5px; }
.skill-body { font-size:8.1pt; color:#333; }
.rail-list { font-size:8.1pt; color:#333; }
</style></head><body>
<div class="header">
  <div class="id"><div class="name">${esc(d.name)}</div>${d.headline ? `<div class="headline">${esc(d.headline)}</div>` : ""}</div>
  <div class="contact">${contactLines.join("<br>")}</div>
</div>
<div class="body">
  <div class="col-main">
    ${expEntries ? `<div class="col-heading">Experience</div>${expEntries}` : ""}
  </div>
  <div class="col-rail">
    ${railSection("Education", eduEntries)}
    ${railSection("Skills", skillGroups.join(""))}
    ${workedWith.length ? railSection("Worked With", `<div class="rail-list">${workedWith.map(esc).join(", ")}</div>`) : ""}
    ${railSection("References", refEntries)}
  </div>
</div>
</body></html>`;

mkdirSync(OUTDIR, { recursive: true });
const stem = join(OUTDIR, `Resume_${name}_standard`);
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
