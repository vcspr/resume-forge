#!/usr/bin/env node
/**
 * forge.mjs — one resume, every design.
 *
 * Usage:
 *   node forge.mjs --theme swiss                          # demo persona, one theme
 *   node forge.mjs --theme swiss --data my-resume.json    # your data (merges over data/base.json)
 *   node forge.mjs --all --data my-resume.json            # every theme
 *   node forge.mjs --list                                 # list themes
 *
 * Options pass through to the theme renderers:
 *   --name <slug>    output basename (default: resume)
 *   --outdir <dir>   output directory (default: output)
 *   --no-pdf         emit HTML only (skip Chromium PDF)
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const THEMES = readdirSync(join(ROOT, "themes"))
  .filter((f) => f.startsWith("render-") && f.endsWith(".mjs"))
  .map((f) => f.slice("render-".length, -".mjs".length))
  .sort();

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const flag = (n) => argv.includes(n);

if (flag("--list")) { console.log(THEMES.join("\n")); process.exit(0); }

const wanted = flag("--all") ? THEMES : [opt("--theme")].filter(Boolean);
if (!wanted.length) {
  console.error(`Usage: node forge.mjs --theme <name> [--data resume.json] [--all]\nThemes: ${THEMES.join(", ")}`);
  process.exit(1);
}
const unknown = wanted.filter((t) => !THEMES.includes(t));
if (unknown.length) { console.error(`Unknown theme(s): ${unknown.join(", ")}`); process.exit(1); }

const pass = [];
const data = opt("--data");
if (data) pass.push("--in", data);
pass.push("--name", opt("--name", "resume"));
const outdir = opt("--outdir"); if (outdir) pass.push("--outdir", outdir);
if (flag("--no-pdf")) pass.push("--no-pdf");

let failed = 0;
for (const t of wanted) {
  const r = spawnSync("node", [join(ROOT, "themes", `render-${t}.mjs`), ...pass], { stdio: "inherit" });
  if (r.status !== 0) { console.error(`✗ theme "${t}" failed`); failed++; }
}
process.exit(failed ? 1 : 0);
