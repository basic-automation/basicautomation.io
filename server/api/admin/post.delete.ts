import { createError, defineEventHandler, getQuery } from 'nuxt/server'

/** Remove a post. */
export default defineEventHandler(async (event) => {
  await requireEditor(event)

  const { project, slug } = getQuery(event)
  if (typeof project !== 'string' || typeof slug !== 'string') {
    throw createError({ status: 400, statusText: 'project and slug are required' })
  }

  if (!(await deletePost(project, slug))) {
    throw createError({ status: 404, statusText: 'No such post' })
  }
  return { ok: true }
})
