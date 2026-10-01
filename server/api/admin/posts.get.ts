/**
 * Every post, drafts included, for the editor's list.
 *
 * Behind the editor's credential and refused over the onion gateway, like the
 * rest of `/api/admin/*` — see `server/utils/adminGuard.ts`. The public list
 * endpoint hides drafts; this one must not, because a draft you cannot see is
 * a draft you cannot finish.
 */
export default defineEventHandler(async (event) => {
  await requireEditor(event)

  const posts = await allPosts()
  return { posts: posts.map(({ body: _body, ...rest }) => rest) }
})
