// Learning that the tab is running a superseded bundle, without giving the
// bundle a sha.
//
// THE RUNNING BUNDLE CARRIES NO SHA AND MUST NOT BE GIVEN ONE. DefinePlugin
// supplies IS_DEV and APP_VERSION only; the sha lives in dist/build-manifest.json
// (webpack/webpack.config.prod.babel.mjs) precisely so it does not rehash every
// chunk on every commit. So there is no "my sha" to compare against the server's.
// What there is instead is a BASELINE: the manifest value read once at boot is,
// by definition, the build this tab started on. Every later read is compared
// against that, which needs nothing from the bundle.
//
// This module is deliberately store-free and touches `window` only inside
// functions, so a spec can import and drive it. `@core/store` reads
// `window.__INITIAL_STATE__` at module scope and there is no jsdom here, so
// anything that reaches the store is untestable -- the same reason
// app/core/ws/send-queue.js exists.
//
//= ====================================
//  WHY THE RE-READ IS CACHE-BUSTED
// -------------------------------------
//
// `/dist/build-manifest.json` IS NOT CONTENT-HASHED AND IS SERVED
// `Cache-Control: public, max-age=31536000, immutable`. The /dist mount in
// api/index.mjs sets that header for every file under it, hashed or not, and
// this file is the one member of that directory whose whole purpose is to
// change under a stable URL. A plain `fetch` of it is therefore answered out of
// the tab's own HTTP cache forever and returns the boot value for the life of
// the tab -- which would make this entire feature a silent no-op, failing in the
// direction that looks like success.
//
// Measured against production on 2026-09-04 rather than assumed. A repeated
// default fetch reported `transferSize: 0` with a 88-byte body (no network at
// all); the same fetch with `cache: 'no-store'` reported `transferSize: 391` on
// every call. Cloudflare answers this path `cf-cache-status: DYNAMIC`, so the
// EDGE is not the problem today -- the browser is. The query parameter is
// insurance against that changing: a Cloudflare cache rule over `/dist/*` would
// reintroduce the same silent failure at the edge, and a novel URL is the only
// thing that cannot be served from an edge cache.
//
// DO NOT reach for a `Cache-Control` REQUEST header instead. It is outside the
// CORS-simple set, so it makes the browser preflight, and
// `Access-Control-Allow-Headers` in api/index.mjs does not name it -- the fetch
// would then fail outright in dev, which is cross-origin, while working in
// production, which is same-origin. `cache: 'no-store'` sets no header and
// preflights nothing.
export const BUILD_MANIFEST_URL = '/dist/build-manifest.json'

// WHY A RECONNECT IS CHECKED MORE THAN ONCE, AND NOT IMMEDIATELY ONLY.
//
// A deploy is `yarn deploy && yarn build && yarn deploy:dist` (package.json),
// and `deploy` ENDS in `pm2 reload`. So the socket drop that tells this tab a
// deploy happened arrives a whole webpack production build BEFORE the new
// manifest is rsynced to the host. A check fired at the instant of reconnect is
// guaranteed to read the OLD manifest and conclude the tab is current.
//
// This is not theoretical: the two deploys that passed a manager's tab on
// 2026-09-03 reconnected at 23:01:24 and 23:33:01 and landed their bundles at
// 23:02:49 and 23:33:28 -- 85 seconds and 27 seconds later. An immediate-only
// check would have missed both, exactly like the reconnect it is meant to
// notice.
//
// So a reconnect arms a BOUNDED schedule that spans that window rather than a
// single read. Bounded, and anchored to an event, because a bare interval polls
// origin forever on every open tab to answer a question that only changes when
// a deploy happens.
export const RECHECK_DELAYS_MS = Object.freeze([0, 30000, 120000, 300000])

// A reconnect storm (the exponential backoff in app/core/ws/sagas.js can put
// several opens close together) and a user flicking between tabs must not turn
// into a request per event.
export const MINIMUM_CHECK_INTERVAL_MS = 15000

export const DISMISSED_BUILD_STORAGE_KEY = 'stale_build_dismissed_sha'

// The build this tab started on. `null` until a manifest read succeeds, so a
// failed boot read leaves the feature dormant rather than permanently disabled
// -- the next reconnect or tab focus can still establish the baseline.
let running_build = null

export const get_running_build = () => running_build

