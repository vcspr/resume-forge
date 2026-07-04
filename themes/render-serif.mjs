#!/usr/bin/env node
/**
 * render-serif.mjs — "Serif editorial" résumé theme (literary-magazine look). Two columns:
 * a wide LEFT rail (large serif name masthead + Experience) and a narrow RIGHT sidebar
 * (tagline/contact, Education, Skills, Worked With, Recognition / References). Large serif
 * name + serif section headings (Georgia/Times family), clean small sans body, org names
 * bold + underlined (link style), monochrome with muted blue for sidebar links/awards.
 * Reproduced from a reference design. 5th theme alongside vic-style / editorial / swiss / ats.
 *
 * Reads the same overlay (+ optional `workedWith` array). Usage:
 *   node bridge/render-serif.mjs --in <overlay.json> --name <slug> [--outdir output] [--no-pdf]
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

// Masthead: italicize the final word of the name (literary-magazine convention, e.g. "Fiona Lin").
const nameParts = (d.name || "").trim().split(/\s+/);
const masthead = nameParts.length > 1
  ? `${esc(nameParts.slice(0, -1).join(" "))} <em>${esc(nameParts[nameParts.length - 1])}</em>`
  : esc(d.name);

// Contact stack (sidebar): portfolio + email + phone + linkedin, blue link style.
const contactBits = [];
if (d.portfolio) contactBits.push(`<a href="https://${esc(d.portfolio)}">${esc(d.portfolio)}</a>`);
if (d.email) contactBits.push(`<a href="mailto:${esc(d.email)}">${esc(d.email)}</a>`);
if (d.phone) contactBits.push(esc(d.phone));
if (d.linkedin) contactBits.push(`<a href="https://${esc(d.linkedin)}">${esc(d.linkedin)}</a>`);

// LEFT rail: Experience. Org bold + underlined (link style), em-dash to role title.
const expEntries = (d.experience || []).filter((j) => j.org || j.role).map((j) => {
  const { title, loc } = splitRole(j.role);
  const head = title ? `<span class="org">${esc(j.org)}</span>—${esc(title)}` : `<span class="org">${esc(j.org)}</span>`;
  const sub = [j.dates, loc].filter(Boolean).map(esc).join("&nbsp;&nbsp;");
  return `<div class="job">
    <div class="job-head">${head}</div>
    ${sub ? `<div class="job-meta">${sub}</div>` : ""}
    <ul class="bullets">${clean(j.bullets).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
  </div>`;
}).join("");

// RIGHT sidebar: Education entries.
const eduEntries = (d.education || []).filter((e) => e.title || e.org).map((e) => {
  const parts = (e.detail || "").split(" · ");
  const dates = parts[0] || "", extra = parts.slice(1).join(" · ");
  return `<div class="side-item">
    <div class="side-strong">${esc(e.org)}</div>
    ${dates ? `<div class="side-meta">${esc(dates)}</div>` : ""}
    <div class="side-line">${esc(e.title)}${extra ? ` · ${esc(extra)}` : ""}</div>
  </div>`;
}).join("");

// RIGHT sidebar: References (gated on showReferences). Name strong, title + contact muted.
const refEntries = (d.showReferences ? (d.references || []) : []).filter((r) => r.name).map((r) =>
  `<div class="side-item"><div class="side-strong">${esc(r.name)}</div>${r.title ? `<div class="side-meta">${esc(r.title)}</div>` : ""}${r.contact ? `<div class="side-line">${esc(r.contact)}</div>` : ""}</div>`
).join("");

// Skills sidebar block: Expertise + Tools as two labelled mini-groups.
const skillsInner = [
  clean(d.expertise).length ? `<div class="skill-grp"><div class="skill-h">Design</div><div class="side-line">${clean(d.expertise).join(" · ")}</div></div>` : "",
  clean(d.tools).length ? `<div class="skill-grp"><div class="skill-h">Tools</div><div class="side-line">${clean(d.tools).map((t) => t.replace(/\s*·\s*/g, ", ")).join(" · ")}</div></div>` : "",
].filter(Boolean).join("");

// Worked With sidebar block: names list, each on its own line, muted-blue link style.
const workedWithInner = clean(d.workedWith).map((x) => `<div class="ww">${esc(x)}</div>`).join("");

const leftSection = (label, inner) => inner ? `<section class="block"><h2 class="sec">${label}</h2>${inner}</section>` : "";
const sideSection = (label, inner) => inner ? `<section class="block"><h2 class="sec sec-side">${label}</h2>${inner}</section>` : "";

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.name)} — Résumé</title>
<style>
@page { size: letter; margin: 0.5in 0.55in; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:"Helvetica Neue", Arial, "Inter", sans-serif; color:#141414; font-size:8pt; line-height:1.36; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.grid { display:grid; grid-template-columns:1fr 33%; gap:0 26px; align-items:start; }
.serif { font-family:Georgia, "Times New Roman", Times, serif; }
.name { font-family:Georgia, "Times New Roman", Times, serif; font-weight:400; font-size:33pt; line-height:0.94; letter-spacing:-0.01em; margin-bottom:18px; }
.name em { font-style:italic; }
.tagline { font-family:Georgia, "Times New Roman", Times, serif; font-weight:700; font-size:9.5pt; line-height:1.3; margin-bottom:16px; }
.sec { font-family:Georgia, "Times New Roman", Times, serif; font-weight:400; font-size:15pt; line-height:1; margin-bottom:9px; }
.sec-side { font-size:13pt; margin-bottom:7px; }
.block { margin-bottom:13px; break-inside:avoid; }
/* LEFT — Experience */
.job { margin-bottom:9px; break-inside:avoid; }
.job-head { font-size:8.2pt; margin-bottom:1px; }
.org { font-weight:700; text-decoration:underline; text-underline-offset:1.5px; }
.job-meta { color:#6a6a6a; font-size:7.7pt; margin-bottom:2.5px; }
.bullets { list-style:none; }
.bullets li { padding-left:9px; text-indent:-9px; margin-bottom:1px; }
.bullets li::before { content:"·\\00a0"; }
/* RIGHT — sidebar */
.contact { margin-bottom:14px; line-height:1.5; }
.side-item { margin-bottom:8px; break-inside:avoid; }
.side-strong { font-weight:700; }
.side-meta { color:#6a6a6a; font-size:7.7pt; }
.side-line { font-size:7.9pt; }
.skill-grp { margin-bottom:7px; }
.skill-h { font-weight:700; margin-bottom:1px; }
.ww { font-weight:700; }
/* muted editorial blue for sidebar links + worked-with + contact */
.contact a, .ww, a { color:#0a4bcc; text-decoration:none; }
.contact a { text-decoration:none; }
.org { color:inherit; }
</style></head><body>
<div class="grid">
  <div class="col-left">
    <h1 class="name">${masthead}</h1>
    ${leftSection("Experience", expEntries)}
  </div>
  <div class="col-right">
    ${d.headline ? `<div class="tagline">${esc(d.headline)}</div>` : ""}
    ${contactBits.length ? `<div class="contact">${contactBits.join("<br>")}</div>` : ""}
    ${sideSection("Education", eduEntries)}
    ${sideSection("Skills", skillsInner)}
    ${workedWithInner ? sideSection("Worked With", workedWithInner) : ""}
    ${refEntries ? sideSection("References", refEntries) : ""}
  </div>
</div>
</body></html>`;

mkdirSync(OUTDIR, { recursive: true });
const stem = join(OUTDIR, `Resume_${name}_serif`);
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
