/**
 * One post, rendered.
 *
 * The markdown goes through the same `marked` + Shiki pipeline as the project
 * READMEs, so a fence in a post looks like a fence anywhere else on the site.
 */
export default defineEventHandler(async (event) => {
  const project = getRouterParam(event, 'project') ?? ''
  const slug = getRouterParam(event, 'slug') ?? ''

  const post = await onePost(project, slug)
  if (!post) throw createError({ statusCode: 404, statusMessage: 'No such post' })

  const { body, ...meta } = post
  return { ...meta, html: await renderMarkdown(body, 'post') }
})
