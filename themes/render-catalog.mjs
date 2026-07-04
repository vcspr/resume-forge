#!/usr/bin/env node
/**
 * render-catalog.mjs — "Vertical-Rule Catalog" résumé theme (library-catalog refinement).
 * THREE columns separated by full-height vertical rules. Header row: name + tagline (col1) ·
 * centered "CV" masthead (col2) · "(1 of 1)" at right (col3). Underlined section labels.
 * Footer row across columns: website · email · @handle. Monochrome, understated neutral type.
 *
 * COL1 = Experience · COL2 = Expertise (categorized) + Tools · COL3 = Education + References.
 * Expertise renders as an "Our Expertise" deck: each group is a bold/underlined sub-heading
 * with its items stacked beneath. Compressed to ONE page (the catalog original is 2 pages).
 *
 * Reads the same overlay (baseResume + tailored overlay), so it renders any variant.
 * Usage: node bridge/render-catalog.mjs --in <overlay.json> --name <slug> [--outdir output] [--no-pdf]
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

// ---- derived footer bits (website · email · @handle) ----
// Prefer the portfolio's trailing path segment (a short handle like "vic");
// fall back to first name. (LinkedIn slugs are long/ugly, so avoid them here.)
const website = d.portfolio || "";
const handleSrc = (d.portfolio || "").split(/[/?#]/).filter(Boolean).pop()
  || (d.name || "").split(" ")[0];
const handle = "@" + (handleSrc || "").replace(/[^A-Za-z0-9._-]+/g, "").toLowerCase();

// ---- COL1: Experience ----
const expEntries = (d.experience || []).filter((j) => j.org || j.role).map((j) => {
  const { title, loc } = splitRole(j.role);
  return `<div class="rec">
    <div class="org">${esc(j.org)}</div>
    ${loc ? `<div class="ln">${esc(loc)}</div>` : ""}
    ${title ? `<div class="ln">${esc(title)}</div>` : ""}
    <div class="ln">${esc(j.dates)}</div>
    ${clean(j.bullets).map((b) => `<div class="ln dim">${esc(b)}</div>`).join("")}
  </div>`;
}).join("");

// ---- COL2: Expertise (categorized) + Tools ----
// Categorized "Our Expertise" deck style: each group = a bold/underlined sub-heading
// with its items stacked beneath (catalog columns are narrow, so vertical stacking).
// Falls back to a flat list of d.expertise when expertiseGroups is absent.
const expertiseGroups = (d.expertiseGroups || []).filter((g) => g && g.name && clean(g.items).length);
const expertise = clean(d.expertise);
const expertiseBody = expertiseGroups.length
  ? expertiseGroups.map((g) =>
      `<div class="subgrp"><div class="sublabel">${esc(g.name)}</div>${clean(g.items).map((it) => `<div class="ln">${esc(it)}</div>`).join("")}</div>`
    ).join("")
  : expertise.map((x) => `<div class="ln">${esc(x)}</div>`).join("");
const expertiseBlock = (expertiseGroups.length || expertise.length)
  ? `<div class="grp"><div class="label">Expertise</div>${expertiseBody}</div>`
  : "";
const tools = clean(d.tools);
const toolsBlock = tools.length
  ? `<div class="grp"><div class="label">Tools</div>${tools.map((t) => `<div class="ln">${esc(t.replace(/\s*·\s*/g, ", "))}</div>`).join("")}</div>`
  : "";

// ---- COL3: Education + References ----
const eduEntries = (d.education || []).filter((e) => e.title || e.org).map((e) => {
  const parts = (e.detail || "").split(" · ");
  return `<div class="rec">
    <div class="org">${esc(e.title)}</div>
    ${e.org ? `<div class="ln">${esc(e.org)}</div>` : ""}
    ${parts.filter(Boolean).map((p) => `<div class="ln dim">${esc(p)}</div>`).join("")}
  </div>`;
}).join("");
const eduBlock = eduEntries ? `<div class="grp"><div class="label">Education</div>${eduEntries}</div>` : "";

const refEntries = (d.showReferences ? (d.references || []) : []).filter((r) => r.name).map((r) =>
  `<div class="rec">
    <div class="org">${esc(r.name)}</div>
    ${r.title ? `<div class="ln">${esc(r.title)}</div>` : ""}
    ${r.contact ? `<div class="ln dim">${esc(r.contact)}</div>` : ""}
  </div>`
).join("");
const refBlock = refEntries ? `<div class="grp"><div class="label">References</div>${refEntries}</div>` : "";

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.name)} — CV</title>
<style>
@page { size: letter; margin: 0.4in 0.45in; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:"Helvetica Neue","Inter","Arial",sans-serif; color:#111; font-size:7.4pt; line-height:1.32; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.sheet { display:flex; flex-direction:column; min-height:9.9in; }

/* header row across the three columns */
.head { display:grid; grid-template-columns:1fr 1fr 1fr; border-bottom:1px solid #111; }
.head > div { padding:0 18px 14px; display:flex; flex-direction:column; }
.head .c1 { align-items:center; text-align:center; }
.head .c2 { align-items:center; text-align:center; justify-content:flex-start; }
.head .c3 { align-items:center; text-align:center; }
.hname { font-size:11pt; font-weight:400; letter-spacing:0.005em; }
.htag { font-size:9pt; color:#111; margin-top:1px; }
.masthead { font-size:11pt; letter-spacing:0.06em; }
.pageno { font-size:9.5pt; }

/* body: three columns with full-height vertical rules */
.cols { display:grid; grid-template-columns:1fr 1fr 1fr; align-items:stretch; flex:1; }
.col { padding:10px 14px 0; min-height:8.5in; }
.col + .col { border-left:1px solid #111; }

.label { font-size:9pt; text-decoration:underline; text-underline-offset:2.5px; margin:0 0 9px; }
.grp { margin-bottom:12px; }
.grp:last-child { margin-bottom:0; }
.rec { margin-bottom:9px; }
.rec:last-child { margin-bottom:0; }
.org { font-size:8pt; }
.ln { font-size:8pt; }
.dim { color:#111; }

/* footer row across the three columns */
.foot { display:grid; grid-template-columns:1fr 1fr 1fr; border-top:1px solid #111; }
.foot > div { padding:11px 18px 0; text-align:center; font-size:8.5pt; }
.foot a { color:#111; text-decoration:none; }
</style></head><body>
<div class="sheet">
  <div class="head">
    <div class="c1"><div class="hname">${esc(d.name)}</div><div class="htag">${esc(d.headline)}</div></div>
    <div class="c2"><div class="masthead">CV</div></div>
    <div class="c3"><div class="pageno">(1 of 1)</div></div>
  </div>
  <div class="cols">
    <div class="col">
      ${expEntries ? `<div class="grp"><div class="label">Experience</div>${expEntries}</div>` : ""}
    </div>
    <div class="col">
      ${expertiseBlock}
      ${toolsBlock}
    </div>
    <div class="col">
      ${eduBlock}
      ${refBlock}
    </div>
  </div>
  <div class="foot">
    <div>${website ? `<a href="https://${esc(website)}">${esc(website)}</a>` : ""}</div>
    <div>${d.email ? esc(d.email) : ""}</div>
    <div>${handle.length > 1 ? esc(handle) : (d.phone ? esc(d.phone) : "")}</div>
  </div>
</div>
</body></html>`;

mkdirSync(OUTDIR, { recursive: true });
const stem = join(OUTDIR, `Resume_${name}_catalog`);
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
