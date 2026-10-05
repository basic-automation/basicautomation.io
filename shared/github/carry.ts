import type { RepoMeta } from '~~/shared/types/project'

type Piece = NonNullable<RepoMeta['incomplete']>[number]

/** Whether `meta` holds the piece a refresh failed to fetch. */
function has(meta: RepoMeta, piece: Piece): boolean {
	if (piece === 'readme') return meta.readmeHtml != null
	if (piece === 'releases') return meta.releases.length > 0
	return meta.crateVersion != null
}

/**
 * Fill the pieces a live refresh could not fetch from the repo's previous live
 * answer.
 *
 * The repo call itself succeeded, so the refresh is live, but its README,
 * release list and crate data are each separate calls allowed to fail. When
 * one did, the page rendered without that section for a whole refresh window
 * (seen live on 2026-10-03/04: Enlil without its README and releases, onyums
 * and Artiqwest without their crate numbers), although the process still had
 * the last answer to every one of them. A missing README is a visible hole;
 * the previous one is almost always the same text.
 *
 * Only a previous LIVE answer is carried, never the snapshot: the snapshot's
 * releases can be several versions old, and its download links with them —
 * the rollback `lastLive` exists to prevent.
 *
 * `incomplete` still names every piece that failed (the upstream call did fail,
 * and health still reports it). `carried` names the ones filled in.
 */
export function carryMissing(fresh: RepoMeta, previous: RepoMeta | undefined): RepoMeta {
	if (!fresh.incomplete?.length || !previous) return fresh
	const out: RepoMeta = { ...fresh }
	const carried: Piece[] = []
	for (const piece of fresh.incomplete) {
		if (!has(previous, piece)) continue
		if (piece === 'readme') {
			out.readmeHtml = previous.readmeHtml
		}
		else if (piece === 'releases') {
			out.releases = previous.releases
			out.latestRelease = previous.latestRelease
			out.download = previous.download
		}
		else {
			out.crateVersion = previous.crateVersion
			out.crateDownloads = previous.crateDownloads
			out.crateUrl = previous.crateUrl
			out.docsUrl = previous.docsUrl
		}
		carried.push(piece)
	}
	if (carried.length) out.carried = carried
	return out
}
