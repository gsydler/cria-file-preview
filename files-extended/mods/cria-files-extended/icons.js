// Which icon a row shows, and which theme color paints it. The icons are Lucide's
// (icons/, ISC: icons/LICENSE), single-color, so the color is a theme key and the
// panel follows whatever theme is on. Pure, so node --test covers it.

const KINDS = {
  code: ["file-code", "ansi4", "js jsx mjs cjs ts tsx mts cts py pyi rb go rs java kt kts scala sc sbt c h cc cpp hpp cs swift php lua dart ex exs erl clj hs ml r jl zig vue svelte html htm css scss sass less tf hcl"],
  shell: ["file-terminal", "ansi2", "sh bash zsh fish ps1 bat cmd command"],
  data: ["file-braces", "ansi3", "json jsonc json5 yaml yml toml xml plist"],
  config: ["file-cog", "ansi6", "ini cfg conf properties editorconfig"],
  text: ["file-text", "muted", "md mdx markdown txt rst adoc org log"],
  pdf: ["file-text", "ansi1", "pdf"],
  table: ["file-spreadsheet", "ansi2", "csv tsv xls xlsx ods parquet"],
  image: ["file-image", "ansi5", "png jpg jpeg gif webp svg ico bmp tif tiff heic avif"],
  video: ["file-video-camera", "ansi5", "mp4 mov mkv webm avi"],
  audio: ["file-music", "ansi5", "mp3 wav flac ogg m4a aac"],
  archive: ["file-archive", "ansi1", "zip tar gz tgz bz2 xz zst 7z rar jar war dmg iso"],
  database: ["file-database", "ansi6", "sql db sqlite sqlite3"],
  font: ["file-type", "muted", "ttf otf woff woff2"],
  diff: ["file-diff", "ansi2", "diff patch"],
  key: ["file-key", "ansi3", "pem key crt cer p12 pfx pub gpg asc"],
  lock: ["file-lock", "dim", "lock"],
};

// Whole names that say more than their extension.
const NAMES = {
  lock: "package-lock.json npm-shrinkwrap.json pnpm-lock.yaml",
  key: ".env id_rsa id_ecdsa id_ed25519",
  config: "Dockerfile Containerfile Makefile GNUmakefile Justfile Brewfile Gemfile Rakefile Procfile Vagrantfile CMakeLists.txt",
  text: "LICENSE COPYING",
};

const BY_EXT = new Map(), BY_NAME = new Map();
for (const [kind, [, , exts]] of Object.entries(KINDS)) for (const ext of exts.split(" ")) BY_EXT.set(ext, kind);
for (const [kind, names] of Object.entries(NAMES)) for (const name of names.split(" ")) BY_NAME.set(name, kind);

/** { icon, color }: `icon` names a file in icons/, `color` a theme() key. */
export function iconFor(name, dir, open) {
  if (dir) return { icon: name === ".github" || name === ".gitlab" ? "folder-git" : open ? "folder-open" : "folder", color: "accent" };
  const kind = BY_NAME.get(name)
    ?? (name.startsWith(".env.") ? "key" : null)
    ?? (name.startsWith(".git") || /^\.[a-z]+rc$/.test(name) ? "config" : null)
    ?? BY_EXT.get(name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "");
  const [icon, color] = KINDS[kind] ?? ["file", "muted"];
  return { icon, color };
}
