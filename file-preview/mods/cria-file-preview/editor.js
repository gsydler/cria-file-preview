// "Open in editor": $VISUAL or $EDITOR, else the default app for the file. An editor that
// draws in a terminal opens in a new Herdr tab, in the file's folder.
import { exec, run, window } from "herdr";
import { commands } from "./platform.js";
import { terminalEditor } from "./editor-command.js";

export async function openInEditor(file, on) {
  if (on) throw new Error("Open in editor works for files on this computer only");
  const [program, args] = commands(window()?.platform, new Set()).editor(file);
  const r = await exec(program, args);
  if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim() || `${program} exited with ${r.code}`);
  const words = terminalEditor(r.stdout);
  if (words) run("terminal.open", { argv: [...words, file], folder: file.slice(0, file.lastIndexOf("/")) || "/", place: "tab" });
}
