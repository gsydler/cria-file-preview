// Any text file: read-only source with syntax colors and line numbers.
import { languageOf } from "../kinds.js";
import { readLongText, codeState, codeView } from "./text.js";
import { wrapButton } from "./controls.js";

export default {
  id: "code",
  async load(file, env) {
    const text = (await readLongText(file, env.on)).text, language = languageOf(file);
    return { text, language, editor: codeState(text, language) };
  },
  toolbar: (state) => wrapButton(state, state.language),
  render: (state) => codeView(state.editor),
  release: (state) => state.editor?.release(),
};
