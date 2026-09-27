/**
 * Largest Contentful Paint and Cumulative Layout Shift, measured in a real
 * browser, on every page the sitemap lists.
 *
 *   npm run vitals -- https://basicautomation.io
 *   npm run vitals -- http://127.0.0.1:3000 --runs=5 --strict
 *   npm run vitals -- http://127.0.0.1:3000 --only=/ --only=/projects
 *   npm run vitals -- http://127.0.0.1:3000 --shaped
 *
 * Two profiles, each a cold load with the cache disabled:
 *
 *   phone    390×844 at 3×, 150 ms round trips, 1.6 Mbps down, CPU slowed 4× —
 *            roughly the throttling Lighthouse applies for its mobile run
 *   desktop  1280×900, no throttling
 *
 * Each page is loaded `--runs` times (default 3) and the median reported, since
 * one load is noise. CLS is computed the way the web-vitals library does it —
 * the largest session window of shifts less than a second apart and at most
 * five seconds long, ignoring shifts right after input — not a plain sum.
 *
 * This is lab data from one machine and one network, not what visitors
 * experienced; that is field data, which this site has too little traffic to
 * appear in CrUX for. What it does answer is the question the roadmap left
 * open: does the page shift, and how long does the main content take, measured
 * rather than argued. `layout-shift` observers DO fire in `--headless=new`
 * driven over CDP — they did not in the screenshot-mode headless used before.
 *
 * `--shaped` swaps the phone profile's DevTools network throttling for a real
 * shaped link (`lib/shaper.mjs`: one shared 1.6 Mbps pipe, 150 ms per
 * response) in front of the target. Prefer it for A/B comparisons: DevTools'
 * throttling once produced a reproducible 48 ms "regression" that the shaped
 * link showed to be an artefact of the throttling itself. It needs a local
 * target — shaping a remote site only adds to its own latency.
 *
 * Reports by default. `--strict` exits non-zero when a median is "poor" by
 * web.dev's thresholds (LCP over 4 s, CLS over 0.25).
 * https://web.dev/articles/vitals#core-web-vitals
 * https://web.dev/articles/cls#what-is-a-good-cls-score
 */

import { sitePages, NOT_FOUND_PATH } from './lib/pages.mjs'
import { startBrowser } from './lib/cdp.mjs'
import { startShaper } from './lib/shaper.mjs'

const args = process.argv.slice(2)
const BASE = (args.find((a) => !a.startsWith('--'))
	?? process.env.CHECK_BASE_URL
	?? 'http://127.0.0.1:3000').replace(/\/$/, '')
const RUNS = Number(args.find((a) => a.startsWith('--runs='))?.slice(7) ?? 3)
const STRICT = args.includes('--strict')
const ONLY = args.filter((a) => a.startsWith('--only=')).map((a) => a.slice(7))
const SHAPED = args.includes('--shaped')

/** web.dev's boundaries: good at or under the first, poor over the second. */
const LCP = { good: 2500, poor: 4000 }
const CLS = { good: 0.1, poor: 0.25 }

