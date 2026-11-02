// The scripts behind image and PDF previews, and parsers for what their programs print.
// Pure, so node --test covers it, and runs the scripts on the system it runs on.
// macOS has sips and PDFKit built in; elsewhere sizes come from `file` and PDF
// pages from poppler's pdftoppm and pdfinfo.

// A file's modification time in seconds. GNU stat goes first: BSD's -c fails
// without printing, while GNU's -f prints file-system details and fails.
const MTIME = String.raw`$(stat -c %Y "$src" 2>/dev/null || stat -f %m "$src")`;

/** sh: copies `src` into `dir` as <key>-<mtime>.<ext> unless there already; prints the name. */
export const STAGE = String.raw`
src=$1 dir=$2 key=$3 ext=$4
[ -f "$src" ] || { echo "This file is no longer available" >&2; exit 1; }
name="$key-${MTIME}.$ext"
mkdir -p "$dir" && { [ -f "$dir/$name" ] || cp "$src" "$dir/$name"; } || exit 1
echo "$name"`;

/** sh: downloads `url` to <dir>/<key>.download (https only, 10 s, 5 MB); prints its MIME type. */
export const FETCH = String.raw`
url=$1 dir=$2 key=$3
mkdir -p "$dir" || exit 1
tmp="$dir/$key.download"
curl -sSfL --proto =https --proto-redir =https --max-time 10 --max-filesize 5242880 -o "$tmp" "$url" || { rm -f "$tmp"; exit 1; }
file -b --mime-type "$tmp"`;

/** The command that prints a bitmap's size, for pictureSize. */
export function sizeCommand(platform, file) {
  return platform === "macos" ? ["sips", ["-g", "pixelWidth", "-g", "pixelHeight", file]] : ["file", ["-b", file]];
}

/** { width, height } from sips or `file -b` output; zeros when it names no size. */
export function pictureSize(text) {
  const sips = (axis) => Number(text.match(new RegExp(`pixel${axis}: (\\d+)`))?.[1] ?? 0);
  if (text.includes("pixelWidth")) return { width: sips("Width"), height: sips("Height") };
  // `file` prints "480 x 270" (PNG, GIF, BMP) or "480x270" (JPEG, WebP), beside a
  // JPEG's "density 1x1" and a BMP's "resolution 2835 x 2835 px/m".
  for (const m of text.matchAll(/(\d+) ?x ?(\d+)/g)) {
    if (/density $/.test(text.slice(0, m.index)) || /^ ?px/.test(text.slice(m.index + m[0].length))) continue;
    return { width: Number(m[1]), height: Number(m[2]) };
  }
  return { width: 0, height: 0 };
}

/** JavaScript for Automation (osascript -l JavaScript): renders pages with PDFKit, prints JSON. */
export const PDFKIT = String.raw`
ObjC.import('Foundation'); ObjC.import('AppKit'); ObjC.import('PDFKit');
function run(argv) {
  var source = argv[0], dir = argv[1], key = argv[2], from = Number(argv[3]), to = Number(argv[4]), wide = Number(argv[5]);
  var fm = $.NSFileManager.defaultManager;
  var attrs = fm.attributesOfItemAtPathError($(source), null);
  if (!attrs || attrs.isNil()) throw new Error('This file is no longer available');
  var stamp = Math.round(ObjC.unwrap(attrs.objectForKey($.NSFileModificationDate).timeIntervalSince1970));
  var doc = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath($(source)));
  if (!doc || doc.isNil()) throw new Error('This PDF cannot be read');
  if (doc.isLocked) throw new Error('This PDF is password protected');
  var count = Number(doc.pageCount), pages = [];
  fm.createDirectoryAtPathWithIntermediateDirectoriesAttributesError($(dir), true, $(), null);
  for (var n = Math.max(1, from); n <= Math.min(to, count); n++) {
    var name = key + '-' + stamp + '-p' + n + '.png', path = dir + '/' + name;
    var page = doc.pageAtIndex(n - 1), box = page.boundsForBox(1), turned = Number(page.rotation) % 180 !== 0;
    var w = turned ? box.size.height : box.size.width, h = turned ? box.size.width : box.size.height;
    if (!fm.fileExistsAtPath($(path))) {
      var picture = page.thumbnailOfSizeForBox($.NSMakeSize(wide, wide * h / w), 1);
      var bitmap = $.NSBitmapImageRep.imageRepWithData(picture.TIFFRepresentation);
      var png = bitmap.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $({}));
      if (!png.writeToFileAtomically($(path), true)) throw new Error('Cannot save page ' + n);
    }
    pages.push({ n: n, path: 'data/cria-file-preview/' + name, width: w, height: h });
  }
  return JSON.stringify({ count: count, pages: pages });
}`;

/** sh: renders pages from..to with pdftoppm into <dir>/<key>-<mtime>-p<n>.png; prints what popplerPages reads. */
export const POPPLER = String.raw`
src=$1 dir=$2 key=$3 from=$4 to=$5 wide=$6
[ -f "$src" ] || { echo "This file is no longer available" >&2; exit 1; }
command -v pdftoppm >/dev/null && command -v pdfinfo >/dev/null || { echo "PDF previews need pdftoppm and pdfinfo (poppler-utils)" >&2; exit 1; }
stamp=${MTIME}
info=$(pdfinfo "$src" 2>&1) || { echo "$info" >&2; exit 1; }
count=$(printf '%s\n' "$info" | sed -n 's/^Pages: *//p')
[ "$from" -ge 1 ] || from=1
[ "$to" -le "$count" ] || to=$count
mkdir -p "$dir" || exit 1
n=$from
while [ "$n" -le "$to" ]; do
  out="$dir/$key-$stamp-p$n"
  [ -f "$out.png" ] || pdftoppm -png -f "$n" -l "$n" -scale-to-x "$wide" -scale-to-y -1 -singlefile "$src" "$out" || exit 1
  n=$((n + 1))
done
echo "Stamp: $stamp"
echo "Pages: $count"
if [ "$from" -le "$to" ]; then pdfinfo -f "$from" -l "$to" "$src"; fi`;

/** The POPPLER script's output as PDFKIT's: { count, pages: [{ n, path, width, height }] }, sizes in points. */
export function popplerPages(text, key) {
  const stamp = text.match(/^Stamp: (\d+)/m)?.[1], count = Number(text.match(/^Pages:\s*(\d+)/m)?.[1] ?? 0);
  const turned = new Set([...text.matchAll(/^Page\s+(\d+) rot:\s*(\d+)/gm)].filter((m) => Number(m[2]) % 180 !== 0).map((m) => Number(m[1])));
  const pages = [...text.matchAll(/^Page\s+(\d+) size:\s*([\d.]+) x ([\d.]+)/gm)].map(([, page, w, h]) => {
    const n = Number(page), [width, height] = turned.has(n) ? [Number(h), Number(w)] : [Number(w), Number(h)];
    return { n, path: `data/cria-file-preview/${key}-${stamp}-p${n}.png`, width, height };
  });
  return { count, pages };
}
