/**
 * Whether rendered HTML holds the element a URL fragment names.
 *
 * The about page folds its README into a `<details>`, and a fragment that
 * points inside it — a README heading, linked from its own contents list or
 * from anywhere else — names an element with no box until the fold is open.
 * A browser opens it on a real fragment navigation; a client-side one has to
 * know to, before it scrolls.
 *
 * `hash` is a location hash with or without its `#`, percent-encoded or not:
 * GitHub's slugs keep emoji and other non-ASCII letters (`#⚡-quick-start`),
 * which a URL carries encoded.
 */
export function hasAnchor(html: string | null | undefined, hash: string): boolean {
  if (!html) return false
  const raw = hash.replace(/^#/, '')
  if (!raw) return false
  const ids = new Set([raw])
  try {
    ids.add(decodeURIComponent(raw))
  }
  catch {
    // A lone `%`: only the raw form can match.
  }
  for (const id of ids) {
    if (html.includes(` id="${escapeAttribute(id)}"`)) return true
  }
  return false
}

/** The escaping a serializer applies inside a double-quoted attribute. */
function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
