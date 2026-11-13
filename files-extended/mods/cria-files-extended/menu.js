// What the right-click menu lists. Pure, so node --test covers it.
import { parentOf } from "./paths.js";

const row = (id, label, enabled = true) => ({ id, label, enabled });

/**
 * The menu for `target` (`path` relative to the tree's folder). `can`: the system's commands
 * (platform.js), so an action it has none for is left out; `labels`: its names for Reveal
 * and Trash. `open(path)`: whether a folder is unfolded;
 * `anyOpen`: whether any is. `canPaste`: something was cut or copied on this machine.
 * Returns { id, label, enabled } rows, with "-" between groups.
 */
export function menuItems({ path, dir }, { can, labels, open, anyOpen, canPaste }) {
  const fold = dir ? [row("expand", "Expand all"), ...(open(path) ? [row("fold", "Fold folder")] : [])]
    : parentOf(path) ? [row("fold-parent", "Fold folder")] : [];
  return [
    row("new-file", "New file…"),
    row("new-folder", "New folder…"),
    "-",
    ...(can.editor ? [row("editor", "Open in editor")] : []),
    ...(can.open && !dir ? [row("default", "Open with default app")] : []),
    ...(can.reveal ? [row("reveal", labels.reveal)] : []),
    row("terminal", "Open in terminal"),
    "-",
    row("cut", "Cut"),
    row("copy", "Copy"),
    row("duplicate", "Duplicate"),
    row("paste", "Paste", Boolean(canPaste)),
    "-",
    row("name", "Copy name"),
    row("path", "Copy path"),
    row("relative", "Copy relative path"),
    "-",
    row("rename", "Rename…"),
    ...(can.trash ? [row("trash", labels.trash)] : []),
    row("delete", "Delete…"),
    "-",
    ...fold,
    row("collapse", "Collapse all", Boolean(anyOpen)),
  ];
}
