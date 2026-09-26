/**
 * The runtime image's Alpine has to be the same Alpine the node binary was
 * built against.
 *
 * The Dockerfile does not run node from `node:24-alpine`; it copies the single
 * `node` binary out of that image into a bare `alpine:3.24`, because not
 * inheriting npm, corepack and the addon headers is the only way to not ship
 * them. That binary is dynamically linked against the musl in the image it came
 * from. Let the two drift — a node base bump to an image built on Alpine 3.25,
 * say, while the runtime stays on 3.24 — and what you get is not a build error.
 * It is a container that exits with a relocation error the first time it runs,
 * in production, on a deploy that looked fine.
 *
 * So: read both tags out of the Dockerfile, ask the node image which Alpine it
 * is, and compare. The roadmap used to carry this as "check on every node base
 * bump", which is a thing a person has to remember. This is the same check,
 * run by CI, on every change.
 *
 *   npm run bases
 *
 * Needs docker. Only the node stage matters — the onion gateway is a static
 * musl binary, so the Alpine behind `rust:1-alpine` never reaches the runtime.
 */

import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const run = promisify(execFile)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DOCKERFILE = resolve(ROOT, 'Dockerfile')

/** `FROM <image> AS <stage>` for one named stage. */
function stageImage(dockerfile, stage) {
  const m = dockerfile.match(new RegExp(`^FROM\\s+(\\S+)\\s+AS\\s+${stage}\\s*$`, 'mi'))
  if (!m) throw new Error(`Dockerfile has no \`FROM … AS ${stage}\` stage`)
  return m[1]
}

/** 3.24.2 and 3.24 are the same series; 3.25.0 is not. */
function series(version) {
  const m = version.trim().match(/^(\d+)\.(\d+)/)
  if (!m) throw new Error(`cannot read an Alpine version out of "${version}"`)
  return `${m[1]}.${m[2]}`
}

const dockerfile = await readFile(DOCKERFILE, 'utf8')
const nodeImage = stageImage(dockerfile, 'build')
const runtimeImage = stageImage(dockerfile, 'runtime')

if (!runtimeImage.startsWith('alpine:')) {
  console.error(`The runtime stage is \`${runtimeImage}\`, not an Alpine image. This check assumes it is; update it or drop it.`)
  process.exit(1)
}

try {
  await run('docker', ['version', '--format', '{{.Server.Version}}'])
}
catch {
  console.error('This check needs a working docker — it asks the node image which Alpine it is built on.')
  process.exit(1)
}

console.log(`Asking ${nodeImage} which Alpine it is built on…`)
const { stdout } = await run('docker', ['run', '--rm', nodeImage, 'cat', '/etc/alpine-release'])

const nodeAlpine = stdout.trim()
const want = series(nodeAlpine)
const have = series(runtimeImage.slice('alpine:'.length))

if (want !== have) {
  console.error(`\n✗ ${nodeImage} is built on Alpine ${nodeAlpine}, but the runtime stage is \`${runtimeImage}\`.`)
  console.error('\n  The runtime does not run node from the node image — it copies the node')
  console.error('  binary into a bare Alpine, and that binary is linked against the musl it')
  console.error(`  was built with. Move the runtime stage to \`alpine:${want}\`, or pin the node`)
  console.error('  stage back to a tag still built on Alpine ' + have + '.')
  process.exit(1)
}

console.log(`✓ ${nodeImage} is Alpine ${nodeAlpine}; the runtime is \`${runtimeImage}\`. Same series.`)
