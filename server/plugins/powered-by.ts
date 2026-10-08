/**
 * No `x-powered-by`.
 *
 * Nuxt's renderer and its payload and island handlers set `x-powered-by: Nuxt`
 * themselves, on every page they answer, and no route rule can take it off:
 * the rule's headers are applied first and the renderer's after. All it does
 * is tell a scanner which framework's advisories to try first. The header is
 * removed in `beforeResponse`, which runs after any handler has set its own.
 * `npm run check` fails a response that still carries it.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (event) => {
    event.node.res.removeHeader('x-powered-by')
  })
})
