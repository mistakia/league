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
 * while `getDraftWindow` remains a pure epoch-seconds calculator with its own
 * test suite. This mapper is where those two units meet, which is what the
 * paragraph above is describing, so the conversion lands here.
 *
 * `draft_type` is deliberately NOT mapped. The calculator takes hours
 * unconditionally under the published-slate rule, and the four `'day'` rows
 * carry `draft_pick_interval = 24` instead. The COLUMN still exists and is
 * still read — two SPA predicates branch on it — and dropping it is
 * `user:task/league/retire-draft-type-and-conform-draft-window-naming.md`.
 *
 * @param {Object} draft_settings
 * @param {Date|string} draft_settings.draft_start - When the draft opens; a Date
 *   on the server, an ISO string once through JSON.
 * @param {number} [draft_settings.draft_pick_interval] - Hours between slots, and
 *   the exclusive-clock floor.
 * @param {number} draft_settings.draft_hour_min - First hour a slot may fall on (inclusive).
 * @param {number} draft_settings.draft_hour_max - Hour the band closes (exclusive),
 *   which is also the daily publication boundary.
 * @param {Date|string} [draft_settings.rookie_draft_end_at] - The draft's hard
 *   cutoff, which `getDraftDates` reads instead of projecting one.
 *
 * `resumed_at` rides along here rather than being passed separately at each
 * site, so every caller that already spreads this config inherits the resume
 * rule by construction. It is attached to the league record by
 * `libs-server/get-league.mjs` and `api/routes/me.mjs` and declared on the
 * SPA's `League` record, which are the shapes every call site passes. A site
 * whose league lacks the field would place windows against a publication the
 * resume already voided, which is why the field travels with the settings it
 * belongs to instead of as a separate argument nobody remembers.
 *
 * @param {Date|string} [draft_settings.resumed_at] - The league's LATEST resume.
 *
 * @returns {Object} Window-calculation arguments, ready to spread.
 */
import timestamptz_to_epoch from './timestamptz-to-epoch.mjs'

export default function get_draft_window_config({
  draft_start,
  draft_pick_interval,
  draft_hour_min,
  draft_hour_max,
  rookie_draft_end_at,
  resumed_at
} = {}) {
  return {
    draft_start_timestamp: timestamptz_to_epoch(draft_start),
    pick_interval_hours: draft_pick_interval,
    daily_window_start_hour: draft_hour_min,
    daily_window_end_hour: draft_hour_max,
    rookie_draft_end_at: rookie_draft_end_at ?? null,
    resumed_at: resumed_at ?? null
  }
}
