// The image and PDF scripts, run for real on this system against samples/: macOS
// exercises sips and PDFKit, Linux `file` and poppler, Windows PowerShell and
// Windows.Data.Pdf, as the mod does on each.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { programs, pdfPages, pictureSize, popplerPages } from "../mods/cria-file-preview/programs.js";
import { commands, powershell } from "../mods/cria-file-preview/platform.js";
import { terminalEditor } from "../mods/cria-file-preview/editor-command.js";

const SAMPLES = fileURLToPath(new URL("../samples/", import.meta.url));
const PLATFORM = { darwin: "macos", win32: "windows" }[process.platform] ?? process.platform; // as Herdr's window().platform
const P = programs(PLATFORM), windows = { skip: PLATFORM !== "windows" };
const has = (program) => PLATFORM === "windows" || spawnSync("sh", ["-c", `command -v ${program}`]).status === 0;
const run = ([program, args], options) => spawnSync(program, args, { encoding: "utf8", ...options });

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

test("pdfPages: each system's failure in words", () => {
  const failed = (stderr) => ({ code: 1, stdout: "", stderr });
  assert.throws(() => pdfPages("macos", failed("0:1: execution error: Error: This PDF is password protected (-2700)"), "k"), /^Error: This PDF is password protected$/);
  assert.throws(() => pdfPages("linux", failed("Command Line Error: Incorrect password"), "k"), /^Error: This PDF is password protected$/);
  assert.throws(() => pdfPages("windows", failed("This PDF cannot be read\r\n"), "k"), /^Error: This PDF cannot be read$/);
  assert.throws(() => pdfPages("windows", failed(""), "k"), /^Error: Cannot render this PDF$/);
});

test("pdfPages: a path outside the cache folder is refused", () => {
  const stdout = JSON.stringify({ count: 1, pages: [{ n: 1, path: "../../secret.png", width: 1, height: 1 }] });
  assert.throws(() => pdfPages("windows", { code: 0, stdout, stderr: "" }, "k"), /unexpected/);
  assert.throws(() => pdfPages("macos", { code: 0, stdout: "{}", stderr: "" }, "k"), /unexpected/);
});

test("stage: copies once, named by key and modification time", () => {
  const dir = mkdtempSync(join(tmpdir(), "cria-stage-"));
  const first = run(P.stage(join(SAMPLES, "img/picture.png"), dir, "k", "png"));
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout.trim(), /^k-\d+\.png$/);
  assert.ok(existsSync(join(dir, first.stdout.trim())));
  assert.equal(run(P.stage(join(SAMPLES, "img/picture.png"), dir, "k", "png")).stdout, first.stdout);

  const gone = run(P.stage(join(SAMPLES, "img/missing.png"), dir, "k", "png"));
  assert.equal(gone.status, 1);
  assert.equal(gone.stderr.trim(), "This file is no longer available");
});

test("stage: a copy counts as new, however old the file", () => {
  const dir = mkdtempSync(join(tmpdir(), "cria-stage-")), old = join(dir, "old.png");
  writeFileSync(old, "x");
  utimesSync(old, new Date("2020-01-01"), new Date("2020-01-01"));
  const name = run(P.stage(old, join(dir, "cache"), "k", "png")).stdout.trim();
  assert.ok(Date.now() - statSync(join(dir, "cache", name)).mtimeMs < 60000);
});

test("stage: a read-only or hidden file stages, and its copy is neither", windows, () => {
  const dir = mkdtempSync(join(tmpdir(), "cria-stage-")), source = join(dir, "locked.png");
  writeFileSync(source, "x");
  chmodSync(source, 0o444);
  spawnSync("attrib", ["+h", source]);
  const r = run(P.stage(source, join(dir, "cache"), "k", "png"));
  assert.equal(r.status, 0, r.stderr);
  const copy = join(dir, "cache", r.stdout.trim()), mode = spawnSync("attrib", [copy], { encoding: "utf8" }).stdout;
  assert.doesNotMatch(mode.slice(0, 12), /[RH]/);
});

test("a file's size in bytes", () => {
  const r = run(P.bytes(join(SAMPLES, "notes.txt")));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(Number(r.stdout.trim()), statSync(join(SAMPLES, "notes.txt")).size);
});

