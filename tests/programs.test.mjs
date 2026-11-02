// The image and PDF scripts, run for real on this system against samples/: macOS
// exercises sips and PDFKit, Linux `file` and poppler, as the mod does on each.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { STAGE, PDFKIT, POPPLER, sizeCommand, pictureSize, popplerPages } from "../mods/cria-file-preview/programs.js";

const SAMPLES = fileURLToPath(new URL("../samples/", import.meta.url));
const PLATFORM = process.platform === "darwin" ? "macos" : process.platform; // as Herdr's window().platform
const has = (program) => spawnSync("sh", ["-c", `command -v ${program}`]).status === 0;
const sh = (script, ...args) => spawnSync("sh", ["-c", script, "test", ...args], { encoding: "utf8" });

test("pictureSize: sips, and file's output for each format", () => {
  assert.deepEqual(pictureSize("/x.jpg\n  pixelWidth: 480\n  pixelHeight: 270\n"), { width: 480, height: 270 });
  assert.deepEqual(pictureSize("PNG image data, 480 x 270, 8-bit/color RGB, non-interlaced"), { width: 480, height: 270 });
  assert.deepEqual(pictureSize("JPEG image data, JFIF standard 1.01, aspect ratio, density 1x1, segment length 16, baseline, precision 8, 480x270, components 3"), { width: 480, height: 270 });
  assert.deepEqual(pictureSize("GIF image data, version 87a, 480 x 270"), { width: 480, height: 270 });
  assert.deepEqual(pictureSize("PC bitmap, Windows 3.x format, 640 x 480 x 24, image size 921600, resolution 2835 x 2835 px/m"), { width: 640, height: 480 });
  assert.deepEqual(pictureSize("HEIF Image HEVC Main or Main Still Picture Profile"), { width: 0, height: 0 });
});

test("popplerPages: sizes in points, a turned page swapped", () => {
  const out = popplerPages("Stamp: 17\nPages: 3\nPage    1 size: 612 x 792 pts (letter)\nPage    1 rot:  0\nPage    2 size: 612 x 792 pts (letter)\nPage    2 rot:  90\n", "k");
  assert.deepEqual(out, { count: 3, pages: [
    { n: 1, path: "data/cria-file-preview/k-17-p1.png", width: 612, height: 792 },
    { n: 2, path: "data/cria-file-preview/k-17-p2.png", width: 792, height: 612 },
  ] });
});

test("STAGE: copies once, named by key and modification time", () => {
  const dir = mkdtempSync(join(tmpdir(), "cria-stage-"));
  const first = sh(STAGE, join(SAMPLES, "img/picture.png"), dir, "k", "png");
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout.trim(), /^k-\d+\.png$/);
  assert.ok(existsSync(join(dir, first.stdout.trim())));
  assert.equal(sh(STAGE, join(SAMPLES, "img/picture.png"), dir, "k", "png").stdout, first.stdout);

  const gone = sh(STAGE, join(SAMPLES, "img/missing.png"), dir, "k", "png");
  assert.equal(gone.status, 1);
  assert.equal(gone.stderr.trim(), "This file is no longer available");
});

for (const picture of ["picture.png", "picture.jpg", "picture.gif"]) {
  const [program, args] = sizeCommand(PLATFORM, join(SAMPLES, "img", picture));
  test(`size of ${picture} through ${program}`, { skip: !has(program) && `${program} isn't installed` }, () => {
    assert.deepEqual(pictureSize(execFileSync(program, args, { encoding: "utf8" })), { width: 480, height: 270 });
  });
}

test("PDF pages render, two of them, as PNGs in the cache folder", {
  skip: PLATFORM === "macos" ? !has("osascript") && "no osascript" : !has("pdftoppm") && "poppler-utils isn't installed",
}, () => {
  const dir = mkdtempSync(join(tmpdir(), "cria-pdf-")), pdf = join(SAMPLES, "sample.pdf");
  const out = PLATFORM === "macos"
    ? JSON.parse(execFileSync("osascript", ["-l", "JavaScript", "-e", PDFKIT, pdf, dir, "k", "1", "6", "200"], { encoding: "utf8" }))
    : popplerPages(execFileSync("sh", ["-c", POPPLER, "pdf", pdf, dir, "k", "1", "6", "200"], { encoding: "utf8" }), "k");
  assert.equal(out.count, 2);
  assert.deepEqual(out.pages.map((p) => p.n), [1, 2]);
  assert.ok(out.pages.every((p) => p.width > 0 && p.height > 0));
  assert.deepEqual(readdirSync(dir).sort(), out.pages.map((p) => p.path.replace("data/cria-file-preview/", "")).sort());
});
