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

The mod carries only code it runs; nothing is shared with another mod's folder. Its one contract is how a file panel opens it, described in `RECIPE.md` ("Install") and coded in `open-file.js`: the mod name, the `props` (`file`, `on`) and the shared keys (`cria-file-preview.open`, `.moved`). A panel patched at install time keeps its own copy of that file, so a change to any of these breaks every installed opener: treat it as a breaking change in `CHANGELOG.md`. If a panel in this repo ever opens the preview, its copy of `open-file.js` must stay identical to this one.

The mod name also appears in asset paths (`mods/cria-file-preview/…`), `openOverlay` and the cache folder `data/cria-file-preview/`: a rename touches all of them. The folder name (`file-preview`) is only in the address and this repo's paths.

## The banner

`preview.png` is the banner `scripts/banner.sh file-preview` renders from `assets/banner.html`; the screenshot in it, `assets/pane.png`, is a crop of the mod's pane only, because `herdr-app shot` captures the whole window, including other spaces and agents. The steps are in the release-check skill's `PREVIEW.md`.
