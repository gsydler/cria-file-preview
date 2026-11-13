// Which preview pane the panel opened for which file. run() returns no ids, so a new pane
// is found by comparing panes() before and after. Pure, so node --test covers it.

/**
 * Pairs each pending preview (`pending`: [id, the preview panes there when it was asked
 * for], oldest first) with a preview pane that appeared since and is recorded for no
 * other file. `previews`: the preview panes now; `open`, `moved`: the shared maps
 * (open-file.js). Returns the maps to share, without closed panes, and the ids recorded;
 * null when none was.
 */
export function recordPreviews(pending, previews, open, moved) {
  const alive = new Set(previews), nextOpen = {}, nextMoved = { ...(moved ?? {}) }, done = [];
  for (const [id, pane] of Object.entries(open ?? {})) if (alive.has(pane)) nextOpen[id] = pane;
  const recorded = new Set(Object.values(nextOpen));
  for (const [id, before] of pending) {
    const made = previews.find((p) => !before.has(p) && !recorded.has(p));
    if (!made) continue;
    nextOpen[id] = made;
    recorded.add(made);
    delete nextMoved[id];
    done.push(id);
  }
  return done.length ? { open: nextOpen, moved: nextMoved, done } : null;
}
