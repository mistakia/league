import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

import timestamptz_to_epoch from './timestamptz-to-epoch.mjs'
import {
  DRAFT_TIMEZONE,
  HOURS_PER_DAY,
  resolve_daily_window as resolve_band
} from './draft-daily-window.mjs'

// `getDraftWindow` is the surface that warns on a misconfigured band, since a
// silently widened window changes every placement on the board.
const resolve_daily_window = (bounds) => resolve_band({ ...bounds, warn: true })

dayjs.extend(utc)
dayjs.extend(timezone)

export { DRAFT_TIMEZONE }

export const DEFAULT_PICK_INTERVAL_HOURS = 1

const DATE_FORMAT = 'YYYY-MM-DD'

/**
 * A timezone-aware instant built fresh from a `(date, hour)` pair.
 *
 * Every slot and every boundary is constructed this way rather than by adding
 * hours to a previous instant. Hour arithmetic across a DST transition drifts
 * by the offset change — 24 hours after midnight on a spring-forward date is
 * 01:00, not midnight — so a schedule built by accumulation walks off the
 * wall-clock hours it is supposed to publish. Building from the pair pins each
 * slot to its wall-clock hour on its own date, which is what the notice says.
 *
 * The one residual is a slot hour that does not EXIST on a spring-forward date;
 * dayjs resolves it forward to 03:00. No elected band puts a slot there, and
 * pinning the behavior is tracked on
 * `user:task/league/fix-draft-window-dst-offset-latching.md`.
 */
const instant_at = (date, hour) =>
  dayjs.tz(`${date} ${String(hour).padStart(2, '0')}:00:00`, DRAFT_TIMEZONE)

/**
 * The band's close for the draft day starting on `date`.
 *
 * A close at hour 24 is midnight of the FOLLOWING date — the same instant,
 * named the way `instant_at` can build it, since there is no hour 24 to
 * construct.
 */
const band_close_at = (date, band) => {
  if (band.end_hour < HOURS_PER_DAY) return instant_at(date, band.end_hour)

  const next_date = dayjs
    .tz(`${date} 12:00:00`, DRAFT_TIMEZONE)
    .add(1, 'day')
    .format(DATE_FORMAT)

  return instant_at(next_date, band.end_hour % HOURS_PER_DAY)
}

/**
 * The wall-clock hours a draft day publishes a slot at.
 *
 * Derived from the band and the interval rather than configured: the first slot
 * is the band's opening hour and each further slot is one interval later, while
 * still strictly inside the band. The elected 2026 config — a 3-hour interval
 * on an 11:00-24:00 band — gives 11, 14, 17, 20 and 23 Eastern.
 *
 * Always at least one slot. An interval at or above the band's width leaves
 * only the opening hour, which is the full-day 24-hour case: one slot a day, at
 * midnight, which is the Article XI Section 8 rule.
 *
 * @param {Object} args
 * @param {number} [args.daily_window_start_hour]
 * @param {number} [args.daily_window_end_hour]
 * @param {number} [args.pick_interval_hours]
 * @returns {Array<number>} Ascending wall-clock hours.
 */
export function get_draft_slot_hours({
  daily_window_start_hour,
  daily_window_end_hour,
  pick_interval_hours
} = {}) {
  const band = resolve_daily_window({
    daily_window_start_hour,
    daily_window_end_hour
  })
  const interval = resolve_pick_interval_hours(pick_interval_hours)

  const slot_hours = []
  for (let hour = band.start_hour; hour < band.end_hour; hour += interval) {
    slot_hours.push(hour)
  }

  return slot_hours
}

