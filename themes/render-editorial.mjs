#!/usr/bin/env node
/**
 * render-editorial.mjs — "Editorial" résumé theme (clean, minimal, label-left columns +
 * hairline dividers + airy whitespace; light sans-serif). A 3rd theme alongside
 * render-vic-style.mjs (APEX mono) and render-ats.mjs (plain ATS).
 *
 * Reads the same overlay (baseResume + tailored overlay), so it renders any variant.
 * Usage: node bridge/render-editorial.mjs --in <overlay.json> --name <slug> [--outdir output] [--no-pdf]
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
if (d.portfolio) contactBits.push(`<a href="https://${esc(d.portfolio)}">${esc(d.portfolio)} ↗</a>`);
if (d.email) contactBits.push(esc(d.email));
if (d.phone) contactBits.push(esc(d.phone));
if (d.linkedin) contactBits.push(esc(d.linkedin));

const expEntries = (d.experience || []).filter((j) => j.org || j.role).map((j) => {
  const { title, loc } = splitRole(j.role);
  return `<div class="entry">
    <div class="c2"><div class="org">${esc(j.org)}</div>${loc ? `<div class="meta">${esc(loc)}</div>` : ""}<div class="meta">${esc(j.dates)}</div></div>
    <div class="c3"><div class="title">${esc(title)}</div>${clean(j.bullets).map((b) => `<div class="bullet">${esc(b)}</div>`).join("")}</div>
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
  `<div class="entry"><div class="c2"><div class="org">${esc(r.name)}</div>${r.title ? `<div class="meta">${esc(r.title)}</div>` : ""}</div><div class="c3"><div class="meta">${esc(r.contact)}</div></div></div>`
).join("");

const section = (label, inner) => `<div class="section"><div class="label">${label}</div><div class="entries">${inner}</div></div>`;
const textSection = (label, text) => `<div class="section"><div class="label">${label}</div><div class="entries"><div class="prose">${esc(text)}</div></div></div>`;

// Expertise rendered as 3 categorized groups stacked vertically in the middle (1fr) column:
// each group = bold heading + its items as a comma-joined line beneath. Falls back to flat d.expertise.
const expertiseSection = () => {
  const groups = (d.expertiseGroups || []).filter((g) => g && g.name && clean(g.items).length);
  const inner = groups.length
    ? `<div class="exp-groups">${groups.map((g) => `<div class="exp-group"><div class="exp-h">${esc(g.name)}</div><div class="exp-i">${clean(g.items).map((it) => esc(it)).join(", ")}</div></div>`).join("")}</div>`
    : `<div class="prose">${esc(clean(d.expertise).join(", "))}</div>`;
  return `<div class="section"><div class="label">Expertise</div><div class="entries">${inner}</div></div>`;
};

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.name)} — Résumé</title>
<style>
@page { size: letter; margin: 0.44in 0.5in; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:"Helvetica Neue", Arial, "Inter", sans-serif; color:#0b0b0b; font-size:8.4pt; line-height:1.33; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.header { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; padding-bottom:15px; }
.id { display:flex; gap:13px; align-items:center; }
.avatar { width:32px; height:32px; border-radius:50%; background:#d8d8d8; flex:none; }
.name { font-size:19pt; font-weight:400; letter-spacing:-0.012em; line-height:1; }
.role { font-size:8.5pt; color:#6b6b6b; margin-top:5px; }
.contact { text-align:left; font-size:8.1pt; color:#222; line-height:1.55; white-space:nowrap; }
.contact a { color:#222; text-decoration:none; }
.section { display:grid; grid-template-columns:108px 1fr; gap:0 20px; border-top:1px solid #111; padding:8px 0; }
.label { font-size:10pt; color:#3a3a3a; font-weight:400; }
.entries { display:flex; flex-direction:column; gap:9px; }
.entry { display:grid; grid-template-columns:172px 1fr; gap:0 17px; align-items:start; }
.org { font-weight:700; font-size:8.5pt; }
.meta { color:#6b6b6b; font-size:8.1pt; }
.title { font-weight:700; font-size:8.5pt; margin-bottom:2px; }
.bullet { padding-left:11px; text-indent:-11px; margin-bottom:1.5px; }
.bullet::before { content:"• "; color:#111; }
.prose { font-size:8.5pt; }
</style></head><body>
<div class="header">
  <div class="id"><div><div class="name">${esc(d.name)}</div><div class="role">${esc(d.headline)}</div></div></div>
  <div class="contact">${contactBits.join("<br>")}</div>
</div>
${expEntries ? section("Experience", expEntries) : ""}
${eduEntries ? section("Education", eduEntries) : ""}
${((d.expertiseGroups && d.expertiseGroups.length) || clean(d.expertise).length) ? expertiseSection() : ""}
${clean(d.tools).length ? textSection("Tools", clean(d.tools).map((t) => t.replace(/\s*·\s*/g, ", ")).join(", ")) : ""}
${refEntries ? section("References", refEntries) : ""}
</body></html>`;

mkdirSync(OUTDIR, { recursive: true });
const stem = join(OUTDIR, `Resume_${name}_editorial`);
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
