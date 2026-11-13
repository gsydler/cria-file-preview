// What the tree reads from disk: a folder's entries and git's marks. Pure, so node --test
// covers it, running the listing for real on each system.
import { sh, powershell, win } from "./platform.js";

// The most entries the panel shows of one folder. A listing reads one more, so the
// panel knows to say the list is cut.
export const PER_FOLDER = 500;
// The most entries in the whole tree.
export const TOTAL = 5000;
// The most folders Expand all opens: each open folder is listed again at every refresh.
export const EXPAND_LIMIT = 100;

// Links keep directory attributes even when dangling; their target is checked. Other
// reparse points (OneDrive's folders) have no LinkType and are folders.
const WINDOWS_LIST = `@(Get-ChildItem -LiteralPath $args[0] -Force | Where-Object Name -ne '.git' | Select-Object -First ${PER_FOLDER + 1} | ForEach-Object { @{ name=$_.Name; dir=($_.PSIsContainer -and (-not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -or -not $_.LinkType -or ($_.Target -and [IO.Directory]::Exists(([IO.Path]::Combine([IO.Path]::GetDirectoryName($_.FullName), $_.Target[0])))))) } }) | ConvertTo-Json -Compress`;

// Kind and name, NUL-separated: a name can hold anything else. The last `test -d` fails
// the command for a folder that is gone.
const UNIX_LIST = `n=0; for p in "$1"/* "$1"/.[!.]* "$1"/..?*; do [ -e "$p" ] || [ -L "$p" ] || continue; name=\${p##*/}; [ "$name" = .git ] && continue; if [ -d "$p" ]; then kind=d; else kind=f; fi; printf "%s\\0%s\\0" "$kind" "$name"; n=$((n+1)); [ "$n" -gt ${PER_FOLDER} ] && break; done; test -d "$1"`;

/** The command that lists `path` on `system`: up to PER_FOLDER + 1 entries, without .git. */
export function listCommand(path, system) {
  return system === "windows" ? powershell(WINDOWS_LIST, win(path)) : sh(UNIX_LIST, path);
}

/** The listing's output as [{ name, dir }], in the order it came. */
export function parseListing(stdout, system) {
  if (system === "windows") {
    const result = JSON.parse(stdout || "[]");
    return (Array.isArray(result) ? result : [result]).map(({ name, dir }) => ({ name, dir: Boolean(dir) }));
  }
  const fields = stdout.split("\0"), out = [];
  for (let i = 0; i + 1 < fields.length; i += 2) out.push({ name: fields[i + 1], dir: fields[i] === "d" });
  return out;
}

export const byKind = (a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name);

// Writes nothing under .git (index lock, fsmonitor cookie): the folder watch would refresh again.
export const STATUS = ["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all"];

/**
 * `git status` (STATUS) as { "<top>/<path>": mark }, for at most `limit` paths. A mark is
 * A (added or untracked), U (conflict), D (deleted) or M (anything else changed).
 */
export function gitMarks(stdout, top, limit) {
  const marks = {};
  for (const entry of stdout.split("\0").filter(Boolean).slice(0, limit)) {
    const xy = entry.slice(0, 2);
    marks[`${top}/${entry.slice(3)}`] = xy === "??" || xy.includes("A") ? "A" : xy.includes("U") ? "U" : xy.includes("D") ? "D" : "M";
  }
  return marks;
}
