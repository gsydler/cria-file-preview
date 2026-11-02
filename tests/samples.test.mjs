// The samples run through the pure modules: samples/expected.json is the oracle,
// the same one the smoke-test skill checks the running app against.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { viewerFor, languageOf, extension } from "../mods/cria-file-preview/kinds.js";
import { resolveLink } from "../mods/cria-file-preview/links.js";
import { splitBlocks } from "../mods/cria-file-preview/markdown-blocks.js";
import { delimiterOf, parseDelimited } from "../mods/cria-file-preview/delimited.js";
import { svgSize } from "../mods/cria-file-preview/svg-size.js";

const SAMPLES = fileURLToPath(new URL("../samples/", import.meta.url));
const EXPECTED = JSON.parse(readFileSync(join(SAMPLES, "expected.json"), "utf8"));
const read = (file) => readFileSync(join(SAMPLES, file), "utf8");

const files = (dir) => readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => e.isDirectory() ? files(join(dir, e.name)) : [relative(SAMPLES, join(dir, e.name))])
  .filter((f) => f !== "expected.json");

const headings = (file) => splitBlocks(read(file)).filter((b) => b.heading).map((b) => b.heading.slug);

test("expected.json lists every sample, and every listed sample exists", () => {
  assert.deepEqual(files(SAMPLES).sort(), Object.keys(EXPECTED).sort());
});

for (const [file, { viewer, facts }] of Object.entries(EXPECTED)) {
  test(`${file}: ${viewer} viewer`, () => {
    assert.equal(viewerFor(file), viewer);
    if (facts.language) assert.equal(languageOf(file), facts.language);

    if (viewer === "markdown") {
      const text = read(file), blocks = splitBlocks(text), images = blocks.filter((b) => b.image);
      assert.deepEqual(headings(file), facts.headings);
      assert.equal(images.length, facts.images);
      assert.equal(images.filter((b) => resolveLink(join(SAMPLES, file), b.image.src).url).length, facts.webImages);

      // Every link and image: a local file exists, an anchor names a heading, unless listed as broken on purpose.
      const targets = [...text.matchAll(/\]\(\s*<?([^)\s>]+)/g)].map((m) => m[1]);
      const missing = new Set(), unresolved = new Set();
      for (const href of targets) {
        const to = resolveLink(join(SAMPLES, file), href);
        assert.equal(to.error, undefined, `${href}: ${to.error}`);
        if (to.url) continue;
        const target = to.file ? relative(SAMPLES, to.file) : file;
        if (to.file && !existsSync(to.file)) { missing.add(target); continue; }
        if (to.anchor && !headings(target).includes(to.anchor)) unresolved.add(to.anchor);
      }
      assert.deepEqual([...missing], facts.missingFiles);
      assert.deepEqual([...unresolved], facts.unresolvedAnchors);
    }

    if (viewer === "table") {
      const text = read(file), delimiter = delimiterOf(extension(file), text), { rows } = parseDelimited(text, delimiter);
      assert.equal(delimiter, facts.delimiter);
      assert.equal(rows.length - 1, facts.rows);
      assert.ok(rows.every((r) => r.length === facts.columns), "every row has the header's column count");
      if (facts.cell) { const [row, column, value] = facts.cell; assert.equal(rows[row][column], value); }
    }

    if (viewer === "json") {
      let value = null, valid = true;
      try { value = JSON.parse(read(file)); } catch { valid = false; }
      assert.equal(valid, facts.valid);
      if (facts.keys !== undefined) assert.equal(Object.keys(value).length, facts.keys);
    }

    if (facts.width) assert.deepEqual(svgSize(read(file)), { width: facts.width, height: facts.height });
  });
}
