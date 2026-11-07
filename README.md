# herdr-cria

[Herdr](https://herdr.dev) mods by gsydler. Each one is listed on its own in [herdr.dev/mods](https://herdr.dev/gallery/?type=mods), and you add each one on its own: you get only the mod you asked for.

## Mods

| Mod | What it does | Add it |
|---|---|---|
| [File preview](file-preview/) | Shows one file read-only in a tab or a split: Markdown with working links and images, PDF, images, CSV and TSV tables, JSON as a tree, anything else as code. Reloads when the file changes on disk. | `herdr.dev/mods/gsydler/herdr-cria--file-preview` |

To add one, ask your agent in Herdr:

```text
Read ~/.config/herdr-app/AGENTS.md, then add this mod: herdr.dev/mods/gsydler/herdr-cria--<folder>
```

The agent reads the mod's folder, tells you what it runs and touches on your computer, and copies it into `~/.config/herdr-app/mods/`. Each mod's README says what it does on your computer before you add it.

## What's in this repo

Each top-level folder with a `RECIPE.md` is one mod as herdr.dev/mods lists it. Everything else is tooling the mods share.

```text
herdr-cria/
├── file-preview/              one mod: herdr.dev/mods/gsydler/herdr-cria--file-preview
│   ├── RECIPE.md              the brief an agent can rebuild the mod from (herdr.dev shows it)
│   ├── preview.png            the picture on the mod's herdr.dev card
│   ├── mods/cria-file-preview/  the mod itself: what gets copied into Herdr
│   ├── README.md              features, install, what it does on your computer
│   ├── CHANGELOG.md           this mod's versions
│   ├── CLAUDE.md              rules for an agent working on this mod
│   ├── tests/                 unit tests (node --test)
│   ├── samples/               one file per kind the preview shows, with what each should show
│   └── assets/                the banner preview.png is rendered from
├── scripts/
│   ├── check-herdr.mjs        checks every mod against Herdr's rules for a shared mod
│   └── banner.sh              renders a mod's banner to its preview.png
├── .github/workflows/ci.yml   CI: the Herdr checks, and each mod's tests on Linux, macOS and Windows
├── .claude/skills/            release-check and smoke-test, for agents working on the mods
├── CLAUDE.md                  rules for an agent working on this repo, and the list of mods
└── LICENSE
```

A folder's name makes the mod's address (`herdr-cria--<folder>`); the mod's own name, in `<folder>/mods/<name>/`, is what Herdr knows it by. They can differ: `file-preview/` holds the `cria-file-preview` mod.

## What the mods share

- **Checks.** `scripts/check-herdr.mjs` holds every mod to what herdr.dev and Herdr ask of a shared mod: the recipe's parts in order, a preview image, only `herdr`, `gpui-kit` and `gpui-base` imports, no `setTimeout`, every program, network access and outside file disclosed in the recipe. It also checks that links to a mod's herdr.dev page name a real folder. CI runs it on every push.
- **CI.** One workflow for all mods: the checks once, then every mod's tests on Linux, macOS and Windows. A new mod's tests run with no change to the workflow.
- **The banner script.** `scripts/banner.sh <folder>` renders `<folder>/assets/banner.html` into `<folder>/preview.png`.
- **The license**, Apache-2.0, for every mod.

What they don't share is code: Herdr loads a mod only from its own folder, so each mod carries everything it runs.

## Versions

Each mod has its own version and changelog (`<folder>/CHANGELOG.md`), tagged `<folder>/vX.Y.Z`, for example `file-preview/v0.2.0`. herdr.dev always installs what's on `main`; a version marks what changed, and when.

## Development

You need [Node](https://nodejs.org) 22 or later; the mods themselves run in Herdr, not Node.

```sh
node --test                                    # every mod's tests
node --test 'file-preview/tests/*.test.mjs'    # one mod's tests
node scripts/check-herdr.mjs                   # every mod against Herdr's rules (file-preview: one)
herdr-app check file-preview/mods/cria-file-preview   # loads and renders a mod; needs the Herdr app
```

Each mod's README has its own development notes. A new mod is a new folder: the steps are in [CLAUDE.md](CLAUDE.md) ("Adding a mod").

## License

[Apache-2.0](LICENSE).