test("a missing file has no size: the command fails", () => {
  assert.notEqual(run(P.bytes(join(SAMPLES, "img/missing.png"))).status, 0);
});

test("head: the first bytes, exactly", () => {
  const dir = mkdtempSync(join(tmpdir(), "cria-head-")), file = join(dir, "a.txt");
  writeFileSync(file, "0123456789");
  const [program, args] = P.head(file, 4);
  assert.deepEqual(spawnSync(program, args).stdout, Buffer.from("0123"));
});

test("prune: drops only what is over two weeks old", () => {
  const dir = mkdtempSync(join(tmpdir(), "cria-prune-")), old = join(dir, "old.png"), fresh = join(dir, "fresh.png");
  writeFileSync(old, "x"); writeFileSync(fresh, "x");
  utimesSync(old, new Date(Date.now() - 20 * 864e5), new Date(Date.now() - 20 * 864e5));
  const r = run(P.prune(dir));
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(readdirSync(dir), ["fresh.png"]);
});

test("prune: reaches hidden files too", windows, () => {
  const dir = mkdtempSync(join(tmpdir(), "cria-prune-")), old = join(dir, "old.png");
  writeFileSync(old, "x");
  utimesSync(old, new Date(Date.now() - 20 * 864e5), new Date(Date.now() - 20 * 864e5));
  spawnSync("attrib", ["+h", old]);
  assert.equal(run(P.prune(dir)).status, 0);
  assert.deepEqual(readdirSync(dir), []);
});

test("move and remove", () => {
  const dir = mkdtempSync(join(tmpdir(), "cria-move-")), from = join(dir, "a"), to = join(dir, "b");
  writeFileSync(from, "new"); writeFileSync(to, "old");
  assert.equal(run(P.move(from, to)).status, 0);
  assert.deepEqual(readdirSync(dir), ["b"]);
  assert.equal(run(P.remove(to)).status, 0);
  assert.deepEqual(readdirSync(dir), []);
});

test("fetch: a failed download fails and leaves nothing behind", () => {
  const dir = mkdtempSync(join(tmpdir(), "cria-fetch-"));
  assert.notEqual(run(P.fetch("https://127.0.0.1:9/a.png", dir, "k")).status, 0);
  assert.deepEqual(readdirSync(dir), []);
});

