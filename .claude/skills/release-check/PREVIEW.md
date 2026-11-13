# Regenerating <folder>/preview.png

`<folder>/preview.png` is the banner: `<folder>/assets/banner.html` (logo, tagline, feature list and `<folder>/assets/pane.png`, a screenshot of the mod) rendered by `scripts/banner.sh <folder>`. Paths are from the repo's top folder. When something drawn changed, refresh the screenshot first, then render. A change to the banner's text or features needs only step 7.

`herdr-app shot` captures the whole Herdr window: other spaces, agents and their tasks, the Files panel. Only the mod goes into `<folder>/assets/pane.png`. Every `herdr-app` call talks to the running app, and the browser render needs it too: in Claude Code, run them outside the sandbox.

1. Note the current space and tab: `herdr-app status`.
2. Show the mod on its samples, as `<folder>/CLAUDE.md` ("The banner") says, noting each tab or space you make.
3. Wait about 3 seconds for it to draw (a shot taken at once shows "Loading…"), then `herdr-app shot <scratchpad>/full.png`.
4. Put the person back: `herdr-app do tab.select '{"id":"<tab from step 1>"}'` (or `space.select`), then close what step 2 made, with `"confirmed":true`.
5. Read `full.png` and find the mod's pane: its rounded border, from its title row to the bottom edge. Crop just inside the border, then scale to the width `<folder>/CLAUDE.md` gives (1200px by default):
   `sips --cropOffset <top> <left> -c <height> <width> full.png --out pane.png` and `sips --resampleWidth <width> pane.png --out <folder>/assets/pane.png`. The coordinates are in the shot's own pixels; the image you are shown may be scaled down.
6. Read `<folder>/assets/pane.png`. It shows the mod and nothing else: no other pane, no space or agent names, no file outside `<folder>/samples/`.
7. `scripts/banner.sh <folder>`, then read `<folder>/preview.png`: the text is in Geist, nothing overflows, the screenshot is the new one.
8. `node scripts/check-herdr.mjs <folder>` for size and format.

Done when `<folder>/preview.png` shows the current build, `<folder>/assets/pane.png` only the mod, and the person's window is back where it was. The GitHub social preview (Settings, General, Social preview) is one image for the whole repo: tell the person if it is this banner and needs uploading again.
