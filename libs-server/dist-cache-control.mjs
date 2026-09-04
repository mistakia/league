import { basename } from 'path'

// The one file under dist/ that is NOT content-hashed.
//
// Everything else webpack emits there carries its content hash in its filename,
// which is what makes `immutable` true of it: the url and the bytes change
// together, so a client may keep an answer forever. build-manifest.json is the
// deliberate exception — build_manifest_plugin writes it under a STABLE name
// (webpack/webpack.config.prod.babel.mjs) precisely so a reader can ask "what
// is deployed right now" without knowing a hash in advance.
export const MUTABLE_DIST_ASSET = 'build-manifest.json'

// A minute is short enough that a tab notices a deploy on its next check and
// long enough that the file is not re-fetched per navigation. `must-revalidate`
// makes the staleness bounded rather than advisory.
export const MUTABLE_DIST_CACHE_CONTROL = 'public, max-age=60, must-revalidate'

export const IMMUTABLE_DIST_CACHE_CONTROL =
  'public, max-age=31536000, immutable'

/**
 * The Cache-Control policy for a file served from dist/.
 *
 * Extracted from the express.static `setHeaders` callback in api/index.mjs so
 * it can be asserted without a built bundle on disk. CI never runs `yarn
 * build`, so a spec that drove this over HTTP would 404 there and pass for the
 * wrong reason.
 *
 * WHY THE EXCEPTION EXISTS. Marking a mutable file `immutable` is not a
 * cosmetic inaccuracy: browsers act on it. Measured 2026-09-04 against
 * production, a repeated default fetch of build-manifest.json reported
 * `transferSize: 0` and never touched the network, so a client polling it to
 * learn a deploy had happened read its own boot value for the life of the tab
 * — a check that silently never fires, which is the direction that looks like
 * success.
 *
 * The SPA's stale-build check does NOT depend on this being right. It sends
 * `cache: 'no-store'` because it cannot depend on a header it does not control,
 * and that remains the load-bearing mechanism. This is the honest header for a
 * file that changes, so the next reader is not misled the same way.
 */
export const dist_cache_control = (file_path) =>
  basename(String(file_path)) === MUTABLE_DIST_ASSET
    ? MUTABLE_DIST_CACHE_CONTROL
    : IMMUTABLE_DIST_CACHE_CONTROL

export default dist_cache_control
