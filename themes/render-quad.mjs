#!/usr/bin/env node
/**
 * render-quad.mjs — "Quad Ledger" résumé theme. A true 4-column equal newspaper grid:
 * full-width header (name + one-word role far left; address / phone / email spread across the
 * top row) over four columns, each topped by a letter-spaced ALL-CAPS label above a hairline
 * rule. Dense small monochrome sans; structure comes entirely from the grid + rules.
 * Reproduced from a reference design. 5th theme alongside vic-style / editorial / swiss / ats.
 *
 * Columns: [1] EDUCATION  ·  [2] EXPERIENCE  ·  [3] WORKED WITH  ·  [4] SKILLS (Expertise + Tools)
 * Reads the same overlay (+ optional `workedWith` array). Usage:
 *   node bridge/render-quad.mjs --in <overlay.json> --name <slug> [--outdir output] [--no-pdf]
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
const nick = d.nickname || (d.name || "").trim().split(/\s+/)[0];
const roleWord = d.headline ? ((d.headline.split(/[·,&/]/)[0].trim().split(/\s+/).slice(-1)[0]) || "") : "";

// ----- Header: name + one-word role far left; contact bits spread across the top row -----
const contactBits = [];
if (d.location) contactBits.push(esc(d.location));
if (d.portfolio) contactBits.push(`<a href="https://${esc(d.portfolio)}">${esc(d.portfolio)}</a>`);
if (d.phone) contactBits.push(esc(d.phone));
if (d.email) contactBits.push(esc(d.email));
if (d.linkedin) contactBits.push(`<a href="https://${esc(d.linkedin)}">${esc(d.linkedin)}</a>`);
const headMeta = contactBits.map((x) => `<span class="hm">${x}</span>`).join("");

// ----- COL 1 — Education -----
const eduCol = (d.education || []).filter((e) => e.title || e.org).map((e) => {
  const parts = (e.detail || "").split(" · ");
  return `<div class="e">
    <div class="org">${esc(e.org)}</div>
    ${parts[0] ? `<div class="meta">${esc(parts[0])}</div>` : ""}
    <div class="role">${esc(e.title)}</div>
    ${parts.slice(1).map((x) => `<div class="meta">${esc(x)}</div>`).join("")}
  </div>`;
}).join("");

// ----- COL 2 — Experience (the dense column) -----
const expCol = (d.experience || []).filter((j) => j.org || j.role).map((j) => {
  const { title, loc } = splitRole(j.role);
  return `<div class="e">
    <div class="org">${esc(j.org)}</div>
    <div class="meta">${esc([loc, j.dates].filter(Boolean).join(" · "))}</div>
    ${title ? `<div class="role">${esc(title)}</div>` : ""}
    ${clean(j.bullets).map((b) => `<div class="ln">${esc(b)}</div>`).join("")}
  </div>`;
}).join("");

// ----- COL 3 — Skills (categorized Expertise groups + Tools sub-block) -----
// "Our Expertise" deck style: each category is a letter-spaced ALL-CAPS heading with
// its items stacked beneath. Falls back to a flat Expertise list if no groups are given.
const sub = (label, body) => body ? `<div class="sub"><div class="sublbl">${label}</div>${body}</div>` : "";
const expertiseBlocks = (d.expertiseGroups && d.expertiseGroups.length)
  ? d.expertiseGroups
      .filter((g) => g && g.name && clean(g.items).length)
      .map((g) => sub(esc(g.name), clean(g.items).map((it) => `<div class="ln">${esc(it)}</div>`).join("")))
      .join("")
  : sub("Expertise", clean(d.expertise).map((x) => `<div class="ln">${esc(x)}</div>`).join(""));
const skillsCol =
  expertiseBlocks +
  sub("Tools", clean(d.tools).map((t) => `<div class="ln">${esc(t.replace(/\s*·\s*/g, ", "))}</div>`).join(""));

const col = (label, body) => `<div class="col"><div class="lbl">${label}</div>${body}</div>`;

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.name)} — Résumé</title>
<style>
@page { size: letter; margin: 0.42in 0.45in; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:"Helvetica Neue", Arial, "Inter", sans-serif; color:#0a0a0a; font-size:7.1pt; line-height:1.34; -webkit-print-color-adjust:exact; print-color-adjust:exact; }

/* ---- full-width header ---- */
.header { display:flex; justify-content:space-between; align-items:flex-start; gap:18px; padding-bottom:9px; }
.id { flex:none; }
.name { font-size:10.5pt; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; line-height:1.05; }
.roleword { font-size:7pt; letter-spacing:0.16em; text-transform:uppercase; color:#000; margin-top:3px; }
.meta-row { flex:1; display:flex; flex-wrap:wrap; justify-content:flex-end; align-items:flex-start; gap:2px 18px; padding-top:1px; }
.hm { font-size:7pt; color:#1a1a1a; white-space:nowrap; }
a { color:inherit; text-decoration:none; }

/* ---- true 4-column equal grid ---- */
.grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:0 22px; border-top:1.4px solid #000; padding-top:9px; align-items:start; }
.col { }
.lbl { font-size:6.6pt; font-weight:700; letter-spacing:0.18em; text-transform:uppercase; padding-bottom:3px; margin-bottom:7px; border-bottom:0.6px solid #000; }

/* ---- entries ---- */
.e { margin-bottom:9px; }
.org { font-weight:700; font-size:7.2pt; letter-spacing:0.01em; }
.role { font-weight:600; margin-top:1.5px; }
.meta { color:#5a5a5a; font-size:6.9pt; }
.ln { margin-top:1px; }
.e .ln { margin-top:1.5px; }

/* ---- skills sub-blocks ---- */
.sub { margin-bottom:10px; }
.sublbl { font-weight:700; font-size:6.9pt; letter-spacing:0.04em; margin-bottom:2.5px; }
</style></head><body>
<div class="header">
  <div class="id"><div class="name">${esc(d.name)}</div>${roleWord ? `<div class="roleword">${esc(roleWord)}</div>` : ""}</div>
  <div class="meta-row">${headMeta}</div>
</div>
<div class="grid">
  ${col("Education", eduCol)}
  ${col("Experience", expCol)}
  ${col("Skills", skillsCol)}
</div>
</body></html>`;

mkdirSync(OUTDIR, { recursive: true });
const stem = join(OUTDIR, `Resume_${name}_quad`);
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
