/**
 * Starts the onion gateway beside the site, from inside the site's own process.
 *
 * This used to be `docker-entrypoint.sh`: a shell script that backgrounded both
 * processes and polled them every two seconds. A shell is the one thing a
 * distroless runtime does not have, and node is the one thing it does — so the
 * process that has to be there anyway now owns the gateway, and the image's
 * command is `node .output/server/index.mjs` in exec form.
 *
 * It is not a node supervisor spawning two children, because that is a second
 * node heap (about 40 MB, against 145 MB for the whole container today) whose
 * only job is to wait.
 *
 * The contract is the script's, unchanged:
 *
 * - Neither process is supervised by the other. If the gateway exits, this
 *   process exits with its status and the container stops — a gateway that has
 *   quietly died beside a healthy site is worse than a container that went
 *   away, and the restart policy and the healthcheck are what bring it back.
 * - On SIGTERM/SIGINT the gateway gets its own SIGTERM and is waited for,
 *   because onyums unpublishes its descriptor on shutdown. Nitro's graceful
 *   shutdown calls the `close` hook before it exits, which is where that
 *   happens, and its own timeout bounds the wait.
 *
 * Only when `ONION_GATEWAY` names the binary, which the image sets and
 * `npm start` does not; `ONION_ENABLED=0` still switches it off in the image.
 */

import { spawn, type ChildProcess } from 'node:child_process'

function log(event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ t: new Date().toISOString(), level: 'info', event, ...fields }))
}

export default defineNitroPlugin((nitroApp) => {
  const binary = process.env.ONION_GATEWAY
  if (!binary) return
  if (process.env.ONION_ENABLED === '0') {
    log('onion.disabled')
    return
  }

  let stopping = false
  // Tor bootstrap is minutes on a cold cache, so the gateway is started now and
  // left to catch up rather than gated on the site listening. The proxy returns
  // 502 until the site answers, which only matters to a visitor who found the
  // address before the site finished starting.
  const gateway: ChildProcess = spawn(binary, [], { stdio: 'inherit' })
  const exited = new Promise<void>((resolve) => gateway.once('exit', () => resolve()))

  gateway.once('spawn', () => log('onion.started', { pid: gateway.pid, site: process.pid }))

  gateway.once('error', (err) => {
    // Could not be started at all — a missing or non-executable binary. Same
    // answer as a crash: the container stops, and says why.
    console.error(JSON.stringify({ t: new Date().toISOString(), level: 'error', event: 'onion.error', message: err.message }))
    process.exit(1)
  })

  gateway.once('exit', (code, signal) => {
    if (stopping) return
    console.error(JSON.stringify({
      t: new Date().toISOString(),
      level: 'error',
      event: 'onion.exited',
      code,
      signal,
      message: 'the onion gateway exited; stopping the site with it',
    }))
    process.exit(code ?? 1)
  })

  nitroApp.hooks.hook('close', async () => {
    stopping = true
    if (gateway.exitCode !== null || gateway.signalCode !== null) return
    gateway.kill('SIGTERM')
    await exited
    log('onion.stopped', { code: gateway.exitCode, signal: gateway.signalCode })
  })
})