/**
 * Record the baseline, once. The FIRST usable manifest read wins and nothing
 * later can move it: the baseline is a statement about the JavaScript already
 * executing in this tab, and that never changes without a page load.
 */
export const note_running_build = (build) => {
  if (running_build) return running_build
  if (!build || typeof build.sha !== 'string' || !build.sha)
    return running_build
  running_build = build
  return running_build
}

export const reset_stale_build_state = () => {
  running_build = null
}

const resolve_fetch = (fetch_impl) => {
  if (fetch_impl) return fetch_impl
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return null
  }
  // Bound through a wrapper rather than passed as a bare reference, which
  // throws `Illegal invocation` when called detached from `window`.
  return (...args) => window.fetch(...args)
}

/**
 * Read the manifest the server is serving RIGHT NOW.
 *
 * Deliberately NOT `read_build` from @core/contribution-context. That function
 * memoizes into `cached_build`, whose contract is load-bearing -- `undefined`
 * means not fetched and `null` means fetched and failed, kept distinguishable so
 * a failed fetch is not retried on every contribution capture. A poller sharing
 * that memo would either return the boot value forever (useless) or have to
 * invalidate it, which is what would make contribution capture start
 * re-fetching. Two readers with different needs, so two functions.
 *
 * DEGRADES, NEVER THROWS. This is an invitation to reload; a failed read is
 * simply no invitation.
 */
export const fetch_deployed_build = async ({
  fetch_impl,
  now = Date.now
} = {}) => {
  const do_fetch = resolve_fetch(fetch_impl)
  if (!do_fetch) return null

  try {
    const response = await do_fetch(`${BUILD_MANIFEST_URL}?t=${now()}`, {
      cache: 'no-store',
      credentials: 'same-origin'
    })
    if (!response.ok) return null
    const { sha, built_at } = await response.json()
    return { sha: sha || null, built_at: built_at || null }
  } catch (_error) {
    return null
  }
}

/**
 * Is `deployed` a build this tab is not running?
 *
 * Sha inequality is the question, but `built_at` is what makes the answer
 * MONOTONE, and monotonicity is what stops a nudge loop. If any layer ever
 * answers a read with an older manifest, sha inequality alone would invite a
 * reload into the build the tab is already running, and the read after that
 * reload would invite it again. Requiring the deployed build to be strictly
 * newer means this can only ever point forward. `built_at` is written by
 * build_manifest_plugin on every build, including a rollback, so it always
 * moves forward with the deploy.
 *
 * When either timestamp is missing or unparseable the comparison falls back to
 * sha inequality, because the alternative -- refusing -- is the silent
 * never-fires failure this whole module is written to avoid.
 */
export const is_newer_build = (running, deployed) => {
  if (!running || !deployed) return false

  const running_sha = running.sha
  const deployed_sha = deployed.sha
  if (typeof running_sha !== 'string' || !running_sha) return false
  if (typeof deployed_sha !== 'string' || !deployed_sha) return false
  if (running_sha === deployed_sha) return false

  const running_at = Date.parse(running.built_at)
  const deployed_at = Date.parse(deployed.built_at)
  if (Number.isNaN(running_at) || Number.isNaN(deployed_at)) return true

  return deployed_at > running_at
}

const resolve_storage = (storage) => {
  if (storage) return storage
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch (_error) {
    // Accessing localStorage THROWS outright under some privacy settings, so
    // even the property read is guarded.
    return null
  }
}

export const read_dismissed_build = (storage) => {
  const store = resolve_storage(storage)
  if (!store) return null
  try {
    return store.getItem(DISMISSED_BUILD_STORAGE_KEY) || null
  } catch (_error) {
    return null
  }
}

export const dismiss_build = (sha, storage) => {
  const store = resolve_storage(storage)
  if (!store || typeof sha !== 'string' || !sha) return false
  try {
    store.setItem(DISMISSED_BUILD_STORAGE_KEY, sha)
    return true
  } catch (_error) {
    return false
  }
}

/**
 * The whole decision, in one place a spec can drive.
 *
 * Dismissal is keyed on the DEPLOYED sha rather than being a boolean, so
 * dismissing this build stays dismissed for this build and the NEXT deploy asks
 * again. A boolean would silence the nudge for the life of the browser profile.
 */
export const should_invite_reload = ({ running, deployed, dismissed_sha }) => {
  if (!is_newer_build(running, deployed)) return false
  return deployed.sha !== dismissed_sha
}
