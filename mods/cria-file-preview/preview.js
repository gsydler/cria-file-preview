// The preview part: one file, shown by the viewer for its kind (viewers/), opened
// by files-extended in a tab or a split. props: { file: absolute path, on: machine or null }.
// A local file reloads when it changes on disk, keeping the viewer's Raw or zoom.
// The header: Back (after following a link), the name and folder (a click copies
// the name or the full path) and its size, the viewer's own controls, and the ⋯ menu.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, theme, notify, watchFolder, shared, setShared, exec } from "herdr";
import { viewerFor, basename } from "./kinds.js";
import { dirname } from "./links.js";
import { VIEWERS } from "./viewers/index.js";
import { openMenu } from "./menu.js";
import { iconButton } from "./viewers/controls.js";
import { previewId, MOVED } from "./open-file.js";
import { formatSize } from "./size.js";

export class Preview {
  init(_props, cx) {
    const { file, on = null } = props() ?? {};
    this.on = on;
    this.history = [];
    this.size = { width: 900, height: 700 };
    this.show(file, cx);
  }

  env() {
    return { file: this.file, on: this.on, anchor: this.anchor, size: this.size, navigate: (file, cx, anchor) => this.navigate(file, cx, anchor) };
  }

  // reload: the same file changed on disk; the old view stays until the new one is ready.
  show(file, cx, reload = false) {
    const previous = reload ? this.state : null;
    if (!reload) this.release();
    this.file = file; this.error = null;
    if (!file) { this.error = "No file to show"; return; }
    if (!reload) this.watch(cx);
    const viewer = this.viewer = VIEWERS[viewerFor(file)];
    const env = this.env(), loading = this.loading = {};
    cx.spawn(async (cx) => {
      const r = await exec("sh", ["-c", 'wc -c < "$1"', "size", file], { on: this.on }).catch(() => null);
      if (this.loading === loading) { this.bytes = r?.code === 0 ? Number(r.stdout.trim()) : null; cx.notify(); }
    });
    cx.spawn(async (cx) => {
      try {
        const state = await viewer.load(file, env, previous);
        if (this.loading !== loading) { viewer.release?.(state); return; }
        this.release();
        this.state = state;
        viewer.start?.(state, env, cx);
      } catch (e) { if (this.loading === loading) { this.release(); this.error = String(e?.message ?? e); } }
      finally { cx.notify(); }
    });
  }

  watch(cx) {
    if (this.on) return;
    const file = this.file, token = this.watching = {};
    cx.spawn(async (cx) => {
      try {
        while (this.watching === token) {
          const changed = await watchFolder(dirname(file));
          if (this.watching === token && changed.includes(file)) this.show(file, cx, true);
        }
      } catch {}
    });
  }

  navigate(file, cx, anchor) {
    this.history.push(this.file);
    this.anchor = anchor;
    this.show(file, cx);
    this.moved();
    cx.notify();
  }

  back(cx) {
    const file = this.history.pop();
    if (file) { this.anchor = null; this.show(file, cx); this.moved(); cx.notify(); }
  }

  // Tells files-extended what this preview shows now, so it isn't reused for the file it opened with.
  moved() {
    const id = previewId(props()?.file, this.on);
    setShared(MOVED, { ...(shared(MOVED) ?? {}), [id]: this.file });
  }

  release() {
    if (this.state) this.viewer?.release?.(this.state);
    this.state = null;
  }

  close() { this.watching = null; this.release(); }

  // The name or the folder, which a click copies: the name, or the file's full path.
  copier(id, label, what, t) {
    const text = what === "name" ? basename(this.file ?? "") : this.file ?? "";
    return div().id(id).min_w(0).truncate().cursor_pointer().hover((s) => s.text_color(t.accent))
      .tooltip(what === "name" ? "Copy the file name" : "Copy the full path")
      .on_click((_e, cx) => {
        cx.write_to_clipboard(text);
        notify({ title: what === "name" ? "File name copied to the clipboard" : "Path copied to the clipboard", body: text, level: "success", timeout: 2500 });
      }).child(label);
  }

  render() {
    const t = theme(), env = this.env(), viewer = this.viewer, state = this.state;
    const control = (id, label, tip, action) => div().id(id).h(26).px(9).flex().items_center().rounded(6).cursor_pointer().text_size(12)
      .text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tip).on_click(action).child(label);
    return v_flex().id("cria-file-preview").size_full().min_h(0).bg(t.background).text_color(t.foreground).text_size(13)
      .child(h_flex().h(42).flex_none().px(10).gap(8).items_center().border_b(1).border_color(t.border)
        .when(this.history.length > 0, (el) => el.child(control("cria-file-preview-back", "←", `Back to ${basename(this.history.at(-1))}`, (_e, cx) => this.back(cx))))
        .child(h_flex().flex_1().min_w(0).gap(8).items_center().pl(this.history.length ? 0 : 4)
          .child(this.copier("cria-file-preview-name", basename(this.file ?? ""), "name", t).flex_none().max_w(320).font_semibold())
          .child(this.copier("cria-file-preview-path", this.file ? dirname(this.file) : "", "path", t).flex_shrink(1).text_size(12).text_color(t.dim))
          .when(this.bytes != null, (el) => el.child(div().flex_none().text_size(12).text_color(t.dim).child(formatSize(this.bytes))))
          .child(div().flex_1()))
        .when(Boolean(state && viewer?.toolbar), (el) => el.child(viewer.toolbar(state, env)))
        .when(Boolean(this.file), (el) => el.child(iconButton("more", "more", "Open in editor, reveal, copy the path…", false, () => openMenu(this.file, this.on)))))
      .child(v_flex().id("cria-file-preview-body").flex_1().min_h(0).on_size_change((size, cx) => { this.size = size; cx.notify(); })
        .child(state ? viewer.render(state, env) : div().p(14).text_color(this.error ? t.ansi1 : t.dim).child(this.error ?? "Loading…")));
  }
}
