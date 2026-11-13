// The samples run through the pure modules and the real listing: samples/expected.json is
// the oracle, the same one the smoke-test skill checks the running app against.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { iconFor } from "../mods/cria-files-extended/icons.js";
import { listCommand, parseListing, byKind } from "../mods/cria-files-extended/listing.js";

const SAMPLES = fileURLToPath(new URL("../samples/", import.meta.url));
const ICONS = fileURLToPath(new URL("../mods/cria-files-extended/icons/", import.meta.url));
const { rows } = JSON.parse(readFileSync(join(SAMPLES, "expected.json"), "utf8"));
const PLATFORM = { darwin: "macos", win32: "windows" }[process.platform] ?? process.platform;

// Every file and folder under samples/, folders ending in "/".
const tree = (dir, prefix = "") => readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((e) => {
  const path = `${prefix}${e.name}`;
  return e.isDirectory() ? [`${path}/`, ...tree(dir, `${path}/`)] : [path];
}).filter((p) => p !== "expected.json");

test("expected.json lists every sample, and every listed sample exists", () => {
  assert.deepEqual(tree(SAMPLES).sort(), Object.keys(rows).sort());
});

for (const [path, { icon, color }] of Object.entries(rows)) {
  test(`${path}: ${icon} in ${color}`, () => {
    const dir = path.endsWith("/"), name = path.replace(/\/$/, "").split("/").pop();
    assert.deepEqual(iconFor(name, dir, false), { icon, color });
    assert.ok(existsSync(join(ICONS, `${icon}.svg`)), `icons/${icon}.svg`);
  });
}

test("the listing shows the samples' top level as the panel orders it", () => {
  const r = spawnSync(...listCommand(SAMPLES.replace(/[\\/]$/, ""), PLATFORM), { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const top = Object.keys(rows).filter((p) => !p.replace(/\/$/, "").includes("/"));
  const expected = top.map((p) => ({ name: p.replace(/\/$/, ""), dir: p.endsWith("/") })).concat({ name: "expected.json", dir: false }).sort(byKind);
  assert.deepEqual(parseListing(r.stdout, PLATFORM).sort(byKind), expected);
});
