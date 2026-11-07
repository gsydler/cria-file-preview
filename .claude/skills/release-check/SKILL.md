---
name: release-check
description: Checks the file-preview mod (file-preview/, the cria-file-preview mod) end to end and proposes a fix for every gap found: tests, Herdr's mod requirements, a security review, the changelog, the feature list and the preview image. Use after changing anything under file-preview/mods/, and before tagging a file-preview release.
---

# Release check

Run every step, even after one goes red: the report is worth more whole. Gather findings; change nothing until the person says go, and commit nothing.

Paths are from the repo's top folder; the mod's own files are under `file-preview/`.

## 1. Scope

The **change set** is everything in `file-preview/` since its last release: `git describe --tags --abbrev=0 --match 'file-preview/v*'`, else `v0.1.0` (its one tag from before the repo held several mods), then `git diff <tag> -- file-preview/` plus untracked files there. Changes to the shared tooling (`scripts/`, `.github/`, `.claude/`) since the tag are in it too: they can break the mod's checks. Name the tag and the files in the change set. Done when every later step knows which files to read.

## 2. Tests

`node --test 'file-preview/tests/*.test.mjs'`, outside Claude Code's sandbox (it stops osascript saving the PDF test's pages). A skipped test names the program it lacks: install it or say the platform went untested. Red: find the cause in the code and propose the fix, keeping every assertion. Then check coverage: each function added or changed in a module marked "Pure, so node --test covers it" has a test that exercises it; a new viewer, extension or behaviour has a sample in `file-preview/samples/` and its entry in `file-preview/samples/expected.json`; propose the missing ones. Done when the run is green and nothing new lacks a test or a sample.

Before a release, also run the `smoke-test` skill: it checks the running app against the same samples.

## 3. Herdr requirements

1. `node scripts/check-herdr.mjs`: the static checks CI runs, on every mod folder.
2. `herdr-app check file-preview/mods/cria-file-preview`: loads and renders the mod. It talks to the running app, so in Claude Code it runs outside the sandbox.
3. Read `~/.config/herdr-app/AGENTS.md`, sections "Layouts and mods other people made", "Mods: `mods/<name>/`", "A mod" and "Keep in mind": they change with Herdr versions. For each rule, find where the script checks it; a rule it doesn't check, verify by hand and propose adding it to `scripts/check-herdr.mjs`.

Done when both commands pass and every AGENTS.md rule above is accounted for as script-checked, hand-checked or a finding.

## 4. Security review

Read every changed line against each rule. Done when each file in the change set has been held against all of them, and each finding names `file:line`.

- **Programs:** `exec` gets the program and an argv array. A shell script takes values only as positional `"$1"`, `"$2"`…, never spliced into the script text. PowerShell's `-Command` takes no argv, so a value reaches it only through `powershell` in `platform.js`, as character codes.
- **Network:** nothing is fetched on open. Web content loads only after a click, https only, with size and time caps, and only the expected type is kept.
- **Files:** the mod writes only under `data/cria-file-preview/` in the Herdr home, and checks that paths a helper returns stay there (as `file-preview/mods/cria-file-preview/pdf-render.js` does).
- **Links:** only `http`, `https` and `mailto` leave Herdr; other schemes are refused.
- **Read-only:** the mod changes no file of the person's. The only commands that write go to its cache folder; the ⋯ menu only opens, reveals and copies. A command that moves, deletes or edits a file is a finding.
- **Opener contract:** a change to the mod name, the `props` or the shared keys in `open-file.js` breaks panels patched at install time; it needs a breaking-change entry and the RECIPE's "Install" updated.
- **Data:** no secrets, tokens, internal hostnames, work names or personal data in code, `file-preview/samples/`, docs, `file-preview/assets/pane.png` or `file-preview/preview.png` (look at the images).
- **CI:** `.github/workflows/` keeps `permissions: contents: read` and `persist-credentials: false`, and adds no third-party action.
- **Disclosure:** `file-preview/README.md` ("What it does on your computer") and `file-preview/RECIPE.md` ("Watch out") list every program the mod runs, every network access and every file it reads or writes, as they stand after the change.

## 5. Changelog

`git log <tag>..HEAD --format='%h %s%n%(trailers:key=Changelog,valueonly)' -- file-preview/`: only commits that touched this mod. Each commit with a `Changelog:` trailer other than `other` gets an entry under `## [Unreleased]` in `file-preview/CHANGELOG.md`, in the matching Keep a Changelog heading (`added` → Added, `security` → Security, …), written for someone using the mod, not as the commit subject. A commit that changes behaviour but has no trailer: propose the entry and say the trailer is missing. Uncommitted changes: propose entries for them too.

Before a release, propose the version: under 1.0, a removal or a breaking change bumps the minor, everything else the patch. Then the edit that renames `[Unreleased]` to `[x.y.z] - <date>` with a fresh empty `[Unreleased]` above it, and the `git tag file-preview/vx.y.z` to run once it's committed.

Done when every commit in the range is matched to an entry or marked `other`.

## 6. Feature list

Compare `file-preview/README.md` ("Features", "Platforms") and `file-preview/RECIPE.md` ("What you see", "How it behaves") with the code in `file-preview/mods/cria-file-preview/`: every viewer in `viewers/index.js`, every extension in `kinds.js`, every header control, toolbar control and ⋯ menu item, every limit (row, page, size and character caps, platform tools). Done when each item in the code is in both documents and each claim in them is in the code.

## 7. Preview

Compare the change set with `git log -1 --format=%h -- file-preview/preview.png`. When anything drawn changed since then (`viewers/`, `preview.js`, `menu.js`, the SVG icons), the preview is stale: regenerate it by [PREVIEW.md](PREVIEW.md). When the features changed, the banner's text in `file-preview/assets/banner.html` is stale too: update it and re-render (PREVIEW.md, step 7). Done when the preview shows the current build, or the change set drew nothing new.

## 8. Report

One table, one row per step: **check**, **result** (pass, fail or stale, with the command output for a failure), **proposed fix**. Under it, the findings in full, most severe first. Apply a fix when the person says go, then re-run the steps it touches.