/**
 * The publication boundary governing `until`, or null when none does.
 *
 * A boundary is the band's CLOSE — for an 11:00-24:00 band that is midnight
 * Eastern — plus `draft_start`, which is the initial publication. At each one
 * the schedule is republished; between two of them it is frozen.
 *
 * Two comparisons here are load-bearing and both were ambiguous in the first
 * draft of this rule.
 *
 * The resume comparison is `>=`, not `>`. A resume voids the standing
 * publication, so a boundary is only usable when it lands at or after the
 * latest resume — but a boundary landing exactly ON the resume second does
 * publish. Under a strict `>` a one-second coincidence blacks out a further
 * whole day for no reason anybody could explain to a manager.
 *
 * Returning null is the resume's whole effect: between a resume and the next
 * boundary there is no publication, so no pick has a window and no pick can be
 * passed. That is "windows start the following day after an unpause".
 *
 * @param {Object} args
 * @param {number} args.draft_start_timestamp - Unix seconds the draft opens.
 * @param {Date|string} [args.resumed_at] - The league's LATEST resume, timestamptz.
 * @param {import('dayjs').Dayjs|Date|string|number} [args.until] - The caller's now.
 * @param {number} [args.daily_window_start_hour]
 * @param {number} [args.daily_window_end_hour]
 * @returns {import('dayjs').Dayjs|null}
 */
export function get_publication_boundary({
  draft_start_timestamp,
  resumed_at,
  until,
  daily_window_start_hour,
  daily_window_end_hour
} = {}) {
  const band = resolve_daily_window({
    daily_window_start_hour,
    daily_window_end_hour
  })

  const now = until
    ? dayjs(until).tz(DRAFT_TIMEZONE)
    : dayjs().tz(DRAFT_TIMEZONE)
  const draft_start = dayjs.unix(draft_start_timestamp).tz(DRAFT_TIMEZONE)

  // The draft has not opened, so there is nothing to publish.
  if (now.isBefore(draft_start)) return null

  // The latest daily close at or before now. Today's close is tried first and
  // stepped back a day when it has not happened yet.
  let latest_close = band_close_at(now.format(DATE_FORMAT), band)
  if (latest_close.isAfter(now)) {
    latest_close = band_close_at(
      now.subtract(1, 'day').format(DATE_FORMAT),
      band
    )
  }

  // `draft_start` counts as a boundary, so the governing one is whichever of
  // the two is later — the daily close only takes over once one has occurred
  // since the draft opened.
  const boundary = latest_close.isAfter(draft_start)
    ? latest_close
    : draft_start

  if (resumed_at) {
    const resume = dayjs(resumed_at).tz(DRAFT_TIMEZONE)
    if (boundary.isBefore(resume)) return null
  }

  return boundary
}

/**
 * The next publication boundary strictly AFTER `until`.
 *
 * The counterpart to `get_publication_boundary`, and the only thing a surface
 * can honestly say while every window is null: no pick has a slot yet, and the
 * next slate is published at this instant. Strictly after, because a boundary
 * landing exactly on now has already published — `get_publication_boundary`
 * returns it.
 *
 * @param {Object} args
 * @param {import('dayjs').Dayjs|Date|string|number} [args.until] - The caller's now.
 * @param {number} [args.daily_window_start_hour]
 * @param {number} [args.daily_window_end_hour]
 * @returns {import('dayjs').Dayjs}
 */
export function get_next_publication_boundary({
  until,
  daily_window_start_hour,
  daily_window_end_hour
} = {}) {
  const band = resolve_daily_window({
    daily_window_start_hour,
    daily_window_end_hour
  })

  const now = until
    ? dayjs(until).tz(DRAFT_TIMEZONE)
    : dayjs().tz(DRAFT_TIMEZONE)

  const close = band_close_at(now.format(DATE_FORMAT), band)

  return close.isAfter(now)
    ? close
    : band_close_at(now.add(1, 'day').format(DATE_FORMAT), band)
}

/**
 * The `index`-th slot AT OR AFTER `from`, counting from zero.
 *
 * AT OR AFTER, never strictly after, and the difference is not cosmetic. Under
 * a full-day band the boundary and the day's only slot are the SAME instant, so
 * the strict reading makes the head pick's window the next boundary — which
 * republishes it one day further out again, every day, so no window ever opens
 * for any pick and a genuine stall becomes permanent.
 *
 * @param {Object} args
 * @param {import('dayjs').Dayjs} args.from - Boundary or anchor instant.
 * @param {number} args.index - Zero-based slot offset.
 * @param {Array<number>} args.slot_hours - From `get_draft_slot_hours`.
 * @returns {import('dayjs').Dayjs}
 */
