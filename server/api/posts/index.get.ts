/**
 * Published posts, newest first.
 *
 * `?project=<slug>` narrows to one project's news; `?limit=<n>` bounds the
 * aggregate for the home page teaser. Bodies are never included — a list does
 * not need them, and the home page would otherwise carry every post it links to.
 *
 * Without a limit the aggregate returns everything, because `/news` is the whole
 * site's news and a cap there would quietly drop the oldest history instead of
 * paginating it. That matches the `?project=` branch, which has always been
 * unbounded. Summaries are small enough that the full set costs little.
 */
export default defineEventHandler(async (event) => {
  const { project, limit } = getQuery(event)

  if (typeof project === 'string' && project) {
    // An unknown blog is a 404, as `/api/projects/<nope>` is — an empty list
    // would say "this blog exists and is quiet", which is a different answer.
    if (!isKnownSection(project)) throw createError({ statusCode: 404, statusMessage: 'No such blog' })
    return { posts: await postsFor(project) }
  }

  const n = Number(limit)
  return { posts: await latestPosts(Number.isFinite(n) && n > 0 ? n : undefined) }
})
