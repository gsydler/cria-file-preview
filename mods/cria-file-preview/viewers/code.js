// Any text file: read-only source with syntax colors and line numbers.
import { languageOf } from "../kinds.js";
import { readText, codeState, codeView } from "./text.js";

export default {
  id: "code",
  async load(file, env) {
    return { editor: codeState(await readText(file, env.on), languageOf(file)) };
  },
  render: (state) => codeView(state.editor),
  release: (state) => state.editor?.release(),
};
