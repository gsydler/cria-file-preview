# Changelog

Every change people using the mod would notice. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html), tagged `vX.Y.Z`.

## [Unreleased]

### Added

- First public version of the mod, moved from gsydler's dotfiles (`herdr-mods/file-preview`) and renamed `cria-file-preview`: the Markdown, PDF, image, table, JSON and code viewers, live reload, Back, and the ⋯ menu listed under Features in the README.
- `samples/`: one file per kind the preview shows, with `expected.json` saying what each should show; the unit tests run every sample through the pure modules.
- `scripts/check-herdr.mjs`, which checks the repo against Herdr's requirements for a shared mod, and a CI workflow that runs it with the tests on Linux and macOS.
- Image and PDF previews on Linux: sizes from `file`, PDF pages from poppler's `pdftoppm` (install `poppler-utils`).
