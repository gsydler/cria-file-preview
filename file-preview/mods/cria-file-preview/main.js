// cria-file-preview: one file shown by the viewer for its kind, opened in a tab or a split
// by files-extended. Each copy draws the part its props.part names:
//   preview  the file (preview.js); the default
//   menu     the preview's ⋯ popup (menu.js)
import { View } from "gpui-kit";
import { props } from "herdr";
import { Preview } from "./preview.js";
import { FileMenu } from "./menu.js";

const PARTS = { preview: Preview, menu: FileMenu };

export default class FilePreview extends View {
  init(initial, cx) {
    this.part = new (PARTS[props()?.part] ?? Preview)();
    this.part.init(initial, cx);
  }

  render(cx) { return this.part.render(cx); }

  close(cx) { return this.part.close?.(cx); }
}