const PROFILES = [
	{
		name: 'phone',
		metrics: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
		// Bytes per second: 1.6 Mbps down, 750 Kbps up.
		network: { offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8 },
		cpu: 4,
	},
	{
		name: 'desktop',
		metrics: { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
		network: null,
		cpu: 1,
	},
]

/**
 * Installed before any of the page's own code runs, so buffered entries from
 * the very first paint are seen. Session windows as web-vitals defines them.
 */
const OBSERVER = `
window.__vitals = { lcp: null, lcpElement: null, cls: 0, shifts: 0 };
(() => {
	let session = 0, first = 0, last = 0;
	new PerformanceObserver((list) => {
		for (const e of list.getEntries()) {
			if (e.hadRecentInput) continue;
			__vitals.shifts++;
			if (session && e.startTime - last < 1000 && e.startTime - first < 5000) {
				session += e.value;
			} else {
				session = e.value;
				first = e.startTime;
			}
			last = e.startTime;
			__vitals.cls = Math.max(__vitals.cls, session);
		}
	}).observe({ type: 'layout-shift', buffered: true });
	new PerformanceObserver((list) => {
		const e = list.getEntries().at(-1);
		__vitals.lcp = e.startTime;
		const el = e.element;
		__vitals.lcpElement = el ? el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.getAttribute('src') ? '[src=' + el.getAttribute('src').split('/').pop() + ']' : '') : null;
	}).observe({ type: 'largest-contentful-paint', buffered: true });
})();
`

const median = (xs) => {
	const s = [...xs].sort((a, b) => a - b)
	const m = s.length >> 1
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const rate = (value, t) => (value <= t.good ? 'good' : value <= t.poor ? 'needs work' : 'POOR')

const shaper = SHAPED ? await startShaper({ upstream: BASE, rate: 1_600_000 / 8, rtt: 150 }) : null

const pages = (await sitePages(BASE))
	.filter((p) => p !== NOT_FOUND_PATH && (!ONLY.length || ONLY.includes(p)))
const { cdp, chrome, stop } = await startBrowser()

console.log(`LCP and CLS, median of ${RUNS} cold load(s), ${pages.length} pages from ${BASE}${SHAPED ? ', phone through a shaped link' : ''}`)
console.log(`in ${chrome}\n`)

let poor = 0

try {
	for (const profile of PROFILES) {
		console.log(`${profile.name}`)
		console.log(`  ${'page'.padEnd(26)} ${'LCP'.padStart(8)}  ${''.padEnd(10)} ${'CLS'.padStart(6)}  ${''.padEnd(10)} LCP element`)

		for (const path of pages) {
			const lcps = []
			const clss = []
			let element = null

			for (let run = 0; run < RUNS; run++) {
				// A fresh target per load: nothing carried over from the last one.
				const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
				const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
				await cdp.send('Page.enable', {}, sessionId)
				await cdp.send('Network.enable', {}, sessionId)
				await cdp.send('Network.setCacheDisabled', { cacheDisabled: true }, sessionId)
				await cdp.send('Emulation.setDeviceMetricsOverride', profile.metrics, sessionId)
				if (profile.network && !SHAPED) await cdp.send('Network.emulateNetworkConditions', profile.network, sessionId)
				await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu }, sessionId)
				await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: OBSERVER }, sessionId)

				const loaded = cdp.once('Page.loadEventFired', sessionId, 60_000)
				const origin = shaper && profile.network ? shaper.url : BASE
				const nav = await cdp.send('Page.navigate', { url: origin + path }, sessionId)
				if (nav.errorText) throw new Error(`${path}: ${nav.errorText}`)
				await loaded
				// Late shifts — a font swap, a lazy image, hydration — land after load.
				await new Promise((r) => setTimeout(r, 3000))

				const { result } = await cdp.send('Runtime.evaluate', { expression: 'JSON.stringify(window.__vitals)', returnByValue: true }, sessionId)
				const v = JSON.parse(result.value)
				if (v.lcp !== null) lcps.push(v.lcp)
				clss.push(v.cls)
				element = v.lcpElement ?? element

				await cdp.send('Target.closeTarget', { targetId })
			}

			const lcp = lcps.length ? median(lcps) : null
			const cls = median(clss)
			const lcpRate = lcp === null ? 'none' : rate(lcp, LCP)
			const clsRate = rate(cls, CLS)
			if (lcpRate === 'POOR' || clsRate === 'POOR') poor++

			console.log(`  ${path.padEnd(26)} ${lcp === null ? '—'.padStart(8) : `${Math.round(lcp)} ms`.padStart(8)}  ${lcpRate.padEnd(10)} ${cls.toFixed(3).padStart(6)}  ${clsRate.padEnd(10)} ${element ?? ''}`)
		}
		console.log()
	}
}
finally {
	await stop()
	shaper?.stop()
}

console.log(`Thresholds: LCP good ≤ ${LCP.good} ms, poor > ${LCP.poor} ms; CLS good ≤ ${CLS.good}, poor > ${CLS.poor}.`)
console.log('Lab data from this machine — not what visitors experienced.')

if (poor && STRICT) {
	console.error(`\n✗ ${poor} page/profile median(s) rated poor.`)
	process.exit(1)
}
