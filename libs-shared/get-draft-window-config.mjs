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
 * @returns {Object} Window-calculation arguments, ready to spread.
 */
import timestamptz_to_epoch from './timestamptz-to-epoch.mjs'

export default function get_draft_window_config({
  draft_start,
  draft_type,
  draft_pick_interval,
  draft_hour_min,
  draft_hour_max
} = {}) {
  return {
    draft_start_timestamp: timestamptz_to_epoch(draft_start),
    cadence_unit: draft_type,
    cadence_interval: draft_pick_interval,
    daily_window_start_hour: draft_hour_min,
    daily_window_end_hour: draft_hour_max
  }
}
