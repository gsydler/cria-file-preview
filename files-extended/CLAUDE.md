# files-extended

The `cria-files-extended` mod, listed as `herdr.dev/mods/gsydler/herdr-cria--files-extended`. `mods/cria-files-extended/` is the mod; `RECIPE.md` and `preview.png` are what herdr.dev/mods reads. `README.md` is for people on GitHub. The repo-wide rules, checks and versioning are in `../CLAUDE.md`.

## Checks

- `node --test 'files-extended/tests/*.test.mjs'` from the repo's top folder, and `node scripts/check-herdr.mjs files-extended`. CI runs the tests on Linux, macOS and Windows.
- On Windows a terminal's PATH has Git's tools and Herdr's lacks them: run a local `node --test` with Git off PATH, as CI does.
- `smoke-test` skill: the running app against `samples/expected.json`. Herdr's CLI can't click inside a mod, so the menu is checked with the person.
- After a change under `mods/`, and before tagging a release (`files-extended/vX.Y.Z`), run the `release-check` skill.

## Where logic goes

Logic sits in modules marked "Pure, so node --test covers it" (`listing.js`, `platform.js`, `menu.js`, `names.js`, `paths.js`, `previews.js`, `icons.js`, …) and gets a test in `tests/`. `main.js` only draws and calls `herdr`. A program that differs per system lives in `platform.js` (the menu) or `listing.js` (the folder listing) as `[program, args]`, and runs for real in `tests/programs.test.mjs`; what needs a desktop (Open, Reveal, the Trash) is tested for its form in `tests/windows.test.mjs`. A new icon: its SVG from Lucide in `icons/`, its kind or name in `icons.js`, a file in `samples/` and its row in `samples/expected.json`.

## Herdr's panel underneath

`main.js` is Herdr's shipped `files` mod with our parts added (`NOTICE` names the version). When Herdr ships a new `files`, diff `~/.config/herdr-app/mods/files/main.js` against the version in `NOTICE` (Herdr's changelog names what changed), carry the change over, and bump the version in `NOTICE`, `main.js`'s first line and `RECIPE.md`.

## Standalone, with one optional partner

The mod works alone. It opens files in `cria-file-preview` only when that mod is installed, looked for at each click. Its one contract with it is `open-file.js`, and the install rules in both recipes: this one swaps out a Files panel that `cria-file-preview`'s install patched, and that one leaves this panel alone. `open-file.js`, `editor.js` and `editor-command.js` (Open in editor, which both mods have) must stay identical to their copies in `file-preview/mods/cria-file-preview/` (`check-herdr.mjs`'s `SAME` list fails otherwise): a change to one is made to both, with a line in each entry's changelog when people would notice it.

The mod name appears in asset paths (`mods/cria-files-extended/…`): a rename touches all of them. The folder name (`files-extended`) is only in the address and this repo's paths.

## Release check

What the `release-check` skill holds this mod to, besides the repo-wide steps:

- **Security:** shell scripts take values only as `"$1"`, `"$2"`…; PowerShell values only through `powershell` in `platform.js`, as character codes. A command that changes files runs only from a menu row the person picked, and Delete asks first. The mod reaches no network and writes nothing of its own.
- **Feature list:** every row in `menu.js`, every command in `platform.js` and `listing.js`, every kind in `icons.js` and every block prop (`open`, `icon_colors`) is in `README.md` ("Features", "Platforms") and `RECIPE.md` ("What you see", "How it behaves"), and each claim there is in the code.
- **Preview:** anything drawn (`main.js`'s rows, header, menu and forms, `icons/`, the chevrons) changed since `preview.png`'s last commit makes it stale.

## Smoke test

- **Oracle:** `samples/expected.json` holds `rows` (each file and folder, a folder ending in `/`, with its icon and color; the unit tests check them), what is `visible` when the panel shows `samples/`, and the `manual` steps.
- **Show the samples:** the menu changes files, so copy `samples/` to a scratch folder first, then `herdr-app do space.new '{"name":"smoke","folder":"<scratch copy>"}'` and `herdr-app do pane.split '{"direction":"right","mod":"cria-files-extended"}'`; the panel shows the space's folder. Close the space with `space.close` when done.
- **Without cria-file-preview:** the last `manual` step needs it absent. Ask the person before moving `~/.config/herdr-app/mods/cria-file-preview/` aside, and put it back after.

## The banner

`preview.png` is the banner `scripts/banner.sh files-extended` renders from `assets/banner.html`; the screenshot in it, `assets/pane.png`, is a crop of the panel only, because `herdr-app shot` captures the whole window. The steps are in the release-check skill's `PREVIEW.md`. To show the mod for it, open a copy of `samples/` as the smoke test does, with `src` and `docs` open and the menu showing; Herdr's CLI can't right-click, so ask the person to open the menu on `src/app.js` before the shot. Crop the panel, from its title row to just below the menu, scaled to 1200px wide.
