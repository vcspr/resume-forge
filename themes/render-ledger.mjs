#!/usr/bin/env node
/**
 * render-ledger.mjs — "Oversized-Name Ledger" résumé theme. A MASSIVE bold uppercase
 * display name (heavy grotesque, tight tracking, wraps to 2 lines) anchors the top with
 * contact stacked beneath; the body is a strict 3-column ledger per row:
 *   LEFT  = section label (small bold UPPERCASE: WORK EXPERIENCE / EDUCATION / SKILLS)
 *   MID   = org + italic dates
 *   RIGHT = italic role title + description.
 * Full-width hairline rules separate rows. Strict monochrome black on white.
 *
 * Reads the same overlay (baseResume + tailored overlay), so it renders any variant.
 * Usage: node bridge/render-ledger.mjs --in <overlay.json> --name <slug> [--outdir output] [--no-pdf]
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

const contactBits = [];
if (d.email) contactBits.push(esc(d.email));
if (d.portfolio) contactBits.push(`<a href="https://${esc(d.portfolio)}">${esc(d.portfolio)}</a>`);
if (d.phone) contactBits.push(esc(d.phone));
if (d.linkedin) contactBits.push(esc(d.linkedin));
if (d.location) contactBits.push(esc(d.location));

// Build ledger rows. The section LABEL only prints on the first row of each section
// (matching the reference where WORK EXPERIENCE / EDUCATION sits once, left-aligned).
const row = (label, mid, right, first) =>
  `<div class="row${first ? " row-first" : ""}">
    <div class="lbl">${first ? label : ""}</div>
    <div class="mid">${mid}</div>
    <div class="rgt">${right}</div>
  </div>`;

const expRows = (d.experience || []).filter((j) => j.org || j.role).map((j, i) => {
  const { title, loc } = splitRole(j.role);
  const mid = `<div class="org">${esc(j.org)}</div>${j.dates ? `<div class="dt">${esc(j.dates)}</div>` : ""}${loc ? `<div class="dt">${esc(loc)}</div>` : ""}`;
  const right = `<div class="ttl">${esc(title)}</div>${clean(j.bullets).map((b) => `<div class="ln">${esc(b)}</div>`).join("")}`;
  return row("WORK EXPERIENCE", mid, right, i === 0);
}).join("");

const eduRows = (d.education || []).filter((e) => e.title || e.org).map((e, i) => {
  const parts = (e.detail || "").split(" · ");
  const dates = parts[0] || "", extra = parts.slice(1).join(" · ");
  const mid = `<div class="org">${esc(e.org)}</div>${dates ? `<div class="dt">${esc(dates)}</div>` : ""}`;
  const right = `<div class="ttl">${esc(e.title)}</div>${extra ? `<div class="ln">${esc(extra)}</div>` : ""}`;
  return row("EDUCATION", mid, right, i === 0);
}).join("");

const refRows = (d.showReferences ? (d.references || []) : []).filter((r) => r.name).map((r, i) => {
  const mid = `<div class="org">${esc(r.name)}</div>${r.title ? `<div class="dt">${esc(r.title)}</div>` : ""}`;
  const right = `<div class="ln">${esc(r.contact)}</div>`;
  return row("REFERENCES", mid, right, i === 0);
}).join("");

// Single-row blocks (profile / skills / tools): label left, prose spans mid+right.
const proseRow = (label, inner) =>
  `<div class="row row-first prose-row">
    <div class="lbl">${label}</div>
    <div class="wide">${inner}</div>
  </div>`;

const blocks = [];
if (d.profile) blocks.push(proseRow("PROFILE", esc(d.profile)));
if (expRows) blocks.push(expRows);
if (eduRows) blocks.push(eduRows);
const expertiseInner = (d.expertiseGroups && d.expertiseGroups.length)
  ? `<div class="exp-groups">${d.expertiseGroups.map((g) => `<div class="exp-col"><div class="exp-h">${esc(g.name)}</div>${clean(g.items).map((it) => `<div class="exp-i">${esc(it)}</div>`).join("")}</div>`).join("")}</div>`
  : clean(d.expertise).join(", ");
if (expertiseInner) blocks.push(proseRow("EXPERTISE", expertiseInner));
if (clean(d.tools).length) blocks.push(proseRow("SKILLS", clean(d.tools).map((t) => t.replace(/\s*·\s*/g, ", ")).join(", ")));
if (refRows) blocks.push(refRows);

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.name)} — Résumé</title>
<style>
@page { size: letter; margin: 0.5in 0.55in; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:"Helvetica Neue", Arial, "Inter", sans-serif; color:#000; font-size:7.9pt; line-height:1.28; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.name { font-weight:800; text-transform:uppercase; letter-spacing:-0.028em; line-height:0.9; font-size:46pt; }
.contact { margin-top:12px; margin-bottom:6px; font-size:8.4pt; line-height:1.5; }
.contact a { color:#000; text-decoration:none; }
.row { display:grid; grid-template-columns:140px 200px 1fr; gap:0 18px; align-items:start; padding:6px 0; }
.row-first { border-top:1px solid #000; }
.lbl { font-size:8.4pt; font-weight:700; text-transform:uppercase; letter-spacing:0.01em; }
.mid { padding-top:0; }
.org { font-weight:700; }
.dt { font-style:italic; color:#000; }
.ttl { font-style:italic; font-weight:600; margin-bottom:2px; }
.ln { margin-bottom:1px; }
.wide { grid-column:2 / 4; }
.prose-row .wide { max-width:none; }
.exp-groups { display:grid; grid-template-columns:1fr 1fr 1fr; gap:0 16px; }
.exp-h { font-weight:700; margin-bottom:3px; }
.exp-i { line-height:1.38; }
</style></head><body>
<div class="name">${esc(d.name)}</div>
<div class="contact">${contactBits.join("<br>")}</div>
${blocks.join("\n")}
</body></html>`;

mkdirSync(OUTDIR, { recursive: true });
const stem = join(OUTDIR, `Resume_${name}_ledger`);
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
