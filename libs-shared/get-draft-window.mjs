import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

import timestamptz_to_epoch from './timestamptz-to-epoch.mjs'
import {
  DRAFT_TIMEZONE,
  HOURS_PER_DAY,
  is_open_hour,
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
 * The calendar date one day after `date`.
 *
 * Resolved at NOON so the addition cannot land on an hour that a DST
 * transition removes or repeats; only the date is read off the result.
 */
const next_date_after = (date) =>
  dayjs.tz(`${date} 12:00:00`, DRAFT_TIMEZONE).add(1, 'day').format(DATE_FORMAT)

/**
 * Rolls forward to the band's opening hour, if `time` is outside the band.
 *
 * A time already inside the band is returned untouched. One outside it lands on
 * the opening hour of its own date when it falls before the band opens, and on
 * the next date's opening hour when it falls after the band closes.
 *
 * Built from a `(date, hour)` pair rather than by adding hours, for the reason
 * `instant_at` gives: hour arithmetic across a DST transition drifts by the
 * offset change. Walking 11 hours forward from midnight on the November
 * fall-back date reaches 10:00, not 11:00, because one of those hours is lived
 * twice — which is exactly the defect this walk shipped with historically.
 */
function advance_to_open_hour(time, band) {
  if (is_open_hour(time.hour(), band)) return time

  const date = time.format(DATE_FORMAT)

  if (time.hour() < band.start_hour) return instant_at(date, band.start_hour)

  return instant_at(next_date_after(date), band.start_hour)
}

/**
 * Advances one cadence step, landing on an open hour.
 *
 * A step is `interval` OPEN hours, counted one at a time and skipping the
 * overnight gap — so a step begun late in the band lands the next morning and
 * consumes only the hours the band was actually open for. That is why the day's
 * slot times DRIFT once the band's width is not a multiple of the interval: a
 * 13-hour band at a 3-hour interval seats five picks at 11, 14, 17, 20 and 23,
 * and the sixth lands at 13:00 rather than 11:00, because one of its three
 * hours was spent closing out the previous day.
 *
 * Counted as a `(date, hour)` pair for the DST reason above, and rebuilt into
 * an instant once, at the end.
 */
function advance_one_step({ time, interval, band }) {
  let date = time.format(DATE_FORMAT)
  let hour = time.hour()

  for (let open_hour = 0; open_hour < interval; open_hour++) {
    hour += 1

    if (!is_open_hour(hour, band)) {
      date = next_date_after(date)
      hour = band.start_hour
    }
  }

  return instant_at(date, hour)
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
 * Calculates when a given pick becomes passable.
 *
 * A pick's window is the moment that pick may be taken *out of order* — when
 * its team may select even though an earlier pick is still unmade. A team whose
 * preceding pick has already been made is on the clock regardless of the
 * window; the window governs only jumping a stalled team ahead of you.
 *
 * The rule is the historical anchored walk, RECOMPUTED ONCE A DAY:
 *
 *   window(P) = walk(anchor, steps)
 *
 *     boundary   the latest publication boundary at or before now that is also
 *                at or after the latest resume; `draft_start` counts as one
 *     as-of      the board as it stood AT that boundary: a pick counts as made
 *                only if its selection landed at or before it
 *     anchor     the highest-numbered pick below P that is made as of the
 *                boundary, taken at the LATER of its selection instant and the
 *                boundary; with nothing made ahead of P, `draft_start`
 *     steps      how many picks between the anchor and P are still unmade as of
 *                the boundary
 *     walk       start at the anchor, advance to an open hour, then take one
 *                step of `pick_interval_hours` OPEN hours per step
 *
 * Two things about `anchor` carry the whole design.
 *
 * It is the highest-numbered made pick below P rather than the latest by TIME,
 * which is what keeps a gap board honest: the pick behind a just-made pick X
 * measures from X, not from whoever happened to click most recently. Counting
 * only UNMADE picks as steps is the same idea — a jumped pick is already made,
 * so it consumes no step and the picks behind it do not inherit a stale queue.
 *
 * And it is clamped forward to the boundary, which is the once-a-day part. A
 * selection made during the day moves nothing until midnight; at midnight the
 * remaining picks are laid out afresh from that morning's opening hour, and the
 * picks made during the day have left the queue, so the ones behind them move
 * up. That is the shift, calculated once, knowable the night before. The clamp
 * is also what stops a long pause from stranding the board: without it every
 * window on a five-day-old anchor is already in the past, and the whole
 * remaining board is passable the instant the slate publishes.
 *
 * A pick is ON THE CLOCK from the start of its window, whether or not the pick
 * ahead of it has been selected. Consecutive steps are one interval apart, so a
 * pick has the clock to itself for a full interval before the next one joins —
 * that is the exclusive-interval guarantee, and it comes from the step spacing.
 *
 * The invariant: BETWEEN two boundaries `window(P)` is CONSTANT, since both the
 * as-of board and the anchor are fixed for the day. AT a boundary it is re-laid
 * from the new morning, so it moves EARLIER by one step per pick made during
 * the day, and LATER by the day the boundary itself advanced. A day on which
 * nobody picks therefore rolls every window forward 24 hours; a day that
 * consumes more than a day of steps pulls them back. "Windows only ever move
 * up" is false and must not be said.
 *
 * Note the slot times DRIFT across days whenever the band's width is not a
 * multiple of the interval — see `advance_one_step`. The first day after any
 * boundary always opens at the band's opening hour, because the anchor is
 * clamped to that boundary; only picks landing on a LATER day drift, and the
 * next boundary re-lays them anyway.
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

  const band = resolve_daily_window({
    daily_window_start_hour,
    daily_window_end_hour
  })
  const interval = resolve_pick_interval_hours(pick_interval_hours)
  const as_of_boundary = resolve_board_as_of({ draft_picks, boundary })

  // A pick already made as of the boundary has no window to open. Literally
  // null, for the reason the return doc gives.
  const own_row = as_of_boundary?.find((row) => row.pick === pick_number)
  if (own_row && own_row.selection_timestamp) return null

  const { anchor, steps } = resolve_anchor({
    draft_start_timestamp,
    as_of_boundary,
    pick_number,
    boundary
  })

  let window_open_at = advance_to_open_hour(anchor, band)
  for (let step = 0; step < steps; step++) {
    window_open_at = advance_one_step({ time: window_open_at, interval, band })
  }

  return window_open_at
}

/**
 * The board as it stood AT the boundary.
 *
 * A pick counts as made only when it carries a `selection_timestamp` at or
 * before the boundary; anything later is stripped back to unmade, which is what
 * freezes the day. Reading the timestamp rather than the `pid` also absorbs the
 * client's reducer race, where a `pid` lands the instant a selection is made and
 * its timestamp arrives with the next load — such a pick stays outstanding,
 * holding the queue still rather than jittering it between refetches.
 *
 * Returns null with no board at all, which the caller reads as the pre-draft
 * case rather than as an empty board.
 */
function resolve_board_as_of({ draft_picks, boundary }) {
  if (!draft_picks || !draft_picks.length) return null

  return draft_picks.map((draft_pick) => {
    if (!draft_pick.selection_timestamp) return draft_pick

    const selected_at = dayjs
      .unix(timestamptz_to_epoch(draft_pick.selection_timestamp))
      .tz(DRAFT_TIMEZONE)

    if (!selected_at.isAfter(boundary)) return draft_pick

    return { ...draft_pick, pid: null, selection_timestamp: null }
  })
}

/**
 * The instant to walk from, and how many steps past it the pick sits.
 *
 * The anchor is the highest-numbered pick below the target that is made as of
 * the boundary, and the steps are the picks still unmade between the two. With
 * nothing made ahead of it the anchor is `draft_start`, standing in for the
 * completion of a notional pick 0, and every preceding pick is a step.
 *
 * The returned anchor is CLAMPED FORWARD to the boundary. A selection is only
 * ever at or before the boundary (`resolve_board_as_of` guarantees it), so in
 * practice the clamp always fires and the walk starts from the boundary — which
 * is the once-a-day recomputation. The selection instant still decides WHICH
 * pick anchors and therefore how many steps the target sits behind it.
 */
function resolve_anchor({
  draft_start_timestamp,
  as_of_boundary,
  pick_number,
  boundary
}) {
  const clamp = (instant) => (instant.isBefore(boundary) ? boundary : instant)

  const preceding = (as_of_boundary ?? [])
    .filter((draft_pick) => draft_pick.pick < pick_number)
    .sort((a, b) => a.pick - b.pick)

  // A reverse loop rather than findLast: this module is isomorphic and reaches
  // the SPA bundle, where preset-env transpiles syntax but leaves a runtime
  // array method to a polyfill that is not configured here.
  let anchor_index = -1
  for (let index = preceding.length - 1; index >= 0; index--) {
    if (preceding[index].selection_timestamp) {
      anchor_index = index
      break
    }
  }

  if (anchor_index === -1) {
    return {
      anchor: clamp(dayjs.unix(draft_start_timestamp).tz(DRAFT_TIMEZONE)),
      // With no board at all every preceding pick is unmade by definition,
      // which is the pre-draft case the bare `pick_number` stands in for.
      steps: preceding.length || Math.max(pick_number - 1, 0)
    }
  }

  return {
    anchor: clamp(
      dayjs
        .unix(timestamptz_to_epoch(preceding[anchor_index].selection_timestamp))
        .tz(DRAFT_TIMEZONE)
    ),
    steps: preceding
      .slice(anchor_index + 1)
      .filter((draft_pick) => !draft_pick.selection_timestamp).length
  }
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
