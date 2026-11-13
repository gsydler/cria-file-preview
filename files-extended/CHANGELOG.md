# Changelog

Every change people using the mod would notice. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html), tagged `files-extended/vX.Y.Z`.

## [Unreleased]

### Added

- Herdr's Files panel with an icon for each kind of file, in your theme's colors (`"icon_colors": false` makes them one color), and a right-click menu: New file and New folder, Open in editor, Open with default app, Reveal, Open in terminal, Cut, Copy, Duplicate and Paste, Copy name, path and relative path, Rename, Move to Trash, Delete (asking first), Expand all, Fold folder and Collapse all.
- A click on a file opens it in cria-file-preview when you have it, in a new tab or a split (`"open"`), and brings forward a preview already showing it; the tree stays on its folder. Without cria-file-preview, Herdr's own preview shows the file in the panel.
- Paste and Duplicate never replace an item already there, and pick Finder's "a copy.txt" name for a clash, whatever its case on macOS and Windows. A rename never replaces another item either.
- Delete removes a link alone, never what it points to, also on Windows.
- Open in editor opens vim, nano and other editors that draw in a terminal in a new Herdr tab, on macOS and Linux.
- Expand all opens up to 100 folders, and stops when you fold one or collapse all.
- Works on macOS, Linux and Windows, and on another machine through Herdr; a row your system can't do is left out (Move to Recycle Bin on a Windows network share, for one).
