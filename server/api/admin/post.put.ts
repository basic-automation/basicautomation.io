/**
 * Create or replace a post.
 *
 * `PUT` rather than `POST` because it is idempotent on `(project, slug)`: the
 * editor saves the same document repeatedly and each save should land on the
 * same file rather than accumulate.
 */
export default defineEventHandler(async (event) => {
  refuseOverOnion(event)

  const parsed = parsePost(await readBody(event))
  if (!parsed.ok) throw createError({ statusCode: 400, statusMessage: parsed.reason })

  await writePost(parsed.post)
  return { ok: true, project: parsed.post.project, slug: parsed.post.slug }
})
