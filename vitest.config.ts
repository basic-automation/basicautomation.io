import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Unit tests only, and deliberately so.
 *
 * What CI already proves is that the site builds, starts, renders every page
 * and answers the right status codes — `npm run check` walks a real server.
 * What it cannot prove is that a regex handling somebody else's README gets the
 * awkward input right, because the awkward input is not in any README today.
 * That is what this is for: the pure functions in `shared/`, exercised directly,
 * with no Nuxt runtime, no network and no fixtures to keep in step.
 *
 * Nothing here renders a component or boots Nitro. If a test would need either,
 * it is a thing `npm run check` should be asserting against a running server
 * instead.
 */
export default defineConfig({
	resolve: {
		alias: {
			'~~': fileURLToPath(new URL('.', import.meta.url)),
		},
	},
	test: {
		environment: 'node',
		include: ['test/**/*.test.ts'],
	},
})
