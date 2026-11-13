// The listing and the menu's commands, run for real on this system in a scratch folder:
// sh on macOS and Linux (and over hc on another machine), PowerShell on Windows, as the
// mod runs them on each. Open, Reveal and the Trash need a desktop: windows.test.mjs
// checks their form.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commands } from "../mods/cria-files-extended/platform.js";
import { listCommand, parseListing, PER_FOLDER } from "../mods/cria-files-extended/listing.js";
import { terminalEditor } from "../mods/cria-files-extended/editor-command.js";

const PLATFORM = { darwin: "macos", win32: "windows" }[process.platform] ?? process.platform; // as Herdr's window().platform
const C = commands(PLATFORM, new Set());
const posix = { skip: PLATFORM === "windows" && "no sh on Herdr's Windows PATH" }, windows = { skip: PLATFORM !== "windows" };
const run = ([program, args], options) => spawnSync(program, args, { encoding: "utf8", timeout: 60000, ...options });
// Every scratch folder lives under one, removed after the tests.
const ROOT = mkdtempSync(join(tmpdir(), "cria-files-"));
after(() => rmSync(ROOT, { recursive: true, force: true }));
const scratch = (prefix = "cria files ") => mkdtempSync(join(ROOT, prefix));
// The panel joins paths with "/" on every system.
const at = (...parts) => parts.join("/");

function list(path) {
  const r = run(listCommand(path, PLATFORM));
  assert.equal(r.status, 0, r.stderr);
  return parseListing(r.stdout, PLATFORM).sort((a, b) => (a.name < b.name ? -1 : 1));
}

test("listing: files, folders and dotfiles, without .git, names whole", () => {
  const dir = scratch();
  for (const name of [".git", "src", "..dots"]) mkdirSync(join(dir, name));
  for (const name of ["a b.txt", ".env", "it's $(x).md", "..x", "café.md"]) writeFileSync(join(dir, name), "");
  assert.deepEqual(list(dir), [
    { name: "..dots", dir: true }, { name: "..x", dir: false }, { name: ".env", dir: false }, { name: "a b.txt", dir: false },
    { name: "café.md", dir: false }, { name: "it's $(x).md", dir: false }, { name: "src", dir: true },
  ]);
});

test("listing: an empty folder lists nothing", () => {
  assert.deepEqual(list(scratch()), []);
});

test("listing: stops one past the panel's limit, so the panel can say the list is cut", () => {
  const dir = scratch();
  for (let i = 0; i < PER_FOLDER + 20; i++) writeFileSync(join(dir, `f${i}`), "");
  assert.equal(list(dir).length, PER_FOLDER + 1);
});

test("listing: a folder that is gone fails", () => {
  const r = run(listCommand(at(scratch(), "gone"), PLATFORM));
  assert.notEqual(r.status, 0);
});

test("listing: a link to a folder is a folder, a dangling link a file", posix, () => {
  const dir = scratch();
  mkdirSync(join(dir, "real"));
  symlinkSync(join(dir, "real"), join(dir, "linked"));
  symlinkSync(join(dir, "nowhere"), join(dir, "dangling"));
  assert.deepEqual(list(dir), [{ name: "dangling", dir: false }, { name: "linked", dir: true }, { name: "real", dir: true }]);
});

test("listing: a junction to a folder is a folder, a dangling one a file", windows, () => {
  const dir = scratch();
  mkdirSync(join(dir, "real"));
  mkdirSync(join(dir, "gone"));
  symlinkSync(join(dir, "real"), join(dir, "linked"), "junction");
  symlinkSync(join(dir, "gone"), join(dir, "dangling"), "junction");
  rmSync(join(dir, "gone"), { recursive: true });
  assert.deepEqual(list(dir), [{ name: "dangling", dir: false }, { name: "linked", dir: true }, { name: "real", dir: true }]);
});

test("new file and new folder, and neither replaces what is there", () => {
  const dir = scratch();
  assert.equal(run(C.newFile(at(dir, "a.txt"))).status, 0);
  assert.equal(run(C.newFolder(at(dir, "src"))).status, 0);
  assert.deepEqual(readdirSync(dir).sort(), ["a.txt", "src"]);
  writeFileSync(join(dir, "a.txt"), "kept");
  assert.notEqual(run(C.newFile(at(dir, "a.txt"))).status, 0);
  assert.equal(readFileSync(join(dir, "a.txt"), "utf8"), "kept");
  assert.notEqual(run(C.newFolder(at(dir, "src"))).status, 0);
  assert.notEqual(run(C.newFolder(at(dir, "a.txt"))).status, 0);
});

test("rename: refuses a name that is taken, and says so", () => {
  const dir = scratch();
  writeFileSync(join(dir, "a.txt"), "a");
  writeFileSync(join(dir, "b.txt"), "b");
  const r = run(C.rename(at(dir, "a.txt"), at(dir, "b.txt"), false));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /already exists/);
  assert.equal(readFileSync(join(dir, "b.txt"), "utf8"), "b");
  assert.equal(run(C.rename(at(dir, "a.txt"), at(dir, "c.txt"), false)).status, 0);
  assert.deepEqual(readdirSync(dir).sort(), ["b.txt", "c.txt"]);
});

test("rename: on a disk that keeps case apart, A.txt is another item and stays", posix, (t) => {
  const dir = scratch();
  writeFileSync(join(dir, "a.txt"), "a");
  if (existsSync(join(dir, "A.txt"))) return t.skip("this disk ignores case");
  writeFileSync(join(dir, "A.txt"), "A");
  const r = run(C.rename(at(dir, "a.txt"), at(dir, "A.txt"), true));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /already exists/);
  assert.equal(readFileSync(join(dir, "A.txt"), "utf8"), "A");
});

