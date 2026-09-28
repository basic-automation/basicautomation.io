/**
 * Published posts, newest first.
 *
 * `?project=<slug>` narrows to one project's news; `?limit=<n>` bounds the
 * aggregate on the home page. Bodies are never included — a list does not need
 * them, and the home page would otherwise carry every post it links to.
 */
export default defineEventHandler(async (event) => {
  const { project, limit } = getQuery(event)

  if (typeof project === 'string' && project) {
    return { posts: await postsFor(project) }
  }

  const n = Number(limit)
  return { posts: await latestPosts(Number.isFinite(n) && n > 0 ? Math.min(n, 50) : 10) }
})
