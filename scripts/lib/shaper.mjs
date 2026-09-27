/**
 * A slow link, simulated at the socket rather than inside the browser.
 *
 * DevTools' network throttling is per-request arithmetic, and it can invent
 * differences a real link does not have: under it, preloading a smaller font
 * made the stylesheet arrive ~45 ms later, reproducibly, and through this
 * proxy the same two builds painted within a millisecond of each other. So
 * `measure-vitals.mjs --shaped` routes the browser through here instead:
 *
 *   - one shared pipe of `rate` bytes a second, divided round-robin in
 *     TCP-sized pieces between every response in flight, as flows share a link
 *   - `rtt` ms before each response starts, one round trip
 *
 * Crude — no slow start, no congestion — but its errors are the same for both
 * sides of a comparison, which is what an A/B needs.
 */

import { createServer, request } from 'node:http'

export function startShaper({ upstream, rate = 200_000, rtt = 150 }) {
	const target = new URL(upstream)
	const TICK = 10
	const SEGMENT = 1460
	const flows = []

	const timer = setInterval(() => {
		let budget = (rate * TICK) / 1000
		while (budget > 0 && flows.length) {
			const flow = flows.shift()
			const take = Math.min(flow.buf.length, SEGMENT, budget)
			flow.res.write(flow.buf.subarray(0, take))
			budget -= take
			flow.buf = flow.buf.subarray(take)
			if (flow.buf.length) flows.push(flow)
			else flow.res.end()
		}
	}, TICK)

	const server = createServer((req, res) => {
		const up = request({
			host: target.hostname,
			port: target.port,
			path: req.url,
			method: req.method,
			headers: { ...req.headers, host: target.host },
		}, (u) => {
			const chunks = []
			u.on('data', (c) => chunks.push(c))
			u.on('end', () => setTimeout(() => {
				const headers = { ...u.headers }
				delete headers['transfer-encoding']
				res.writeHead(u.statusCode ?? 502, headers)
				flows.push({ res, buf: Buffer.concat(chunks) })
			}, rtt))
		})
		up.on('error', () => {
			res.writeHead(502)
			res.end()
		})
		req.pipe(up)
	})

	return new Promise((resolve) => {
		server.listen(0, '127.0.0.1', () => {
			resolve({
				url: `http://127.0.0.1:${server.address().port}`,
				stop: () => {
					clearInterval(timer)
					server.closeAllConnections?.()
					server.close()
				},
			})
		})
	})
}
