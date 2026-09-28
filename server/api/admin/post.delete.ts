/** Remove a post. */
export default defineEventHandler(async (event) => {
  const { project, slug } = getQuery(event)
  if (typeof project !== 'string' || typeof slug !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'project and slug are required' })
  }

  if (!(await deletePost(project, slug))) {
    throw createError({ statusCode: 404, statusMessage: 'No such post' })
  }
  return { ok: true }
})
