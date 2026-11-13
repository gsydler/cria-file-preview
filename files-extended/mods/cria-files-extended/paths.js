// Paths as the panel joins them: "/" between parts on every system, though a folder on
// Windows comes with "\" (C:\x/src/a.js). Pure, so node --test covers it.

// macOS and Windows disks ignore case by default: README.md and readme.md are one item.
export const caseBlind = (system) => system === "macos" || system === "windows";

const slash = (path) => path.replaceAll("\\", "/");

/** The last part of `path`, whichever separator comes before it. */
export const baseName = (path) => path.split(/[\\/]/).pop();

/** `path` without its last part, or "" when it has one part only. */
export function parentOf(path) {
  const at = slash(path).lastIndexOf("/");
  return at < 0 ? "" : path.slice(0, at);
}

/** Whether `path` is `base` or lies inside it, on `system` (case-blind on macOS and Windows). */
export function within(path, base, system) {
  const p = slash(path), b = slash(base).replace(/\/+$/, ""), head = p.slice(0, b.length);
  const same = caseBlind(system) ? head.toLowerCase() === b.toLowerCase() : head === b;
  return same && (p.length === b.length || p[b.length] === "/");
}

/** `file` relative to the git checkout `top` when inside it, else to the shown folder `root`. */
export function relativeTo(file, top, root, system) {
  // Windows mixes separators: git prints C:/x, a folder comes as C:\x.
  for (const base of [top, root]) {
    if (base && within(file, base, system)) return slash(file).slice(slash(base).replace(/\/+$/, "").length + 1) || ".";
  }
  return slash(file);
}
