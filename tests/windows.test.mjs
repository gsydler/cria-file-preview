// Windows paths and commands. These modules are pure, so this runs on every system;
// programs.test.mjs runs the scripts themselves on Windows.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, dirname, localPath, samePath, relativePath, native, changedFile } from "../mods/cria-file-preview/paths.js";
import { resolveLink } from "../mods/cria-file-preview/links.js";
import { commands } from "../mods/cria-file-preview/platform.js";
import { programs } from "../mods/cria-file-preview/programs.js";

test("normalize: a drive or share keeps its root, in any slash form", () => {
  assert.equal(normalize("C:\\a\\.\\b\\..\\c.md"), "C:/a/c.md");
  assert.equal(normalize("C:/a/b.md"), "C:/a/b.md");
  assert.equal(normalize("C:\\a/b.md"), "C:/a/b.md");
  assert.equal(normalize("C:\\..\\a.md"), "C:/a.md");
  assert.equal(normalize("\\\\srv\\share\\a.md"), "//srv/share/a.md");
  assert.equal(normalize("//srv/share/a.md"), "//srv/share/a.md");
  assert.equal(normalize("//srv/share\\docs\\a.md"), "//srv/share/docs/a.md");
});

test("normalize: a verbatim path, as watchFolder reports on Windows, is the plain path", () => {
  assert.equal(normalize("\\\\?\\C:\\r\\a.md"), "C:/r/a.md");
  assert.equal(normalize("\\\\?\\UNC\\srv\\share\\a.md"), "//srv/share/a.md");
});

test("normalize: a backslash in a POSIX file name stays", () => {
  assert.equal(normalize("/a/b\\c.md"), "/a/b\\c.md");
});

test("dirname: stops at the drive", () => {
  assert.equal(dirname("C:\\a\\b.md"), "C:/a");
  assert.equal(dirname("C:/a/b.md"), "C:/a");
  assert.equal(dirname("C:/b.md"), "C:/");
  assert.equal(dirname("\\\\srv\\share\\a.md"), "//srv/share");
  assert.equal(dirname("//srv/share\\docs\\a.md"), "//srv/share/docs");
});

test("localPath: // is a share on Windows, a slip elsewhere: a panel at / joins root and path into it", () => {
  assert.equal(localPath("//etc/hosts", "linux"), "/etc/hosts");
  assert.equal(localPath("///etc/hosts", "macos"), "/etc/hosts");
  assert.equal(localPath("//etc/hosts", "remote"), "/etc/hosts");
  assert.equal(localPath("/etc/hosts", "linux"), "/etc/hosts");
  assert.equal(localPath("//srv/share/a.md", "windows"), "//srv/share/a.md");
});

test("samePath: the same file in any Windows form; POSIX names are exact", () => {
  assert.equal(samePath("C:\\r/a.md", "C:/r/a.md"), true);
  assert.equal(samePath("c:\\R\\A.md", "C:/r/a.md"), true);
  assert.equal(samePath("/r/A.md", "/r/a.md"), false);
  assert.equal(samePath("/r/a.md", "/r/a.md"), true);
});

test("resolveLink: relative to a Windows file, in any slash form", () => {
  for (const from of ["C:\\r\\docs\\a.md", "C:/r/docs/a.md", "C:\\r\\docs/a.md"]) {
    assert.deepEqual(resolveLink(from, "b.md"), { file: "C:/r/docs/b.md" });
    assert.deepEqual(resolveLink(from, "../img/a%20b.png#x"), { file: "C:/r/img/a b.png", anchor: "x" });
    assert.deepEqual(resolveLink(from, "sub\\c.md"), { file: "C:/r/docs/sub/c.md" });
  }
});

test("resolveLink: absolute Windows links are files, not schemes", () => {
  const from = "C:\\r\\a.md";
  assert.deepEqual(resolveLink(from, "D:/x/y.md"), { file: "D:/x/y.md" });
  assert.deepEqual(resolveLink(from, "D:\\x\\y.md"), { file: "D:/x/y.md" });
  assert.deepEqual(resolveLink(from, "file:///D:/x/y.md"), { file: "D:/x/y.md" });
  assert.deepEqual(resolveLink(from, "file:///D:\\x\\y.md"), { file: "D:/x/y.md" });
  assert.deepEqual(resolveLink(from, "file:///D%3A/x/y.md"), { file: "D:/x/y.md" });
  assert.deepEqual(resolveLink(from, "/x/y.md"), { file: "C:/x/y.md" });
  assert.deepEqual(resolveLink(from, "vscode:open"), { error: "Can't open vscode: links here" });
});

