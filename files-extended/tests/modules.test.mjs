// The pure modules: the menu, names, paths, icons, the listing's output and git's marks, the opener.
import { test } from "node:test";
import assert from "node:assert/strict";
import { menuItems } from "../mods/cria-files-extended/menu.js";
import { badName, freeName, nameError, caseOnly, pasteProblem } from "../mods/cria-files-extended/names.js";
import { baseName, parentOf, within, relativeTo } from "../mods/cria-files-extended/paths.js";
import { recordPreviews } from "../mods/cria-files-extended/previews.js";
import { iconFor } from "../mods/cria-files-extended/icons.js";
import { existsSync } from "node:fs";
import { systemOf, commands, labels, toolProbe, toolsFrom } from "../mods/cria-files-extended/platform.js";
import { parseListing, byKind, gitMarks } from "../mods/cria-files-extended/listing.js";
import { openCommand, shownIn, previewId } from "../mods/cria-files-extended/open-file.js";
import { terminalEditor } from "../mods/cria-files-extended/editor-command.js";

const ids = (list) => list.map((it) => (it === "-" ? "-" : it.id));
const enabled = (list) => list.filter((it) => it !== "-" && it.enabled).map((it) => it.id);
const on = (system, tools = ["trash", "xdg-open", "gio"]) => ({ can: commands(system, new Set(tools)), labels: labels(system) });
const none = { ...on("macos"), open: () => false, anyOpen: false };

test("a file in a subfolder can fold that folder; a folder has no default app", () => {
  assert.deepEqual(ids(menuItems({ path: "src/a.js", dir: false }, none)),
    ["new-file", "new-folder", "-", "editor", "default", "reveal", "terminal", "-", "cut", "copy", "duplicate", "paste", "-",
     "name", "path", "relative", "-", "rename", "trash", "delete", "-", "fold-parent", "collapse"]);
  assert.deepEqual(ids(menuItems({ path: "src", dir: true }, none)),
    ["new-file", "new-folder", "-", "editor", "reveal", "terminal", "-", "cut", "copy", "duplicate", "paste", "-",
     "name", "path", "relative", "-", "rename", "trash", "delete", "-", "expand", "collapse"]);
  assert.deepEqual(ids(menuItems({ path: "src", dir: true }, { ...none, open: (p) => p === "src" })).slice(-3), ["expand", "fold", "collapse"]);
});

test("a top-level file has nothing to fold", () => {
  assert.deepEqual(ids(menuItems({ path: "a.js", dir: false }, none)).slice(-2), ["-", "collapse"]);
});

test("paste needs a cut or copy; collapse all an open folder", () => {
  assert.ok(!enabled(menuItems({ path: "a.js", dir: false }, none)).includes("paste"));
  assert.ok(enabled(menuItems({ path: "a.js", dir: false }, { ...none, canPaste: true })).includes("paste"));
  assert.ok(!enabled(menuItems({ path: "a.js", dir: false }, none)).includes("collapse"));
  assert.ok(enabled(menuItems({ path: "a.js", dir: false }, { ...none, anyOpen: true })).includes("collapse"));
});

test("an action the system can't do is left out, and Reveal and Trash use its own names", () => {
  const desktop = (system, tools) => menuItems({ path: "a.js", dir: false }, { ...none, ...on(system, tools) })
    .filter((it) => ["editor", "default", "reveal", "trash"].includes(it.id)).map((it) => it.label);
  assert.deepEqual(desktop("macos"), ["Open in editor", "Open with default app", "Reveal in Finder", "Move to Trash"]);
  assert.deepEqual(desktop("macos", []), ["Open in editor", "Open with default app", "Reveal in Finder"]);
  assert.deepEqual(desktop("windows"), ["Open in editor", "Open with default app", "Show in Explorer", "Move to Recycle Bin"]);
  assert.deepEqual(desktop("linux"), ["Open in editor", "Open with default app", "Open containing folder", "Move to Trash"]);
  assert.deepEqual(desktop("linux", []), ["Open in editor"]);
  assert.deepEqual(desktop("remote"), []);
  assert.equal(systemOf("macos", "server"), "remote");
});

