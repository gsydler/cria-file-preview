import { test } from "node:test";
import assert from "node:assert/strict";
import { viewerFor, languageOf, extension, basename } from "../mods/cria-file-preview/kinds.js";
import { resolveLink } from "../mods/cria-file-preview/links.js";
import { normalize, dirname } from "../mods/cria-file-preview/paths.js";
import { openCommand } from "../mods/cria-file-preview/open-file.js";

test("viewerFor picks by extension, code by default", () => {
  assert.equal(viewerFor("/a/README.md"), "markdown");
  assert.equal(viewerFor("/a/Guide.MARKDOWN"), "markdown");
  assert.equal(viewerFor("/a/spec.pdf"), "pdf");
  assert.equal(viewerFor("/a/main.js"), "code");
  assert.equal(viewerFor("/a/Makefile"), "code");
  assert.equal(viewerFor("/a/.env"), "code");
});

test("extension and language", () => {
  assert.equal(extension("/a/.gitignore"), "");
  assert.equal(extension("/a/x.tar.gz"), "gz");
  assert.equal(languageOf("/a/x.tsx"), "js");
  assert.equal(languageOf("/a/x.go"), "go");
  assert.equal(languageOf("/a/Makefile"), "text");
  assert.equal(basename("/a/b/c.md"), "c.md");
});

test("normalize and dirname", () => {
  assert.equal(normalize("/a/./b/../c//d"), "/a/c/d");
  assert.equal(normalize("/../x"), "/x");
  assert.equal(dirname("/a/b/c.md"), "/a/b");
  assert.equal(dirname("/c.md"), "/");
});

test("resolveLink: local files relative to the Markdown file", () => {
  const from = "/repo/docs/guide.md";
  assert.deepEqual(resolveLink(from, "setup.md"), { file: "/repo/docs/setup.md" });
  assert.deepEqual(resolveLink(from, "../README.md#install"), { file: "/repo/README.md", anchor: "install" });
  assert.deepEqual(resolveLink(from, "./img/a%20b.pdf"), { file: "/repo/docs/img/a b.pdf" });
  assert.deepEqual(resolveLink(from, "/etc/hosts"), { file: "/etc/hosts" });
  assert.deepEqual(resolveLink(from, "file:///repo/x.md"), { file: "/repo/x.md" });
});

test("resolveLink: web, mail, anchors, others", () => {
  assert.deepEqual(resolveLink("/r/a.md", "https://herdr.dev/x"), { url: "https://herdr.dev/x" });
  assert.deepEqual(resolveLink("/r/a.md", "mailto:a@b.c"), { url: "mailto:a@b.c" });
  assert.deepEqual(resolveLink("/r/a.md", "#usage"), { anchor: "usage" });
  assert.ok(resolveLink("/r/a.md", "javascript:alert(1)").error);
  assert.ok(resolveLink("/r/a.md", "").error);
});

test("openCommand: tab by default, splits on request", () => {
  assert.deepEqual(openCommand({ file: "/r/a.md" }), ["tab.new", { name: "a.md", mod: "cria-file-preview", props: { file: "/r/a.md", on: null } }]);
  assert.deepEqual(openCommand({ file: "/r/a.md", on: "vps", mode: "split-down" }), ["pane.split", { direction: "down", mod: "cria-file-preview", props: { file: "/r/a.md", on: "vps" } }]);
  assert.equal(openCommand({ file: "/r/a.md", mode: "split-right" })[1].direction, "right");
  assert.equal(openCommand({ file: "/r/a.md", mode: "bogus" })[0], "tab.new");
});

import { splitBlocks, slugify, imageNote } from "../mods/cria-file-preview/markdown-blocks.js";
import { svgSize } from "../mods/cria-file-preview/svg-size.js";
import { GONE, withoutBom, readFailure, tooLong, wholeLines } from "../mods/cria-file-preview/text-file.js";

test("splitBlocks: text and images in order, linked images keep their link", () => {
  assert.deepEqual(splitBlocks("# T\n\n![logo](img/a.png)\n\nafter\n"), [
    { text: "# T\n\n", heading: { level: 1, title: "T", slug: "t" } }, { image: { alt: "logo", src: "img/a.png" } }, { text: "\n\nafter\n" }]);
  assert.deepEqual(splitBlocks('[![b](https://x/b.svg "t")](https://x)')[0], { image: { alt: "b", src: "https://x/b.svg", link: "https://x" } });
});

test("splitBlocks: code is left alone, no images gives one block", () => {
  const fenced = "```md\n![a](a.png)\n```\n";
  assert.deepEqual(splitBlocks(fenced), [{ text: fenced }]);
  assert.deepEqual(splitBlocks("use `![a](a.png)` here"), [{ text: "use `![a](a.png)` here" }]);
  assert.deepEqual(splitBlocks(""), [{ text: "" }]);
});

test("splitBlocks: reference definitions repeat in every text block", () => {
  const blocks = splitBlocks("see [docs][d]\n![a](a.png)\nmore\n\n[d]: https://x\n");
  assert.equal(blocks.length, 3);
  for (const b of blocks.filter((b) => b.text !== undefined)) assert.match(b.text, /\[d\]: https:\/\/x/);
});

