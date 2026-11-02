# Regenerating preview.png

`herdr-app shot` captures the whole Herdr window: other spaces, agents and their tasks, the Files panel. Only the mod's pane goes into `preview.png`. Every `herdr-app` call talks to the running app; in Claude Code, run them outside the sandbox.

1. Note the current tab: `herdr-app status` → `tab`.
2. Open the file the changed viewer shows best (default `samples/README.md`, which covers Markdown, images and links):
   `herdr-app do tab.new '{"name":"preview-shot","mod":"cria-file-preview","props":{"file":"<absolute path>"}}'` and note the returned `tab`.
3. `herdr-app shot <folder>/full.png`. The shot is the last frame drawn; take it while the new tab is shown.
4. Put the person back: `herdr-app do tab.select '{"id":"<tab from step 1>"}'`, then `herdr-app do tab.close '{"id":"<tab from step 2>","confirmed":true}'`.
5. Read `full.png` and find the mod's pane: its rounded border, from the `cria-file-preview` title row to the bottom edge. Crop to it, then scale to 1600px wide:
   `sips --cropOffset <top> <left> -c <height> <width> full.png --out pane.png` and `sips -Z 1600 pane.png --out preview.png`. The coordinates are in the shot's own pixels; the image you are shown may be scaled down.
6. Read the cropped image. It shows the mod and nothing else: no other pane, no space or agent names, no file content outside `samples/`. Then copy it to the repo root.
7. `node scripts/check-herdr.mjs` for size and format.

Done when `preview.png` shows the current build, only the mod's pane, and the person's window is back on their tab.