test("rename: a change of case alone, for a file and a folder", () => {
  const dir = scratch();
  writeFileSync(join(dir, "a.txt"), "");
  mkdirSync(join(dir, "src"));
  assert.equal(run(C.rename(at(dir, "a.txt"), at(dir, "A.txt"), true)).status, 0);
  assert.equal(run(C.rename(at(dir, "src"), at(dir, "Src"), true)).status, 0);
  assert.deepEqual(readdirSync(dir).sort(), ["A.txt", "Src"]);
});

test("copy a folder whole, move it, then delete it", () => {
  const dir = scratch();
  mkdirSync(join(dir, "src", "deep"), { recursive: true });
  writeFileSync(join(dir, "src", "deep", "a.txt"), "a");
  mkdirSync(join(dir, "into"));
  assert.equal(run(C.copy(at(dir, "src"), at(dir, "src copy"))).status, 0);
  assert.equal(readFileSync(join(dir, "src copy", "deep", "a.txt"), "utf8"), "a");
  assert.equal(run(C.move(at(dir, "src copy"), at(dir, "into", "src"))).status, 0);
  assert.ok(existsSync(join(dir, "into", "src", "deep", "a.txt")));
  assert.equal(run(C.remove(at(dir, "into"))).status, 0);
  assert.deepEqual(readdirSync(dir), ["src"]);
});

test("paste and duplicate never replace what is there, whatever its case", () => {
  const dir = scratch();
  mkdirSync(join(dir, "into", "src"), { recursive: true });
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src", "a.txt"), "moved");
  writeFileSync(join(dir, "README.md"), "kept");
  writeFileSync(join(dir, "readme.md.new"), "new");
  for (const command of [C.copy, C.move]) {
    const r = run(command(at(dir, "readme.md.new"), at(dir, "README.md")));
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /already exists/);
    assert.equal(readFileSync(join(dir, "README.md"), "utf8"), "kept");
    // A folder onto a folder: not put inside it.
    assert.notEqual(run(command(at(dir, "src"), at(dir, "into", "src"))).status, 0);
    assert.deepEqual(readdirSync(join(dir, "into", "src")), []);
  }
  if (PLATFORM !== "linux") {
    // macOS and Windows disks ignore case: readme.md is README.md.
    writeFileSync(join(dir, "other.md"), "other");
    assert.notEqual(run(C.copy(at(dir, "other.md"), at(dir, "readme.md"))).status, 0);
    assert.equal(readFileSync(join(dir, "README.md"), "utf8"), "kept");
  }
});

test("delete: a junction goes, the folder it points to stays whole", windows, () => {
  const dir = scratch();
  mkdirSync(join(dir, "data"));
  writeFileSync(join(dir, "data", "keep.txt"), "kept");
  mkdirSync(join(dir, "proj", "deep"), { recursive: true });
  symlinkSync(join(dir, "data"), join(dir, "proj", "shared"), "junction");
  symlinkSync(join(dir, "data"), join(dir, "proj", "deep", "shared"), "junction");
  symlinkSync(join(dir, "data"), join(dir, "link"), "junction");
  const r = run(C.remove(at(dir, "link")));
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!existsSync(join(dir, "link")));
  assert.equal(readFileSync(join(dir, "data", "keep.txt"), "utf8"), "kept");
  const s = run(C.remove(at(dir, "proj")));
  assert.equal(s.status, 0, s.stderr);
  assert.ok(!existsSync(join(dir, "proj")));
  assert.equal(readFileSync(join(dir, "data", "keep.txt"), "utf8"), "kept");
});

test("PowerShell gets a value whole, however hostile", windows, () => {
  const dir = scratch(), name = "it's '; Remove-Item x; ' $(y) `n.txt";
  assert.equal(run(C.newFile(at(dir, name))).status, 0);
  assert.deepEqual(readdirSync(dir), [name]);
});

test("a failed PowerShell command reports one line", windows, () => {
  const r = run(C.remove(at(scratch(), "gone")));
  assert.notEqual(r.status, 0);
  assert.equal(r.stderr.trim().split("\n").length, 1, r.stderr);
});

// A stand-in editor that records the file it was given, in a folder with a space.
function fakeEditor() {
  const dir = scratch("cria editor "), bin = join(dir, "Program Files");
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
    const r = run(C.editor("C:/some dir/a.md"), { env: { ...process.env, VISUAL: value(program), EDITOR: "" } });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(await opened(out), "C:\\some dir\\a.md");
  });
}

// A stand-in program that records its arguments. No space in its path: $EDITOR is split into words.
function fakePosix(name) {
  const dir = scratch("cria-editor-"), program = join(dir, name), out = join(dir, "opened.txt");
  writeFileSync(program, `#!/bin/sh\nprintf '%s\\n' "$@" > "${out}"\n`);
  chmodSync(program, 0o755);
  return { dir, program, out };
}

// HOME is an empty folder: the login shell reads no profile of the person running the tests.
const editorRun = (file, env) => run(C.editor(file), { env: { ...process.env, HOME: scratch("home-"), SHELL: "/bin/sh", VISUAL: "", EDITOR: "", ...env } });

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
  const { program, out } = fakePosix("ed"), home = scratch("home-");
  writeFileSync(join(home, ".profile"), `echo Welcome back\nexport VISUAL='${program} --wait'\n`);
  const r = editorRun("/a.md", { HOME: home });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(out, "utf8").trim(), "/a.md");
});
