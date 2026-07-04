#!/usr/bin/env node
/**
 * render-numbered.mjs — "Numbered Experience" résumé theme. Two columns: a LEFT
 * sidebar (Personal Statement, Skills/Expertise grouped under bracketed category
 * tags in the gutter, Education) and a RIGHT column where Work Experience is a
 * NUMBERED vertical list with big pale-grey numerals beside each role.
 * Underline-rule section headers, light humanist sans, monochrome + pale-grey accents.
 * Name pinned top-left, contact top-right.
 *
 * Reads the same overlay (baseResume + tailored overlay), so it renders any variant.
 * Usage: node bridge/render-numbered.mjs --in <overlay.json> --name <slug> [--outdir output] [--no-pdf]
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

// ---- Contact (top-right, stacked) ----
const contactBits = [];
if (d.portfolio) contactBits.push(`<a href="https://${esc(d.portfolio)}">${esc(d.portfolio)}</a>`);
if (d.email) contactBits.push(esc(d.email));
if (d.phone) contactBits.push(esc(d.phone));
if (d.location) contactBits.push(esc(d.location));
if (d.linkedin) contactBits.push(`<a href="https://${esc(d.linkedin)}">${esc(d.linkedin)}</a>`);

// ---- RIGHT column: numbered work experience ----
const expEntries = (d.experience || []).filter((j) => j.org || j.role).map((j, i) => {
  const { title, loc } = splitRole(j.role);
  const place = [j.org, loc].filter(Boolean).map(esc).join(". ");
  return `<div class="job">
    <div class="num">${i + 1}</div>
    <div class="jbody">
      ${j.dates ? `<div class="jdates">${esc(j.dates)}</div>` : ""}
      ${title ? `<div class="jtitle">${esc(title)}</div>` : ""}
      ${place ? `<div class="jplace">${place}</div>` : ""}
      ${clean(j.bullets).map((b) => `<div class="bullet">${esc(b)}</div>`).join("")}
    </div>
  </div>`;
}).join("");

// ---- LEFT column: skills/expertise grouped under bracketed category tags ----
const tagRow = (tag, items) => items.length ? `<div class="tagrow">
  <div class="tag">[${esc(tag)}]</div>
  <div class="taglist">${items.map((x) => `<div class="skill">${esc(x)}</div>`).join("")}</div>
</div>` : "";

// Expertise: prefer categorized groups (each becomes a [CATEGORY] gutter row with
// its items stacked beneath — the sidebar is narrow, so groups stack vertically).
// Fall back to a single flat [DESIGN] row from d.expertise when groups are absent.
const expertiseRows = (d.expertiseGroups && d.expertiseGroups.length)
  ? d.expertiseGroups.map((g) => tagRow((g.name || "").toUpperCase(), clean(g.items))).filter(Boolean).join("")
  : tagRow("DESIGN", clean(d.expertise));

const skillsBlock = [
  expertiseRows,
  tagRow("TOOLS", clean(d.tools).flatMap((t) => t.split(/\s*·\s*/).map((x) => x.trim()).filter(Boolean))),
].filter(Boolean).join("");

// ---- LEFT column: education ----
const eduEntries = (d.education || []).filter((e) => e.title || e.org).map((e) => {
  const parts = (e.detail || "").split(" · ");
  const dates = parts[0] || "", extra = parts.slice(1).join(" · ");
  return `<div class="edu">
    ${dates ? `<div class="edates">${esc(dates)}</div>` : ""}
    ${e.title ? `<div class="etitle">${esc(e.title)}</div>` : ""}
    <div class="eplace">${esc(e.org)}${extra ? `. ${esc(extra)}` : ""}</div>
  </div>`;
}).join("");

// ---- LEFT column: references (optional) ----
const refEntries = (d.showReferences ? (d.references || []) : []).filter((r) => r.name).map((r) =>
  `<div class="ref"><div class="rname">${esc(r.name)}</div>${r.title ? `<div class="rmeta">${esc(r.title)}</div>` : ""}${r.contact ? `<div class="rmeta">${esc(r.contact)}</div>` : ""}</div>`
).join("");

