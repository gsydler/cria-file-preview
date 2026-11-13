---
name: smoke-test
description: Smoke-tests one mod of this repo (a folder such as file-preview/) in the running Herdr app against <folder>/samples/: shows each sample, checks each screenshot against samples/expected.json, then walks the person through the clicks only a human can make. Use before a release, after a change to what a mod draws, or when asked to try a mod for real.
---

# Smoke test

The mod is the folder the person names: `<folder>`, with its mod in `<folder>/mods/<name>/`. `<folder>/samples/expected.json` is the oracle: what must be **visible** once the mod shows a sample, and the **manual** steps (`do`, `expect`). `<folder>/CLAUDE.md`, section "Smoke test", says how to show the mod on a sample, how the oracle is laid out for it, and what more to check. Read it first.

Paths are from the repo's top folder. Every `herdr-app` call talks to the running app: in Claude Code, run them outside the sandbox. Keep shots in the session scratchpad; they show the person's whole window, so they never leave it.

## 1. The app runs this build

`herdr-app status` answers (Herdr is running). `diff -rq <folder>/mods/<name> ~/.config/herdr-app/mods/<name>`: a file that differs or is missing on the Herdr side means the app runs another build; stop and ask the person to install this one, then `herdr-app status` shows no errors. Lines "Only in" the Herdr side are files Herdr wrote or leftovers: ignore them. Note the current space and tab from `herdr-app status`. Done when the installed mod matches the repo.

## 2. What the agent can see

For each sample the mod's "Smoke test" section names, in order:

1. Show it as that section says, noting what you made.
2. `herdr-app shot <scratchpad>/<sample>.png` and Read it. A view still saying "Loading…": shoot again.
3. Hold the mod's pane against every `visible` line. Each one is **seen**, **not seen** (say what is there instead) or **can't tell** from the shot.
4. `herdr-app status`: `errors` is empty.
5. Close what step 1 made, with `"confirmed":true`.

Then the extra checks the section lists. Done when every `visible` line has a verdict, and the person's window is back where step 1 found it (`herdr-app do tab.select` or `space.select`).

## 3. What only the person can do

Herdr's CLI can't click inside a mod. Walk the person through the `manual` steps, in order:

1. Show the sample as in step 2 and tell the person it's there.
2. Ask with one AskUserQuestion per step: the question is the `do`, then "You should see: <expect>", with the options **As described**, **Different** and **Skip**. On Different, ask what they saw.
3. Close what you made when its steps are answered.

Done when every `manual` step has an answer.

## 4. Report

One table: **sample**, **visible** (seen / total, with each miss), **manual** (as described / total), and a column per extra check. Under it, each failure with what was expected and what happened, then the likely cause in the code (`file:line`) and a proposed fix. A failure that the unit tests could catch gets a proposed test or oracle entry too. Fix nothing until the person says go; commit nothing.