export function get_draft_slot_at_index({ from, index, slot_hours }) {
  let remaining = index

  // Each day contributes at least one slot, so `index + 2` days always covers
  // the request even when the boundary's own day is fully consumed.
  for (let day_offset = 0; day_offset <= index + 1; day_offset++) {
    const date = from.add(day_offset, 'day').format(DATE_FORMAT)

    for (const hour of slot_hours) {
      const slot = instant_at(date, hour)
      if (slot.isBefore(from)) continue
      if (remaining === 0) return slot
      remaining -= 1
    }
  }

  // Unreachable for a non-empty slot list; returned rather than thrown so a
  // misconfigured band degrades to a late window instead of a crashed page.
  return from.add(index + 2, 'day')
}

/**
 * Calculates when a given pick becomes passable.
 *
 * A pick's window is the moment that pick may be taken *out of order* — when
 * its team may select even though an earlier pick is still unmade. A team whose
 * preceding pick has already been made is on the clock regardless of the
 * window; the window governs only jumping a stalled team ahead of you.
 *
 * The rule is a frozen daily slate, and nothing else:
 *
 *   window(P) = published
 *
 *     boundary    the latest publication boundary at or before now that is also
 *                 at or after the latest resume; `draft_start` counts as one
 *     outstanding the picks with no selection AS OF that boundary, in pick order
 *     index       P's position within `outstanding`
 *     published   the index-th slot at or after `boundary`
 *
 * There is no second term, and in particular no selection-time input. A pick's
 * window is the slot the slate published for it, however fast or slow the board
 * then goes: a pick made nine hours after its own slot does not push the picks
 * behind it back, and a board that races ahead does not pull anything forward.
 * That is what makes the day's schedule knowable the night before, which is the
 * property the notice publishes.
 *
 * The outstanding set is computed as of the BOUNDARY, not as of now. A pick made
 * after the boundary stays in the set and keeps its index, so no later pick's
 * published slot moves until the next boundary. Filtering the live board
 * instead would shrink a jumped pick out of the set and pull later windows
 * EARLIER between boundaries — the freeze is what "publication" means.
 *
 * The invariant, stated exactly: BETWEEN two boundaries `window(P)` is
 * CONSTANT, because the only inputs that could move it — the outstanding set
 * and the boundary — are both fixed for the day. AT a boundary a window may
 * move EARLIER, because picks made since the last publication shrink P's index;
 * it can never move later. That move-up happens once a day, is calculated once,
 * and the slate announces it the night before.
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
 * @param {Date|string} [args.resumed_at] - The league's LATEST resume. A resume
 *   voids the standing publication: until a boundary arrives at or after it,
 *   every pick's window is null and no pick can be passed. A scalar rather than
 *   the interval array the open-seconds credit needed, because only the latest
 *   resume can matter — two pauses in a day are equivalent to one.
 *
 * @param {import('dayjs').Dayjs|Date|string|number} [args.until] - The caller's
 *   now, against which the governing boundary is resolved. Defaults to the
 *   current time. The SPA passes its frozen draft clock so boundaries resolve
 *   against the same clock every other display on the page reads.
 *
 * @returns {import('dayjs').Dayjs|null} The moment the pick becomes passable, or
 *   null when it has none — no boundary since the resume, or the pick was
 *   already made as of the boundary. LITERALLY null, never undefined:
 *   `now.isAfter(undefined)` is TRUE, so a missing return would make every
 *   stalled pick passable instead of blocking it, which is the exact inversion
 *   of what a null window means.
 *
 * @example
 * // The live 2026 config: 3-hour slots on an 11:00-24:00 Eastern band
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

  const boundary = get_publication_boundary({
    draft_start_timestamp,
    resumed_at,
    until,
    daily_window_start_hour,
    daily_window_end_hour
  })

  if (!boundary) return null

  const index = resolve_published_index({
    draft_picks,
    pick_number,
    boundary
  })

  if (index === null) return null

  const slot_hours = get_draft_slot_hours({
    daily_window_start_hour,
    daily_window_end_hour,
    pick_interval_hours
  })

  return get_draft_slot_at_index({
    from: boundary,
    index,
    slot_hours
  })
}

/**
 * When the pick currently on the clock becomes passable.
 *
 * The slot of the SECOND outstanding pick, which is the first moment anybody
 * else's window opens on a board where the head is stalled — so it is the
 * deadline the on-clock notification announces and the countdown the draft page
 * renders.
 *
 * It exists because the obvious spelling does not work under the slate. Both
 * former call sites passed `frontier.pick + 1`, and on a board with a gap that
 * names a pick that is already MADE (on the live 2026 board the frontier is
 * pick 3 and pick 4 is made), for which `getDraftWindow` correctly returns
 * null. Asking for the second outstanding pick asks the question the caller
 * actually has.
 *
 * @param {Object} args - The same window arguments, minus `pick_number`.
 * @returns {import('dayjs').Dayjs|null} Null when no boundary governs, or when
 *   fewer than two picks are outstanding — the last pick on the board cannot be
 *   passed by anyone.
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
  const boundary = get_publication_boundary({
    draft_start_timestamp,
    resumed_at,
    until,
    daily_window_start_hour,
    daily_window_end_hour
  })

  if (!boundary) return null

  const outstanding = resolve_outstanding_picks({ draft_picks, boundary })

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

/**
 * The pick numbers with no selection AS OF `boundary`, in pick order.
 *
 * A pick counts as made only when it carries a `selection_timestamp` at or
 * before the boundary. Reading the timestamp rather than the `pid` is what
 * makes the set a function of the boundary instead of of now, and it also
 * absorbs the client's reducer race, where a `pid` lands on a pick the instant
 * a selection is made and its timestamp arrives with the next load — such a
 * pick stays outstanding, which holds every later index still rather than
 * jittering the slate between refetches.
 *
 * Returns null with no board at all, which the caller reads as the pre-draft
 * case rather than as an empty board.
 */
