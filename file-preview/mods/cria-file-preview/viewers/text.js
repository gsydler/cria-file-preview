// Reading a file as text and showing it as code: shared by the code and Markdown viewers.
import { Editor, EditorState } from "gpui-base";
import { readTextFile, exec, theme, settings, window } from "herdr";
import { GONE, withoutBom, readFailure, tooLong, wholeLines } from "../text-file.js";
import { programs } from "../programs.js";
import { systemOf } from "../platform.js";

const LIMIT = 400000;
const HEAD = 4 * 1024 * 1024; // more than LIMIT characters in any encoding; readTextFile stops at 1 MiB

function checked(text) {
  if (text === null) throw new Error(GONE);
  if (text.includes("\0")) throw new Error("Binary file · no text preview");
  return withoutBom(text);
}

export async function readText(file, on) {
  return checked(await readTextFile(file, { on }).catch((e) => { throw new Error(readFailure(String(e?.message ?? e))); }));
}

/** For a view that can cut: a file over Herdr's read limit comes back as its head. Resolves { text, cut }. */
export async function readLongText(file, on) {
  let long = false;
  const text = await readTextFile(file, { on }).catch((e) => {
    if (tooLong(String(e?.message ?? e))) { long = true; return null; }
    throw new Error(readFailure(String(e?.message ?? e)));
  });
  if (!long) return { text: checked(text), cut: false };
  const r = await exec(...programs(systemOf(window()?.platform, on)).head(file, HEAD), { on });
  if (r.code !== 0) throw new Error(r.stderr.trim() || "Cannot read this file");
  return { text: checked(wholeLines(r.stdout)), cut: true };
}

// Whether long lines wrap: the person's last choice, kept across restarts, for
// every editor made from then on. An editor can't change it once made.
const WRAP = "cria-file-preview.wrap", wrapped = new WeakMap();
const wrapping = () => localStorage.getItem(WRAP) === "true";
export const wraps = (editor) => wrapped.get(editor) ?? false;

export function codeState(text, language) {
  const t = theme(), wrap = wrapping();
  const editor = EditorState.new({ language, readonly: true, soft_wrap: wrap,
    value: text.length > LIMIT ? text.slice(0, LIMIT) + "\n… (file truncated)" : text,
    font_family: settings().font_family, font_size: 13,
    syntax: { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6 } });
  wrapped.set(editor, wrap);
  return editor;
}

/** Wrap on or off from now on, and state.editor made again from state.text with it. */
export function toggleWrap(state, language) {
  localStorage.setItem(WRAP, String(!wraps(state.editor)));
  state.editor?.release();
  state.editor = codeState(state.text, language);
}

export const codeView = (state) => Editor.new(state).flex_1().min_h(0);