test("Windows has no Recycle Bin on a network share, so Trash is left out there", () => {
  const trash = (file) => Boolean(commands("windows", new Set(), file).trash);
  assert.equal(trash("C:\\r/a.txt"), true);
  assert.equal(trash("\\\\server\\share/a.txt"), false);
  assert.equal(trash("//server/share/a.txt"), false);
  assert.equal(trash("\\\\wsl$\\Ubuntu/a.txt"), false);
  assert.ok(commands("windows", new Set(), "\\\\server\\share/a.txt").remove, "Delete stays");
  assert.ok(commands("linux", new Set(["gio"]), "//x/a.txt").trash, "// is a path elsewhere");
});

test("the optional tools: looked for off Windows, read from the probe's output", () => {
  assert.equal(toolProbe("windows"), null);
  assert.equal(toolProbe("macos")[0], "sh");
  assert.deepEqual([...toolsFrom("trash\ngio\nbanner\n")], ["trash", "gio"]);
});

test("relative to the git checkout, else to the shown folder", () => {
  assert.equal(relativeTo("C:\\r\\src/a.js", "C:/r", "C:\\r\\src"), "src/a.js");
  assert.equal(relativeTo("/r/app/src/a.js", "/r", "/r/app"), "app/src/a.js");
  assert.equal(relativeTo("/x/src/a.js", null, "/x"), "src/a.js");
  assert.equal(relativeTo("/r", "/r", "/r"), ".");
  assert.equal(relativeTo("/rx/a.js", "/r", null), "/rx/a.js");
  assert.equal(relativeTo("c:\\R\\src/a.js", "C:/r", null, "windows"), "src/a.js", "Windows ignores case");
  assert.equal(relativeTo("/Users/A/r/a.js", "/users/a/r", null, "macos"), "a.js");
  assert.equal(relativeTo("/R/a.js", "/r", null, "linux"), "/R/a.js");
});

test("paths: last part, parent, and inside, whichever separator", () => {
  assert.equal(baseName("C:\\r\\src/a.js"), "a.js");
  assert.equal(baseName("C:\\r"), "r");
  assert.equal(parentOf("src/a.js"), "src");
  assert.equal(parentOf("a.js"), "");
  assert.equal(parentOf("C:\\r\\src"), "C:\\r");
  assert.ok(within("/r/src/a", "/r/src", "linux"));
  assert.ok(within("/r/src", "/r/src/", "linux"));
  assert.ok(!within("/r/srcx", "/r/src", "linux"));
  assert.ok(!within("/r/Src/a", "/r/src", "linux"));
  assert.ok(within("/r/Src/a", "/r/src", "macos"));
  assert.ok(within("C:\\R\\src", "c:/r", "windows"));
  assert.ok(within("/a", "/", "linux"));
});

test("a clash gets Finder's copy name; a copy of a copy counts on", () => {
  const taken = new Set(["a.txt", "a copy.txt", "src", ".env", "archive.tar.gz"]);
  assert.equal(freeName("b.txt", taken, false), "b.txt");
  assert.equal(freeName("a.txt", taken, false), "a copy 2.txt");
  assert.equal(freeName("a copy.txt", taken, false), "a copy 2.txt");
  assert.equal(freeName("src", taken, true), "src copy");
  assert.equal(freeName(".env", taken, false), ".env copy");
  assert.equal(freeName("archive.tar.gz", taken, false), "archive.tar copy.gz");
  assert.equal(freeName("v1.2", new Set(["v1.2"]), true), "v1.2 copy");
});

test("a disk that ignores case: a name differing only in case is taken", () => {
  const taken = new Set(["README.md", "readme copy.md"]);
  assert.equal(freeName("readme.md", taken, false), "readme.md", "case-sensitive disk");
  assert.equal(freeName("readme.md", taken, false, true), "readme copy 2.md");
  assert.equal(freeName("Src", new Set(["src"]), true, true), "Src copy");
});

test("a name can't be empty, . or .., or hold a slash; on Windows, a backslash either", () => {
  for (const bad of ["", "  ", ".", "..", "a/b"]) assert.ok(badName(bad), bad);
  for (const good of ["a", ".env", "a b.txt", "…", "a\\b"]) assert.equal(badName(good), null, good);
  assert.equal(badName("a\\b", "windows"), "A name can't contain / or \\");
  assert.equal(badName("a/b", "windows"), "A name can't contain / or \\");
  assert.equal(badName("a\\b", "linux"), null);
});

