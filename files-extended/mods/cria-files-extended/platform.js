// The commands behind the right-click menu, per system. Pure, so node --test covers it.
// A system is "macos", "linux" or "windows" for files on this computer, or "remote" for
// files on another machine: a Unix shell over hc, with no desktop to open them in.
// A command is [program, args]; an action with no command on a system is hidden.
import { editorCommand } from "./editor-command.js";

export function systemOf(platform, on) {
  return on ? "remote" : platform;
}

export const sh = (script, ...args) => ["sh", ["-c", script, "files", ...args]];

// PowerShell reads everything after -Command as script and takes no argv, so each value
// reaches it as character codes, which leave nothing to quote or escape. Scripts use no
// double quotes: Windows PowerShell 5 mangles them on its command line. A failure
// prints its message alone, the one line a toast shows.
const value = (text) => `(-join [char[]]@(${Array.from({ length: text.length }, (_, i) => text.charCodeAt(i)).join(",")}))`;
const shell = (...flags) => (script, ...values) => ["powershell", [...flags, "-NonInteractive", "-Command",
  `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $ErrorActionPreference = 'Stop'; & { try { ${script} } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 } } ${values.map(value).join(" ")}`]];

export const powershell = shell("-NoProfile");
const withProfile = shell();

export const win = (path) => path.replaceAll("/", "\\");
const ps = (script, ...paths) => powershell(script, ...paths.map(win));

// $VISUAL or $EDITOR without its wait flag, else the default app. The program may be
// quoted, or be a whole path with spaces and no quotes at all. Runs with the person's
// profile, Windows' counterpart of the login shell.
const EDITOR = String.raw`
$file = $args[0]
$editor = if ($env:VISUAL) { $env:VISUAL } else { $env:EDITOR }
$quote = [string][char]34
$text = ([string]$editor -replace '(^|\s)(--wait|-w)(?=\s|$)', '').Trim()
if (-not $text) { Invoke-Item -LiteralPath $file; return }
if ($text.StartsWith($quote)) {
  $end = $text.IndexOf($quote, 1)
  $program = $text.Substring(1, $end - 1)
  $rest = $text.Substring($end + 1)
} elseif (Test-Path -LiteralPath $text) {
  $program = $text
  $rest = ''
} else {
  $program, $rest = $text -split '\s+', 2
}
Start-Process -FilePath $program -ArgumentList (@(([string]$rest).Trim() -split '\s+' | Where-Object { $_ }) + ($quote + $file + $quote))`;

// mv and cp replace, or put a folder inside, what is already at the destination: refuse it
// first. A name that differs only in case is the same item on a disk that ignores case.
const FREE = 'if [ -e "$2" ] || [ -L "$2" ]; then echo "$2 already exists" >&2; exit 1; fi; ';

const UNIX = {
  newFile: (path) => sh('set -C; : > "$1"', path),
  newFolder: (path) => sh('mkdir -- "$1"', path),
  // A rename that only changes case finds its own item at the new name on a disk that
  // ignores case (-ef: the same file); any other item there is refused.
  rename: (from, to) => sh('if { [ -e "$2" ] || [ -L "$2" ]; } && ! [ "$1" -ef "$2" ]; then echo "$2 already exists" >&2; exit 1; fi; mv -- "$1" "$2"', from, to),
  move: (from, to) => sh(`${FREE}mv -- "$1" "$2"`, from, to),
  copy: (from, to) => sh(`${FREE}cp -R -- "$1" "$2"`, from, to),
  remove: (path) => sh('rm -rf -- "$1"', path),
};

// Move-Item and Copy-Item, likewise.
const TAKEN = "if (Test-Path -LiteralPath $args[1]) { throw ($args[1] + ' already exists') }; ";

// Windows PowerShell's Remove-Item -Recurse goes into a link to a folder (a junction or a
// symbolic link) and deletes what it points to. A link is deleted alone, and the links
// inside a folder are deleted before the folder, without going into them.
const REMOVE = "function Unlink($dir) { foreach ($d in ([IO.DirectoryInfo]$dir).GetDirectories()) { if ($d.LinkType) { $d.Delete() } else { Unlink $d.FullName } } }; " +
  "$item = Get-Item -LiteralPath $args[0] -Force; " +
  "if ($item.PSIsContainer -and $item.LinkType) { $item.Delete() } " +
  "else { if ($item.PSIsContainer) { Unlink $item.FullName }; Remove-Item -LiteralPath $args[0] -Recurse -Force }";

