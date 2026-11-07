// How a file opens in cria-file-preview: a new tab, or a split beside the focused
// pane, or the pane already showing it. Pure, so node --test covers it.

// Shared keys. OPEN: "<on>:<file>" -> the pane the opener made for it. MOVED:
// "<on>:<file>" -> what that preview shows now, once it followed a link.
export const OPEN = "cria-file-preview.open", MOVED = "cria-file-preview.moved";
export const previewId = (file, on) => `${on ?? ""}:${file}`;

/** The pane already showing `file`, or null. `open`, `moved`: the shared maps; `alive`: pane ids that exist. */
export function shownIn(open, moved, file, on, alive) {
  const id = previewId(file, on), pane = open?.[id];
  return pane && alive.has(pane) && (moved?.[id] ?? file) === file ? pane : null;
}

export const MODES = ["tab", "split-right", "split-down"];

/** The app command, as [name, args], that shows `file` (on machine `on`) in cria-file-preview. */
export function openCommand({ file, on = null, mode = "tab" }) {
  const props = { file, on };
  if (mode === "split-right" || mode === "split-down") {
    return ["pane.split", { direction: mode === "split-down" ? "down" : "right", mod: "cria-file-preview", props }];
  }
  return ["tab.new", { name: file.split(/[\\/]/).pop(), mod: "cria-file-preview", props }];
}
