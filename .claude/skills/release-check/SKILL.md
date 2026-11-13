---
name: release-check
description: Checks one mod of this repo (a folder such as file-preview/ or files-extended/) end to end and proposes a fix for every gap found: tests, Herdr's mod requirements, a security review, the changelog, the feature list and the preview image. Use after changing anything under <folder>/mods/, and before tagging a release of that mod.
---

# Release check

The mod is the folder the person names, or the one the change touches: `<folder>`, with its mod in `<folder>/mods/<name>/`. Its own rules are in `<folder>/CLAUDE.md`, section "Release check": the security rules, what the feature list covers and which files are drawn. Read it first.

Run every step, even after one goes red: the report is worth more whole. Gather findings; change nothing until the person says go, and commit nothing. Paths are from the repo's top folder.

## 1. Scope

The **change set** is everything in `<folder>/` since its last release: `git describe --tags --abbrev=0 --match '<folder>/v*'` (for `file-preview`, else `v0.1.0`, its one tag from before the repo held several mods; a mod never released: its first commit), then `git diff <tag> -- <folder>/` plus untracked files there. Changes to the shared tooling (`scripts/`, `.github/`, `.claude/`) since the tag are in it too: they can break the mod's checks. Name the tag and the files in the change set. Done when every later step knows which files to read.

## 2. Tests

`node --test '<folder>/tests/*.test.mjs'`, outside Claude Code's sandbox (programs the tests run, like osascript, can't write there). A skipped test names the program or system it lacks: install it, or say that platform went untested (CI runs Linux, macOS and Windows). Red: find the cause in the code and propose the fix, keeping every assertion. Then check coverage: each function added or changed in a module marked "Pure, so node --test covers it" has a test that exercises it; a new behaviour has a sample in `<folder>/samples/` and its entry in `<folder>/samples/expected.json`; propose the missing ones. Done when the run is green and nothing new lacks a test or a sample.

Before a release, also run the `smoke-test` skill: it checks the running app against the same samples.

## 3. Herdr requirements

1. `node scripts/check-herdr.mjs`: the static checks CI runs, on every mod folder.
2. `herdr-app check <folder>/mods/<name>`: loads and renders the mod. It talks to the running app, so in Claude Code it runs outside the sandbox.
3. Read `~/.config/herdr-app/AGENTS.md`, sections "Layouts and mods other people made", "Mods: `mods/<name>/`", "A mod" and "Keep in mind": they change with Herdr versions. For each rule, find where the script checks it; a rule it doesn't check, verify by hand and propose adding it to `scripts/check-herdr.mjs`.

Done when both commands pass and every AGENTS.md rule above is accounted for as script-checked, hand-checked or a finding.

## 4. Security review

Read every changed line against each rule, the mod's own ("Release check", Security) and these. Done when each file in the change set has been held against all of them, and each finding names `file:line`.

- **Programs:** `exec` gets the program and an argv array. A shell script takes values only as positional `"$1"`, `"$2"`…, never spliced into the script text. PowerShell's `-Command` takes no argv, so a value reaches it only as character codes, through the mod's `powershell` helper.
- **Network:** nothing is fetched without a click, and only what the mod's rules allow.
- **Files:** the mod writes or changes only what its rules say, and nothing of the person's without an action they picked.
- **Opener contract:** a change to the mod name, the `props` or the shared keys in `open-file.js` breaks panels that open `cria-file-preview`; it needs a breaking-change entry and both recipes' "Install" updated. `check-herdr.mjs` fails when the copies differ.
- **Data:** no secrets, tokens, internal hostnames, work names or personal data in code, `<folder>/samples/`, docs, `<folder>/assets/` or `<folder>/preview.png` (look at the images).
- **CI:** `.github/workflows/` keeps `permissions: contents: read` and `persist-credentials: false`, and adds no third-party action.
- **Disclosure:** `<folder>/README.md` ("What it does on your computer") and `<folder>/RECIPE.md` ("Watch out") list every program the mod runs, every network access and every file it reads, writes or changes, as they stand after the change.

## 5. Changelog

`git log <tag>..HEAD --format='%h %s%n%(trailers:key=Changelog,valueonly)' -- <folder>/`: only commits that touched this mod. Each commit with a `Changelog:` trailer other than `other` gets an entry under `## [Unreleased]` in `<folder>/CHANGELOG.md`, in the matching Keep a Changelog heading (`added` → Added, `security` → Security, …), written for someone using the mod, not as the commit subject. A commit that changes behaviour but has no trailer: propose the entry and say the trailer is missing. Uncommitted changes: propose entries for them too.

Before a release, propose the version: under 1.0, a removal or a breaking change bumps the minor, everything else the patch (a first release is 0.1.0). Then the edit that renames `[Unreleased]` to `[x.y.z] - <date>` with a fresh empty `[Unreleased]` above it, and the `git tag <folder>/vx.y.z` to run once it's committed.

Done when every commit in the range is matched to an entry or marked `other`.

## 6. Feature list

Compare `<folder>/README.md` ("Features", "Platforms") and `<folder>/RECIPE.md` ("What you see", "How it behaves") with the code, over what the mod's "Release check" section lists. Done when each item in the code is in both documents and each claim in them is in the code.

## 7. Preview

Compare the change set with `git log -1 --format=%h -- <folder>/preview.png`. When a file the mod's rules name as drawn changed since then, the preview is stale: regenerate it by [PREVIEW.md](PREVIEW.md). When the features changed, the banner's text in `<folder>/assets/banner.html` is stale too: update it and re-render (PREVIEW.md, step 7). Done when the preview shows the current build, or the change set drew nothing new.

## 8. Report

One table, one row per step: **check**, **result** (pass, fail or stale, with the command output for a failure), **proposed fix**. Under it, the findings in full, most severe first. Apply a fix when the person says go, then re-run the steps it touches.
