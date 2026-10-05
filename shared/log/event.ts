/**
 * One log line, as the request log writes them: a JSON object with `t`,
 * `level`, `event` and a human `message`, so `docker logs basicautomation-site
 * | jq` reads every line rather than choking on the odd plain-text one.
 *
 * The README promises exactly that, and until 2026-10-05 seven warnings broke
 * it — among them a failed GitHub fetch, the line an operator is most likely
 * to be looking for. `test/log-lines.test.ts` fails a `console` call in
 * `server/` or `shared/` that does not write JSON.
 */
export type LogLevel = 'info' | 'warn' | 'error'

export function logLine(level: LogLevel, event: string, message: string, fields: Record<string, unknown> = {}): string {
	return JSON.stringify({ t: new Date().toISOString(), level, event, ...fields, message })
}

export function logEvent(level: LogLevel, event: string, message: string, fields: Record<string, unknown> = {}): void {
	const line = logLine(level, event, message, fields)
	if (level === 'error') console.error(line)
	else if (level === 'warn') console.warn(line)
	else console.log(line)
}
