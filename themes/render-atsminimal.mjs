#!/usr/bin/env node
/**
 * render-atsminimal.mjs — ATS-SAFE, airy modern sans.
 *
 * Single column, standard headers, no tables/graphics, hyphens not en-dashes, so
 * modern ATS (Ashby/Greenhouse/Lever) and legacy parsers both read it cleanly. The
 * look is quiet and roomy: Helvetica, generous whitespace, letter-spaced section
 * labels instead of heavy rules. Reach for this at tech companies whose portals parse
 * clean but whose recruiters still read the PDF.
 *
 * Usage: node themes/render-atsminimal.mjs --in <overlay.json> --name <slug> [--outdir output] [--no-pdf]
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
const contact = [d.location, d.email, d.phone, d.portfolio, d.linkedin].filter(Boolean).map(dash).join("   /   ");
const jobs = (d.experience || []).filter((j) => j.org || j.role);
const refsOn = d.showReferences && (d.references || []).some((r) => r.name);

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.name)} - Resume</title>
<style>
@page { size: letter; margin: 0.6in; }
* { box-sizing: border-box; }
body { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 10pt; line-height: 1.4; color: #111; margin: 0; }
h1 { font-size: 17pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 3px; }
.hl { font-size: 10pt; color: #333; margin: 0 0 3px; }
.contact { font-size: 9pt; color: #333; margin: 0 0 16px; }
h2 { font-size: 9.5pt; text-transform: uppercase; letter-spacing: 2px; color: #000; margin: 14px 0 5px; }
p { margin: 0 0 5px; }
.job { margin-bottom: 8px; }
.jh { font-weight: 700; }
ul { margin: 3px 0 0 16px; padding: 0; }
li { margin-bottom: 2.5px; }
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
const stem = join(OUTDIR, `Resume_${name}_atsminimal`);
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
