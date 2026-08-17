import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

import timestamptz_to_epoch from '../timestamptz-to-epoch.mjs'
import { DRAFT_TIMEZONE } from '../draft-daily-window.mjs'

dayjs.extend(utc)
dayjs.extend(timezone)

/**
 * The pick numbers with no selection AS OF `boundary`, in pick order.
 *
 * This is the only thing a selection timestamp is read for: it decides which
 * picks are still in the queue at a publication, and therefore each pick's
 * POSITION. It never places an instant — the slot times come from the grid
 * alone, so how late a team clicked cannot move anybody's window.
 *
 * A pick counts as made only when it carries a `selection_timestamp` at or
 * before the boundary. Reading the timestamp rather than the `pid` is what
 * makes the set a function of the boundary instead of of now, and it also
 * absorbs the client's reducer race, where a `pid` lands on a pick the instant
 * a selection is made and its timestamp arrives with the next load — such a
 * pick stays outstanding, which holds every later index still rather than
 * jittering the slate between refetches.
 *
 * @param {Object} args
 * @param {Array} [args.draft_picks] - The WHOLE board, as `{ pick, pid,
 *   selection_timestamp }` rows in any order.
 * @param {import('dayjs').Dayjs} args.boundary
 * @returns {number[]|null} Null with no board at all, which the caller reads as
 *   the pre-draft case rather than as an empty board.
 */
export function resolve_outstanding_picks({ draft_picks, boundary }) {
  if (!draft_picks || !draft_picks.length) return null

  return draft_picks
    .filter((draft_pick) => !is_selected_as_of({ draft_pick, boundary }))
    .map((draft_pick) => draft_pick.pick)
    .sort((a, b) => a - b)
}

/**
 * Whether a board row was already selected at `boundary`.
 *
 * Asked of a ROW rather than of a pick number, because "absent from the
 * outstanding set" and "already made" are different facts: callers ask for
 * pick numbers past the end of the board — the draft-end estimate wants the
 * slot after the last one — and such a pick is unmade, not made.
 *
 * @param {Object} args
 * @param {Object} args.draft_pick - A `{ pick, pid, selection_timestamp }` row.
 * @param {import('dayjs').Dayjs} args.boundary
 * @returns {boolean}
 */
export function is_selected_as_of({ draft_pick, boundary }) {
  if (!draft_pick || !draft_pick.selection_timestamp) return false

  const selected_at = dayjs
    .unix(timestamptz_to_epoch(draft_pick.selection_timestamp))
    .tz(DRAFT_TIMEZONE)

  return !selected_at.isAfter(boundary)
}

/**
 * How many picks ahead of `pick_number` are still outstanding at a boundary —
 * the pick's position in that publication's queue, 0-based.
 *
 * Counted rather than looked up, so the answer is well defined whether or not
 * the pick itself is outstanding, and a board the caller has not screened
 * cannot yield a position that indexes backwards off the grid.
 *
 * With no board at all every preceding pick is unmade by definition, which is
 * the pre-draft case the bare `pick_number` stands in for.
 *
 * @param {Object} args
 * @param {number[]|null} args.outstanding
 * @param {number} args.pick_number
 * @returns {number}
 */
export function count_outstanding_ahead({ outstanding, pick_number }) {
  if (!outstanding) return Math.max(pick_number - 1, 0)

  return outstanding.filter((pick) => pick < pick_number).length
}