test("svgSize: text with no svg tag has no size, so a fake download isn't kept", () => {
  assert.deepEqual(svgSize("this is not a picture"), { width: 0, height: 0 });
  assert.deepEqual(svgSize(""), { width: 0, height: 0 });
  assert.deepEqual(svgSize("<svg>"), { width: 300, height: 150 });
});

test("svgSize: a prefixed svg tag counts", () => {
  assert.deepEqual(svgSize('<ns0:svg xmlns:ns0="http://www.w3.org/2000/svg" width="10" height="5">'), { width: 10, height: 5 });
  assert.deepEqual(svgSize('<ns0:svg xmlns:ns0="http://www.w3.org/2000/svg">'), { width: 300, height: 150 });
});

test("imageNote: why an image isn't drawn", () => {
  assert.equal(imageNote({ url: "https://x/a.png" }, "ask"), "on the web");
  assert.equal(imageNote({ url: "https://x/a.png" }, "loading"), "loading…");
  assert.equal(imageNote({ url: "https://x/a.png" }, "loaded"), "couldn't load");
  assert.equal(imageNote({}, "ask"), "not found");
  assert.equal(imageNote({ failed: GONE }, "ask"), "not found");
  assert.equal(imageNote({ failed: "Can't open links to another computer" }, "ask"), "Can't open links to another computer");
});

test("withoutBom: Notepad's and Excel's first character goes", () => {
  const bom = String.fromCharCode(0xFEFF);
  assert.equal(withoutBom(bom + '{"a":1}'), '{"a":1}');
  assert.equal(withoutBom("plain"), "plain");
  assert.equal(withoutBom("a" + bom + "b"), "a" + bom + "b");
});

test("readFailure: what Herdr's read errors mean to the person", () => {
  assert.equal(readFailure("`herdr.readTextFile`: Text file exceeds 1 MiB"), "This file is over 1 MiB, too large to preview");
  assert.equal(readFailure("`herdr.readTextFile`: stream did not contain valid UTF-8"), "Binary or non-UTF-8 file · no text preview");
  assert.equal(readFailure("something else"), "something else");
});

test("tooLong: only the size limit leaves a head to read", () => {
  assert.equal(tooLong("`herdr.readTextFile`: Text file exceeds 1 MiB"), true);
  assert.equal(tooLong("stream did not contain valid UTF-8"), false);
});

test("wholeLines: a cut text ends on its last whole line", () => {
  assert.equal(wholeLines("a,b\nc,d\ne,"), "a,b\nc,d\n");
  assert.equal(wholeLines("no line end"), "no line end");
});

test("svgSize: attributes, else viewBox, else the default", () => {
  assert.deepEqual(svgSize('<svg width="24" height="12px">'), { width: 24, height: 12 });
  assert.deepEqual(svgSize('<svg viewBox="0 0 100 50">'), { width: 100, height: 50 });
  assert.deepEqual(svgSize("<svg>"), { width: 300, height: 150 });
});

import { shownIn, previewId } from "../mods/cria-file-preview/open-file.js";

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