test("resolveLink: a drive means nothing to a POSIX document", () => {
  assert.deepEqual(resolveLink("/r/a.md", "c:/foo"), { error: "Can't open c: links here" });
  assert.deepEqual(resolveLink("/r/a.md", "file:///C:/x.md"), { file: "/C:/x.md" });
});

test("resolveLink: never reaches another computer, where Windows would send the person's credentials", () => {
  const refused = { error: "Can't open links to another computer" };
  for (const link of ["\\\\evil\\share\\x.png", "%5C%5Cevil%5Cshare%5Cx.png", "\\\\?\\UNC\\evil\\s\\x.png", "//evil/s/x.png", "file://evil/s/x.png", "file:////evil/s/x.png"]) {
    assert.deepEqual(resolveLink("C:\\r\\a.md", link), refused, link);
  }
  assert.deepEqual(resolveLink("//srv/share/a.md", "../../evil/s/x.png"), refused);
  for (const link of ["/\\evil\\share\\x.png", "/\\\\evil\\share\\x.png"]) {
    assert.deepEqual(resolveLink("\\\\srv\\share\\a.md", link), refused, `${link}: PowerShell gets its slashes turned`);
  }
});

test("resolveLink: // is only a path on POSIX", () => {
  assert.deepEqual(resolveLink("/r/a.md", "//usr/b.md"), { file: "/usr/b.md" });
  assert.deepEqual(resolveLink("/r/a.md", "/\\x.md"), { file: "/\\x.md" });
  assert.deepEqual(resolveLink("/a.md", "b.md"), { file: "/b.md" });
  assert.deepEqual(resolveLink("/etc/a.md", "../usr/b.md"), { file: "/usr/b.md" });
});

test("resolveLink: a file on a share keeps its links on that share", () => {
  assert.deepEqual(resolveLink("\\\\srv\\share\\a.md", "b.md"), { file: "//srv/share/b.md" });
  assert.deepEqual(resolveLink("//SRV/share/a.md", "//srv/share/b.md"), { file: "//srv/share/b.md" });
  assert.deepEqual(resolveLink("\\\\srv\\share\\docs\\a.md", "..\\b.md"), { file: "//srv/share/b.md" });
  assert.deepEqual(resolveLink("\\\\srv\\share\\docs\\a.md", "/x/y.md"), { file: "//srv/share/x/y.md" });
});

test("relativePath: case and form don't matter on Windows", () => {
  assert.equal(relativePath("c:\\Users\\g\\a.md", "C:/Users/g", "C:\\Users\\g"), "a.md");
  assert.equal(relativePath("c:\\Users\\g\\a.md", null, "C:\\Users\\g"), "~/a.md");
  assert.equal(relativePath("\\\\?\\C:\\Users\\G\\a.md", "C:/users/g", null), "a.md");
  assert.equal(relativePath("/Users/G/a.md", "/Users/g", null), "/Users/G/a.md");
});

test("native: backslashes on Windows, as they are elsewhere", () => {
  assert.equal(native("C:/a/b.md", "windows"), "C:\\a\\b.md");
  assert.equal(native("C:/", "windows"), "C:\\");
  assert.equal(native("//srv/share/a.md", "windows"), "\\\\srv\\share\\a.md");
  assert.equal(native("/a/b.md", "macos"), "/a/b.md");
  assert.equal(native("//etc/hosts", "linux"), "//etc/hosts");
  assert.equal(native("/srv/a.md", "remote"), "/srv/a.md");
});

