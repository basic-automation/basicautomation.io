/**
 * One post's raw markdown, front matter and all, for the editor.
 *
 * The editor works on the file as written rather than on parsed fields, so what
 * you see is what is on disk.
 */
export default defineEventHandler(async (event) => {
  refuseOverOnion(event)

  const { project, slug } = getQuery(event)
  if (typeof project !== 'string' || typeof slug !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'project and slug are required' })
  }

  const raw = await rawPost(project, slug)
  if (raw === null) throw createError({ statusCode: 404, statusMessage: 'No such post' })

  return { project, slug, raw }
})
