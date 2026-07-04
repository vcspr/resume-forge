#!/usr/bin/env node
/**
 * letter.mjs — a cover letter that matches your resume.
 *
 * Shares data/base.json (name, contact) with the resume themes; the letter
 * itself comes from a small JSON:
 *
 *   node letter.mjs --in examples/letter.json
 *
 * letter.json:
 *   { "recipient": "Hiring Team", "company": "Northwind Labs",
 *     "role": "Senior Product Designer",
 *     "paragraphs": ["...", "...", "..."] }
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const flag = (n) => argv.includes(n);

const inPath = opt("--in");
if (!inPath) { console.error("Usage: node letter.mjs --in letter.json [--data resume.json] [--out output]"); process.exit(1); }

const base = JSON.parse(readFileSync(join(ROOT, "data", "base.json"), "utf8"));
const over = opt("--data") ? JSON.parse(readFileSync(resolve(opt("--data")), "utf8")) : {};
const d = { ...base, ...over };
const L = JSON.parse(readFileSync(resolve(inPath), "utf8"));

const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
const contact = [d.email, d.phone, d.portfolio, d.linkedin].filter(Boolean).map(esc).join("  ·  ");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.name)} — Cover Letter</title>
<style>
@page { size: Letter; margin: 0.9in 1in; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: "Helvetica Neue", Arial, sans-serif; color: #111; font-size: 10pt; line-height: 1.55;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.name { font-size: 20pt; font-weight: 800; letter-spacing: -0.02em; }
.contact { font-size: 8.8pt; color: #333; margin-top: 4px; }
.rule { border-top: 1.2px solid #111; margin: 14px 0 22px; }
.date { font-size: 9.5pt; color: #333; margin-bottom: 18px; }
p { margin-bottom: 13px; }
.signoff { margin-top: 22px; }
.sig { font-weight: 700; margin-top: 4px; }
</style></head><body>
<div class="name">${esc(d.name)}</div>
<div class="contact">${contact}</div>
<div class="rule"></div>
<div class="date">${esc(L.date || today)}</div>
<p>Dear ${esc(L.recipient || "Hiring Team")},</p>
${(L.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join("\n")}
<div class="signoff">Sincerely,<div class="sig">${esc(d.name)}</div></div>
</body></html>`;

const OUT = resolve(opt("--out", "output"));
mkdirSync(OUT, { recursive: true });
const slug = (L.company || "letter").toLowerCase().replace(/[^\w]+/g, "-");
const htmlOut = join(OUT, `Letter_${slug}.html`);
writeFileSync(htmlOut, html);
console.log(`✓ ${htmlOut}`);

if (!flag("--no-pdf")) {
  const { chromium } = await import("playwright");
  const b = await chromium.launch();
  try {
    const p = await b.newPage();
    await p.setContent(html, { waitUntil: "networkidle" });
    await p.pdf({ path: join(OUT, `Letter_${slug}.pdf`), format: "Letter", printBackground: true, preferCSSPageSize: true });
    console.log(`✓ ${join(OUT, `Letter_${slug}.pdf`)}`);
  } finally { await b.close(); }
}
