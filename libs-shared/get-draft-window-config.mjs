/**
 * Maps the persisted draft settings onto the arguments `getDraftWindow` and
 * `getDraftDates` take.
 *
 * This is the single place the `seasons` column names meet the window
 * calculation, so a schema change lands here instead of in each of the callers
 * scattered across the API, the scripts, and the frontend.
 *
 * Accepts anything carrying the season's draft columns — a `getLeague` result
 * or the draft reducer state both qualify, since both keep the column names.
 *
 * `seasons.draft_start` is timestamptz as of the 2026-08-07 conformance pass,
 * while `getDraftWindow`/`getDraftDates` remain pure epoch-seconds calculators
 * with their own test suite. This mapper is where those two units meet, which
 * is what the paragraph above is describing, so the conversion lands here.
 *
 * @param {Object} draft_settings
 * @param {Date|string} draft_settings.draft_start - When the draft opens; a Date
 *   on the server, an ISO string once through JSON.
 * @param {string} draft_settings.draft_type - Cadence unit: 'hour' or 'day'.
 * @param {number} [draft_settings.draft_pick_interval] - Units of `draft_type` between consecutive picks' windows.
 * @param {number} draft_settings.draft_hour_min - First hour a window may open (inclusive).
 * @param {number} draft_settings.draft_hour_max - Hour windows stop opening (exclusive).
 *
 * `draft_pause_periods` rides along here rather than being passed separately at
 * each site, so every caller that already spreads this config inherits the
 * pause credit by construction. It is attached to the league record by
 * `libs-server/get-league.mjs` and declared on the SPA's `League` record, which
 * are the two shapes every call site passes. A site whose league lacks the
 * field credits nothing and fails silently, which is why the field travels with
 * the settings it belongs to instead of as a separate argument nobody
 * remembers.
 *
 * `getDraftDates` ignores it: the hard end quantizes to `endOf('day')`, so a
 * credit below a whole band moves it by zero and the expiry sweep skips paused
 * leagues outright instead.
 *
 * @param {Array} [draft_settings.draft_pause_periods] - League pause intervals.
 *
 * @returns {Object} Window-calculation arguments, ready to spread.
 */
import timestamptz_to_epoch from './timestamptz-to-epoch.mjs'

export default function get_draft_window_config({
  draft_start,
  draft_type,
  draft_pick_interval,
  draft_hour_min,
  draft_hour_max,
  draft_pause_periods
} = {}) {
  return {
    draft_start_timestamp: timestamptz_to_epoch(draft_start),
    cadence_unit: draft_type,
    cadence_interval: draft_pick_interval,
    daily_window_start_hour: draft_hour_min,
    daily_window_end_hour: draft_hour_max,
    draft_pause_periods: normalize_pause_periods(draft_pause_periods)
  }
}

/**
 * Coerces the pause intervals to a plain array of plain rows.
 *
 * The SPA holds them in an Immutable `List` of `Map`s while the server has
 * plain objects, and `get_paused_open_seconds` reads `paused_at`/`resumed_at`
 * by property. Normalizing here keeps that difference out of the calculator,
 * which is isomorphic and must not know which side it is running on.
 */
function normalize_pause_periods(draft_pause_periods) {
  if (!draft_pause_periods) return []

  const periods =
    typeof draft_pause_periods.toJS === 'function'
      ? draft_pause_periods.toJS()
      : draft_pause_periods

  if (!Array.isArray(periods)) return []

  return periods.map((period) => ({
    paused_at: period.paused_at,
    resumed_at: period.resumed_at ?? null
  }))
}