test("New and Rename: a name taken is refused, except the item's own or a change of case", () => {
  const taken = new Set(["a.txt", "b.txt"]);
  assert.equal(nameError("b.txt", { old: "a.txt", taken }), "b.txt already exists here");
  assert.equal(nameError("a.txt", { old: "a.txt", taken }), null, "unchanged");
  assert.equal(nameError("A.txt", { old: "a.txt", taken: new Set(["a.txt", "A.txt"]) }), null, "the command decides");
  assert.equal(nameError("a.txt", { taken }), "a.txt already exists here", "New");
  assert.equal(nameError("c.txt", { taken }), null);
  assert.equal(nameError("a\\b", { taken, system: "windows" }), "A name can't contain / or \\");
  assert.ok(caseOnly("a.txt", "A.txt"));
  assert.ok(!caseOnly("a.txt", "a.txt"));
  assert.ok(!caseOnly("a.txt", "b.txt"));
});

test("paste: a folder can't go inside itself; a cut item already there stays", () => {
  const folder = { file: "/r/src", dir: true, cut: false };
  assert.equal(pasteProblem(folder, "/r/src", "linux"), "inside");
  assert.equal(pasteProblem(folder, "/r/src/deep", "linux"), "inside");
  assert.equal(pasteProblem(folder, "/r/srcx", "linux"), null);
  assert.equal(pasteProblem(folder, "/r/SRC/deep", "macos"), "inside");
  assert.equal(pasteProblem({ file: "C:\\r/src", dir: true }, "c:/R/src/deep", "windows"), "inside");
  assert.equal(pasteProblem(folder, "/r", "linux"), null, "a copy beside it");
  assert.equal(pasteProblem({ ...folder, cut: true }, "/r", "linux"), "here");
  assert.equal(pasteProblem({ file: "/r/a.txt", dir: false, cut: true }, "/r/", "linux"), "here");
  assert.equal(pasteProblem({ file: "/r/a.txt", dir: false, cut: true }, "/r/b", "linux"), null);
});

test("a row's icon comes from its whole name, else its extension; colors are theme keys", () => {
  const icon = (name, dir = false, open = false) => iconFor(name, dir, open).icon;
  assert.equal(icon("main.TS"), "file-code");
  assert.equal(icon("package-lock.json"), "file-lock");
  assert.equal(icon("data.json"), "file-braces");
  assert.equal(icon(".env.local"), "file-key");
  assert.equal(icon(".gitignore"), "file-cog");
  assert.equal(icon(".zshrc"), "file-cog");
  assert.equal(icon("Makefile"), "file-cog");
  assert.equal(icon("README"), "file");
  assert.equal(icon("src", true), "folder");
  assert.equal(icon("src", true, true), "folder-open");
  assert.equal(icon(".github", true, true), "folder-git");
  assert.equal(iconFor("x.unknown", false, false).color, "muted");
});

test("every icon the mapping names is in icons/", () => {
  const names = ["a.js", "a.sh", "a.json", "a.ini", "a.md", "a.pdf", "a.csv", "a.png", "a.mp4", "a.mp3", "a.zip", "a.sql", "a.ttf", "a.diff", "a.pem", "a.lock", "a", ".github"];
  for (const name of names) {
    const { icon } = iconFor(name, name === ".github", false);
    assert.ok(existsSync(new URL(`../mods/cria-files-extended/icons/${icon}.svg`, import.meta.url)), icon);
  }
  for (const icon of ["folder", "folder-open"]) assert.ok(existsSync(new URL(`../mods/cria-files-extended/icons/${icon}.svg`, import.meta.url)), icon);
});

test("openCommand: tab by default, splits on request", () => {
  assert.deepEqual(openCommand({ file: "/r/a.md" }), ["tab.new", { name: "a.md", mod: "cria-file-preview", props: { file: "/r/a.md", on: null } }]);
  assert.deepEqual(openCommand({ file: "/r/a.md", on: "vps", mode: "split-down" }), ["pane.split", { direction: "down", mod: "cria-file-preview", props: { file: "/r/a.md", on: "vps" } }]);
  assert.equal(openCommand({ file: "/r/a.md", mode: "split-right" })[1].direction, "right");
  assert.equal(openCommand({ file: "/r/a.md", mode: "bogus" })[0], "tab.new");
});

