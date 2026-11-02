#!/usr/bin/env node
// Checks this repo against what herdr.dev/mods and Herdr's AGENTS.md ask of a shared mod,
// plus the mod rules a static read can catch. Runs in CI and in the release-check skill.
// No dependencies. Exit 1 on any error; warnings print but pass.
//
// Herdr's own `herdr-app check <mod folder>` (loads and renders the mod) needs the app,
// so it runs locally only, from the release-check skill.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [], warnings = [];
const error = (msg) => errors.push(msg), warn = (msg) => warnings.push(msg);
const read = (path) => readFileSync(join(ROOT, path), "utf8");
const exists = (path) => existsSync(join(ROOT, path));

// Mods Herdr ships (AGENTS.md, "Mods"): a shared mod must not take one of their names.
const SHIPPED = ["spaces", "agents", "tabs", "menu", "prompt", "confirm", "help", "toast", "picker", "peek", "pane", "worktree", "files"];
const PLACES = ["right", "left", "top", "bottom", "none"];
const IMPORTS = ["gpui-kit", "gpui-base", "herdr"];
const RECIPE_SECTIONS = ["What you see", "How it behaves", "Built from", "Watch out", "Done when"];
// Files the app writes into a mod folder (AGENTS.md: jsconfig.json, .d.ts): never committed.
const GENERATED = /(^|\/)(jsconfig\.json|[^/]+\.d\.ts)$/;
const SECRETS = [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bgh[pousr]_[A-Za-z0-9]{36}\b/, /\bAKIA[0-9A-Z]{16}\b/, /\bxox[baprs]-[A-Za-z0-9-]{10,}/, /\bsk-[A-Za-z0-9_-]{20,}/];

function walk(dir, out = []) {
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== "node_modules" && entry.name !== ".git") walk(path, out); }
    else out.push(path);
  }
  return out;
}

function tracked() {
  try { return execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean); }
  catch { return null; }
}

// --- Repo layout (herdr.dev/mods: mods/<name>/, RECIPE.md, preview.png, optional keys.json; no layouts/) ---

if (exists("layouts")) error("layouts/ found: a mod repo has only mods/<name>/ (a layout goes to herdr.dev/layouts)");
if (!exists("LICENSE")) error("LICENSE missing");
if (!exists("RECIPE.md")) error("RECIPE.md missing: herdr.dev/mods lists a mod from its recipe");
if (!exists("preview.png")) error("preview.png missing: herdr.dev/mods shows it on the mod's card");
if (exists("keys.json")) { try { JSON.parse(read("keys.json")); } catch (e) { error(`keys.json is not valid JSON: ${e.message}`); } }

