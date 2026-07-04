#!/usr/bin/env node
/**
 * render-ats.mjs — ATS-SAFE twin of a tailored résumé.
 *
 * Same tailored content (reads baseResume + your overlay, like render-vic-style.mjs), but a
 * PLAIN single-column layout that legacy ATS parsers (Workday/Taleo/iCIMS) read cleanly:
 *   single column · Arial · standard section headers (Summary/Skills/Experience/Education) ·
 *   no letter-spacing · no grids/tables · contact in body · hyphens not en-dashes.
 * Emits .html + .pdf + .txt (the .txt is the most ATS-safe and is paste-ready for text boxes).
 *
 * Use the pretty render-vic-style.mjs version for humans / modern ATS (Ashby, Greenhouse, Lever);
 * use THIS for aggressive legacy portals or when an upload keeps mis-parsing.
 *
 * Usage: node bridge/render-ats.mjs --in <overlay.json> --name <slug> [--outdir output/x] [--no-pdf]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
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

const loadBase = (f) => JSON.parse(readFileSync(f, "utf8"));
function merge(base, ov) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(ov || {})) {
    out[k] = (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) ? merge(base[k], v) : v;
  }
  return out;
}

const dash = (s) => (s || "").replace(/[–—]/g, "-");           // en/em dash -> hyphen
const esc = (s) => dash(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clean = (a) => (a || []).map((x) => (x || "").trim()).filter(Boolean);

const base = loadBase(BASE);
const d = merge(base, inPath ? JSON.parse(readFileSync(resolve(inPath), "utf8")) : {});

const contact = [d.location, d.email, d.phone, d.portfolio, d.linkedin].filter(Boolean).map(dash).join("  |  ");
const jobs = (d.experience || []).filter((j) => j.org || j.role);
const refsOn = d.showReferences && (d.references || []).some((r) => r.name);

// ---- HTML ----
const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.name)} - Resume</title>
<style>
@page { size: letter; margin: 0.45in; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 9.6pt; line-height: 1.27; color: #000; margin: 0; }
h1 { font-size: 16pt; margin: 0 0 2px; }
.hl { font-size: 10.2pt; font-weight: bold; margin: 0 0 2px; }
.contact { font-size: 8.9pt; margin: 0 0 7px; }
h2 { font-size: 10.6pt; text-transform: uppercase; border-bottom: 1px solid #000; margin: 8px 0 4px; padding-bottom: 2px; }
p { margin: 0 0 4px; }
.job { margin-bottom: 5px; }
.jh { font-weight: bold; }
ul { margin: 2px 0 0 16px; padding: 0; }
li { margin-bottom: 1.5px; }
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

// ---- plain TXT (ultimate ATS-safe + paste-ready) ----
const line = (s = "") => dash(s);
const txt = [
  d.name.toUpperCase(), line(d.headline), contact, "",
  "SUMMARY", line(d.profile), "",
  "SKILLS", "Expertise: " + clean(d.expertise).map(line).join(", "), "Tools: " + clean(d.tools).map((t) => line(t.replace(/\s*·\s*/g, ", "))).join(", "), "",
  "EXPERIENCE",
  ...jobs.flatMap((j) => [`${line(j.org)} - ${line(j.role)} (${line(j.dates)})`, ...clean(j.bullets).map((b) => "- " + line(b)), ""]),
  "EDUCATION", ...(d.education || []).map((e) => [e.title, e.org, e.detail].filter(Boolean).map(line).join(" - ")), "",
  ...(refsOn ? ["REFERENCES", ...(d.references || []).filter((r) => r.name).map((r) => [r.name, r.title, r.contact].filter(Boolean).map(line).join(" - "))] : []),
].join("\n");

mkdirSync(OUTDIR, { recursive: true });
const stem = join(OUTDIR, `Resume_${name}_ATS`);
writeFileSync(`${stem}.html`, html);
writeFileSync(`${stem}.txt`, txt);
console.log(`✓ ${stem}.html\n✓ ${stem}.txt`);

if (wantPdf) {
  const { chromium } = await import("playwright");
  const b = await chromium.launch();
  try {
    const p = await b.newPage();
    await p.setContent(html, { waitUntil: "networkidle" });
    const h = await p.evaluate(() => document.body.scrollHeight);
    await p.pdf({ path: `${stem}.pdf`, format: "Letter", printBackground: false, preferCSSPageSize: true });
    console.log(`✓ ${stem}.pdf  (~${h}px${h > 1300 ? " — likely 2 pages; fine for ATS" : ""})`);
  } finally { await b.close(); }
}
