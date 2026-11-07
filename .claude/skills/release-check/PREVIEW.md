# Regenerating file-preview/preview.png

`file-preview/preview.png` is the banner: `file-preview/assets/banner.html` (logo, tagline, feature list and `file-preview/assets/pane.png`, a screenshot of the mod's pane) rendered by `scripts/banner.sh file-preview`. Paths are from the repo's top folder. When something drawn changed, refresh the screenshot first, then render. A change to the banner's text or features needs only step 7.

`herdr-app shot` captures the whole Herdr window: other spaces, agents and their tasks, the Files panel. Only the mod's pane goes into `file-preview/assets/pane.png`. Every `herdr-app` call talks to the running app, and the browser render needs it too: in Claude Code, run them outside the sandbox.

1. Note the current tab: `herdr-app status` → `tab`.
2. Open `file-preview/samples/README.md` in a new tab, then split it, so each pane is half the window, the width the banner shows:
   `herdr-app do tab.new '{"name":"preview-shot","mod":"cria-file-preview","props":{"file":"<absolute path>"}}'` (note the returned `tab`), then `herdr-app do pane.split '{"direction":"right","mod":"cria-file-preview","props":{"file":"<absolute path>"}}'`.
3. Wait about 3 seconds for the preview to draw (a shot taken at once shows "Loading…"), then `herdr-app shot <folder>/full.png`.
4. Put the person back: `herdr-app do tab.select '{"id":"<tab from step 1>"}'`, then `herdr-app do tab.close '{"id":"<tab from step 2>","confirmed":true}'`.
5. Read `full.png` and find the left pane: its rounded border, from the `cria-file-preview` title row to the bottom edge. Crop just inside the border, then scale to 1200px wide:
   `sips --cropOffset <top> <left> -c <height> <width> full.png --out pane.png` and `sips --resampleWidth 1200 pane.png --out file-preview/assets/pane.png`. The coordinates are in the shot's own pixels; the image you are shown may be scaled down.
6. Read `file-preview/assets/pane.png`. It shows the mod and nothing else: no other pane, no space or agent names, no file content outside `file-preview/samples/`.
7. `scripts/banner.sh file-preview`, then read `file-preview/preview.png`: the text is in Geist, nothing overflows, the pane on the right is the new one.
8. `node scripts/check-herdr.mjs file-preview` for size and format.

Done when `file-preview/preview.png` shows the current build, `file-preview/assets/pane.png` only the mod's pane, and the person's window is back on their tab. The GitHub social preview (Settings, General, Social preview) is one image for the whole repo: tell the person if it is this banner and needs uploading again.