const leftSection = (label, inner, cls = "") => inner ? `<div class="lsec ${cls}"><div class="lhead">${label}</div>${inner}</div>` : "";
const proseSection = (label, text) => text ? `<div class="lsec"><div class="lhead">${label}</div><div class="prose">${esc(text)}</div></div>` : "";

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.name)} — Résumé</title>
<style>
@page { size: letter; margin: 0.5in 0.55in; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:"Helvetica Neue", Arial, "Inter", sans-serif; color:#1a1a1a; font-size:8pt; line-height:1.36; -webkit-print-color-adjust:exact; print-color-adjust:exact; }

/* Header: name left, contact right */
.header { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; padding-bottom:16px; }
.name { font-size:20pt; font-weight:400; letter-spacing:-0.01em; line-height:1.05; color:#111; }
.contact { text-align:right; font-size:7.8pt; color:#555; line-height:1.65; white-space:nowrap; }
.contact a { color:#555; text-decoration:none; }

/* Two-column body */
.cols { display:grid; grid-template-columns:1fr 1.32fr; gap:0 34px; align-items:start; }

/* Section heads with underline rule */
.lhead, .rhead { font-size:7.6pt; font-weight:400; letter-spacing:0.12em; text-transform:uppercase; color:#3a3a3a;
  border-bottom:1px solid #1a1a1a; padding-bottom:4px; margin-bottom:8px; }

/* ---- LEFT sidebar ---- */
.lsec { margin-bottom:13px; }
.prose { font-size:8pt; color:#2a2a2a; }
.prose p { margin-bottom:7px; }

/* Skills grouped under bracketed category tags in the gutter */
.tagrow { display:grid; grid-template-columns:60px 1fr; gap:0 12px; align-items:start; padding:4px 0; }
.tagrow + .tagrow { border-top:1px solid #e6e6e6; }
.tag { font-size:7.3pt; letter-spacing:0.04em; color:#b9b9b9; padding-top:1px; }
.taglist { display:flex; flex-direction:column; gap:2px; }
.skill { font-size:8pt; color:#222; }

/* Education */
.edu { margin-bottom:7px; }
.edates { font-size:7.6pt; color:#7a7a7a; }
.etitle { font-size:8pt; color:#7a7a7a; }
.eplace { font-size:8pt; font-weight:700; color:#1a1a1a; }

/* References */
.ref { margin-bottom:7px; }
.rname { font-size:8pt; font-weight:700; }
.rmeta { font-size:7.7pt; color:#7a7a7a; }

/* ---- RIGHT column: numbered experience ---- */
.job { display:grid; grid-template-columns:34px 1fr; gap:0 8px; align-items:start; margin-bottom:10px; }
.num { font-size:22pt; font-weight:400; line-height:0.92; color:#cfcfcf; letter-spacing:-0.02em; }
.jbody { padding-top:1px; }
.jdates { font-size:8pt; color:#1a1a1a; }
.jtitle { font-size:8pt; color:#1a1a1a; }
.jplace { font-size:8pt; font-weight:700; color:#1a1a1a; margin-bottom:2px; }
.bullet { font-size:8pt; color:#2a2a2a; margin-bottom:1.5px; }
</style></head><body>
<div class="header">
  <div class="name">${esc(d.name)}</div>
  <div class="contact">${contactBits.join("<br>")}</div>
</div>
<div class="cols">
  <div class="left">
    ${proseSection("Personal Statement", d.profile)}
    ${leftSection("Skills &amp; Expertise", skillsBlock)}
    ${leftSection("Education", eduEntries)}
    ${refEntries ? leftSection("References", refEntries) : ""}
  </div>
  <div class="right">
    <div class="rhead">Work Experience</div>
    ${expEntries}
  </div>
</div>
</body></html>`;

mkdirSync(OUTDIR, { recursive: true });
const stem = join(OUTDIR, `Resume_${name}_numbered`);
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
