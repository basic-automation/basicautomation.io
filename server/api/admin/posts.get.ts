/**
 * Every post, drafts included, for the editor's list.
 *
 * Behind Caddy basic auth along with the rest of `/api/admin/*`, and refused
 * over the onion gateway, which bypasses Caddy — see
 * `server/utils/adminPosts.ts`. The public list endpoint hides drafts; this one
 * must not, because a draft you cannot see is a draft you cannot finish.
 */
export default defineEventHandler(async (event) => {
  refuseOverOnion(event)

  const posts = await allPosts()
  return { posts: posts.map(({ body: _body, ...rest }) => rest) }
})
