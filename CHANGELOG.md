# Changelog

Every change people using the mod would notice. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html), tagged `vX.Y.Z`.

## [Unreleased]

## [0.1.0] - 2026-11-05

### Added

- First public version of the mod, moved from gsydler's dotfiles (`herdr-mods/file-preview`) and renamed `cria-file-preview`: the Markdown, PDF, image, table, JSON and code viewers, live reload, Back, and the ⋯ menu listed under Features in the README.
- `samples/`: one file per kind the preview shows, with `expected.json` saying what each should show; the unit tests run every sample through the pure modules.
- `scripts/check-herdr.mjs`, which checks the repo against Herdr's requirements for a shared mod, and a CI workflow that runs it with the tests on Linux, macOS and Windows.
- Image and PDF previews on Linux: sizes from `file`, PDF pages from poppler's `pdftoppm` (install `poppler-utils`).
- Windows support with nothing to install: images, PDFs, web images, the file size in the header and live reload all work, through PowerShell and Windows' own PDF renderer.

### Changed

- Code and tables show the start of a file over 1 MiB instead of refusing it; Markdown and JSON, and any file that isn't UTF-8, say why they can't open.
- A Markdown image that can't be shown says why, and "(not found)" is kept for a file that really is missing.

### Fixed

- Paths on Windows: Markdown links and images, the folder in the header and Copy relative path now work with `\`, `/` or both, and with absolute `C:\` links.
- UTF-8 files that start with a byte-order mark open normally, so such a JSON file shows as a tree instead of as invalid.
- Open in editor on Windows handles an editor whose path has spaces, and finds `$EDITOR` set in your PowerShell profile.
- Open in editor no longer does nothing on macOS or Linux when your login shell is slow to start.
- An SVG whose tag has a prefix, like `<svg:svg>`, opens at its real size.
- With the Files panel patched as `RECIPE.md` describes, a click on a file no longer sends its tree to another folder.

### Security

- A Markdown link or image can't reach another computer: Windows would connect to it on open and offer your credentials.
- A web image that turns out not to be a picture is deleted instead of staying in the cache.