test("changedFile: the file in any slash form, or the folder when the list overflowed", () => {
  assert.equal(changedFile(["\\\\?\\C:\\r\\a.md"], "C:\\r\\a.md"), true);
  assert.equal(changedFile(["C:\\r\\a.md"], "C:/r/a.md"), true);
  assert.equal(changedFile(["C:/r/a.md"], "C:\\r\\a.md"), true);
  assert.equal(changedFile(["c:\\r\\A.md"], "C:\\r\\a.md"), true);
  assert.equal(changedFile(["C:\\r"], "C:\\r\\a.md"), true);
  assert.equal(changedFile(["/r"], "/r/a.md"), true);
  assert.equal(changedFile(["/r/A.md"], "/r/a.md"), false, "POSIX names are case-sensitive");
  assert.equal(changedFile(["C:\\r\\b.md"], "C:\\r\\a.md"), false);
  assert.equal(changedFile([], "C:\\r\\a.md"), false);
});

test("Windows commands use only what Windows ships: Herdr's PATH has no sh, file or rm", () => {
  const p = programs("windows"), menu = commands("windows", new Set());
  const all = [p.stage("C:/a.png", "C:/d", "k", "png"), p.fetch("https://x/a.png", "C:/d", "k"), p.size("C:/a.png"), p.mime("C:/a.png"),
    p.bytes("C:/a.png"), p.head("C:/a.txt", 5), p.prune("C:/d"), p.move("C:/a", "C:/b"), p.remove("C:/a"), p.pdf("C:/a.pdf", "C:/d", "k", 1, 6, 1600),
    menu.open("C:/a.md"), menu.reveal("C:/a.md"), menu.editor("C:/a.md")];
  for (const [program, args] of all) {
    assert.equal(program, "powershell");
    assert.ok(!args.at(-1).includes('"'), "Windows PowerShell 5 mangles double quotes on its command line");
  }
});

test("other systems keep their commands", () => {
  const linux = programs("linux"), mac = programs("macos");
  assert.equal(linux.stage("/a.png", "/d", "k", "png")[0], "sh");
  assert.equal(mac.fetch("https://x/a.png", "/d", "k")[0], "sh");
  assert.equal(programs("remote").bytes("/a.png")[0], "sh");
  assert.equal(programs("remote").head("/a.txt", 5)[0], "sh");
  assert.equal(linux.prune("/d")[0], "find");
  assert.deepEqual(linux.move("/a", "/b"), ["mv", ["-f", "/a", "/b"]]);
  assert.deepEqual(mac.remove("/a"), ["rm", ["-f", "/a"]]);
  assert.equal(mac.pdf("/a.pdf", "/d", "k", 1, 6, 1600)[0], "osascript");
  assert.equal(linux.pdf("/a.pdf", "/d", "k", 1, 6, 1600)[0], "sh");
  assert.equal(mac.size("/a.png")[0], "sips");
  assert.equal(linux.size("/a.png")[0], "file");
});

test("a value is never script text: only character codes reach PowerShell", () => {
  const [, args] = commands("windows", new Set()).open("C:/it's '; Remove-Item x; '.md");
  assert.ok(!args.at(-1).includes("Remove-Item x"));
  assert.ok(!args.at(-1).includes("it's"));
});

test("a URL keeps its slashes: only paths turn them", () => {
  const [, args] = programs("windows").fetch("https://x/", "C:/d", "k");
  const codes = (text) => [...text].map((c) => c.charCodeAt(0)).join(",");
  assert.ok(args.at(-1).includes(codes("https://x/")));
  assert.ok(args.at(-1).includes(codes("C:\\d")));
});

test("a failed PowerShell command reports one line, not its whole error record", () => {
  const [, args] = commands("windows", new Set()).open("C:/a.md");
  assert.match(args.at(-1), /catch \{ \[Console\]::Error\.WriteLine\(\$_\.Exception\.Message\); exit 1 \}/);
});

test("editor off Windows: one process with the file as a value, since the menu's copy dies with its popup", () => {
  for (const [system, opener] of [["macos", "open"], ["linux", "xdg-open"]]) {
    const [program, args] = commands(system, new Set()).editor("/a b/$(x).md");
    assert.equal(program, "sh");
    assert.equal(args[0], "-c");
    assert.ok(!args[1].includes("$(x)"));
    assert.deepEqual(args.slice(2), ["editor", "/a b/$(x).md", opener]);
  }
});

test("editor: one process that loads the profile, since the menu's copy dies with its popup", () => {
  const [, args] = commands("windows", new Set()).editor("C:/a.md");
  assert.ok(!args.includes("-NoProfile"), "PowerShell reads $EDITOR from the profile itself");
  assert.match(args.at(-1), /\$env:VISUAL/);
});
