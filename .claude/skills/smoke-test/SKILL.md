---
name: smoke-test
description: Smoke-tests cria-file-preview in the running Herdr app against samples/: opens every sample, checks each screenshot against samples/expected.json, tests live reload, then walks the person through the clicks only a human can make. Use before a release, after a change to a viewer, or when asked to try the mod for real.
---

# Smoke test

`samples/expected.json` is the oracle: per sample, its `viewer`, what must be `visible` once it opens, and the `manual` steps (`do`, `expect`). The unit tests check its `facts`; this skill checks the rest in the real app. Every `herdr-app` call talks to the running app: in Claude Code, run them outside the sandbox. Keep shots in the session scratchpad; they show the person's whole window, so they never leave it.

## 1. The app runs this build

`herdr-app status` answers (Herdr is running). `diff -rq mods/cria-file-preview ~/.config/herdr-app/mods/cria-file-preview`: a file that differs or is missing on the Herdr side means the app runs another build; stop and ask the person to install this one, then `herdr-app status` shows no errors. Lines "Only in" the Herdr side are files Herdr wrote or leftovers: ignore them. Note the current `tab` from `herdr-app status`. Done when the installed mod matches the repo.

## 2. What the agent can see

For each sample in `expected.json`, in order:

1. `herdr-app do tab.new '{"name":"smoke","mod":"cria-file-preview","props":{"file":"<absolute path of the sample>"}}'`, noting the returned `tab`.
2. `herdr-app shot <scratchpad>/<sample>.png` and Read it. A body still saying "Loading…" (PDF pages render in batches): shoot again.
3. Hold the preview's pane against every `visible` line. Each one is **seen**, **not seen** (say what is there instead) or **can't tell** from the shot.
4. `herdr-app status`: `errors` is empty.
5. `herdr-app do tab.close '{"id":"<tab>","confirmed":true}'`.

Then **live reload**: copy `samples/notes.txt` and `samples/data.json` to a scratch folder, open each copy as above, append a line to the text copy and change a value in the JSON copy, shoot again: the change shows without reopening. Do the JSON one after opening a branch: it stays open.

Done when every `visible` line of every sample has a verdict, and the person's window is back on the tab from step 1 (`herdr-app do tab.select`).

## 3. What only the person can do

Herdr's CLI can't click inside a mod. Walk the person through the `manual` steps one sample at a time:

1. Open the sample as in step 2 and tell the person it's there.
2. Ask with one AskUserQuestion per step: the question is the `do`, then "You should see: <expect>", with the options **As described**, **Different** and **Skip**. On Different, ask what they saw.
3. Close the tab when its steps are answered.

Then the steps that hold for every file, once, on `samples/README.md`: a click on the name copies it, a click on the folder copies the full path, and each ⋯ menu item works (Open in editor, Open with default app, Reveal, Copy path, Copy relative path).

Done when every `manual` step has an answer.

## 4. Report

One table: **sample**, **visible** (seen / total, with each miss), **manual** (as described / total), **reload**. Under it, each failure with what was expected and what happened, then the likely cause in the code (`file:line`) and a proposed fix. A failure that the unit tests could catch gets a proposed `facts` entry or test too. Fix nothing until the person says go; commit nothing.
