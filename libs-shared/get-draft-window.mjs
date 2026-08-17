import { DRAFT_TIMEZONE, resolve_daily_window } from './draft-daily-window.mjs'
import {
  DEFAULT_PICK_INTERVAL_HOURS,
  resolve_pick_interval_hours,
  slot_at_index
} from './draft-window/slot-grid.mjs'
import { list_publication_boundaries } from './draft-window/publication-boundaries.mjs'
import {
  count_outstanding_ahead,
  is_selected_as_of,
  resolve_outstanding_picks
} from './draft-window/outstanding-picks.mjs'

export { DRAFT_TIMEZONE, DEFAULT_PICK_INTERVAL_HOURS }

/**
 * Calculates when a given pick becomes passable.
 *
 * A pick's window is the moment that pick may be taken *out of order* — when
 * its team may select even though an earlier pick is still unmade. A team
 * whose preceding pick has already been made is on the clock regardless of the
 * window; the window governs only jumping a stalled team ahead of you.
 *
 * The rule is a frozen daily slate on a fixed grid, and it RATCHETS:
 *
 *   window(P) = the EARLIEST slot any publication has ever given P
 *
 *     publication  the draft opening, then each daily band close; after a
 *                  pause, the first close at or after the resume and each one
 *                  after that
 *     queue        at a publication, the picks still unmade as of it, in pick
 *                  order
 *     slot         the (queue position)-th slot of the fixed daily grid at or
 *                  after that publication
 *
 * Three properties carry the whole design.
 *
 * **Selection times never place an instant.** They decide only which picks are
 * still in the queue at a publication, and therefore each pick's position in
 * it. How late the team ahead of you clicked cannot move your window — the
 * slot times come from the band alone and are the same every day.
 *
 * **A window never moves later.** Each publication re-lays the outstanding
 * picks from that day, and the answer is the minimum across every publication
 * so far, so a day on which more picks were made than the slate scheduled
 * pulls the remaining windows EARLIER and a quiet day leaves them exactly
 * where they were. The one exception is a pause: a resume voids the standing
 * publication and the ratchet starts again from the first close after it,
 * which is what a pause is for.
 *
 * **The shift happens once a day.** Between two publications every window is
 * constant, because both the queue and the grid are fixed for the day. A pick
 * made this afternoon moves nothing until the band closes; at the close the
 * picks made during the day leave the queue and everything behind them comes
 * up. So the next day's board is knowable the night before.
 *
 * @param {Object} args
 * @param {number} args.draft_start_timestamp - Unix timestamp (seconds) the draft opens.
 * @param {number} args.pick_number - 1-based pick number to calculate the window for.
 * @param {number} [args.pick_interval_hours=1] - Hours between slots.
 * @param {number} [args.daily_window_start_hour=11] - First hour of the day a slot may fall on (inclusive).
 * @param {number} [args.daily_window_end_hour=16] - Hour of the day the band closes (EXCLUSIVE), and the publication boundary.
 *
 * `draft_picks[].selection_timestamp` and `resumed_at` are timestamptz and
 * always DB-sourced, so they are taken as instants here rather than converted
 * at each caller. `draft_start_timestamp` stays epoch seconds because this
 * function does arithmetic on it.
 *
 * @param {Array} [args.draft_picks] - The WHOLE board, as `{ pick, pid,
 *   selection_timestamp }` rows in any order. Omit pre-draft, in which case
 *   every pick is outstanding and pick N takes the (N-1)th slot. Passing a
 *   PARTIAL board mis-indexes the slate and places windows too early.
 *
 * @param {Date|string} [args.resumed_at] - The league's LATEST resume. A scalar
 *   rather than the interval array the open-seconds credit needed, because only
 *   the latest resume can matter — two pauses in a day are equivalent to one.
 *
 * @param {import('dayjs').Dayjs|Date|string|number} [args.until] - The caller's
 *   now, against which the publications are resolved. Defaults to the current
 *   time. The SPA passes its frozen draft clock so the slate resolves against
 *   the same clock every other display on the page reads.
 *
 * @returns {import('dayjs').Dayjs|null} The moment the pick becomes passable, or
 *   null when it has none — no publication since the resume, or the pick is
 *   already made. LITERALLY null, never undefined: `now.isAfter(undefined)` is
 *   TRUE, so a missing return would make every stalled pick passable instead of
 *   blocking it, which is the exact inversion of what a null window means.
 *
 * @example
 * // The live 2026 config: 3-hour slots on an 11:00-24:00 Eastern band, which
 * // seats five windows a day at 11, 14, 17, 20 and 23.
 * getDraftWindow({
 *   draft_start_timestamp: 1786953600,
 *   pick_number: 3,
 *   pick_interval_hours: 3,
 *   daily_window_start_hour: 11,
 *   daily_window_end_hour: 24,
 *   draft_picks,
 *   resumed_at: '2026-08-17T13:00:00Z'
 * })
 */
