#!/usr/bin/env node
/**
 * render-allcaps.mjs — "All-Caps Swiss" résumé theme. ALL-CAPS sans-serif throughout
 * (name, section labels, summary, every entry) via CSS text-transform; label-left
 * layout (section labels in a left rail, content to the right); each experience entry =
 * ROLE / COMPANY / "→ LOCATION" with a right-aligned DATE column on the far right; big
 * airy whitespace; very small type; monochrome black on white, no accent. A 4th theme
 * alongside render-editorial.mjs / render-vic-style.mjs / render-ats.mjs.
 *
 * Reads the same overlay (baseResume + tailored overlay), so it renders any variant.
 * Usage: node bridge/render-allcaps.mjs --in <overlay.json> --name <slug> [--outdir output] [--no-pdf]
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
if (d.linkedin) contactBits.push(esc(d.linkedin));

const expEntries = (d.experience || []).filter((j) => j.org || j.role).map((j) => {
  const { title, loc } = splitRole(j.role);
  return `<div class="entry">
    <div class="c2">
      ${title ? `<div class="role">${esc(title)}</div>` : ""}
      <div class="org">${esc(j.org)}</div>
      ${loc ? `<div class="loc">→ ${esc(loc)}</div>` : ""}
      ${clean(j.bullets).map((b) => `<div class="bullet">${esc(b)}</div>`).join("")}
    </div>
    <div class="c3">${esc(j.dates)}</div>
  </div>`;
}).join("");

const eduEntries = (d.education || []).filter((e) => e.title || e.org).map((e) => {
  const parts = (e.detail || "").split(" · ");
  const dates = parts[0] || "", extra = parts.slice(1).join(" · ");
  return `<div class="entry">
    <div class="c2">
      <div class="role">${esc(e.title)}</div>
      ${e.org ? `<div class="org">${esc(e.org)}</div>` : ""}
      ${extra ? `<div class="loc">${esc(extra)}</div>` : ""}
    </div>
    <div class="c3">${esc(dates)}</div>
  </div>`;
}).join("");

const refEntries = (d.showReferences ? (d.references || []) : []).filter((r) => r.name).map((r) =>
  `<div class="entry"><div class="c2"><div class="role">${esc(r.name)}</div>${r.title ? `<div class="org">${esc(r.title)}</div>` : ""}${r.contact ? `<div class="loc">${esc(r.contact)}</div>` : ""}</div><div class="c3"></div></div>`
).join("");

const section = (label, inner) => `<div class="section"><div class="label">${label}</div><div class="entries">${inner}</div></div>`;
const textSection = (label, text) => `<div class="section"><div class="label">${label}</div><div class="entries"><div class="prose">${esc(text)}</div></div></div>`;

const skillsBlocks = [];
if (clean(d.expertise).length) skillsBlocks.push(`<div class="prose">${esc(clean(d.expertise).join(" / "))}</div>`);
if (clean(d.tools).length) skillsBlocks.push(`<div class="prose tools">${esc(clean(d.tools).map((t) => t.replace(/\s*·\s*/g, ", ")).join(" / "))}</div>`);

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.name)} — Résumé</title>
<style>
@page { size: letter; margin: 0.55in 0.62in; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:"Helvetica Neue", Arial, "Inter", sans-serif; color:#111; font-size:7.2pt; line-height:1.4; text-transform:uppercase; letter-spacing:0.01em; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.header { display:grid; grid-template-columns:200px 1fr; gap:0 24px; align-items:start; padding-bottom:24px; }
.name { font-size:11pt; font-weight:400; letter-spacing:0.02em; line-height:1.1; }
.role-head { font-size:7pt; color:#111; margin-top:6px; letter-spacing:0.04em; }
.contact { font-size:7pt; color:#111; line-height:1.65; margin-top:9px; }
.contact a { color:#111; text-decoration:none; }
.summary { font-size:7.2pt; line-height:1.5; letter-spacing:0.01em; max-width:30em; }
.section { display:grid; grid-template-columns:200px 1fr; gap:0 24px; padding:0 0 20px; align-items:start; }
.label { font-size:7.2pt; color:#111; font-weight:400; letter-spacing:0.03em; }
.entries { display:flex; flex-direction:column; gap:11px; }
.entry { display:grid; grid-template-columns:1fr 78px; gap:0 14px; align-items:start; }
.role { font-size:7.2pt; font-weight:400; line-height:1.3; }
.org { font-size:7.2pt; line-height:1.3; }
.loc { font-size:6.4pt; color:#444; letter-spacing:0.02em; margin-top:1px; }
.bullet { font-size:6.6pt; color:#333; line-height:1.4; margin-top:3px; padding-left:9px; text-indent:-9px; }
.bullet::before { content:"– "; color:#333; }
.c3 { font-size:7pt; text-align:right; letter-spacing:0.02em; font-variant-numeric:tabular-nums; white-space:nowrap; }
.prose { font-size:7.2pt; line-height:1.55; }
.prose.tools { margin-top:7px; color:#333; }
</style></head><body>
<div class="header">
  <div><div class="name">${esc(d.name)}</div><div class="role-head">${esc(d.headline)}</div>
    <div class="contact">${contactBits.join("<br>")}</div>
  </div>
  <div class="summary">${esc(d.profile)}</div>
</div>
${d.profile ? "" : ""}
${expEntries ? section("Professional Experience", expEntries) : ""}
${eduEntries ? section("Education", eduEntries) : ""}
${skillsBlocks.length ? `<div class="section"><div class="label">Skills</div><div class="entries">${skillsBlocks.join("")}</div></div>` : ""}
${clean(d.workedWith).length ? textSection("Worked With", clean(d.workedWith).join(" / ")) : ""}
${refEntries ? section("References", refEntries) : ""}
</body></html>`;

mkdirSync(OUTDIR, { recursive: true });
const stem = join(OUTDIR, `Resume_${name}_allcaps`);
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
