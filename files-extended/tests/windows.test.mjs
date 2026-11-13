// The Windows commands' form. These modules are pure, so this runs on every system;
// programs.test.mjs runs the commands themselves on Windows.
import { test } from "node:test";
import assert from "node:assert/strict";
import { commands } from "../mods/cria-files-extended/platform.js";
import { listCommand } from "../mods/cria-files-extended/listing.js";

const W = commands("windows", new Set());
const all = () => [listCommand("C:/a", "windows"), ...Object.values(W).map((make) => make("C:/a", "C:/b", true))];

test("Windows commands use only PowerShell: Herdr's PATH there has no sh, mv or rm", () => {
  for (const [program, args] of all()) {
    assert.equal(program, "powershell");
    assert.ok(!args.at(-1).includes('"'), "Windows PowerShell 5 mangles double quotes on its command line");
  }
});

test("a value is never script text: only character codes reach PowerShell", () => {
  const [, args] = W.rename("C:/it's '; Remove-Item x; '.md", "C:/b.md", false);
  assert.ok(!args.at(-1).includes("Remove-Item x"));
  assert.ok(!args.at(-1).includes("it's"));
});

test("paths reach PowerShell with backslashes", () => {
  const codes = (text) => [...text].map((c) => c.charCodeAt(0)).join(",");
  assert.ok(W.move("C:/a/b.txt", "C:/c")[1].at(-1).includes(codes("C:\\a\\b.txt")));
  assert.ok(listCommand("C:/a/b", "windows")[1].at(-1).includes(codes("C:\\a\\b")));
});

test("a failed PowerShell command reports one line, not its whole error record", () => {
  for (const [, args] of all()) assert.match(args.at(-1), /catch \{ \[Console\]::Error\.WriteLine\(\$_\.Exception\.Message\); exit 1 \}/);
});

test("only the editor loads the profile, where $EDITOR is set", () => {
  for (const [name, make] of Object.entries(W)) {
    const [, args] = make("C:/a", "C:/b", true);
    assert.equal(args.includes("-NoProfile"), name !== "editor", name);
  }
  assert.match(W.editor("C:/a.md")[1].at(-1), /\$env:VISUAL/);
});

test("Trash and Reveal use Windows' own: the Recycle Bin and Explorer", () => {
  assert.match(W.trash("C:/a")[1].at(-1), /SendToRecycleBin/);
  assert.match(W.reveal("C:/a")[1].at(-1), /explorer\.exe/);
});

test("Paste and Duplicate refuse a name taken; Delete removes a link alone; a case-only rename goes through a unique name", () => {
  for (const name of ["copy", "move"]) assert.match(W[name]("C:/a", "C:/b")[1].at(-1), /Test-Path -LiteralPath \$args\[1\]\) \{ throw/, name);
  assert.match(W.remove("C:/a")[1].at(-1), /LinkType\) \{ \$item\.Delete\(\) \}/);
  assert.match(W.rename("C:/a", "C:/A", true)[1].at(-1), /NewGuid/);
});

test("Unix commands pass paths as arguments, never inside the script", () => {
  for (const system of ["macos", "linux", "remote"]) {
    const [program, args] = commands(system, new Set()).copy("/a/$(x).txt", "/b/y.txt");
    assert.deepEqual([program, args.slice(2)], ["sh", ["files", "/a/$(x).txt", "/b/y.txt"]], system);
  }
  assert.deepEqual(listCommand("/a/$(x)", "remote")[1].slice(2), ["files", "/a/$(x)"]);
});

test("editor off Windows: one process with the file as a value", () => {
  for (const [system, opener] of [["macos", "open"], ["linux", "xdg-open"]]) {
    const [program, args] = commands(system, new Set()).editor("/a b/$(x).md");
    assert.equal(program, "sh");
    assert.ok(!args[1].includes("$(x)"));
    assert.deepEqual(args.slice(2), ["editor", "/a b/$(x).md", opener]);
  }
});
