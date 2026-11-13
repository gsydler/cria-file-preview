#!/usr/bin/env node
// Checks this repo against what herdr.dev/mods and Herdr's AGENTS.md ask of a shared mod,
// plus the mod rules a static read can catch. Runs in CI and in the release-check skill.
// No dependencies. Exit 1 on any error; warnings print but pass.
//
// The repo holds several gallery entries: each top-level folder with a RECIPE.md is one,
// listed as herdr.dev/mods/<OWNER>/<REPO>--<folder>. `node scripts/check-herdr.mjs` checks
// them all; `node scripts/check-herdr.mjs file-preview` checks one.
//
// Herdr's own `herdr-app check <mod folder>` (loads and renders the mod) needs the app,
// so it runs locally only, from the release-check skill.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// The gallery builds each entry's address from these: a rename of the repo changes every one.
const OWNER = "gsydler", REPO = "herdr-cria";
const errors = [], warnings = [];
const error = (msg) => errors.push(msg), warn = (msg) => warnings.push(msg);
const read = (path) => readFileSync(join(ROOT, path), "utf8");
const exists = (path) => existsSync(join(ROOT, path));

// Mods Herdr ships (AGENTS.md, "Mods"): a shared mod must not take one of their names.
const SHIPPED = ["spaces", "agents", "tabs", "menu", "prompt", "confirm", "help", "toast", "picker", "peek", "pane", "worktree", "files"];
const PLACES = ["right", "left", "top", "bottom", "none"];
// AGENTS.md ("The `herdr` module") also lists `fs/promises` among a mod's built-ins.
const IMPORTS = ["gpui-kit", "gpui-base", "herdr", "fs/promises"];
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

// --- Repo layout (herdr.dev/mods: each entry a folder with mods/<name>/, RECIPE.md, preview.png,
//     optional keys.json; no layouts/. One repo can hold several.) ---

if (!exists("LICENSE")) error("LICENSE missing");
if (!exists("README.md")) warn("README.md missing: GitHub visitors land on it");
// A RECIPE.md at the top would make the whole repo one more entry, at herdr.dev/mods/<OWNER>/<REPO>.
for (const stray of ["RECIPE.md", "preview.png", "keys.json", "mods", "layouts"]) {
  if (exists(stray)) error(`${stray} at the top of the repo: it belongs in a mod's folder (<folder>/${stray})`);
}

const entries = readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith(".") && exists(`${d.name}/RECIPE.md`))
  .map((d) => d.name).sort();
if (!entries.length) error("no mod folder: a gallery entry is a top-level folder with a RECIPE.md");
const only = process.argv[2];
if (only && !entries.includes(only)) error(`${only}: not a mod folder (${entries.join(", ")})`);