test("splitBlocks: a block per heading, with GitHub anchor names", () => {
  const blocks = splitBlocks("intro\n# Get started\ntext\n## Get started\n```\n# not a heading\n```\n### `run` it! ##\n");
  assert.deepEqual(blocks.map((b) => b.heading?.slug ?? null), [null, "get-started", "get-started-1", "run-it"]);
  assert.equal(blocks[3].heading.level, 3);
  assert.match(blocks[2].text, /# not a heading/);
});

test("slugify", () => {
  assert.equal(slugify("Hello, World!"), "hello-world");
  assert.equal(slugify("A [link](x.md) and `code`"), "a-link-and-code");
  assert.equal(slugify("Über café"), "über-café");
});

import { delimiterOf, parseDelimited, columnWidths } from "../mods/cria-file-preview/delimited.js";
import { flatten, containers } from "../mods/cria-file-preview/json-tree.js";

test("delimiterOf: tab for tsv, semicolon when it wins the first line", () => {
  assert.equal(delimiterOf("tsv", "a,b"), "\t");
  assert.equal(delimiterOf("csv", "a,b,c\n1;2"), ",");
  assert.equal(delimiterOf("csv", "a;b;c\n1,2"), ";");
});

test("parseDelimited: quotes, escaped quotes, newlines in cells, CRLF", () => {
  const { rows, truncated } = parseDelimited('name,note\r\n"Doe, J","said ""hi"""\r\nx,"two\nlines"\n', ",");
  assert.deepEqual(rows, [["name", "note"], ["Doe, J", 'said "hi"'], ["x", "two\nlines"]]);
  assert.equal(truncated, false);
  assert.deepEqual(parseDelimited("a\tb\n1\t", "\t").rows, [["a", "b"], ["1", ""]]);
});

test("parseDelimited: stops at the limit and says so", () => {
  const r = parseDelimited("h\n1\n2\n3\n", ",", 2);
  assert.deepEqual(r.rows, [["h"], ["1"]]);
  assert.equal(r.truncated, true);
});

test("columnWidths: from the longest cell, clamped", () => {
  assert.deepEqual(columnWidths([["id", "x".repeat(200)], ["12345", ""]]), [58, 360]);
});

test("flatten: open containers list their children with JSON Pointer paths", () => {
  const value = { a: [1, "x"], "b/c": null };
  assert.deepEqual(flatten(value, new Set([""])).map((r) => [r.path, r.key, r.text]), [
    ["", null, "{ 2 keys }"], ["/a", "a", "[ 2 items ]"], ["/b~1c", "b/c", "null"]]);
  const open = flatten(value, new Set(["", "/a"]));
  assert.deepEqual(open.map((r) => [r.path, r.depth, r.kind]), [
    ["", 0, "object"], ["/a", 1, "array"], ["/a/0", 2, "number"], ["/a/1", 2, "string"], ["/b~1c", 1, "null"]]);
  assert.equal(open[3].text, '"x"');
});

test("containers: by depth, or all", () => {
  const value = { a: { b: { c: 1 } }, d: [] };
  assert.deepEqual([...containers(value, 1)], ["", "/a", "/d"]);
  assert.deepEqual([...containers(value)], ["", "/a", "/a/b", "/d"]);
  assert.deepEqual([...containers(42)], []);
});

import { valueAt, toggleDeep } from "../mods/cria-file-preview/json-tree.js";
import { formatSize } from "../mods/cria-file-preview/size.js";

test("valueAt and toggleDeep: alt-click opens or closes a whole branch", () => {
  const value = { a: { b: { c: [1] } }, "x/y": { z: {} } };
  assert.deepEqual(valueAt(value, "/a/b"), { c: [1] });
  assert.deepEqual(valueAt(value, "/x~1y/z"), {});
  assert.equal(valueAt(value, "/a/nope/deeper"), undefined);
  const opened = toggleDeep(value, new Set([""]), "/a");
  assert.deepEqual([...opened].sort(), ["", "/a", "/a/b", "/a/b/c"]);
  assert.deepEqual([...toggleDeep(value, opened, "/a")], [""]);
  assert.deepEqual([...toggleDeep(value, new Set([""]), "/x~1y")].sort(), ["", "/x~1y", "/x~1y/z"]);
});

test("formatSize", () => {
  assert.equal(formatSize(840), "840 B");
  assert.equal(formatSize(1024), "1 KB");
  assert.equal(formatSize(12 * 1024 + 300), "12 KB");
  assert.equal(formatSize(3.4 * 1024 * 1024), "3.4 MB");
  assert.equal(formatSize(null), "");
});

import { relativePath } from "../mods/cria-file-preview/paths.js";

test("relativePath: from the repo root, else ~/, else absolute", () => {
  assert.equal(relativePath("/Users/g/repo/docs/a.md", "/Users/g/repo", "/Users/g"), "docs/a.md");
  assert.equal(relativePath("/Users/g/notes/a.md", null, "/Users/g"), "~/notes/a.md");
  assert.equal(relativePath("/tmp/a.md", "/Users/g/repo", "/Users/g"), "/tmp/a.md");
  assert.equal(relativePath("/Users/g/repo2/a.md", "/Users/g/repo", "/Users/g/"), "~/repo2/a.md");
  assert.equal(relativePath("C:\\Users\\g\\repo/docs/a.md", "C:/Users/g/repo", "C:\\Users\\g"), "docs/a.md");
});

import { imageExtension } from "../mods/cria-file-preview/mime.js";

test("imageExtension: images the preview draws, nothing else", () => {
  assert.equal(imageExtension("image/svg+xml"), "svg");
  assert.equal(imageExtension("image/PNG; charset=binary"), "png");
  assert.equal(imageExtension("image/jpeg"), "jpg");
  assert.equal(imageExtension("text/html"), null);
  assert.equal(imageExtension("image/tiff"), null);
});

import { systemOf, commands, revealLabel } from "../mods/cria-file-preview/platform.js";

test("platform commands: open and reveal per system, none for a remote file", () => {
  assert.equal(systemOf("macos", null), "macos");
  assert.equal(systemOf("macos", "box"), "remote");
  assert.deepEqual(commands("macos", new Set()).reveal("/a/b.md"), ["open", ["-R", "/a/b.md"]]);
  assert.deepEqual(commands("linux", new Set(["xdg-open"])).reveal("/a/b.md"), ["xdg-open", ["/a"]]);
  assert.equal(commands("linux", new Set()).open, undefined);
  assert.deepEqual(commands("remote", new Set()), {});
  assert.equal(revealLabel("windows"), "Show in Explorer");
});

test("platform commands: Windows passes paths to PowerShell as character codes", () => {
  const [program, args] = commands("windows", new Set()).open("C:/it's/b.md");
  const codes = [..."C:\\it's\\b.md"].map((c) => c.charCodeAt(0)).join(",");
  assert.equal(program, "powershell");
  assert.ok(args.at(-1).endsWith(` (-join [char[]]@(${codes}))`));
});
