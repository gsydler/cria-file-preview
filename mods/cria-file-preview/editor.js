// "Open in editor": $VISUAL or $EDITOR, else the default app for the file.
import { exec, window } from "herdr";
import { editorCommand } from "./editor-command.js";
import { commands } from "./platform.js";

// Asked of the login shell: Herdr's own environment lacks $EDITOR (zsh sets it in .zshenv).
async function loginEditor() {
  const r = await exec("sh", ["-c", 'exec "${SHELL:-/bin/sh}" -lc \'printf %s "${VISUAL:-$EDITOR}"\'']).catch(() => null);
  return r?.stdout ?? "";
}

export async function openInEditor(file, on) {
  if (on) throw new Error("Open in editor works for files on this computer only");
  const platform = window()?.platform;
  const [program, ...args] = platform === "windows"
    ? commands("windows", new Set()).editor(file).flat()
    : editorCommand(await loginEditor(), file, platform === "linux" ? "xdg-open" : "open");
  const r = await exec(program, args);
  if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim() || `${program} exited with ${r.code}`);
}
