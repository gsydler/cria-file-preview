// The commands behind the ⋯ menu's Open in editor, Open with default app and Reveal,
// per system. Pure, so node --test covers it.
// A system is "macos", "linux" or "windows" for files on this computer, or "remote" for
// files on another machine: no desktop to open them in, so no command at all.
// A command is [program, args]; an action with no command on a system is hidden.

export function systemOf(platform, on) {
  return on ? "remote" : platform;
}

// PowerShell reads everything after -Command as script, so arguments are quoted into it,
// in single quotes only: Windows PowerShell 5 mangles double quotes on its command line.
const win = (path) => path.replaceAll("/", "\\");
const quote = (text) => `'${text.replaceAll("'", "''")}'`;
const ps = (script, ...args) => ["powershell", ["-NoProfile", "-NonInteractive", "-Command",
  `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $ErrorActionPreference = 'Stop'; & { ${script} } ${args.map((a) => quote(win(a))).join(" ")}`]];

const WINDOWS = {
  open: (path) => ps("Invoke-Item -LiteralPath $args[0]", path),
  reveal: (path) => ps("Start-Process explorer.exe -ArgumentList ('/select,' + [char]34 + $args[0] + [char]34)", path),
  // $VISUAL or $EDITOR without its wait flag, else the default app.
  editor: (path) => ps("$e = if ($env:VISUAL) { $env:VISUAL } else { $env:EDITOR }; $w = @([string]$e -split '\\s+' | Where-Object { $_ -and $_ -notin '--wait', '-w' }); if (-not $w) { Invoke-Item -LiteralPath $args[0]; return }; Start-Process -FilePath $w[0] -ArgumentList (@($w | Select-Object -Skip 1) + ([char]34 + $args[0] + [char]34))", path),
};

const dirname = (path) => path.slice(0, path.lastIndexOf("/")) || "/";

/**
 * The commands for `system`. `tools`: the optional programs found on this computer
 * (`xdg-open`). "editor" on macOS and Linux is true: editor.js asks the login shell
 * for $EDITOR there.
 */
export function commands(system, tools) {
  if (system === "windows") return WINDOWS;
  if (system === "macos") return { editor: true, open: (p) => ["open", [p]], reveal: (p) => ["open", ["-R", p]] };
  if (system === "linux") return { editor: true,
    ...(tools.has("xdg-open") ? { open: (p) => ["xdg-open", [p]], reveal: (p) => ["xdg-open", [dirname(p)]] } : {}) };
  return {};
}

/** The Reveal item's label, naming the system's own file manager. */
export function revealLabel(system) {
  return system === "windows" ? "Show in Explorer" : system === "linux" ? "Open containing folder" : "Reveal in Finder";
}
