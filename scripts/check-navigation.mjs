/**
 * What a visitor's own navigation does to a project page, in a real browser.
 *
 *   node .output/server/index.mjs &
 *   npm run check:navigation              # Chromium
 *   npm run check:navigation -- --firefox # Firefox
 *
 * The about page folds its README, and none of what follows runs on the
 * server, so neither `npm run check` nor axe can see it break. Two bugs lived
 * here unseen: a page reached by Back came back folded, so the scroll position
 * the router saved no longer existed and a reader 6,000 px down a README
 * landed at the bottom of the folded page; and a link to a README heading
 * left Firefox — Tor Browser, for the onion service — at the same place with
 * the heading hidden, because only Chromium opens a closed `<details>` for a
 * fragment by itself. `app/composables/useReadmeFold.ts` fixed both. This
 * holds them fixed, on every about page whose README has a heading:
 *
 *   - unfold, read down, go to the blog tab, Back: unfolded, same place
 *   - Forward and Back again: the same
 *   - reload: unfolded, same place
 *   - blog tab, then the about tab by its link: folded, at the top
 *   - a cold load of `about#<heading>`: unfolded, the heading at the top
 *   - a client navigation to `about#<heading>`: unfolded, the heading on screen
 *   - fold it, blog tab, Back: still folded — even with the fragment
 *   - opened before the app hydrates: still open after it has
 *
 * And, as in `check-a11y-browser.mjs`, any console error fails it.
 */

import { sitePages } from './lib/pages.mjs'
import { startDriver } from './lib/browser.mjs'

const args = process.argv.slice(2)
const BASE = (args.find((a) => !a.startsWith('--'))
	?? process.env.CHECK_BASE_URL
	?? 'http://127.0.0.1:3000').replace(/\/$/, '')
const ENGINE = args.includes('--firefox') ? 'firefox' : 'chromium'

/** How far from the saved position a restored one may land, in CSS pixels. */
const SLACK = 4
/** Where a heading scrolled to may sit: its scroll margin clears the masthead. */
const HEADING_BAND = [-2, 200]

