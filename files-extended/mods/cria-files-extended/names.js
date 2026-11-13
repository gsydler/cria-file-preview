// Names for new, renamed, pasted and duplicated items. Pure, so node --test covers it.
import { parentOf, within } from "./paths.js";

/** Why `name` can't name an item in a folder on `system`, or null when it can. */
export function badName(name, system) {
  if (!name.trim()) return "Type a name";
  if (name === "." || name === "..") return `"${name}" can't be used as a name`;
  // Windows takes \ as a separator too.
  if (system === "windows" && (name.includes("/") || name.includes("\\") || name.includes("\0"))) return "A name can't contain / or \\";
  if (name.includes("/") || name.includes("\0")) return "A name can't contain /";
  return null;
}

/** Whether renaming `old` to `name`, in the same folder, changes only the letters' case. */
export const caseOnly = (old, name) => old !== name && old.toLowerCase() === name.toLowerCase();

/**
 * Why the name typed for New or Rename can't be used, or null. `old`: the name being
 * renamed, else null; `taken`: the names in the folder. A rename that only changes case
 * isn't checked against `taken`, where a disk that ignores case finds the item itself;
 * the command decides.
 */
export function nameError(name, { old = null, taken, system }) {
  const bad = badName(name, system);
  if (bad) return bad;
  if (old !== null && (name === old || caseOnly(old, name))) return null;
  return taken.has(name) ? `${name} already exists here` : null;
}

/**
 * `name`, or Finder's "a copy.txt", "a copy 2.txt"… when `taken` (a Set) already holds it,
 * compared regardless of case when `blind` (the disk ignores case). A folder or a dotfile
 * keeps its whole name before " copy"; a copy of a copy counts on.
 */
export function freeName(name, taken, dir, blind = false) {
  const lower = blind ? new Set([...taken].map((n) => n.toLowerCase())) : null;
  const has = (n) => (blind ? lower.has(n.toLowerCase()) : taken.has(n));
  if (!has(name)) return name;
  const dot = dir ? -1 : name.lastIndexOf(".");
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  const base = stem.replace(/ copy( \d+)?$/, "");
  for (let n = 1; ; n++) {
    const next = `${base} copy${n > 1 ? ` ${n}` : ""}${ext}`;
    if (!has(next)) return next;
  }
}

/**
 * Pasting `item` ({ file, dir, cut }, absolute) into the folder `dest`: "inside" when a
 * folder would go inside itself, "here" when a cut item is already in `dest` (nothing to
 * do), else null. Compared as `system` compares paths.
 */
export function pasteProblem(item, dest, system) {
  if (item.dir && within(dest, item.file, system)) return "inside";
  const from = parentOf(item.file);
  if (item.cut && within(dest, from, system) && within(from, dest, system)) return "here"; // the same folder
  return null;
}
