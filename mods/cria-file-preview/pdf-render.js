// PDF pages as PNGs: drawn by macOS's own PDFKit through osascript (nothing to
// install), elsewhere by poppler's pdftoppm. Pages land in data/cria-file-preview/
// in the Herdr home, because image() only reads files from there. A page is named
// by its file, its modification time and its number, so an edited PDF renders anew.
import { exec, appHome, window } from "herdr";
import { key } from "./media.js";
import { PDFKIT, POPPLER, popplerPages } from "./programs.js";

const WIDTH = 1600; // pixels across: sharp in a wide tab on a Retina screen, ~0.5 MB a page

/** Renders pages from..to (1-based, clamped). Resolves { count, pages: [{ n, path, width, height }] }. */
export async function renderPages(file, from, to) {
  const dir = `${appHome().split("\\").join("/")}/data/cria-file-preview`, k = key(file);
  let out;
  if (window()?.platform === "macos") {
    const r = await exec("osascript", ["-l", "JavaScript", "-e", PDFKIT, file, dir, k, String(from), String(to), String(WIDTH)]);
    if (r.code !== 0) throw new Error(r.stderr.replace(/^.*execution error: (Error: )?/s, "").replace(/ \(-?\d+\)\s*$/, "").trim() || "Cannot render this PDF");
    out = JSON.parse(r.stdout.trim());
  } else {
    const r = await exec("sh", ["-c", POPPLER, "pdf", file, dir, k, String(from), String(to), String(WIDTH)]);
    if (r.code !== 0) throw new Error(/password/i.test(r.stderr) ? "This PDF is password protected" : r.stderr.trim() || "Cannot render this PDF");
    out = popplerPages(r.stdout, k);
  }
  if (!Array.isArray(out.pages) || out.pages.some((p) => !p.path.startsWith("data/cria-file-preview/"))) throw new Error("The PDF renderer returned something unexpected");
  return out;
}
