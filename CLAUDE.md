# cria-file-preview

A [Herdr](https://herdr.dev) mod, shared on herdr.dev/mods: `mods/cria-file-preview/` is the mod; `RECIPE.md`, `preview.png` and an optional `keys.json` at the root are what herdr.dev/mods reads. `README.md` is for people on GitHub.

## Herdr is the API truth

Mods run in Herdr's own JavaScript runtime, not Node: no DOM, no Node APIs, no `setTimeout`. Before using a `herdr`, `gpui-kit` or `gpui-base` call, read `~/.config/herdr-app/AGENTS.md` and the `.d.ts` files next to it; they match the installed Herdr version. `scripts/check-herdr.mjs` enforces the rules a static read can catch.

## Checks

- `node --test` and `node scripts/check-herdr.mjs`: both run in CI, the tests on Linux (with poppler-utils) and macOS. In Claude Code run `node --test` outside the sandbox: the sandbox stops osascript from saving the PDF test's pages.
- `herdr-app check mods/cria-file-preview`: loads and renders the mod; needs the app running. It writes `jsconfig.json` and `*.d.ts` into the mod folder (gitignored).
- After a change under `mods/`, and before tagging a release, run the `release-check` skill.

## Where logic goes

Logic sits in modules marked "Pure, so node --test covers it" (`kinds.js`, `links.js`, `delimited.js`, `json-tree.js`, …) and gets a test in `tests/`. The viewers and `preview.js` only draw and call `herdr`. A new viewer: `viewers/<id>.js`, registered in `viewers/index.js`, its extensions mapped in `kinds.js`.

## Standalone, with one public contract

The mod carries only code it runs; nothing is shared with another mod's folder. Its one contract is how a file panel opens it, described in `RECIPE.md` ("Install") and coded in `open-file.js`: the mod name, the `props` (`file`, `on`) and the shared keys (`cria-file-preview.open`, `.moved`). A panel patched at install time keeps its own copy of that file, so a change to any of these breaks every installed opener: treat it as a breaking change in `CHANGELOG.md`.

The mod name also appears in asset paths (`mods/cria-file-preview/…`), `openOverlay` and the cache folder `data/cria-file-preview/`: a rename touches all of them.

## Conventions

- Commit subjects in the imperative, under 72 characters, with a `Changelog:` trailer (`added`, `fixed`, `changed`, `deprecated`, `removed`, `security`, `performance` or `other`); the release-check skill turns them into `CHANGELOG.md` entries.
- `preview.png` is the banner `scripts/banner.sh` renders from `assets/banner.html`; the screenshot in it, `assets/pane.png`, is a crop of the mod's pane only, because `herdr-app shot` captures the whole window, including other spaces and agents. The steps are in the release-check skill's `PREVIEW.md`.
- Write for the person first in `RECIPE.md` and `README.md`: what they see and what it does on their computer, then the code.
