// How "Open in editor" runs on macOS and Linux (Windows has its own in platform.js): the
// person's $VISUAL or $EDITOR without its wait flag (nothing here waits for the file to
// close), else the system's opener. Pure, so node --test covers it.

// Editors that draw in a terminal: started with none, they show nothing, so they open in a
// Herdr tab instead. Emacs counts when told to stay in the terminal (-nw, -t).
export const TERMINAL_EDITORS = ["vi", "vim", "nvim", "view", "nano", "pico", "micro", "hx", "helix", "kak", "ne", "joe", "mg", "jed", "mcedit", "vis"];
const MARK = "__cria_editor__";

// Asks the login shell, since Herdr's own environment lacks $EDITOR (zsh sets it in
// .zshenv). The login shell, in whatever language it speaks, runs sh to print the value
// after a marker, so a profile's greeting on stdout can't become part of it. A graphical
// editor starts from this same process, with nothing to wait for after it: a caller whose
// tasks may stop soon after the click (a menu that closes) still opens it. A terminal
// editor's words are printed back after the marker, for the caller to open in a tab.
const EDITOR = `
file=$1 opener=$2
probe='sh -c '\\''printf "\\\\n${MARK}%s" "\${VISUAL:-$EDITOR}"'\\'''
editor=$("\${SHELL:-/bin/sh}" -lc "$probe" 2>/dev/null)
case $editor in *${MARK}*) editor=\${editor##*${MARK}} ;; *) editor= ;; esac
set -f
set --
for word in $editor; do
  case $word in --wait|-w) ;; *) set -- "$@" "$word" ;; esac
done
[ $# -gt 0 ] || set -- "$opener"
terminal=
case \${1##*/} in
  ${TERMINAL_EDITORS.join("|")}) terminal=1 ;;
  emacs|emacsclient) for word; do case $word in -nw|-t|--no-window-system|--tty) terminal=1 ;; esac; done ;;
esac
if [ -n "$terminal" ]; then printf '${MARK}\\0'; printf '%s\\0' "$@"; exit 0; fi
exec "$@" "$file"`;

/** The command, as [program, args], that opens `file`; `opener`: the system's own. */
export const editorCommand = (file, opener) => ["sh", ["-c", EDITOR, "editor", file, opener]];

/** The terminal editor's words when editorCommand's output names one, else null. */
export function terminalEditor(stdout) {
  return stdout.startsWith(`${MARK}\0`) ? stdout.slice(MARK.length + 1).split("\0").filter(Boolean) : null;
}