test("shownIn: the recorded pane while it lives and still shows the file", () => {
  const open = { [previewId("/r/a.md", null)]: "p1", [previewId("/r/b.md", "vps")]: "p2" };
  const alive = new Set(["p1", "p2"]);
  assert.equal(shownIn(open, {}, "/r/a.md", null, alive), "p1");
  assert.equal(shownIn(open, {}, "/r/b.md", "vps", alive), "p2");
  assert.equal(shownIn(open, {}, "/r/b.md", null, alive), null, "same path, other machine");
  assert.equal(shownIn(open, {}, "/r/a.md", null, new Set(["p2"])), null, "pane closed");
  assert.equal(shownIn(open, { [previewId("/r/a.md", null)]: "/r/c.md" }, "/r/a.md", null, alive), null, "followed a link away");
  assert.equal(shownIn(open, { [previewId("/r/a.md", null)]: "/r/a.md" }, "/r/a.md", null, alive), "p1", "came back");
  assert.equal(shownIn(undefined, undefined, "/r/a.md", null, alive), null);
});

test("recordPreviews: each pending preview gets the next new pane, oldest first", () => {
  const a = previewId("/r/a.md", null), b = previewId("/r/b.md", null), c = previewId("/r/c.md", null);
  const before = new Set(["p1"]);
  assert.equal(recordPreviews([[a, before]], ["p1"], {}, {}), null, "no new pane yet");
  const first = recordPreviews([[a, before], [b, before]], ["p1", "p2"], { [c]: "p1", gone: "p0" }, { [a]: "/r/x.md", [c]: "/r/y.md" });
  assert.deepEqual(first, { open: { [c]: "p1", [a]: "p2" }, moved: { [c]: "/r/y.md" }, done: [a] });
  const second = recordPreviews([[b, before]], ["p1", "p2", "p3"], first.open, first.moved);
  assert.deepEqual(second.open, { [c]: "p1", [a]: "p2", [b]: "p3" });
});

test("terminalEditor: the words after the marker, else nothing", () => {
  assert.deepEqual(terminalEditor("__cria_editor__\0nvim\0-p\0"), ["nvim", "-p"]);
  assert.equal(terminalEditor(""), null);
  assert.equal(terminalEditor("some output a graphical editor printed\n"), null);
});

test("parseListing: NUL-separated kinds and names, whatever a name holds", () => {
  assert.deepEqual(parseListing("d\0src\0f\0a b\nc.txt\0f\0.env\0", "macos"),
    [{ name: "src", dir: true }, { name: "a b\nc.txt", dir: false }, { name: ".env", dir: false }]);
  assert.deepEqual(parseListing("", "linux"), []);
});

test("parseListing: PowerShell's JSON, one entry or many", () => {
  assert.deepEqual(parseListing('{"name":"a.txt","dir":false}', "windows"), [{ name: "a.txt", dir: false }]);
  assert.deepEqual(parseListing('[{"name":"src","dir":true},{"name":"a.txt","dir":null}]', "windows"), [{ name: "src", dir: true }, { name: "a.txt", dir: false }]);
  assert.deepEqual(parseListing("", "windows"), []);
});

test("byKind: folders first, then by name", () => {
  const entries = [{ name: "b.txt", dir: false }, { name: "z", dir: true }, { name: "a.txt", dir: false }, { name: "a", dir: true }];
  assert.deepEqual(entries.sort(byKind).map((e) => e.name), ["a", "z", "a.txt", "b.txt"]);
});

test("gitMarks: added, conflicted, deleted, else modified, keyed by full path", () => {
  const out = ["?? new.txt", "A  staged.txt", "UU both.txt", " D gone.txt", "D  removed.txt", " M changed.txt", "MM src/twice.js", "AM added-then-changed.txt"].join("\0") + "\0";
  assert.deepEqual(gitMarks(out, "/r", 100), {
    "/r/new.txt": "A", "/r/staged.txt": "A", "/r/both.txt": "U", "/r/gone.txt": "D", "/r/removed.txt": "D",
    "/r/changed.txt": "M", "/r/src/twice.js": "M", "/r/added-then-changed.txt": "A",
  });
  assert.deepEqual(Object.keys(gitMarks(out, "/r", 2)), ["/r/new.txt", "/r/staged.txt"]);
  assert.deepEqual(gitMarks("", "/r", 100), {});
});