export default function getDraftWindow({
  draft_start_timestamp,
  pick_number,
  pick_interval_hours,
  daily_window_start_hour,
  daily_window_end_hour,
  draft_picks,
  resumed_at,
  until
}) {
  if (!Number.isFinite(pick_number) || pick_number <= 0) {
    console.warn('[getDraftWindow] Invalid pick_number:', pick_number)
    return null
  }

  // `getDraftWindow` is the surface that warns on a misconfigured band, since
  // a silently widened window changes every placement on the board.
  const band = resolve_daily_window({
    daily_window_start_hour,
    daily_window_end_hour,
    warn: true
  })
  const interval = resolve_pick_interval_hours(pick_interval_hours)

  const boundaries = list_publication_boundaries({
    draft_start_timestamp,
    band,
    resumed_at,
    until
  })

  if (!boundaries.length) return null

  // A pick already made has no window to open. Read against the LATEST
  // publication, which is the only one that can still call it unmade, and off
  // the pick's own ROW — a pick number past the end of the board is unmade,
  // and the draft-end estimate asks for exactly that.
  const is_made = is_selected_as_of({
    draft_pick: (draft_picks ?? []).find((row) => row.pick === pick_number),
    boundary: boundaries[boundaries.length - 1]
  })
  if (is_made) return null

  return boundaries.reduce((window_open_at, boundary) => {
    const outstanding = resolve_outstanding_picks({ draft_picks, boundary })
    const slot = slot_at_index({
      from: boundary,
      index: count_outstanding_ahead({ outstanding, pick_number }),
      band,
      interval
    })

    return !window_open_at || slot.isBefore(window_open_at)
      ? slot
      : window_open_at
  }, null)
}

/**
 * When the pick currently on the clock becomes passable.
 *
 * The slot of the SECOND outstanding pick, which is the first moment anybody
 * else's window opens on a board where the head is stalled — so it is the
 * deadline the on-clock notification announces and the countdown the draft
 * page renders.
 *
 * It exists because the obvious spelling does not work under the slate. Both
 * former call sites passed `frontier.pick + 1`, and on a board with a gap that
 * names a pick that is already MADE (on the live 2026 board the frontier is
 * pick 3 and pick 4 is made), for which `getDraftWindow` correctly returns
 * null. Asking for the second outstanding pick asks the question the caller
 * actually has.
 *
 * @param {Object} args - The same window arguments, minus `pick_number`.
 * @returns {import('dayjs').Dayjs|null} Null when no publication governs, or
 *   when fewer than two picks are outstanding — the last pick on the board
 *   cannot be passed by anyone.
 */
export function get_draft_pass_window({
  draft_start_timestamp,
  pick_interval_hours,
  daily_window_start_hour,
  daily_window_end_hour,
  draft_picks,
  resumed_at,
  until
}) {
  const band = resolve_daily_window({
    daily_window_start_hour,
    daily_window_end_hour,
    warn: true
  })

  const boundaries = list_publication_boundaries({
    draft_start_timestamp,
    band,
    resumed_at,
    until
  })

  if (!boundaries.length) return null

  const outstanding = resolve_outstanding_picks({
    draft_picks,
    boundary: boundaries[boundaries.length - 1]
  })

  if (!outstanding || outstanding.length < 2) return null

  return getDraftWindow({
    draft_start_timestamp,
    pick_number: outstanding[1],
    pick_interval_hours,
    daily_window_start_hour,
    daily_window_end_hour,
    draft_picks,
    resumed_at,
    until
  })
}
