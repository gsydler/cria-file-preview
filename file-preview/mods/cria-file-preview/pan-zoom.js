// Zoom steps, and where a zoomed picture sits in its pane: the wheel zooms
// around the pointer, a drag or the wheel moves it. Pure, so node --test covers it.

export const ZOOMS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

/** The scale after one wheel turn with ctrl or cmd held: away from you zooms in, smoothly on a trackpad. */
export function wheelZoom(scale, deltaY) {
  return Math.min(ZOOMS.at(-1), Math.max(ZOOMS[0], scale * Math.exp(deltaY / 250)));
}

/** The picture's top-left corner after a zoom, keeping the point under the pointer where it was. */
export function zoomAt(offset, from, to, point) {
  const k = to / from;
  return { x: point.x - (point.x - offset.x) * k, y: point.y - (point.y - offset.y) * k };
}

/** The picture's top-left corner, kept on screen: centered along a side where it fits
 *  the pane, else leaving at most `pad` of empty canvas at an edge. offset null: centered. */
export function placed(offset, size, pane, pad) {
  const along = (at, length, room) => length + 2 * pad <= room ? (room - length) / 2
    : Math.min(pad, Math.max(room - length - pad, at ?? (room - length) / 2));
  return { x: along(offset?.x, size.width, pane.width), y: along(offset?.y, size.height, pane.height) };
}

// The view is kept as the picture's point at the pane's center, in fractions of
// its size, so the − and + buttons zoom around the center without knowing the offset.

/** The top-left corner that puts `focus` at the pane's center; null focus: null (centered). */
export const offsetFor = (focus, size, pane) => focus && { x: pane.width / 2 - focus.x * size.width, y: pane.height / 2 - focus.y * size.height };

/** The point at the pane's center for a top-left corner. */
export const focusAt = (offset, size, pane) => ({ x: (pane.width / 2 - offset.x) / size.width, y: (pane.height / 2 - offset.y) / size.height });
