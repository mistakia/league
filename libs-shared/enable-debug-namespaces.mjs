import debug from 'debug'

// Snapshotted at module load, and it MUST NOT be read per-call: debug.enable()
// calls its own save(), which on node WRITES process.env.DEBUG. So the first
// call through here populates the variable, and a per-call read then sees it
// set and treats every later module's namespaces as overridden by an
// "explicit" DEBUG that this function itself wrote -- leaving only the
// first-imported module enabled, which is the same single-winner failure the
// union is here to remove. Measured: with the per-call read, a three-module
// graph printed lib-a alone.
//
// The snapshot is trustworthy because ESM evaluates this module before the body
// of anything that imports it, so nothing can have called enable() yet.
const debug_was_set_in_the_environment = Boolean(globalThis.process?.env?.DEBUG)

/**
 * Add namespaces to the process-wide debug set, as a UNION rather than a
 * replacement. This is the only place in the tree allowed to call
 * `debug.enable` -- `local/no-bare-debug-enable` enforces that.
 *
 * `debug.enable` REPLACES the enabled namespace set. ESM evaluates every import
 * before the importing module's body, so with a bare call at module scope the
 * LAST module to be imported owns the process and every other namespace goes
 * dark. That is what left the prop write path unlogged in production for five
 * deploys on 2026-08-03, and what still silences six modules in
 * `scripts/import-full-season.mjs`'s import graph today.
 *
 * Reading the current set back out and re-enabling it alongside the new one
 * makes the operation commutative, so import order stops mattering and no entry
 * point has to enumerate the namespaces of its transitive dependencies. That
 * enumeration is the OTHER half of the same failure: it decays silently, and it
 * is why `record-league-format-projection-value-history` logged zero times
 * through a 468,930-row seed.
 *
 * An explicit `DEBUG` stays authoritative -- these lists are only the default
 * for a bare CLI run.
 *
 * `globalThis.process?.env` rather than a bare `process.env`: this file is
 * isomorphic and is bundled into the SPA, where `process` need not exist.
 *
 * @param {string} namespaces comma-separated namespaces, as `debug.enable` takes
 */
export const enable_debug_namespaces = (namespaces) => {
  if (debug_was_set_in_the_environment) {
    return
  }

  // debug.disable() returns the currently-active namespace string and clears
  // it; re-enabling with both halves is what makes this a union.
  const current = debug.disable()
  debug.enable(current ? `${current},${namespaces}` : namespaces)
}
