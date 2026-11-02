// Where a link in a Markdown file goes. Pure, so node --test covers it.
//   { url }   a web or mail link, for the system to open
//   { file, anchor? }  a local file, absolute, to open in this preview, at a heading
//   { anchor } a heading in this page
//   { error } anything else

export function normalize(path) {
  const out = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop(); else out.push(part);
  }
  return "/" + out.join("/");
}
export const dirname = (path) => normalize(path).replace(/\/[^/]*$/, "") || "/";

export function resolveLink(from, href) {
  const link = String(href ?? "").trim();
  if (!link) return { error: "Empty link" };
  if (link.startsWith("#")) return { anchor: link.slice(1) };
  if (/^(https?|mailto):/i.test(link)) return { url: link };
  let path = link;
  if (/^file:\/\//i.test(path)) path = path.replace(/^file:\/\/(localhost)?/i, "");
  else if (/^[a-z][a-z\d+.-]*:/i.test(path)) return { error: `Can't open ${link.split(":")[0]}: links here` };
  const anchor = path.match(/#(.*)$/)?.[1];
  path = path.replace(/[?#].*$/, "");
  if (!path) return { anchor: anchor ?? "" };
  try { path = decodeURIComponent(path); } catch { return { error: "This link has an invalid path" }; }
  const file = normalize(path.startsWith("/") ? path : `${dirname(from)}/${path}`);
  return anchor ? { file, anchor } : { file };
}

/** `file` from the repo root when it has one, else from the home folder as ~/…, else as is. */
export function relativePath(file, root, home) {
  // Windows mixes separators: git prints C:/x, a folder comes as C:\x.
  [file, root, home] = [file, root, home].map((path) => path?.replaceAll("\\", "/"));
  const under = (base) => base && file.startsWith(base.replace(/\/$/, "") + "/") ? file.slice(base.replace(/\/$/, "").length + 1) : null;
  return under(root) ?? (under(home) !== null ? `~/${under(home)}` : file);
}
