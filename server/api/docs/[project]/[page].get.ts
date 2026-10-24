import { createError, defineEventHandler, getRouterParam } from 'nuxt/server'

/**
 * One documentation page, rendered.
 *
 * The same `marked` + Shiki pipeline as the READMEs and the blog, in the
 * blog's `post` mode: a page is written under its own title and keeps its
 * heading levels.
 */
export default defineEventHandler(async (event) => {
  const project = getRouterParam(event, 'project') ?? ''
  const page = getRouterParam(event, 'page') ?? ''

  const doc = await oneDoc(project, page)
  if (!doc) throw createError({ status: 404, statusText: 'No such page' })

  const { body, ...meta } = doc
  // The page renders its own title as the h1, so the markdown's leading one
  // would be a second, and `post` mode would demote it to an h2 besides.
  const withoutTitle = body.replace(/^\s*# [^\n]*\n/, '')
  return { ...meta, html: await renderMarkdown(withoutTitle, 'post') }
})