/** The same two widths `check-a11y-browser.mjs` uses. */
const VIEWPORTS = [
	{ name: 'desktop', width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
	{ name: 'phone', width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
]

const ABOUT = /^\/projects\/([^/]+)\/about$/
const slugs = (await sitePages(BASE)).map((p) => ABOUT.exec(p)?.[1]).filter(Boolean)
if (!slugs.length) throw new Error(`${BASE}/sitemap.xml lists no about pages`)

const browser = await startDriver(ENGINE)
console.log(`Navigation on ${slugs.length} about pages × ${VIEWPORTS.length} widths in ${browser.name} (${browser.binary})\n`)

const failures = []
let checked = 0

try {
	for (const { name, ...viewport } of VIEWPORTS) {
		const page = await browser.open(viewport)
		const sleep = (ms) => page.evaluate(`new Promise((r) => setTimeout(r, ${ms}))`)
		/**
		 * Wait for the router to arrive at `path`, then for the page to stop
		 * moving. The site scrolls smoothly (`scroll-behavior: smooth`), so a
		 * restored position or a heading is reached over a second or more, not
		 * at once: scrolling is done when `scrollY` has held still for 400 ms.
		 */
		const arrive = async (path) => {
			await page.evaluate(`(async () => {
				const wait = (ms) => new Promise((r) => setTimeout(r, ms))
				const until = Date.now() + 8000
				while (location.pathname !== ${JSON.stringify(path)} && Date.now() < until) await wait(50)
				await new Promise((r) => requestIdleCallback(() => r(), { timeout: 2000 }))
				await wait(300)
				let last = -1, still = 0
				while (still < 4 && Date.now() < until) {
					await wait(100)
					still = scrollY === last ? still + 1 : 0
					last = scrollY
				}
			})()`)
		}
		const click = (selector) => page.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
		const state = (id) => page.evaluate(`({
			path: location.pathname,
			y: Math.round(scrollY),
			open: document.querySelector('details')?.open ?? null,
			heading: ${id ? `Math.round(document.getElementById(${JSON.stringify(id)})?.getBoundingClientRect().top ?? NaN)` : 'null'},
		})`)

		for (const slug of slugs) {
			const about = `/projects/${slug}/about`
			const blog = `/projects/${slug}/blog`
			const problems = []
			const expect = (what, ok, got) => {
				checked++
				if (!ok) problems.push(`${what} — got ${JSON.stringify(got)}`)
			}

			await page.goto('about:blank')
			await page.goto(BASE + about)
			await arrive(about)
			page.takeErrors()
			// A heading from the middle of the README: deep enough that folding
			// hides it, and the kind of link a contents list makes.
			const id = await page.evaluate(`(() => {
				const ids = [...document.querySelectorAll('.readme [id]')].map((e) => e.id)
				return ids[Math.floor(ids.length / 2)] ?? null
			})()`)
			if (!id) {
				console.log(`  - ${name.padEnd(7)} ${about}: no README heading, skipped`)
				continue
			}

			let s = await state()
			expect('a first visit starts folded, at the top', s.open === false && s.y === 0, s)

			// Unfold and read down past where the folded page ends, so a page that
			// came back folded could not land there.
			const foldedBottom = await page.evaluate('document.documentElement.scrollHeight - innerHeight')
			await click('details > summary')
			await sleep(300)
			const target = await page.evaluate(`Math.min(${foldedBottom} + 1500, document.documentElement.scrollHeight - innerHeight - 10)`)
			await page.evaluate(`scrollTo({ top: ${target}, behavior: 'instant' })`)
			// Where the reader is once the README's lazy images around them have
			// loaded and moved things, not where they were sent.
			await arrive(about)
			const left = (await state()).y
			const deep = left > foldedBottom + 100
			const near = (y) => !deep || Math.abs(y - left) <= SLACK

			await click(`a[href="${blog}"]`)
			await arrive(blog)
			await page.evaluate('history.back()')
			await arrive(about)
			s = await state()
			expect(`Back reopens the README at y ${left}`, s.open === true && near(s.y), s)

			await page.evaluate('history.forward()')
			await arrive(blog)
			await page.evaluate('history.back()')
			await arrive(about)
			s = await state()
			expect(`Forward and Back again, at y ${left}`, s.open === true && near(s.y), s)

			await page.reload()
			await arrive(about)
			s = await state()
			expect(`a reload reopens it at y ${left}`, s.open === true && near(s.y), s)

			await click(`a[href="${blog}"]`)
			await arrive(blog)
			await click(`a[href="${about}"]`)
			await arrive(about)
			s = await state()
			expect('a visit by link starts folded, at the top', s.open === false && s.y <= 1, s)

			const hash = `#${encodeURIComponent(id)}`
			await page.goto('about:blank')
			await page.goto(BASE + about + hash)
			await arrive(about)
			s = await state(id)
			expect(`a cold load of ${hash} opens it at the heading`, s.open === true && s.heading >= HEADING_BAND[0] && s.heading <= HEADING_BAND[1], s)

			await click(`a[href="${blog}"]`)
			await arrive(blog)
			await page.evaluate(`document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$router.push(${JSON.stringify(about + hash)})`)
			await arrive(about)
			s = await state(id)
			// On screen, not at the top: this one scrolls smoothly (Nuxt's hash
			// behaviour is the stylesheet's), and README images above the heading
			// load while the page passes them, so where it stops depends on them.
			expect(`a client navigation to ${hash} opens it with the heading on screen`, s.open === true && s.heading >= HEADING_BAND[0] && s.heading <= viewport.height - 40, s)

			await click('details > summary')
			await sleep(300)
			await click(`a[href="${blog}"]`)
			await arrive(blog)
			await page.evaluate('history.back()')
			await arrive(about)
			s = await state()
			expect('folded by the visitor, it stays folded on Back', s.open === false, s)

			// A reader on a slow line opens the fold before the app has hydrated:
		// it must stay open. Hydration once wrote the bound `false` over it.
		const undo = await page.preload(`document.addEventListener('DOMContentLoaded', () => { document.querySelector('.readme')?.closest('details')?.setAttribute('open', '') })`)
		await page.goto('about:blank')
		await page.goto(BASE + about)
		await arrive(about)
		await sleep(1500)
		await undo()
		s = await state()
		expect('opened before hydration, it stays open', s.open === true, s)

		for (const { text } of page.takeErrors()) problems.push(`console: ${text}`)
			console.log(`  ${problems.length ? '✗' : '·'} ${name.padEnd(7)} ${about}${deep ? '' : ' (README too short to test the scroll position)'}`)
			for (const p of problems) console.error(`      ${p}`)
			failures.push(...problems.map((p) => `${name} ${about}: ${p}`))
		}
		await page.close()
	}
}
finally {
	await browser.stop()
}

if (failures.length) {
	console.error(`\n${failures.length} failure(s) in ${browser.name}.`)
	process.exit(1)
}
console.log(`\n✓ ${checked} navigation checks across ${slugs.length} about pages at ${VIEWPORTS.map((v) => `${v.width}px`).join(' and ')} in ${browser.name}.`)
