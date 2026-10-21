import { createError, defineEventHandler, getQuery } from 'nuxt/server'

/**
 * One post's raw markdown, front matter and all, for the editor.
 *
 * The editor works on the file as written rather than on parsed fields, so what
 * you see is what is on disk.
 */
export default defineEventHandler(async (event) => {
  await requireEditor(event)

  const { project, slug } = getQuery(event)
  if (typeof project !== 'string' || typeof slug !== 'string') {
    throw createError({ status: 400, statusText: 'project and slug are required' })
  }

  const raw = await rawPost(project, slug)
  if (raw === null) throw createError({ status: 404, statusText: 'No such post' })

  return { project, slug, raw }
})