const allMods = new Map(); // mod name -> entries carrying it
for (const entry of entries) {
  const mods = exists(`${entry}/mods`) ? readdirSync(join(ROOT, entry, "mods"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
  for (const name of mods) allMods.set(name, [...(allMods.get(name) ?? []), entry]);
}

for (const entry of entries) if (!only || entry === only) checkEntry(entry);

// A mod carried by two entries is installed from either: the copies must stay identical.
for (const [name, carriers] of allMods) {
  if (carriers.length < 2) continue;
  const [first, ...rest] = carriers, base = `${first}/mods/${name}`;
  const list = (dir) => walk(dir).map((f) => relative(join(ROOT, dir), join(ROOT, f))).sort();
  for (const other of rest) {
    const dir = `${other}/mods/${name}`, a = list(base), b = list(dir);
    if (a.join("\n") !== b.join("\n") || a.some((f) => read(`${base}/${f}`) !== read(`${dir}/${f}`))) {
      error(`mods/${name} differs between ${first}/ and ${other}/: copies of one mod must be identical`);
    }
  }
}

// Files two mods each carry a copy of, since a mod can't import another's: open-file.js is how a
// panel opens cria-file-preview (file-preview/CLAUDE.md), and both open files in the editor alike.
const SAME = ["open-file.js", "editor-command.js", "editor.js"];
for (const same of SAME) {
  const copies = [...allMods].flatMap(([name, [entry]]) => exists(`${entry}/mods/${name}/${same}`) ? [`${entry}/mods/${name}/${same}`] : []);
  for (const file of copies.slice(1)) if (read(file) !== read(copies[0])) error(`${file} differs from ${copies[0]}: copies of ${same} must be identical`);
}

// --- Links to the gallery: each must name a real entry, or it lands on herdr.dev's home page ---

const docs = walk(".").filter((f) => f.endsWith(".md"));
for (const file of docs) {
  // A slug ending at "<" is a placeholder, like herdr-cria--<folder>.
  for (const [, owner, slug] of read(file).matchAll(/herdr\.dev\/mods\/([\w.-]+)\/([\w.-]+)(?![\w.<-])/g)) {
    if (owner !== OWNER) continue;
    const entry = slug.startsWith(`${REPO}--`) ? slug.slice(REPO.length + 2) : null;
    if (!entry || !entries.includes(entry)) error(`${file}: herdr.dev/mods/${owner}/${slug} is no entry; use herdr.dev/mods/${OWNER}/${REPO}--<folder>`);
  }
}

function checkEntry(entry) {
  const at = (path) => `${entry}/${path}`;

  if (exists(at("layouts"))) error(`${at("layouts/")} found: a mod entry has only mods/<name>/ (a layout goes to herdr.dev/layouts)`);
  if (!exists(at("preview.png"))) error(`${at("preview.png")} missing: herdr.dev/mods shows it on the mod's card`);
  if (exists(at("keys.json"))) { try { JSON.parse(read(at("keys.json"))); } catch (e) { error(`${at("keys.json")} is not valid JSON: ${e.message}`); } }

  const mods = exists(at("mods")) ? readdirSync(join(ROOT, entry, "mods"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
  if (!mods.length) error(`${entry}: no mods/<name>/ folder`);

  // --- preview.png ---

  if (exists(at("preview.png"))) {
    const png = readFileSync(join(ROOT, at("preview.png")));
    if (png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") error(`${at("preview.png")} is not a PNG`);
    else {
      const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
      if (width < 800) warn(`${at("preview.png")} is ${width}px wide: under 800px looks blurry on the mods page`);
      if (png.length > 2 * 1024 * 1024) warn(`${at("preview.png")} is ${(png.length / 1048576).toFixed(1)} MB: keep it under 2 MB`);
      if (width / height > 3 || height / width > 3) warn(`${at("preview.png")} is ${width}×${height}: an extreme ratio crops badly`);
    }
  }

  // --- RECIPE.md (AGENTS.md, "Layouts and mods other people made": six parts, in order) ---

  const recipe = read(at("RECIPE.md"));
  if (!/^# \S/.test(recipe)) error(`${at("RECIPE.md")} must start with '# <Name>'`);
  if (!/!\[[^\]]*\]\(preview\.png\)/.test(recipe)) error(`${at("RECIPE.md")} must show ![Name](preview.png) under its title`);
  const headings = [...recipe.matchAll(/^#{2,3}\s+(.+?)\s*$/gm)].map((m) => m[1].replace(/[*:]/g, "").trim().toLowerCase());
  let last = -1;
  for (const section of RECIPE_SECTIONS) {
    const i = headings.indexOf(section.toLowerCase());
    if (i < 0) error(`${at("RECIPE.md")} has no '## ${section}' section`);
    else if (i < last) error(`${at("RECIPE.md")}: '## ${section}' is out of order (${RECIPE_SECTIONS.join(", ")})`);
    else last = i;
  }

  // --- Each mod (AGENTS.md, "Mods: mods/<name>/" and "A mod") ---

  const code = [];
  for (const name of mods) {
    const dir = at(`mods/${name}`);
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
      // AGENTS.md ("A mod"): side effects on globalThis survive a reload, and a cx belongs to one callback.
      if (/\bglobalThis\b/.test(bare)) warn(`${file}: globalThis outlives a reload; keep side effects out of the module's top level`);
      if (/\bthis\.\w+\s*=\s*cx\b(?!\s*[.([])/.test(bare)) warn(`${file}: keeps a cx for later; use the one each callback gets`);

      for (const [, spec] of text.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)) {
        if (spec.startsWith(".")) {
          const target = relative(ROOT, join(ROOT, dirname(file), spec));
          if (!existsSync(join(ROOT, target))) error(`${file}: imports ${spec}, which doesn't exist`);
          else if (!target.startsWith(`${dir}/`)) error(`${file}: imports ${spec}, outside its own folder; Herdr can't load it`);
        }
        else if (!IMPORTS.includes(spec)) error(`${file}: imports '${spec}'; a mod can import only ${IMPORTS.join(", ")} and its own files`);
      }

      // Assets load from the Herdr home as mods/<name>/…, so the folder name is part of every path.
      for (const [, owner, rest] of text.matchAll(/["'`]mods\/([^/"'`$]+)\/([^"'`]*)["'`]/g)) {
        if (owner !== name) error(`${file}: asset path mods/${owner}/… points outside this mod (${name})`);
        else if (rest && !rest.includes("${") && !exists(`${dir}/${rest}`)) error(`${file}: asset mods/${owner}/${rest} doesn't exist`);
      }
      // The gallery installs one entry: a mod it opens must come with it, unless another entry
      // here carries it, to install on its own (its RECIPE.md says what the opener does without it).
      for (const [, target] of text.matchAll(/\bmod:\s*["']([^"']+)["']/g)) {
        if (target !== name && !mods.includes(target) && !allMods.has(target)) warn(`${file}: opens mod '${target}', which isn't in ${entry}/mods/`);
        else if (target !== name && !mods.includes(target) && !recipe.includes(target)) warn(`${file}: opens mod '${target}' from another entry; ${at("RECIPE.md")} should name it and say what happens without it`);
      }
    }
  }

  // --- What a person must be told before adding it (AGENTS.md, step 1): network, programs, outside files ---

  const said = recipe.toLowerCase(), all = code.map((c) => c.text).join("\n");
  const disclose = [
    [/\bexec\s*\(|\bhc\s*\(/, /\bexec\b|runs programs|\bprograms?\b/, "runs programs (exec/hc)"],
    [/\bfetch\s*\(|\bcurl\b|open_url/, /network|download|fetch|web/, "reaches the network"],
    [/readTextFile|watchFolder/, /outside its (own )?folder|any file|files? (it|you) open/, "reads files outside its own folder"],
  ];
  // Writing files through fs/promises is told in "Watch out" (where the RECIPE says what the mod does).
  const watchOut = recipe.split(/^## Watch out\s*$/m)[1]?.split(/^## /m)[0].toLowerCase() ?? "";
  if (/\bfs\.(writeFile|appendFile|rm|rename|mkdir|unlink)\s*\(/.test(all) && !/\bwrit/.test(watchOut)) warn(`${at("RECIPE.md")}: the mod writes files (fs/promises); its "Watch out" should say where`);
  for (const [uses, says, what] of disclose) if (uses.test(all) && !says.test(said)) error(`${at("RECIPE.md")} must say the mod ${what}`);

  // --- The entry's own documents ---

  if (!exists(at("CHANGELOG.md"))) warn(`${at("CHANGELOG.md")} missing`);
  else if (!/^## \[Unreleased\]/m.test(read(at("CHANGELOG.md")))) warn(`${at("CHANGELOG.md")} has no '## [Unreleased]' section`);
  if (!exists(at("README.md"))) warn(`${at("README.md")} missing: GitHub shows it when someone opens the folder`);
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


// --- Report ---

for (const w of warnings) console.log(`warning  ${w}`);
for (const e of errors) console.log(`error    ${e}`);
const checked = entries.filter((e) => !only || e === only);
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s) · ${checked.length} entr${checked.length === 1 ? "y" : "ies"}: ${checked.map((e) => `${e} (${[...allMods].filter(([, c]) => c.includes(e)).map(([m]) => m).join(", ")})`).join("; ") || "none"}`);
process.exit(errors.length ? 1 : 0);
