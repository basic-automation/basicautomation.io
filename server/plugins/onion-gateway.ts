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
 * - If the gateway exits on its own, this process exits with its status and
 *   the container stops — a gateway that has quietly died beside a healthy
 *   site is worse than a container that went away, and the restart policy and
 *   the healthcheck are what bring it back.
 * - One exception, a restart this process asks for: a gateway that is running
 *   but has not been reached over Tor for an hour is stopped and started again
 *   in place, at most hourly (`shouldRestartGateway` says why that helps). On
 *   2026-10-08 the cure for a four-and-a-half-hour outage was `docker restart`,
 *   which took the clearnet site down with it; this does the same for the
 *   gateway alone.
 * - On SIGTERM/SIGINT the gateway gets its own SIGTERM and is waited for,
 *   because onyums unpublishes its descriptor on shutdown. Nitro's graceful
 *   shutdown calls the `close` hook before it exits, which is where that
 *   happens, and its own timeout bounds the wait.
 *
 * Only when `ONION_GATEWAY` names the binary, which the image sets and
 * `npm start` does not; `ONION_ENABLED=0` still switches it off in the image.
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { logEvent } from '~~/shared/log/event'

/** How long a gateway gets to stop on SIGTERM before it is killed. */
const STOP_GRACE_MS = 9_000

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
  /** A gateway this process is stopping on purpose, whose exit is not a crash. */
  let retiring: ChildProcess | null = null
  let gateway: ChildProcess
  let exited: Promise<void>

  // Tor bootstrap is minutes on a cold cache, so the gateway is started now and
  // left to catch up rather than gated on the site listening. The proxy returns
  // 502 until the site answers, which only matters to a visitor who found the
  // address before the site finished starting.
  function start() {
    const child = spawn(binary!, [], { stdio: 'inherit' })
    gateway = child
    exited = new Promise<void>((resolve) => child.once('exit', () => resolve()))

    child.once('spawn', () => {
      markGatewayStarted()
      log('onion.started', { pid: child.pid, site: process.pid })
    })

    child.once('error', (err) => {
      // Could not be started at all — a missing or non-executable binary. Same
      // answer as a crash: the container stops, and says why.
      console.error(JSON.stringify({ t: new Date().toISOString(), level: 'error', event: 'onion.error', message: err.message }))
      process.exit(1)
    })

    child.once('exit', (code, signal) => {
      if (stopping || child === retiring) return
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
  }

  /**
   * SIGTERM, then wait: onyums unpublishes its descriptor on the way out, which
   * takes milliseconds. Not forever, though — a gateway that ignored the signal
   * would leave an in-place restart waiting with no gateway at all, so after
   * `STOP_GRACE_MS` it is killed. That is inside both Nitro's own 30 s shutdown
   * timeout and `docker stop`'s default 10 s.
   */
  async function stop() {
    const child = gateway
    const done = exited
    if (child.exitCode !== null || child.signalCode !== null) return
    child.kill('SIGTERM')
    let timer: ReturnType<typeof setTimeout> | undefined
    const graceful = await Promise.race([
      done.then(() => true),
      new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), STOP_GRACE_MS) }),
    ])
    clearTimeout(timer)
    if (!graceful) {
      logEvent('warn', 'onion.killed', `the gateway ignored SIGTERM for ${STOP_GRACE_MS / 1000} s; killing it`, { pid: child.pid })
      child.kill('SIGKILL')
      await done
    }
    log('onion.stopped', { code: child.exitCode, signal: child.signalCode })
  }

  start()

  let checking = false
  const watchdog = setInterval(async () => {
    if (stopping || checking) return
    checking = true
    try {
      if (!await gatewayRestartDue() || stopping) return
      logEvent('warn', 'onion.restarting', 'not reached over Tor for an hour; restarting the gateway in place', { pid: gateway.pid })
      retiring = gateway
      await stop()
      retiring = null
      if (!stopping) start()
    }
    catch (err) {
      // An unhandled rejection would take the site down, which is the one
      // thing this watchdog exists to avoid.
      logEvent('error', 'onion.watchdog_failed', (err as Error).message)
    }
    finally {
      checking = false
    }
  }, 60_000)
  watchdog.unref()

  nitroApp.hooks.hook('close', async () => {
    stopping = true
    clearInterval(watchdog)
    await stop()
  })
})
