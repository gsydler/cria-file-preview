// Pictures: fitted to the pane, or zoomed. Files on this computer only.
// Zoomed larger than the pane, a drag or the wheel moves the picture; the wheel
// with ctrl or cmd held zooms around the pointer.
import { div, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, settings } from "herdr";
import { stageImage, pruneCache } from "../media.js";
import { zoomControl } from "./zoom.js";
import { wheelZoom, zoomAt, placed, offsetFor, focusAt } from "../pan-zoom.js";

const PAD = 24;

// Herdr scales what a mod draws by the app's zoom, but reports sizes and pointer
// positions unscaled: everything here is in drawing units.
const unit = () => settings().zoom || 1;
const paneOf = (env) => ({ width: env.size.width / unit(), height: env.size.height / unit() });
const fit = (picture, pane) => Math.min(1, (pane.width - 2 * PAD) / picture.width, (pane.height - 2 * PAD) / picture.height);

// The scale, size and top-left corner the picture is drawn at now.
function view(state, env) {
  const p = state.picture, pane = paneOf(env), scale = Math.max(0.01, state.zoom ?? fit(p, pane));
  const size = { width: p.width * scale, height: p.height * scale };
  return { pane, scale, size, offset: placed(state.zoom === null ? null : offsetFor(state.focus, size, pane), size, pane, PAD) };
}

function moveTo(state, offset, size, pane) {
  state.focus = focusAt(placed(offset, size, pane, PAD), size, pane);
}

function wheel(state, env, e) {
  const v = view(state, env);
  if (e.modifiers.control || e.modifiers.platform) {
    const to = wheelZoom(v.scale, e.delta.y), size = { width: state.picture.width * to, height: state.picture.height * to };
    const point = e.local_position ? { x: e.local_position.x / unit(), y: e.local_position.y / unit() } : { x: v.pane.width / 2, y: v.pane.height / 2 };
    state.zoom = to;
    moveTo(state, zoomAt(v.offset, v.scale, to, point), size, v.pane);
  } else if (state.zoom !== null) {
    // Shift turns a mouse wheel sideways.
    const dx = e.modifiers.shift && !e.delta.x ? e.delta.y : e.delta.x, dy = e.modifiers.shift && !e.delta.x ? 0 : e.delta.y;
    moveTo(state, { x: v.offset.x + dx / unit(), y: v.offset.y + dy / unit() }, v.size, v.pane);
  }
}

export default {
  id: "image",
  async load(file, env, previous) {
    if (env.on) throw new Error("Image previews work for files on this computer only");
    const picture = await stageImage(file);
    pruneCache();
    return { picture, zoom: previous?.zoom ?? null, focus: previous?.focus ?? null, drag: null };
  },

  toolbar: (state, env) => h_flex().gap(8).items_center().text_size(12).text_color(theme().dim)
    .child(`${state.picture.width} × ${state.picture.height}`)
    .child(zoomControl(state, view(state, env).scale)),

  render(state, env) {
    const v = view(state, env);
    // Back at Fit, the next zoom starts from the center, not from an old drag.
    if (state.zoom === null) state.focus = null;
    const movable = v.size.width + 2 * PAD > v.pane.width || v.size.height + 2 * PAD > v.pane.height;
    return div().id("image-view").flex_1().min_h(0).size_full().relative().overflow_hidden().bg(theme().canvas)
      .when(movable, (el) => state.drag ? el.cursor_grabbing() : el.cursor_grab())
      .on_mouse_down("left", (e, cx) => {
        if (!movable) return;
        state.drag = { from: e.position, offset: view(state, env).offset };
        cx.notify();
      })
      .on_mouse_move((e, cx) => {
        const d = state.drag;
        if (!d) return;
        const now = view(state, env);
        moveTo(state, { x: d.offset.x + (e.position.x - d.from.x) / unit(), y: d.offset.y + (e.position.y - d.from.y) / unit() }, now.size, now.pane);
        cx.notify();
      })
      .on_mouse_up("left", (_e, cx) => { state.drag = null; cx.notify(); })
      // A release outside the pane never arrives here: leaving it ends the drag.
      .on_hover((inside, cx) => { if (!inside && state.drag) { state.drag = null; cx.notify(); } })
      .on_scroll_wheel((e, cx) => { wheel(state, env, e); cx.notify(); })
      .child(image(state.picture.path).absolute().left(v.offset.x).top(v.offset.y).w(v.size.width).h(v.size.height));
  },
};
