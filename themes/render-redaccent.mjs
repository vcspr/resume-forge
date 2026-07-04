#!/usr/bin/env node
/**
 * render-redaccent.mjs — "Red-Accent Minimal" résumé theme. Far-left tracked-out ALL-CAPS
 * section labels, a wide content column with an inner title|description split, monochrome
 * black/grey on white, and a single bold red quarter-circle blooming from the top-left
 * corner of the page. Red ≈ #E0301E. A theme alongside render-editorial.mjs / render-swiss.mjs.
 *
 * Reads the same overlay (baseResume + tailored overlay), so it renders any variant.
 * Usage: node bridge/render-redaccent.mjs --in <overlay.json> --name <slug> [--outdir output] [--no-pdf]
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
if (d.portfolio) contactBits.push(`<a href="https://${esc(d.portfolio)}">${esc(d.portfolio)}</a>`);
if (d.email) contactBits.push(esc(d.email));
if (d.phone) contactBits.push(esc(d.phone));
if (d.linkedin) contactBits.push(`<a href="https://${esc(d.linkedin)}">${esc(d.linkedin)}</a>`);

const expEntries = (d.experience || []).filter((j) => j.org || j.role).map((j) => {
  const { title, loc } = splitRole(j.role);
  return `<div class="entry">
    <div class="c2"><div class="org">${esc(j.org)}</div>${title ? `<div class="title">${esc(title)}</div>` : ""}<div class="meta">${esc(j.dates)}</div>${loc ? `<div class="meta">${esc(loc)}</div>` : ""}</div>
    <div class="c3">${clean(j.bullets).map((b) => `<div class="bullet">${esc(b)}</div>`).join("")}</div>
  </div>`;
}).join("");

const eduEntries = (d.education || []).filter((e) => e.title || e.org).map((e) => {
  const parts = (e.detail || "").split(" · ");
  const dates = parts[0] || "", extra = parts.slice(1).join(" · ");
  return `<div class="entry">
    <div class="c2"><div class="org">${esc(e.org)}</div>${dates ? `<div class="meta">${esc(dates)}</div>` : ""}</div>
    <div class="c3"><div class="title">${esc(e.title)}</div>${extra ? `<div class="meta">${esc(extra)}</div>` : ""}</div>
  </div>`;
}).join("");

const refEntries = (d.showReferences ? (d.references || []) : []).filter((r) => r.name).map((r) =>
  `<div class="entry"><div class="c2"><div class="org">${esc(r.name)}</div>${r.title ? `<div class="meta">${esc(r.title)}</div>` : ""}</div><div class="c3"><div class="refc">${esc(r.contact)}</div></div></div>`
).join("");

const section = (label, inner) => `<div class="section"><div class="label">${esc(label)}</div><div class="entries">${inner}</div></div>`;
const textSection = (label, text) => `<div class="section"><div class="label">${esc(label)}</div><div class="entries"><div class="prose">${esc(text)}</div></div></div>`;

const skillsInner = `<div class="entry">
  ${clean(d.expertise).length ? `<div class="c2"><div class="title">Expertise</div><div class="prose">${clean(d.expertise).join(", ")}</div></div>` : "<div class=\"c2\"></div>"}
  ${clean(d.tools).length ? `<div class="c3"><div class="title">Tools</div><div class="prose">${clean(d.tools).map((t) => t.replace(/\s*·\s*/g, ", ")).join(", ")}</div></div>` : ""}
</div>`;

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.name)} — Résumé</title>
<style>
@page { size: letter; margin: 0; }
* { margin:0; padding:0; box-sizing:border-box; }
html,body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
body { font-family:"Helvetica Neue", Arial, "Inter", sans-serif; color:#1a1a1a; font-size:8.1pt; line-height:1.32; padding:0.46in 0.62in 0.38in; position:relative; }
.corner { position:absolute; top:0; left:0; width:78px; height:78px; background:#E0301E; border-bottom-right-radius:100%; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.header { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; padding:7px 0 12px 96px; }
.name { font-size:14pt; font-weight:700; letter-spacing:0.34em; line-height:1.1; text-transform:uppercase; }
.role { font-size:8.2pt; color:#6b6b6b; margin-top:5px; letter-spacing:0.04em; }
.contact { text-align:right; font-size:8pt; color:#3a3a3a; line-height:1.6; white-space:nowrap; }
.contact a { color:#3a3a3a; text-decoration:none; }
.section { display:grid; grid-template-columns:118px 1fr; gap:0 18px; padding:7px 0; align-items:start; }
.section + .section { border-top:1px solid #e2e2e2; }
.label { font-size:7.7pt; color:#1a1a1a; font-weight:600; letter-spacing:0.26em; text-transform:uppercase; padding-top:1px; }
.entries { display:flex; flex-direction:column; gap:7.5px; }
.entry { display:grid; grid-template-columns:170px 1fr; gap:0 18px; align-items:start; }
.org { font-weight:700; font-size:8.4pt; letter-spacing:0.01em; }
.title { font-weight:700; font-size:8.4pt; margin-bottom:2px; }
.meta { color:#7a7a7a; font-size:7.9pt; }
.refc { color:#3a3a3a; font-size:8pt; }
.bullet { padding-left:11px; text-indent:-11px; margin-bottom:2px; color:#2a2a2a; }
.bullet::before { content:"—  "; color:#E0301E; font-weight:700; }
.prose { font-size:8.2pt; color:#2a2a2a; }
.c2 .title { margin-bottom:3px; }
</style></head><body>
<div class="corner"></div>
<div class="header">
  <div class="id"><div class="name">${esc(d.name)}</div><div class="role">${esc(d.headline)}</div></div>
  <div class="contact">${contactBits.join("<br>")}</div>
</div>
${d.profile ? textSection("Profile", d.profile) : ""}
${expEntries ? section("Experience", expEntries) : ""}
${eduEntries ? section("Education", eduEntries) : ""}
${(clean(d.expertise).length || clean(d.tools).length) ? `<div class="section"><div class="label">Skills</div><div class="entries">${skillsInner}</div></div>` : ""}
${refEntries ? section("References", refEntries) : ""}
</body></html>`;

mkdirSync(OUTDIR, { recursive: true });
const stem = join(OUTDIR, `Resume_${name}_redaccent`);
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
