/**
 * Whether this request may use the editor: 204 if so, otherwise whatever
 * `requireEditor` refuses it with (404 over Tor or when unconfigured, 401
 * without the credential).
 *
 * For the editor page, which renders on the server and has no data of its own
 * to fetch before it knows — without this it rendered an empty editor, with a
 * 200, for anyone who reached it.
 */
export default defineEventHandler(async (event) => {
  await requireEditor(event)

  setResponseStatus(event, 204)
  return null
})
