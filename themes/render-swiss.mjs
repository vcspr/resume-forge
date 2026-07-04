#!/usr/bin/env node
/**
 * render-swiss.mjs — "Swiss / typographic" résumé theme. 3-column grid, uppercase section
 * labels + company names, italic roles, no bullet dots, lots of whitespace, small light sans.
 * Reproduced from a reference PDF (Anaïs Pyrczak style). 4th theme alongside vic-style / editorial / ats.
 *
 * Columns: [1] INFO + EXPERIENCE  ·  [2] EDUCATION + EXPERTISE + REFERENCES  ·  [3] SKILLS + WORKED WITH
 * Reads the same overlay (+ optional `workedWith` array). Usage:
 *   node bridge/render-swiss.mjs --in <overlay.json> --name <slug> [--outdir output] [--no-pdf]
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
const titleOf = (r) => { const p = (r || "").split(" · "); return p.length > 1 ? p.slice(0, -1).join(" · ") : (r || ""); };
const lines = (arr) => clean(arr).map((x) => `<div class="ln">${esc(x)}</div>`).join("");

const d = merge(loadBase(BASE), inPath ? JSON.parse(readFileSync(resolve(inPath), "utf8")) : {});
const nick = d.nickname || (d.name || "").trim().split(/\s+/)[0]; // nickname for the (parenthetical)

const info = [
  d.email, d.phone,
  d.portfolio ? `<a href="https://${esc(d.portfolio)}">${esc(d.portfolio)}</a>` : "",
  d.linkedin ? `<a href="https://${esc(d.linkedin)}">${esc(d.linkedin)}</a>` : "",
].filter(Boolean).map((x) => `<div class="ln">${x.startsWith("<a") ? x : esc(x)}</div>`).join("");

const exp = (d.experience || []).filter((j) => j.org || j.role).map((j) => `<div class="item">
  <div class="co">${esc(j.org)}</div>
  <div class="ro">${esc(titleOf(j.role))}</div>
  <div class="dt">${esc(j.dates)}</div>
  ${lines(j.bullets)}
</div>`).join("");

const edu = (d.education || []).filter((e) => e.title || e.org).map((e) => {
  const parts = (e.detail || "").split(" · ");
  return `<div class="item">
  <div class="co">${esc(e.org)}</div>
  ${parts[0] ? `<div class="dt">${esc(parts[0])}</div>` : ""}
  <div class="ln">${esc(e.title)}</div>
  ${parts.slice(1).map((x) => `<div class="ln">${esc(x)}</div>`).join("")}
</div>`;
}).join("");

const refs = (d.showReferences ? (d.references || []) : []).filter((r) => r.name).map((r) => `<div class="item">
  <div class="co">${esc(r.name)}</div>
  ${r.title ? `<div class="ro">${esc(r.title)}</div>` : ""}
  ${r.contact ? `<div class="ln">${esc(r.contact)}</div>` : ""}
</div>`).join("");

const skills = clean(d.tools).map((t) => `<div class="ln">${esc(t.replace(/\s*·\s*/g, ", "))}</div>`).join("");
const sec = (label, body) => body ? `<section><div class="lbl">${label}</div>${body}</section>` : "";

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.name)} — Résumé</title>
<style>
@page { size: letter; margin: 0.5in; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:"Helvetica Neue", Arial, sans-serif; font-size:8pt; line-height:1.5; color:#2b2b2b; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.head { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:34px; font-size:8.6pt; letter-spacing:0.02em; }
.cols { display:grid; grid-template-columns:1fr 1fr 1fr; gap:0 24px; align-items:start; }
section { margin-bottom:24px; break-inside:avoid; }
.lbl { text-transform:uppercase; margin-bottom:12px; letter-spacing:0.02em; }
.item { margin-bottom:13px; }
.co { text-transform:uppercase; }
.ro { font-style:italic; }
.dt { text-transform:uppercase; }
.ln { }
.up { text-transform:uppercase; }
a { color:inherit; text-decoration:underline; text-underline-offset:1.5px; }
</style></head><body>
<div class="head"><span>(${esc(nick)}) ${esc(d.name)}</span><span>(EN)</span></div>
<div class="cols">
  <div>
    ${sec("Info", info)}
    ${sec("Experience", exp)}
  </div>
  <div>
    ${sec("Education", edu)}
    ${sec("Expertise", lines(d.expertise))}
    ${sec("References", refs)}
  </div>
  <div>
    ${sec("Skills", skills)}
    ${clean(d.workedWith).length ? `<section><div class="lbl">Worked With</div>${clean(d.workedWith).map((x) => `<div class="ln up">${esc(x)}</div>`).join("")}</section>` : ""}
  </div>
</div>
</body></html>`;

mkdirSync(OUTDIR, { recursive: true });
const stem = join(OUTDIR, `Resume_${name}_swiss`);
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
