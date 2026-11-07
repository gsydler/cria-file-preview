# herdr-cria

Gsydler's [Herdr](https://herdr.dev) mods, shared on herdr.dev/mods. The repo holds several gallery entries: each top-level folder with a `RECIPE.md` is one, listed as `herdr.dev/mods/gsydler/herdr-cria--<folder>`. Everything else at the top is tooling shared by all of them. `README.md` explains the layout for people on GitHub.

## Mods

| Folder | Mod(s) in `<folder>/mods/` | What it is |
|---|---|---|
| [`file-preview/`](file-preview/) | `cria-file-preview` | One file shown read-only in a tab or split, by a viewer for its kind. Its own rules: `file-preview/CLAUDE.md`. |

A new entry adds its row here, and in `README.md`.

## An entry's folder

What herdr.dev/mods reads: `RECIPE.md`, `preview.png`, `mods/<name>/` and an optional `keys.json`, with no `layouts/`. Next to them, for GitHub and for us: `README.md` (for people), `CHANGELOG.md`, `CLAUDE.md` (the mod's own rules), `tests/`, `samples/`, `assets/` (the banner). The person's agent reads the whole folder before adding the mod, so nothing in it may be surprising: no secrets, no instructions aimed at that agent.

The folder name is part of the public address; the mod name (`mods/<name>/`) is what Herdr and other mods know it by. Either can change without the other, but each change is a breaking one for someone: the address for people adding it, the mod name for every layout, panel and asset path (`mods/<name>/…`) that uses it.

## Herdr is the API truth

Mods run in Herdr's own JavaScript runtime, not Node: no DOM, no Node APIs, no `setTimeout`. Before using a `herdr`, `gpui-kit` or `gpui-base` call, read `~/.config/herdr-app/AGENTS.md` and the `.d.ts` files next to it; they match the installed Herdr version. `scripts/check-herdr.mjs` enforces the rules a static read can catch.

A mod imports only its own files: Herdr can't load another mod's folder, here or installed. When two mods need the same code, each carries a copy. When two entries ship the same mod, the copies must be identical (`check-herdr.mjs` fails otherwise).

## Shared tooling

A change here reaches every entry: run every entry's checks after it.

- `scripts/check-herdr.mjs`: Herdr's requirements for each entry (recipe sections, preview, mod rules, disclosure), the repo's layout, and links to `herdr.dev/mods/gsydler/…`, which must name a real entry. `node scripts/check-herdr.mjs` checks them all, `node scripts/check-herdr.mjs <folder>` one. `OWNER` and `REPO` at its top build the addresses: a repo rename changes them.
- `scripts/banner.sh <folder>`: renders `<folder>/assets/banner.html` to `<folder>/preview.png`.
- `.github/workflows/ci.yml`: one job runs `check-herdr.mjs`; a matrix runs each entry's `tests/` on Linux, macOS and Windows. An entry with tests adds itself to `matrix.mod`, and a program it needs on Linux to an `include` line (`apt`).
- `.claude/skills/`: `release-check` and `smoke-test`, written for `file-preview/` today. A second entry that needs them makes them take the folder, keeping each mod's own rules (security, features, samples) in its folder.

## Checks

- `node --test` runs every entry's tests; `node --test '<folder>/tests/*.test.mjs'` one entry's. CI runs them on Linux, macOS and Windows (on Windows with Git's tools off PATH, as Herdr has them).
- `node scripts/check-herdr.mjs`: in CI too.
- `herdr-app check <folder>/mods/<name>`: loads and renders a mod; needs the app running. It writes `jsconfig.json` and `*.d.ts` into the mod folder (gitignored).
- After a change under `<folder>/mods/`, and before tagging a release, run that entry's release check.

## Versions

Each entry has its own: `<folder>/CHANGELOG.md` ([Keep a Changelog](https://keepachangelog.com/en/1.1.0/), [SemVer](https://semver.org/spec/v2.0.0.html)) and tags `<folder>/vX.Y.Z`. The gallery ignores both: it installs from `main`, so `main` is always what people get. An entry's changes are the commits that touched its folder (`git log <folder>/vX.Y.Z..HEAD -- <folder>/`); a commit touching two entries gets an entry in both changelogs, and one that touches only shared tooling in none. `file-preview` 0.1.0 is tagged `v0.1.0`, from before the repo held several mods.

## Adding a mod

1. A folder named for its address (`herdr-cria--<folder>`), with `mods/<name>/`, `RECIPE.md` (the six parts `check-herdr.mjs` asks for), `preview.png`, `README.md`, `CHANGELOG.md` starting at `[Unreleased]`, and a `CLAUDE.md` for its own rules.
2. Logic that doesn't draw or call `herdr` goes in pure modules with tests in `<folder>/tests/`; add the folder to CI's `matrix.mod`.
3. Its row in the tables here and in `README.md`, with its address.
4. `node scripts/check-herdr.mjs` and `herdr-app check <folder>/mods/<name>` pass.

## Conventions

- Commit subjects in the imperative, under 72 characters, with a `Changelog:` trailer (`added`, `fixed`, `changed`, `deprecated`, `removed`, `security`, `performance` or `other`); the release check turns them into entries in the changelog of each folder the commit touched.
- Write for the person first in `RECIPE.md` and `README.md`: what they see and what it does on their computer, then the code.
- Links to a mod use its full address, `herdr.dev/mods/gsydler/herdr-cria--<folder>`: a wrong one doesn't fail, it lands on herdr.dev's home page.
