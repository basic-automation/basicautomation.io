/**
 * What the client bundle is made of, written down at build time so
 * `npm run audit:runtime` can ask the registry about it.
 *
 * The server half needs no help: Nitro traces its packages into
 * `.output/server/node_modules` and its chunks carry sourcemaps. The client
 * chunks have neither — and sourcemaps there would be served to anyone who
 * asks — so this Vite plugin reads the bundle as it is generated instead:
 * every module with code actually rendered into a client chunk, mapped to the
 * package it came from and the version in that package's own `package.json`.
 * A package the bundler tree-shook to nothing is not listed; it ships nothing.
 *
 * The list is written to `.output/server/client-packages.json` once Nitro has
 * compiled, beside the server's own manifest — inside the image, never under
 * `public/`, so it is never served.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { packageFromPath } from '../../shared/security/advisories'

export const CLIENT_PACKAGES_FILE = 'client-packages.json'

export function clientPackages() {
	const found = new Map<string, Set<string>>()

	const plugin: Plugin = {
		name: 'basicautomation:client-packages',
		applyToEnvironment: (environment) => environment.name === 'client',
		generateBundle(_options, bundle) {
			for (const output of Object.values(bundle)) {
				if (output.type !== 'chunk') continue
				for (const [id, module] of Object.entries(output.modules)) {
					if (!module.renderedLength) continue
					const pkg = packageFromPath(id.replace(/^\0/, '').split('?')[0]!)
					if (!pkg) continue
					const { version } = JSON.parse(readFileSync(join(pkg.root, 'package.json'), 'utf8')) as { version: string }
					if (!found.has(pkg.name)) found.set(pkg.name, new Set())
					found.get(pkg.name)!.add(version)
				}
			}
		},
	}

	function write(serverDir: string) {
		const packages = Object.fromEntries([...found].sort(([a], [b]) => a.localeCompare(b)).map(([name, versions]) => [name, [...versions].sort()]))
		writeFileSync(join(serverDir, CLIENT_PACKAGES_FILE), JSON.stringify({ packages }, null, '\t') + '\n')
	}

	return { plugin, write }
}
