#!/usr/bin/env node
/**
 * render-greenlink.mjs — "Green Link" résumé theme (monospace studio/portfolio résumé:
 * Courier/SF-Mono/Menlo body throughout, two columns — LEFT (name + contact, then
 * EXPERIENCE / EDUCATION / EXPERTISE / TOOLS) and RIGHT (disciplines, then WORKED WITH /
 * REFERENCES). Bold uppercase section headers, italic roles, bold-italic for highlighted
 * names. Monochrome except a single green accent (#1a7f37) on the portfolio link only —
 * top of the left column and a centered footer link). A theme alongside
 * render-editorial.mjs (clean sans) and render-monomemo.mjs (mono memo).
 *
 * Reads the same overlay (baseResume + tailored overlay), so it renders any variant.
 * Usage: node bridge/render-greenlink.mjs --in <overlay.json> --name <slug> [--outdir output] [--no-pdf]
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

// ── Contact block (left column, green portfolio link) ─────────────────────────
const portfolioLink = d.portfolio ? `<a class="link" href="https://${esc(d.portfolio)}">${esc(d.portfolio)}</a>` : "";
const contactBits = [];
if (d.location) contactBits.push(esc(d.location));
if (d.phone) contactBits.push(`C ${esc(d.phone)}`);
if (d.email) contactBits.push(esc(d.email));
if (d.linkedin) contactBits.push(esc(d.linkedin));

// ── Disciplines (right column top — split from headline) ──────────────────────
const disciplines = clean((d.headline || "").split(/\s*[·|,/]\s*/));

// ── LEFT: experience entries (org / italic role / dates + bullets) ────────────
const expEntries = (d.experience || []).filter((j) => j.org || j.role).map((j) => {
  const { title, loc } = splitRole(j.role);
  return `<div class="entry">
    <div class="org">${esc(j.org)}</div>
    <div class="role">${esc(title)}${loc ? ` — ${esc(loc)}` : ""}</div>
    ${j.dates ? `<div class="dates">${esc(j.dates)}</div>` : ""}
    ${clean(j.bullets).map((b) => `<div class="bullet">${esc(b)}</div>`).join("")}
  </div>`;
}).join("");

// ── LEFT: education entries (org / italic title / dates) ───────────────────────
const eduEntries = (d.education || []).filter((e) => e.title || e.org).map((e) => {
  const parts = (e.detail || "").split(" · ");
  const dates = parts[0] || "", extra = parts.slice(1).join(" · ");
  return `<div class="entry">
    <div class="org">${esc(e.org)}</div>
    <div class="role">${esc(e.title)}</div>
    ${dates ? `<div class="dates"> ${esc(dates)}${extra ? ` · ${esc(extra)}` : ""}</div>` : ""}
  </div>`;
}).join("");

// ── RIGHT: references (bold-italic name + role/contact below) ──────────────────
const refEntries = (d.showReferences ? (d.references || []) : []).filter((r) => r.name).map((r) =>
  `<div class="entry">
    ${r.title ? `<div class="role">${esc(r.title)}</div>` : ""}
    <div class="award">${esc(r.name)}</div>
    ${r.contact ? `<div class="dates"> ${esc(r.contact)}</div>` : ""}
  </div>`
).join("");

// ── RIGHT: worked-with (bold-italic names) ────────────────────────────────────
const workedWith = clean(d.workedWith);
const wwEntries = workedWith.length
  ? `<div class="entry"><div class="award">${workedWith.map(esc).join("</div><div class=\"award\">")}</div></div>`
  : "";

const sectionL = (label, inner) => inner ? `<div class="section"><div class="head">${label}</div>${inner}</div>` : "";
const proseL = (label, text) => text ? `<div class="section"><div class="head">${label}</div><div class="prose">${esc(text)}</div></div>` : "";

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.name)} — Résumé</title>
<style>
@page { size: letter; margin: 0.5in 0.6in; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:"SF Mono","Menlo","Courier New",monospace; color:#111; font-size:7pt; line-height:1.42; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.grid { display:grid; grid-template-columns:1fr 1fr; gap:0 32px; }
.col { display:flex; flex-direction:column; }
/* ── header ── */
.name { font-weight:700; font-size:8.2pt; letter-spacing:0.01em; }
.contact { margin-top:1px; }
.contact div { white-space:nowrap; }
.link { color:#1a7f37; text-decoration:none; }
.disc div { white-space:nowrap; }
/* ── sections ── */
.section { margin-top:13px; }
.head { font-weight:700; text-transform:uppercase; letter-spacing:0.02em; margin-bottom:9px; }
.entry { margin-bottom:9px; }
.org { font-weight:400; }
.role { font-style:italic; }
.dates { } /* indented one space via leading space in content, mono-aligned */
.bullet { padding-left:8px; text-indent:-8px; }
.bullet::before { content:"- "; }
.award { font-weight:700; font-style:italic; }
.prose { }
/* ── footer ── */
.footer { text-align:center; margin-top:22px; }
</style></head><body>
<div class="grid">
  <div class="col">
    <div class="name">${esc(d.name)}</div>
    <div class="contact">
      ${contactBits.map((c) => `<div>${c}</div>`).join("")}
      ${portfolioLink ? `<div>${portfolioLink}</div>` : ""}
    </div>
    ${sectionL("Experience", expEntries)}
    ${sectionL("Education", eduEntries)}
    ${clean(d.expertise).length ? sectionL("Expertise", `<div class="prose">${clean(d.expertise).map(esc).join(" · ")}</div>`) : ""}
    ${clean(d.tools).length ? sectionL("Tools", `<div class="prose">${clean(d.tools).map((t) => esc(t)).join(" · ")}</div>`) : ""}
  </div>
  <div class="col">
    ${disciplines.length ? `<div class="disc">${disciplines.map((x) => `<div>${esc(x)}</div>`).join("")}</div>` : ""}
    ${proseL("Profile", d.profile)}
    ${sectionL("Worked With", wwEntries)}
    ${refEntries ? sectionL("References", refEntries) : ""}
  </div>
</div>
${portfolioLink ? `<div class="footer">${portfolioLink}</div>` : ""}
</body></html>`;

mkdirSync(OUTDIR, { recursive: true });
const stem = join(OUTDIR, `Resume_${name}_greenlink`);
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
