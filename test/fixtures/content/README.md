# Test posts

A content directory for CI, never for the live site. CI starts the built
server with `CONTENT_DIR` pointing here, so that `npm run check` and both
`a11y` passes render real post pages — with no posts, the blog pages CI crawls
are all empty states, and a post page is never rendered at all.

Each file exercises something a real post will eventually do: a title with a
colon in it (the front matter writer quotes values for exactly that reason), a
fenced code block through Shiki, a table, an internal link the crawler follows,
and a draft that must not appear in any listing.

Nothing here is news. The site's real posts live on the
`basicautomation-content` volume, not in git.
