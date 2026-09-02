import dayjs from 'dayjs'

import db from '#db'
import { get_free_agent_period } from '#libs-shared'
import { current_season } from '#constants'
import emit_signal from './emit-signal.mjs'
import { get_auction_spots_remaining } from './auction-completion.mjs'
import debug from 'debug'

const log = debug('auction-final-block')

const SIGNAL_SOURCE = 'auction-final-block'

/**
 * When the mandatory final live block starts.
 *
 * PURE. This is the auction's forcing function, not a backstop -- election mode
 * carries no clock of any kind, so a nomination nobody elects on and a turn
 * nobody takes both sit indefinitely, and this is the ONLY mechanism that
 * guarantees the auction concludes before the Regular Season.
 *
 *   period_end - spots_remaining * pace - buffer
 *
 * `spots_remaining` is the league's UNFILLED ACTIVE ROSTER SPOTS, never the
 * count of unnominated players. Rosters are fixed for the period, so unfilled
 * spots is exactly the number of players the auction still has to place, and it
 * falls to zero when the auction ends. Sizing against players instead would
 * reserve time for the several hundred free agents carrying a projection rather
 * than the ~69 signings, and pull the block absurdly early.
 *
 * TWO GUARDS, and the first replaces a rule the design stated in terms of state
 * this deliberately does not keep.
 *
 * The design said the computed time may always move later and may move earlier
 * only outside the notice threshold, "after which the announced time locks".
 * Enforcing that literally needs a recorded announcement to compare against.
 * It does not need one, because the property that rule protects is that nobody
 * is pulled into a MANDATORY live block on less notice than the league
 * configured -- so flooring the result at `now + notice` delivers it directly,
 * with no table, no announcement record and no second source of truth. The
 * computed time is monotone anyway: spots only fall, so the raw computation
 * only moves later, and the one lever that can move it earlier is a
 * commissioner-override release freeing a spot. That is exactly the case the
 * floor catches.
 *
 * The second guard is the past. A computation landing before now means the
 * window inequality has already failed and the design's only termination
 * guarantee is gone, so it is clamped to now and reported -- failing silently
 * here is the worst available outcome.
 *
 * @param {object} params
 * @param {dayjs.Dayjs} params.period_end
 * @param {number} params.spots_remaining
 * @param {number} params.auction_block_notice_minutes
 * @param {number} params.auction_final_block_pace_minutes
 * @param {number} params.auction_final_block_buffer_hours
 * @param {dayjs.Dayjs} params.now
 * @returns {{final_block_at: dayjs.Dayjs, computed_at: dayjs.Dayjs,
 *   is_in_the_past: boolean, is_held_off_by_notice: boolean,
 *   spots_remaining: number}}
 */