function resolve_outstanding_picks({ draft_picks, boundary }) {
  if (!draft_picks || !draft_picks.length) return null

  return draft_picks
    .filter((draft_pick) => {
      if (!draft_pick.selection_timestamp) return true
      const selected_at = dayjs
        .unix(timestamptz_to_epoch(draft_pick.selection_timestamp))
        .tz(DRAFT_TIMEZONE)
      return selected_at.isAfter(boundary)
    })
    .map((draft_pick) => draft_pick.pick)
    .sort((a, b) => a - b)
}

/**
 * `pick_number`'s zero-based position in the outstanding set, or null when it
 * is not in it.
 *
 * With no board, every pick is outstanding by definition — the pre-draft case —
 * so pick N takes the (N-1)th slot.
 */
function resolve_published_index({ draft_picks, pick_number, boundary }) {
  const outstanding = resolve_outstanding_picks({ draft_picks, boundary })

  if (!outstanding) return pick_number - 1

  const index = outstanding.indexOf(pick_number)

  return index === -1 ? null : index
}

/**
 * Validates the interval, falling back to the default rather than silently
 * accepting a value that would produce an empty or infinite slot list.
 */
function resolve_pick_interval_hours(pick_interval_hours) {
  const interval = pick_interval_hours ?? DEFAULT_PICK_INTERVAL_HOURS

  if (!Number.isInteger(interval) || interval < 1) {
    console.warn(
      '[getDraftWindow] Invalid pick_interval_hours:',
      pick_interval_hours,
      `- falling back to ${DEFAULT_PICK_INTERVAL_HOURS}`
    )
    return DEFAULT_PICK_INTERVAL_HOURS
  }

  return interval
}
