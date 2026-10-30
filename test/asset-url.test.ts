import { describe, expect, it } from 'vitest'
import { projects } from '~~/data/projects'
import { assetUrl } from '~~/app/utils/assetSize'

// `sizes:check` proves the hashes match the files; this proves every wordmark
// a page draws is requested by one, so a replaced logo is a new URL.
describe.each(projects.filter((p) => p.logo).map((p) => [p.slug, p.logo!]))('%s wordmark', (_, src) => {
	it('is requested with a version from its bytes', () => {
		expect(assetUrl(src)).toMatch(new RegExp(`^${src.replace(/\./g, '\\.')}\\?v=[0-9a-f]{10}$`))
	})
})

describe('assetUrl', () => {
	it('leaves an image it has no hash for alone', () => {
		expect(assetUrl('/not/in/the/manifest.png')).toBe('/not/in/the/manifest.png')
	})
})
