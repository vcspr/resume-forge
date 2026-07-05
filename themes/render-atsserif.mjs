#!/usr/bin/env node
/**
 * render-atsserif.mjs — ATS-SAFE, conservative serif.
 *
 * Single column, standard headers, no tables/graphics, hyphens not en-dashes, so
 * legacy ATS parsers (Workday/Taleo/iCIMS) read it cleanly. The look is traditional:
 * Georgia serif, centered name and contact, classic rules. Reach for this in finance,
 * law, academia, and other conservative fields where a serif reads as "serious."
 *
 * Usage: node themes/render-atsserif.mjs --in <overlay.json> --name <slug> [--outdir output] [--no-pdf]
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
const name = (opt("--name", "tailored")).replace(/[^\w.-]+/g, "_");
const OUTDIR = resolve(PROJECT, opt("--outdir", "output"));
const BASE = resolve(PROJECT, opt("--base", "data/base.json"));
const wantPdf = !flag("--no-pdf");

function merge(base, ov) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(ov || {})) {
    out[k] = (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) ? merge(base[k], v) : v;
  }
  return out;
}
const dash = (s) => (s || "").replace(/[–—]/g, "-");
const esc = (s) => dash(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clean = (a) => (a || []).map((x) => (x || "").trim()).filter(Boolean);

const base = JSON.parse(readFileSync(BASE, "utf8"));
const d = merge(base, inPath ? JSON.parse(readFileSync(resolve(inPath), "utf8")) : {});
const contact = [d.location, d.email, d.phone, d.portfolio, d.linkedin].filter(Boolean).map(dash).join("  |  ");
const jobs = (d.experience || []).filter((j) => j.org || j.role);
const refsOn = d.showReferences && (d.references || []).some((r) => r.name);

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.name)} - Resume</title>
<style>
@page { size: letter; margin: 0.5in; }
* { box-sizing: border-box; }
body { font-family: Georgia, "Times New Roman", serif; font-size: 10pt; line-height: 1.3; color: #000; margin: 0; }
h1 { font-size: 18pt; text-align: center; margin: 0 0 2px; letter-spacing: 0.4px; }
.hl { text-align: center; font-size: 10.5pt; font-style: italic; margin: 0 0 4px; }
.contact { text-align: center; font-size: 9pt; margin: 0 0 10px; }
h2 { font-size: 11pt; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid #000; margin: 10px 0 4px; padding-bottom: 2px; }
p { margin: 0 0 4px; }
.job { margin-bottom: 6px; }
.jh { font-weight: bold; }
ul { margin: 2px 0 0 18px; padding: 0; }
li { margin-bottom: 2px; }
</style></head><body>
<h1>${esc(d.name)}</h1>
<div class="hl">${esc(d.headline)}</div>
<div class="contact">${esc(contact)}</div>
<h2>Summary</h2>
<p>${esc(d.profile)}</p>
<h2>Skills</h2>
<p><b>Expertise:</b> ${clean(d.expertise).map(esc).join(", ")}</p>
<p><b>Tools:</b> ${clean(d.tools).map((t) => esc(t.replace(/\s*·\s*/g, ", "))).join(", ")}</p>
<h2>Experience</h2>
${jobs.map((j) => `<div class="job"><div class="jh">${esc(j.org)} - ${esc(j.role)} (${esc(j.dates)})</div><ul>${clean(j.bullets).map((b) => `<li>${esc(b)}</li>`).join("")}</ul></div>`).join("\n")}
<h2>Education</h2>
${(d.education || []).map((e) => `<p>${[e.title, e.org, e.detail].filter(Boolean).map(esc).join(" - ")}</p>`).join("\n")}
${refsOn ? `<h2>References</h2>\n${(d.references || []).filter((r) => r.name).map((r) => `<p>${[r.name, r.title, r.contact].filter(Boolean).map(esc).join(" - ")}</p>`).join("\n")}` : ""}
</body></html>`;

mkdirSync(OUTDIR, { recursive: true });
const stem = join(OUTDIR, `Resume_${name}_atsserif`);
writeFileSync(`${stem}.html`, html);
console.log(`✓ ${stem}.html`);

if (wantPdf) {
  const { chromium } = await import("playwright");
  const b = await chromium.launch();
  try {
    const p = await b.newPage();
    await p.setContent(html, { waitUntil: "networkidle" });
    await p.pdf({ path: `${stem}.pdf`, format: "Letter", printBackground: false, preferCSSPageSize: true });
    console.log(`✓ ${stem}.pdf`);
  } finally { await b.close(); }
}