const WINDOWS = {
  newFile: (path) => ps("[IO.File]::Open($args[0], 'CreateNew').Close()", path),
  newFolder: (path) => ps("if (Test-Path -LiteralPath $args[0]) { throw ($args[0] + ' already exists') }; [void][IO.Directory]::CreateDirectory($args[0])", path),
  // Move-Item refuses a folder rename that only changes case, so that goes through a temporary name.
  rename: (from, to, caseOnly) => powershell("if ($args[2]) { $t = $args[1] + '.' + [guid]::NewGuid(); Move-Item -LiteralPath $args[0] -Destination $t; Move-Item -LiteralPath $t -Destination $args[1] } elseif (Test-Path -LiteralPath $args[1]) { throw ($args[1] + ' already exists') } else { Move-Item -LiteralPath $args[0] -Destination $args[1] }", win(from), win(to), caseOnly ? "1" : ""),
  move: (from, to) => ps(`${TAKEN}Move-Item -LiteralPath $args[0] -Destination $args[1]`, from, to),
  copy: (from, to) => ps(`${TAKEN}Copy-Item -LiteralPath $args[0] -Destination $args[1] -Recurse`, from, to),
  remove: (path) => ps(REMOVE, path),
  trash: (path) => ps("Add-Type -AssemblyName Microsoft.VisualBasic; $fs = [Microsoft.VisualBasic.FileIO.FileSystem]; if (Test-Path -LiteralPath $args[0] -PathType Container) { $fs::DeleteDirectory($args[0], 'OnlyErrorDialogs', 'SendToRecycleBin') } else { $fs::DeleteFile($args[0], 'OnlyErrorDialogs', 'SendToRecycleBin') }", path),
  open: (path) => ps("Invoke-Item -LiteralPath $args[0]", path),
  reveal: (path) => ps("Start-Process explorer.exe -ArgumentList ('/select,' + [char]34 + $args[0] + [char]34)", path),
  editor: (path) => withProfile(EDITOR, win(path)),
};

const dirname = (path) => path.slice(0, path.lastIndexOf("/")) || "/";

// A network share (\\server\share, \\wsl$) has no Recycle Bin: Windows would delete for good.
const { trash: _, ...WINDOWS_SHARE } = WINDOWS;
export const onShare = (path) => /^[\\/]{2}/.test(path);

/**
 * The commands for `system`. `tools`: the optional programs found on this computer
 * (`trash` from macOS 15, `xdg-open`, `gio`). `file`, when given: the item they act on,
 * which on Windows has no Trash on a network share.
 */
export function commands(system, tools, file) {
  if (system === "windows") return file && onShare(file) ? WINDOWS_SHARE : WINDOWS;
  if (system === "macos") return { ...UNIX, editor: (p) => editorCommand(p, "open"), open: (p) => ["open", [p]], reveal: (p) => ["open", ["-R", p]],
    ...(tools.has("trash") ? { trash: (p) => ["trash", [p]] } : {}) };
  if (system === "linux") return { ...UNIX, editor: (p) => editorCommand(p, "xdg-open"),
    ...(tools.has("xdg-open") ? { open: (p) => ["xdg-open", [p]], reveal: (p) => ["xdg-open", [dirname(p)]] } : {}),
    ...(tools.has("gio") ? { trash: (p) => ["gio", ["trash", "--", p]] } : {}) };
  return UNIX;
}

// The optional programs some menu actions need, looked for once. Windows needs none.
const TOOLS = ["trash", "xdg-open", "gio"];

/** The command, as [program, args], that prints which TOOLS this computer has; null on Windows. */
export function toolProbe(platform) {
  return platform === "windows" ? null : sh(`for t in ${TOOLS.join(" ")}; do command -v "$t" >/dev/null 2>&1 && echo "$t"; done`);
}

/** The tools toolProbe's output names, as a Set. */
export const toolsFrom = (stdout) => new Set(stdout.split("\n").filter((t) => TOOLS.includes(t)));

/** Menu labels that name the system's own places. */
export function labels(system) {
  return {
    reveal: system === "windows" ? "Show in Explorer" : system === "linux" ? "Open containing folder" : "Reveal in Finder",
    trash: system === "windows" ? "Move to Recycle Bin" : "Move to Trash",
  };
}
