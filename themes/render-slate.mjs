#!/usr/bin/env node
/**
 * render-slate.mjs — "Slate Metric" résumé theme (tech-modern, label-left 3-column;
 * NO divider rules — separation by whitespace only; cool slate / ink-blue-grey type
 * with lighter grey body; inline metrics/numbers bolded so they pop; clean geometric
 * sans). A theme alongside render-editorial.mjs / render-swiss.mjs / render-ats.mjs.
 *
 * Reads the same overlay (baseResume + tailored overlay), so it renders any variant.
 * Usage: node bridge/render-slate.mjs --in <overlay.json> --name <slug> [--outdir output] [--no-pdf]
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

// Bold inline metrics/numbers so they pop. Applied to the already-escaped string.
const boldMetrics = (s) => (s || "").replace(/(\$[\d.]+[KMB]?|\d[\d,]*\+?(?:-practice)?%?)/g, '<strong>$1</strong>');

const d = merge(loadBase(BASE), inPath ? JSON.parse(readFileSync(resolve(inPath), "utf8")) : {});

const contactBits = [];
if (d.portfolio) contactBits.push(`<a href="https://${esc(d.portfolio)}">${esc(d.portfolio)}</a>`);
if (d.email) contactBits.push(esc(d.email));
if (d.phone) contactBits.push(esc(d.phone));
if (d.linkedin) contactBits.push(`<a href="https://${esc(d.linkedin)}">${esc(d.linkedin)}</a>`);

const expEntries = (d.experience || []).filter((j) => j.org || j.role).map((j) => {
  const { title, loc } = splitRole(j.role);
  return `<div class="entry">
    <div class="c2"><div class="org">${esc(j.org)}</div><div class="title">${esc(title)}</div>${loc ? `<div class="meta">${esc(loc)}</div>` : ""}<div class="meta">${esc(j.dates)}</div></div>
    <div class="c3">${clean(j.bullets).map((b) => `<div class="bullet">${boldMetrics(esc(b))}</div>`).join("")}</div>
  </div>`;
}).join("");

const eduEntries = (d.education || []).filter((e) => e.title || e.org).map((e) => {
  const parts = (e.detail || "").split(" · ");
  const dates = parts[0] || "", extra = parts.slice(1).join(" · ");
  return `<div class="entry">
    <div class="c2"><div class="org">${esc(e.org)}</div>${dates ? `<div class="meta">${esc(dates)}</div>` : ""}</div>
    <div class="c3"><div class="title">${esc(e.title)}</div>${extra ? `<div class="meta">${boldMetrics(esc(extra))}</div>` : ""}</div>
  </div>`;
}).join("");

const refEntries = (d.showReferences ? (d.references || []) : []).filter((r) => r.name).map((r) =>
  `<div class="entry"><div class="c2"><div class="org">${esc(r.name)}</div>${r.title ? `<div class="meta">${esc(r.title)}</div>` : ""}</div><div class="c3"><div class="meta">${esc(r.contact)}</div></div></div>`
).join("");

const section = (label, inner) => `<div class="section"><div class="label">${label}</div><div class="entries">${inner}</div></div>`;
const textSection = (label, text) => `<div class="section"><div class="label">${label}</div><div class="entries"><div class="prose">${text}</div></div></div>`;

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.name)} — Résumé</title>
<style>
@page { size: letter; margin: 0.5in 0.6in; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:"Inter", "Helvetica Neue", Arial, sans-serif; color:#5a5a5a; font-size:8.6pt; line-height:1.4; letter-spacing:0.002em; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
strong { color:#2b3a4a; font-weight:700; }
.header { display:flex; justify-content:space-between; align-items:flex-start; gap:28px; padding-bottom:20px; }
.name { font-size:13pt; font-weight:600; letter-spacing:0.16em; color:#2b3a4a; line-height:1.1; text-transform:uppercase; }
.role { font-size:8pt; color:#5a5a5a; margin-top:5px; letter-spacing:0.13em; text-transform:uppercase; }
.contact { text-align:left; font-size:8.2pt; color:#5a5a5a; line-height:1.6; white-space:nowrap; }
.contact a { color:#2b3a4a; text-decoration:underline; text-underline-offset:1.5px; }
.section { display:grid; grid-template-columns:120px 1fr; gap:0 24px; padding:10px 0; }
.entry { break-inside:avoid; }
.label { font-size:8pt; color:#2b3a4a; font-weight:600; letter-spacing:0.16em; text-transform:uppercase; padding-top:1px; }
.entries { display:flex; flex-direction:column; gap:13px; }
.entry { display:grid; grid-template-columns:188px 1fr; gap:0 22px; align-items:start; }
.org { font-weight:700; font-size:8.6pt; color:#2b3a4a; }
.title { font-weight:600; font-size:8.5pt; color:#2b3a4a; margin-top:1px; }
.meta { color:#8a93a0; font-size:8.1pt; margin-top:1px; }
.c3 { display:flex; flex-direction:column; gap:3.5px; }
.bullet { color:#5a5a5a; }
.prose { color:#5a5a5a; font-size:8.4pt; }
</style></head><body>
<div class="header">
  <div><div class="name">${esc(d.name)}</div><div class="role">${esc(d.headline)}</div></div>
  <div class="contact">${contactBits.join("<br>")}</div>
</div>
${d.profile ? textSection("Profile", boldMetrics(esc(d.profile))) : ""}
${expEntries ? section("Experience", expEntries) : ""}
${eduEntries ? section("Education", eduEntries) : ""}
${clean(d.expertise).length ? textSection("Expertise", esc(clean(d.expertise).join(", "))) : ""}
${clean(d.tools).length ? textSection("Tools", esc(clean(d.tools).map((t) => t.replace(/\s*·\s*/g, ", ")).join(", "))) : ""}
${refEntries ? section("References", refEntries) : ""}
</body></html>`;

mkdirSync(OUTDIR, { recursive: true });
const stem = join(OUTDIR, `Resume_${name}_slate`);
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
