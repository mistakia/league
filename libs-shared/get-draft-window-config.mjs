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
 * @param {Object} draft_settings
 * @param {number} draft_settings.draft_start - Unix timestamp (seconds) the draft opens.
 * @param {string} draft_settings.draft_type - Cadence unit: 'hour' or 'day'.
 * @param {number} [draft_settings.draft_pick_interval] - Units of `draft_type` between consecutive picks' windows.
 * @param {number} draft_settings.draft_hour_min - First hour a window may open (inclusive).
 * @param {number} draft_settings.draft_hour_max - Hour windows stop opening (exclusive).
 *
 * @returns {Object} Window-calculation arguments, ready to spread.
 */
export default function get_draft_window_config({
  draft_start,
  draft_type,
  draft_pick_interval,
  draft_hour_min,
  draft_hour_max
} = {}) {
  return {
    draft_start_timestamp: draft_start,
    cadence_unit: draft_type,
    cadence_interval: draft_pick_interval,
    daily_window_start_hour: draft_hour_min,
    daily_window_end_hour: draft_hour_max
  }
}