export const calculate_final_block = ({
  period_start,
  period_end,
  spots_remaining,
  auction_block_notice_minutes,
  auction_final_block_pace_minutes,
  auction_final_block_buffer_hours,
  now
}) => {
  const computed_at = dayjs(period_end)
    .subtract(spots_remaining * auction_final_block_pace_minutes, 'minute')
    .subtract(auction_final_block_buffer_hours, 'hour')

  // NOTICE IS OWED FROM WHEN THE BLOCK BECOMES KNOWABLE, AND THAT IS THE PERIOD
  // START -- not `now`. The final block carries no opt-in and no unanimity; it
  // is published from the first read of the calendar and every term in it is
  // configuration or rosters, so the league can see it coming for the whole
  // period.
  //
  // Anchored to `now` this was a RECEDING HORIZON, and it is the reason the
  // clock could never reach the block at all: every read moved it another hour
  // out, so `now >= final_block_at` stayed false until `now + notice` passed the
  // period end, at which point it collapsed to `now`. On the real 2026 shape
  // that put the auction's ONLY termination guarantee 55 minutes before the
  // period closed, against a computation that had reserved three and a half
  // hours to place 47 players -- the pace reservation and the buffer were
  // computed and then thrown away. It was invisible to a spec asserting at one
  // instant, where `now + notice` is exactly what a correct floor would produce.
  const notice_floor = dayjs(period_start).add(
    auction_block_notice_minutes,
    'minute'
  )

  // "IN THE PAST" MEANS THE WINDOW FAILED, NOT THAT THE BLOCK HAS STARTED. The
  // predicate is against the period START, not against `now`: once the clock
  // passes the computed time the final block is simply RUNNING, which is the
  // normal state for the last hours of every auction. Compared against `now` it
  // read as a failure on every read from that moment on and pushed the block
  // another notice-width out each time -- the same receding horizon as the floor
  // above, reached by the other branch.
  const is_in_the_past = computed_at.isBefore(period_start)
  const is_held_off_by_notice =
    !is_in_the_past && computed_at.isBefore(notice_floor)

  let final_block_at = computed_at
  if (is_in_the_past || is_held_off_by_notice) {
    // The league is owed its notice either way, measured from the period start,
    // which is the earliest instant the block could have been known.
    final_block_at = notice_floor
  }

  // The floor must never push the block past the period it exists to finish
  // inside. If it would, the window has failed and the block starts now.
  if (final_block_at.isAfter(period_end)) {
    final_block_at = dayjs(now)
  }

  return {
    final_block_at,
    computed_at,
    is_in_the_past,
    is_held_off_by_notice,
    spots_remaining
  }
}

export const describe_final_block = (result) => {
  const at = result.final_block_at.toISOString()
  if (result.is_in_the_past) {
    return (
      `auction final block computed INTO THE PAST at ${result.computed_at.toISOString()} ` +
      `with ${result.spots_remaining} spots remaining; clamped to ${at}`
    )
  }
  if (result.is_held_off_by_notice) {
    return (
      `auction final block held off by the notice threshold: computed ` +
      `${result.computed_at.toISOString()}, announced ${at}`
    )
  }
  return `auction final block at ${at} with ${result.spots_remaining} spots remaining`
}

/**
 * The final block for a live league, read from its configuration and rosters.
 *
 * Recomputed on demand rather than stored. Nothing here is a decision -- every
 * term is either configuration or derived from the rosters -- so a column would
 * be a second source of truth that can disagree with the board.
 */
export const get_auction_final_block = async ({
  lid,
  season_year = current_season.year,
  now = current_season.now
}) => {
  const rows = await db('seasons').where({ lid, season_year })
  const season = rows[0]
  if (!season)
    throw new Error(`no season row for league ${lid} in ${season_year}`)

  const period = get_free_agent_period(season)
  if (!period.start) return null

  const spots_remaining = await get_auction_spots_remaining({
    lid,
    season_year
  })

  const result = calculate_final_block({
    period_start: period.start,
    period_end: period.end,
    spots_remaining,
    auction_block_notice_minutes: season.auction_block_notice_minutes,
    auction_final_block_pace_minutes: season.auction_final_block_pace_minutes,
    auction_final_block_buffer_hours: season.auction_final_block_buffer_hours,
    now
  })

  log(describe_final_block(result))

  if (result.is_in_the_past) {
    // An output oracle distinct from the exit code, per the pipeline-failure
    // rule: a caller that only checks whether this threw learns nothing about
    // how far into the past the block landed, and that number is the whole
    // actionable content.
    await emit_signal({
      source: SIGNAL_SOURCE,
      kind: 'pipeline_failure',
      severity: 'high',
      title: `league ${lid} auction final block computed into the past`,
      payload: {
        lid,
        season_year,
        spots_remaining,
        computed_at: result.computed_at.toISOString(),
        clamped_to: result.final_block_at.toISOString()
      },
      dedup_key: `pipeline_failure:${SIGNAL_SOURCE}:${lid}`
    })
  }

  // The period end travels with the result because every consumer needs both:
  // mode resolution holds the auction live from the final block UNTIL the period
  // ends, and the calendar draws the window the grid covers.
  return { ...result, period_end: period.end }
}

export default {
  calculate_final_block,
  describe_final_block,
  get_auction_final_block
}
