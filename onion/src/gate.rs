//! The Skin abuse gate, with one WAF rule switched off.
//!
//! # Why this file exists
//!
//! `onyums-skin`'s starter ruleset contains `sqli_comment`:
//!
//! ```text
//! (--\s|#|/\*)[\s\S]*?(\bor\b|\band\b|=)
//! ```
//!
//! and `Waf::inspect` runs every rule against every header value. The `Accept`
//! header a browser sends for an HTML document ends
//!
//! ```text
//! …,*/*;q=0.8
//! ```
//!
//! in which the media range `*/*` supplies the SQL block-comment opener `/*`
//! and `;q=` the trailing `=`. So the rule matches, and the request is blocked
//! before it reaches the site. Firefox, Tor Browser, Chrome and Safari all send
//! that shape; `curl`, whose default `Accept` is a bare `*/*` with no `;q=`,
//! does not — which is how this survived an end-to-end test over Tor and was
//! only found by opening the page in Tor Browser.
//!
//! # Why it is shaped like this
//!
//! The WAF inside the default gate is unreachable from outside: `Skin`'s fields
//! are private and there are no setters, so the only way to change one rule is
//! to build the whole gate. That is what `build` does, and it mirrors
//! `Skin::secure_default` exactly but for the one `disable_rule` call.
//!
//! **That mirroring is a liability.** The defaults it copies are private consts
//! in `onyums-skin`, so if a future version raises the difficulty, adds a
//! challenge tier or tightens the rate limit, this gate will silently keep the
//! old, weaker settings. Re-read `Skin::secure_default` whenever onyums is
//! upgraded and bring this back in step. `assert_mirrors_secure_default` below
//! catches the one class of drift that is mechanically checkable.
//!
//! # The real fix is upstream
//!
//! Disabling the rule here loses whatever genuine SQL-comment coverage it had.
//! The rule is wrong rather than unlucky — injection signatures are matched
//! against whole raw header values, so each header's own grammar ends up inside
//! the haystack — and it should be narrowed in `onyums-skin` to the shapes that
//! actually indicate an attack (a quote or paren followed by a comment, or the
//! MySQL executable comment `/*!`). Until that ships, this keeps the site
//! reachable.

use std::{io::Read, num::NonZeroU32, sync::Arc, time::Duration};

use onyums::onyums_skin::{
	HmacClearanceStore, PatienceChallenge, Skin, SkinRateLimit, Waf,
	challenge::{captcha::CaptchaChallenge, pow::{Hashcash, PowChallenge}},
};

/// The rule that blocks every browser. See the module docs.
const DISABLED_RULE: &str = "sqli_comment";

// Mirrors of the private consts in onyums-skin's `layer.rs` that
// `Skin::secure_default` uses. Named the same as their originals so a diff
// against that function is easy to do by eye.
const DEFAULT_SUBMIT_PATH: &str = "/.skin/pow";
const DEFAULT_DIFFICULTY: u32 = 18;
const DEFAULT_PATIENCE_DELAY: Duration = Duration::from_secs(5);
const DEFAULT_RATE_PER_SEC: u32 = 30;

/// `Skin::secure_default()`, minus one misfiring WAF rule.
pub fn build() -> Result<Skin, Box<dyn std::error::Error>> {
	let waf = Waf::starter().disable_rule(DISABLED_RULE);
	assert_disabled(&waf);

	let store = HmacClearanceStore::generate();

	// The fallback chain, most-preferred first: JS PoW → no-JS CAPTCHA → no-JS
	// tarpit — the same order and the same tiers as `secure_default`. The
	// CAPTCHA advertises its no-visual escape because the tarpit sits behind it,
	// so a low-vision no-JS client can fall through rather than fail an image.
	Ok(Skin::builder()
		.store(Arc::new(store.clone()))
		.challenge(Box::new(PowChallenge::new(Hashcash, secret()?, DEFAULT_DIFFICULTY)))
		.challenge(Box::new(CaptchaChallenge::new(secret()?).with_submit_path(DEFAULT_SUBMIT_PATH).with_no_image_escape(true)))
		.challenge(Box::new(PatienceChallenge::new(store, DEFAULT_PATIENCE_DELAY)))
		.rate_limit(SkinRateLimit::per_second(NonZeroU32::new(DEFAULT_RATE_PER_SEC).expect("DEFAULT_RATE_PER_SEC is nonzero")))
		.waf(waf)
		.build())
}

/// `disable_rule` takes a `&str` and silently does nothing when no rule has that
/// id, so an upstream rename would put the site back behind the block with no
/// signal at all. Fail at startup instead.
///
/// The count is what does that job, and it is the only thing that can.
/// `is_rule_enabled` returns `false` for an id that does not exist — by
/// construction, it is `any(|(rule_id, on)| rule_id == id && on)` — so asserting
/// on it alone would pass vacuously after exactly the rename it is supposed to
/// catch. It is kept because it states the intent at the call site, but it is
/// not the check; if you ever have to choose one, keep the count.
fn assert_disabled(waf: &Waf) {
	assert!(!waf.is_rule_enabled(DISABLED_RULE), "{DISABLED_RULE} is enabled");
	assert_eq!(
		waf.enabled_rule_count(),
		Waf::starter().rule_count() - 1,
		"expected to disable exactly one rule — if this fails, `{DISABLED_RULE}` is not in onyums-skin's \
		 ruleset under that name any more. Re-check whether it still misfires on the Accept header before \
		 deleting this gate, and read the module docs either way",
	);
}

/// 32 bytes of kernel randomness for a challenge secret.
///
/// `secure_default` uses `rand`; this reads the same source directly rather than
/// take a dependency for two calls at startup.
fn secret() -> std::io::Result<Vec<u8>> {
	let mut buf = vec![0u8; 32];
	std::fs::File::open("/dev/urandom")?.read_exact(&mut buf)?;
	Ok(buf)
}

#[cfg(test)]
mod tests {
	use super::*;

	/// The bug this whole module exists for. If this ever fails, upstream has
	/// fixed the rule and the gate can go back to `Skin::secure_default`.
	#[test]
	fn the_starter_ruleset_still_blocks_a_browsers_accept_header() {
		let accept = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/png,image/svg+xml,*/*;q=0.8";
		let pattern = regex::Regex::new(r"(--\s|#|/\*)[\s\S]*?(\bor\b|\band\b|=)").expect("the rule's own pattern compiles");
		assert!(pattern.is_match(accept), "sqli_comment no longer matches a browser Accept header");
	}

	#[test]
	fn curl_is_the_one_client_that_slips_through() {
		// Documents why an end-to-end test over Tor passed while every browser
		// was blocked: curl's default Accept has the `/*` but no trailing `=`.
		let pattern = regex::Regex::new(r"(--\s|#|/\*)[\s\S]*?(\bor\b|\band\b|=)").expect("the rule's own pattern compiles");
		assert!(!pattern.is_match("*/*"));
	}

	#[test]
	fn the_rule_is_actually_disabled() {
		assert_disabled(&Waf::starter().disable_rule(DISABLED_RULE));
	}

	/// Pins why `assert_disabled` leans on the count and not on the flag: asking
	/// whether a rule that does not exist is enabled answers "no", which is the
	/// same answer you get when you have successfully disabled it.
	#[test]
	fn is_rule_enabled_cannot_tell_disabled_from_absent() {
		let waf = Waf::starter();
		assert!(!waf.is_rule_enabled("no-such-rule-was-ever-shipped"));
		assert_eq!(waf.enabled_rule_count(), Waf::starter().rule_count(), "disabling nothing must not change the count");
	}
}
