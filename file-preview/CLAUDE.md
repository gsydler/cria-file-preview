# file-preview

The `cria-file-preview` mod, listed as `herdr.dev/mods/gsydler/herdr-cria--file-preview`. `mods/cria-file-preview/` is the mod; `RECIPE.md`, `preview.png` (and a `keys.json`, if it ever needs one) are what herdr.dev/mods reads. `README.md` is for people on GitHub. The repo-wide rules, checks and versioning are in `../CLAUDE.md`.

## Checks

- `node --test 'file-preview/tests/*.test.mjs'` from the repo's top folder, and `node scripts/check-herdr.mjs file-preview`. CI runs the tests on Linux (with poppler-utils), macOS and Windows. In Claude Code run them outside the sandbox: the sandbox stops osascript from saving the PDF test's pages.
- `smoke-test` skill: the running app against `samples/expected.json`. `herdr-app check` stops at the first render, so `exec`, `watchFolder` and async loads prove themselves only here.
- On Windows a terminal's PATH has Git's tools and Herdr's lacks them: run a local `node --test` with Git off PATH, as CI does.
- After a change under `mods/`, and before tagging a release (`file-preview/vX.Y.Z`), run the `release-check` skill.

## Where logic goes

Logic sits in modules marked "Pure, so node --test covers it" (`kinds.js`, `paths.js`, `links.js`, `delimited.js`, `json-tree.js`, …) and gets a test in `tests/`. The viewers and `preview.js` only draw and call `herdr`. A program that differs per system lives in the table in `programs.js` (the ⋯ menu's in `platform.js`) as `[program, args]`, and runs for real in `tests/programs.test.mjs`; what opens a window or needs the network is tested for its form in `tests/windows.test.mjs`. A new viewer: `viewers/<id>.js`, registered in `viewers/index.js`, its extensions mapped in `kinds.js`.

## Standalone, with one public contract

The mod carries only code it runs; nothing is shared with another mod's folder. Its one contract is how a file panel opens it, described in `RECIPE.md` ("Install") and coded in `open-file.js`: the mod name, the `props` (`file`, `on`) and the shared keys (`cria-file-preview.open`, `.moved`). A panel patched at install time keeps its own copy of that file, so a change to any of these breaks every installed opener: treat it as a breaking change in `CHANGELOG.md`. `files-extended/` opens the preview: its copies of `open-file.js`, and of `editor.js` and `editor-command.js` (Open in editor, which it has too), must stay identical to these, which `check-herdr.mjs` checks (its `SAME` list), and its install replaces a Files panel this mod's install patched, while this mod's install leaves it alone.

The mod name also appears in asset paths (`mods/cria-file-preview/…`), `openOverlay` and the cache folder `data/cria-file-preview/`: a rename touches all of them. The folder name (`file-preview`) is only in the address and this repo's paths.

## Release check

What the `release-check` skill holds this mod to, besides the repo-wide steps:

- **Security:** web content loads only after a click, https only, with size and time caps, and only the expected type is kept. The mod writes only under `data/cria-file-preview/` in the Herdr home, and checks that paths a helper returns stay there (as `pdf-render.js` does). Only `http`, `https` and `mailto` links leave Herdr; other schemes are refused. The mod changes no file of the person's: the only commands that write go to its cache folder, and the ⋯ menu only opens, reveals and copies; a command that moves, deletes or edits a file is a finding.
- **Feature list:** every viewer in `viewers/index.js`, every extension in `kinds.js`, every header control, toolbar control and ⋯ menu item, every limit (row, page, size and character caps, platform tools).
- **Preview:** anything drawn (`viewers/`, `preview.js`, `menu.js`, the SVG icons) changed since `preview.png`'s last commit makes it stale.

## Smoke test

- **Oracle:** `samples/expected.json` holds one entry per sample: its `viewer`, the `facts` the unit tests check, what is `visible` once it opens, and its `manual` steps.
- **Show a sample:** `herdr-app do tab.new '{"name":"smoke","mod":"cria-file-preview","props":{"file":"<absolute path of the sample>"}}'`, noting the returned `tab`; close it with `tab.close`. PDF pages render in batches: a shot still saying "Loading…" is taken again.
- **Live reload:** copy `samples/notes.txt` and `samples/data.json` to a scratch folder, open each copy, append a line to the text copy and change a value in the JSON copy after opening a branch, shoot again: the change shows without reopening, and the branch stays open.
- **For every file**, once, on `samples/README.md`: a click on the name copies it, a click on the folder copies the full path, and each ⋯ menu item works (Open in editor, Open with default app, Reveal, Copy path, Copy relative path).

## The banner

`preview.png` is the banner `scripts/banner.sh file-preview` renders from `assets/banner.html`; the screenshot in it, `assets/pane.png`, is a crop of the mod's pane only, because `herdr-app shot` captures the whole window, including other spaces and agents. The steps are in the release-check skill's `PREVIEW.md`. To show the mod for it, open `samples/README.md` in a new tab, then split it, so each pane is half the window, the width the banner shows: `herdr-app do tab.new '{"name":"preview-shot","mod":"cria-file-preview","props":{"file":"<absolute path>"}}'`, then `herdr-app do pane.split '{"direction":"right","mod":"cria-file-preview","props":{"file":"<absolute path>"}}'`. Crop the left pane, from the `cria-file-preview` title row to the bottom edge, scaled to 1200px wide.
