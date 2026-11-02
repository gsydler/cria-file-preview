// Reading a file as text and showing it as code: shared by the code and Markdown viewers.
import { Editor, EditorState } from "gpui-base";
import { readTextFile, theme, settings } from "herdr";

const LIMIT = 400000;

export async function readText(file, on) {
  const text = await readTextFile(file, { on });
  if (text === null) throw new Error("This file is no longer available");
  if (text.includes("\0")) throw new Error("Binary file · no text preview");
  return text;
}

export function codeState(text, language) {
  const t = theme();
  return EditorState.new({ language, readonly: true,
    value: text.length > LIMIT ? text.slice(0, LIMIT) + "\n… (file truncated)" : text,
    font_family: settings().font_family, font_size: 13,
    syntax: { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6 } });
}

export const codeView = (state) => Editor.new(state).flex_1().min_h(0);
