// How "Open in editor" runs: the person's $VISUAL or $EDITOR without its wait
// flag (nothing here waits for the file to close), else the system's opener
// (`open` on macOS, `xdg-open` on Linux; Windows has its own in platform.js).
// Pure, so node --test covers it.

const WAIT = new Set(["--wait", "-w"]);

/** `editor`: the $VISUAL/$EDITOR string. Returns the argv that opens `file`. */
export function editorCommand(editor, file, opener = "open") {
  const words = String(editor ?? "").trim().split(/\s+/).filter((w) => w && !WAIT.has(w));
  return [...(words.length ? words : [opener]), file];
}