test("mime: read from the file itself", () => {
  const dir = mkdtempSync(join(tmpdir(), "cria-mime-")), type = (file) => run(P.mime(file)).stdout.trim();
  assert.equal(type(join(SAMPLES, "img/picture.png")), "image/png");
  assert.equal(type(join(SAMPLES, "img/picture.jpg")), "image/jpeg");
  assert.equal(type(join(SAMPLES, "img/picture.gif")), "image/gif");
  writeFileSync(join(dir, "fake.png"), "this is not a picture");
  assert.doesNotMatch(type(join(dir, "fake.png")), /^image\//);
});

test("mime: an SVG, prefixed or not, is an image; an empty file isn't", windows, () => {
  const dir = mkdtempSync(join(tmpdir(), "cria-mime-")), type = (name, text) => {
    writeFileSync(join(dir, name), text);
    return run(P.mime(join(dir, name))).stdout.trim();
  };
  assert.equal(type("a.svg", '<?xml version="1.0"?>\n<svg width="1"/>'), "image/svg+xml");
  assert.equal(type("b.svg", '<ns0:svg xmlns:ns0="http://www.w3.org/2000/svg"/>'), "image/svg+xml");
  assert.doesNotMatch(type("empty", ""), /^image\//);
  assert.doesNotMatch(type("html", "<html><body>svg</body></html>"), /^image\//);
});

test("mime: a page holding an SVG is a page", windows, () => {
  const dir = mkdtempSync(join(tmpdir(), "cria-mime-")), type = (name, text) => {
    writeFileSync(join(dir, name), text);
    return run(P.mime(join(dir, name))).stdout.trim();
  };
  assert.doesNotMatch(type("a", "<!doctype html><html><body><svg width='1'/></body></html>"), /^image\//);
  assert.doesNotMatch(type("b", "<div><svg width='1'/></div>"), /^image\//);
  assert.doesNotMatch(type("c", "<!doctype html><svg width='1'/>"), /^image\//);
});

test("mime: what may come before an SVG's tag", windows, () => {
  const dir = mkdtempSync(join(tmpdir(), "cria-mime-")), type = (name, text) => {
    writeFileSync(join(dir, name), text);
    return run(P.mime(join(dir, name))).stdout.trim();
  };
  assert.equal(type("a", "\n  <svg width='1'/>"), "image/svg+xml");
  assert.equal(type("b", "<?xml version='1.0'?>\n<!-- drawn\n by hand -->\n<!DOCTYPE svg PUBLIC 'x' 'y'>\n<SVG width='1'/>"), "image/svg+xml");
  assert.equal(type("c", `${String.fromCharCode(0xFEFF)}<svg width='1'/>`), "image/svg+xml");
});

for (const picture of ["picture.png", "picture.jpg", "picture.gif"]) {
  const [program, args] = P.size(join(SAMPLES, "img", picture));
  test(`size of ${picture} through ${program}`, { skip: !has(program) && `${program} isn't installed` }, () => {
    assert.deepEqual(pictureSize(execFileSync(program, args, { encoding: "utf8" })), { width: 480, height: 270 });
  });
}

test("PDF pages render, two of them, as PNGs in the cache folder", {
  skip: PLATFORM === "macos" ? !has("osascript") && "no osascript" : !has("pdftoppm") && "poppler-utils isn't installed",
}, () => {
  const dir = mkdtempSync(join(tmpdir(), "cria-pdf-")), pdf = join(SAMPLES, "sample.pdf");
  const r = run(P.pdf(pdf, dir, "k", 1, 6, 200));
  const out = pdfPages(PLATFORM, { code: r.status, stdout: r.stdout, stderr: r.stderr }, "k");
  assert.equal(out.count, 2);
  assert.deepEqual(out.pages.map((p) => p.n), [1, 2]);
  assert.ok(out.pages.every((p) => p.width > 0 && p.height > 0));
  assert.deepEqual(readdirSync(dir).sort(), out.pages.map((p) => p.path.replace("data/cria-file-preview/", "")).sort());
});

test("PDF: renders of one file at once all finish, and leave no temp file", windows, async () => {
  for (let round = 0; round < 3; round++) {
    const dir = mkdtempSync(join(tmpdir(), "cria-pdf-")), [program, args] = P.pdf(join(SAMPLES, "sample.pdf"), dir, "k", 1, 2, 200);
    const codes = await Promise.all(Array.from({ length: 6 }, () => new Promise((done) => spawn(program, args, { stdio: "ignore" }).on("close", done))));
    assert.deepEqual(codes, [0, 0, 0, 0, 0, 0]);
    assert.equal(readdirSync(dir).length, 2);
  }
});

test("PDF: a file that is no PDF says so", windows, () => {
  const dir = mkdtempSync(join(tmpdir(), "cria-pdf-")), bad = join(dir, "bad.pdf");
  writeFileSync(bad, "not a pdf");
  const r = run(P.pdf(bad, dir, "k", 1, 6, 200));
  assert.equal(r.status, 1);
  assert.equal(r.stderr.trim(), "This PDF cannot be read");
});

test("PDF: a file gone says so", windows, () => {
  const dir = mkdtempSync(join(tmpdir(), "cria-pdf-"));
  const r = run(P.pdf(join(dir, "gone.pdf"), dir, "k", 1, 6, 200));
  assert.equal(r.status, 1);
  assert.equal(r.stderr.trim(), "This file is no longer available");
});

test("PowerShell gets a value whole, however hostile", windows, () => {
  const hostile = "it's ’ ‘ \"; Write-Output PWNED; ' $HOME `n é 😀";
  const r = run(powershell("Write-Output $args[0]", hostile));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), hostile);
});

test("PowerShell gets an empty value as an empty string", windows, () => {
  assert.equal(run(powershell("Write-Output ('[' + $args[0] + ']')", "")).stdout.trim(), "[]");
});

// A stand-in editor that records the file it was given, in a folder with a space.
function fakeEditor() {
  const dir = mkdtempSync(join(tmpdir(), "cria editor ")), bin = join(dir, "Program Files");
  mkdirSync(bin);
  const program = join(bin, "ed.cmd"), out = join(dir, "opened.txt");
  writeFileSync(program, `@echo %~1>"${out}"\r\n`);
  return { program, out };
}

async function opened(out) {
  for (let i = 0; i < 100 && !existsSync(out); i++) await new Promise((done) => setTimeout(done, 100));
  return readFileSync(out, "utf8").trim();
}

for (const [form, value] of [["quoted", (p) => `"${p}" --wait`], ["unquoted", (p) => `${p} --wait`], ["with no flag", (p) => p]]) {
  test(`editor: a program path with spaces, ${form}`, windows, async () => {
    const { program, out } = fakeEditor();
    const r = run(commands("windows", new Set()).editor("C:/some dir/a.md"), { env: { ...process.env, VISUAL: value(program), EDITOR: "" } });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(await opened(out), "C:\\some dir\\a.md");
  });
}

// A stand-in program that records its arguments. No space in its path: $EDITOR is split into words.
function fakePosix(name) {
  const dir = mkdtempSync(join(tmpdir(), "cria-editor-")), program = join(dir, name), out = join(dir, "opened.txt");
  writeFileSync(program, `#!/bin/sh\nprintf '%s\\n' "$@" > "${out}"\n`);
  chmodSync(program, 0o755);
  return { dir, program, out };
}

const posix = { skip: PLATFORM === "windows" && "no sh on Herdr's Windows PATH" };
// HOME is an empty folder: the login shell reads no profile of the person running the tests.
const home = () => mkdtempSync(join(tmpdir(), "cria-home-"));
const editorRun = (file, env) => run(commands(PLATFORM, new Set()).editor(file), { env: { ...process.env, HOME: home(), SHELL: "/bin/sh", VISUAL: "", EDITOR: "", ...env }, timeout: 60000 });

test("editor: $VISUAL without its wait flags, the file whole", posix, () => {
  const { program, out } = fakePosix("ed"), file = "/some dir/$(touch pwned) it's.md";
  const r = editorRun(file, { VISUAL: `${program} --wait -x * -w` });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(readFileSync(out, "utf8").trim().split("\n"), ["-x", "*", file]);
});

test("editor: $EDITOR when $VISUAL is empty", posix, () => {
  const { program, out } = fakePosix("ed");
  assert.equal(editorRun("/a.md", { EDITOR: program }).status, 0);
  assert.equal(readFileSync(out, "utf8").trim(), "/a.md");
});

test("editor: the system's opener when neither is set", posix, () => {
  const { dir, out } = fakePosix(PLATFORM === "linux" ? "xdg-open" : "open");
  assert.equal(editorRun("/a.md", { PATH: `${dir}:${process.env.PATH}` }).status, 0);
  assert.equal(readFileSync(out, "utf8").trim(), "/a.md");
});

test("editor: a program that isn't there fails, for the toast", posix, () => {
  const r = editorRun("/a.md", { VISUAL: "/no/such/editor" });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no\/such\/editor/);
});

test("editor: a terminal editor comes back for a Herdr tab, without its wait flags", posix, () => {
  const r = editorRun("/a.md", { VISUAL: "/usr/bin/nvim --wait -p" });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(terminalEditor(r.stdout), ["/usr/bin/nvim", "-p"]);
  assert.deepEqual(terminalEditor(editorRun("/a.md", { EDITOR: "emacs -nw" }).stdout), ["emacs", "-nw"]);
  assert.equal(terminalEditor(editorRun("/a.md", { EDITOR: "/no/such/emacs" }).stdout), null, "a graphical Emacs");
});

test("editor: a profile's greeting on stdout doesn't become part of $EDITOR", posix, () => {
  const { program, out } = fakePosix("ed"), dir = home();
  writeFileSync(join(dir, ".profile"), `echo Welcome back\nexport VISUAL='${program} --wait'\n`);
  const r = editorRun("/a.md", { HOME: dir });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(out, "utf8").trim(), "/a.md");
});