const mods = exists("mods") ? readdirSync(join(ROOT, "mods"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
if (!mods.length) error("no mods/<name>/ folder");

// --- preview.png ---

if (exists("preview.png")) {
  const png = readFileSync(join(ROOT, "preview.png"));
  if (png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") error("preview.png is not a PNG");
  else {
    const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
    if (width < 800) warn(`preview.png is ${width}px wide: under 800px looks blurry on the mods page`);
    if (png.length > 2 * 1024 * 1024) warn(`preview.png is ${(png.length / 1048576).toFixed(1)} MB: keep it under 2 MB`);
    if (width / height > 3 || height / width > 3) warn(`preview.png is ${width}×${height}: an extreme ratio crops badly`);
  }
}

// --- RECIPE.md (AGENTS.md, "Layouts and mods other people made": six parts, in order) ---

if (exists("RECIPE.md")) {
  const recipe = read("RECIPE.md");
  if (!/^# \S/.test(recipe)) error("RECIPE.md must start with '# <Name>'");
  if (!/!\[[^\]]*\]\(preview\.png\)/.test(recipe)) error("RECIPE.md must show ![Name](preview.png) under its title");
  const headings = [...recipe.matchAll(/^#{2,3}\s+(.+?)\s*$/gm)].map((m) => m[1].replace(/[*:]/g, "").trim().toLowerCase());
  let at = -1;
  for (const section of RECIPE_SECTIONS) {
    const i = headings.indexOf(section.toLowerCase());
    if (i < 0) error(`RECIPE.md has no '## ${section}' section`);
    else if (i < at) error(`RECIPE.md: '## ${section}' is out of order (${RECIPE_SECTIONS.join(", ")})`);
    else at = i;
  }
}

// --- Each mod (AGENTS.md, "Mods: mods/<name>/" and "A mod") ---

const code = [];
for (const name of mods) {
  const dir = `mods/${name}`;
  if (SHIPPED.includes(name)) error(`${dir}: '${name}' is a mod Herdr ships; rename it`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) warn(`${dir}: use lower-case letters, digits and dashes in a mod name`);

  if (!exists(`${dir}/main.js`)) error(`${dir}/main.js missing`);
  else if (!/export\s+default\s+class\s+\w+\s+extends\s+View\b/.test(read(`${dir}/main.js`))) error(`${dir}/main.js must default-export a class extending View`);

  if (!exists(`${dir}/mod.json`)) warn(`${dir}/mod.json missing: the mod docks with Herdr's defaults`);
  else {
    let manifest = null;
    try { manifest = JSON.parse(read(`${dir}/mod.json`)); } catch (e) { error(`${dir}/mod.json is not valid JSON: ${e.message}`); }
    if (manifest) {
      if (manifest.place !== undefined && !PLACES.includes(manifest.place)) error(`${dir}/mod.json: place must be one of ${PLACES.join(", ")}`);
      if (manifest.size !== undefined && !(typeof manifest.size === "number" && manifest.size > 0)) error(`${dir}/mod.json: size must be a positive number`);
      if (manifest.focusable !== undefined && typeof manifest.focusable !== "boolean") error(`${dir}/mod.json: focusable must be true or false`);
    }
  }

  for (const file of walk(dir).filter((f) => f.endsWith(".js"))) {
    const text = read(file);
    code.push({ file, text, name });

    try { execFileSync(process.execPath, ["--check", join(ROOT, file)], { stdio: "pipe" }); }
    catch (e) { error(`${file}: syntax error\n${String(e.stderr).trim()}`); }

    // Comments and strings stripped: "setTimeout" in a comment explaining why it isn't used is fine.
    const bare = text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "").replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, '""');
    if (/\b(setTimeout|setInterval)\s*\(/.test(bare)) error(`${file}: setTimeout/setInterval don't exist in a mod; use cx.timer`);
    if (/\brequire\s*\(/.test(bare)) error(`${file}: require() doesn't exist in a mod; use import`);
    if (/^await\b/m.test(bare)) error(`${file}: top-level await; use cx.spawn in init`);

    for (const [, spec] of text.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)) {
      if (spec.startsWith(".")) { if (!existsSync(join(ROOT, dirname(file), spec))) error(`${file}: imports ${spec}, which doesn't exist`); }
      else if (!IMPORTS.includes(spec)) error(`${file}: imports '${spec}'; a mod can import only ${IMPORTS.join(", ")} and its own files`);
    }

    // Assets load from the Herdr home as mods/<name>/…, so the folder name is part of every path.
    for (const [, owner, rest] of text.matchAll(/["'`]mods\/([^/"'`$]+)\/([^"'`]*)["'`]/g)) {
      if (owner !== name) error(`${file}: asset path mods/${owner}/… points outside this mod (${name})`);
      else if (rest && !rest.includes("${") && !exists(`${dir}/${rest}`)) error(`${file}: asset mods/${owner}/${rest} doesn't exist`);
    }
    for (const [, target] of text.matchAll(/\bmod:\s*["']([^"']+)["']/g)) {
      if (target !== name && !mods.includes(target)) warn(`${file}: opens mod '${target}', which isn't in this repo`);
    }
  }
}

// --- What a person must be told before adding it (AGENTS.md, step 1): network, programs, outside files ---

if (exists("RECIPE.md")) {
  const recipe = read("RECIPE.md").toLowerCase(), all = code.map((c) => c.text).join("\n");
  const disclose = [
    [/\bexec\s*\(|\bhc\s*\(/, /\bexec\b|runs programs|\bprograms?\b/, "runs programs (exec/hc)"],
    [/\bfetch\s*\(|\bcurl\b|open_url/, /network|download|fetch|web/, "reaches the network"],
    [/readTextFile|watchFolder/, /outside its (own )?folder|any file|files? (it|you) open/, "reads files outside its own folder"],
  ];
  for (const [uses, says, what] of disclose) if (uses.test(all) && !says.test(recipe)) error(`RECIPE.md must say the mod ${what}`);
}

// --- Repo hygiene ---

const files = tracked();
if (files) {
  for (const f of files.filter((f) => GENERATED.test(f))) error(`${f} is written by Herdr; untrack it (.gitignore has it)`);
  for (const f of files) {
    const full = join(ROOT, f);
    if (!existsSync(full) || statSync(full).size > 1_000_000 || /\.(png|jpe?g|gif|pdf|heic|webp)$/i.test(f)) continue;
    const text = readFileSync(full, "utf8");
    for (const re of SECRETS) if (re.test(text)) error(`${f}: looks like a secret (${re.source.slice(0, 24)}…)`);
  }
} else warn("not a git checkout: skipped the tracked-file checks");

if (!exists("CHANGELOG.md")) warn("CHANGELOG.md missing");
else if (!/^## \[Unreleased\]/m.test(read("CHANGELOG.md"))) warn("CHANGELOG.md has no '## [Unreleased]' section");
if (!exists("README.md")) warn("README.md missing: GitHub visitors land on it");

// --- Report ---

for (const w of warnings) console.log(`warning  ${w}`);
for (const e of errors) console.log(`error    ${e}`);
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s) · ${mods.length} mod(s): ${mods.join(", ") || "none"}`);
process.exit(errors.length ? 1 : 0);
