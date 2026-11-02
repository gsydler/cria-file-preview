// Pictures for image(), which reads only from the Herdr home: a local file is
// copied into data/cria-file-preview/, named by its path and modification time; a
// web image, once the person asked, is downloaded there (https only, 5 MB,
// 10 s, image types only). Each is measured: sips on macOS, `file` elsewhere,
// the SVG's own width/height or viewBox.
import { exec, appHome, readTextFile, window } from "herdr";
import { extension } from "./kinds.js";
import { svgSize } from "./svg-size.js";
import { imageExtension } from "./mime.js";
import { STAGE, FETCH, sizeCommand, pictureSize } from "./programs.js";

const DIR = () => `${appHome().split("\\").join("/")}/data/cria-file-preview`;

// A short, stable name for a path (FNV-1a).
export function key(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

// Size in pixels of a cached picture, by its name in data/cria-file-preview/.
async function measure(name) {
  const file = `${DIR()}/${name}`;
  if (name.endsWith(".svg")) return svgSize(await readTextFile(file) ?? "");
  const [program, args] = sizeCommand(window()?.platform, file);
  return pictureSize((await exec(program, args)).stdout);
}

async function picture(name) {
  const size = await measure(name);
  if (!(size.width > 0 && size.height > 0)) throw new Error("This image format can't be shown");
  return { path: `data/cria-file-preview/${name}`, ...size };
}

/** Resolves { path (for image()), width, height } for a local picture. */
export async function stageImage(file) {
  const r = await exec("sh", ["-c", STAGE, "stage", file, DIR(), key(file), extension(file)]);
  if (r.code !== 0) throw new Error(r.stderr.trim() || "Cannot read this image");
  return picture(r.stdout.trim());
}

/** The same for a web image: downloaded, then kept only when it is an image. */
export async function fetchImage(url) {
  const k = key(url), r = await exec("sh", ["-c", FETCH, "fetch", url, DIR(), k]);
  if (r.code !== 0) throw new Error(r.stderr.trim() || "Download failed");
  const ext = imageExtension(r.stdout.trim()), tmp = `${DIR()}/${k}.download`;
  if (!ext) { await exec("rm", ["-f", tmp]); throw new Error(`Not an image (${r.stdout.trim()})`); }
  await exec("mv", ["-f", tmp, `${DIR()}/${k}.${ext}`]);
  return picture(`${k}.${ext}`);
}

/** Drops cached pages and pictures older than two weeks. */
export function pruneCache() {
  return exec("find", [DIR(), "-type", "f", "-mtime", "+14", "-delete"]).catch(() => null);
}
