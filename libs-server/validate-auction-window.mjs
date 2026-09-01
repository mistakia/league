import dayjs from 'dayjs'

import db from '#db'
import { Roster, get_free_agent_period } from '#libs-shared'
import {
  current_season,
  AUCTION_MINIMUM_ELECTION_WINDOW_HOURS
} from '#constants'
import getRoster from './get-roster.mjs'
import getLeague from './get-league.mjs'

/**
 * Does the free agency period leave enough room for the auction to terminate?
 *
 * PURE. The season dates are not a judgment call -- the configuration itself
 * states what the window has to be, so the requirement is arithmetic and can be
 * checked rather than argued. Without this the violation surfaces as the final
 * block computing into the PAST, which is the design's only termination
 * guarantee failing silently.
 *
 * The final block lands at `period_end - spots * pace - buffer`, and its notice
 * threshold opens `notice` before that. For the threshold to open after the
 * auction has begun, with real election time in between:
 *
 *   period_end - period_start
 *     >= spots * pace + notice + buffer + minimum election window
 *
 * Measured from the PERIOD START, because the period is the auction: elections
 * and nominations both open there and there is no separate scheduled instant.
 *
 * @returns {{is_valid: boolean, available_hours: number, required_hours: number,
 *   shortfall_hours: number, terms: object}}
 */
export const calculate_auction_window = ({
  period_start,
  period_end,
  spots_remaining,
  auction_block_notice_minutes,
  auction_final_block_pace_minutes,
  auction_final_block_buffer_hours
}) => {
  const pace_hours = (spots_remaining * auction_final_block_pace_minutes) / 60
  const notice_hours = auction_block_notice_minutes / 60

  const required_hours =
    pace_hours +
    notice_hours +
    auction_final_block_buffer_hours +
    AUCTION_MINIMUM_ELECTION_WINDOW_HOURS

  const available_hours =
    dayjs(period_end).diff(dayjs(period_start), 'minute') / 60

  const shortfall_hours = required_hours - available_hours

  return {
    is_valid: shortfall_hours <= 0,
    available_hours,
    required_hours,
    // Rounded only in the report; the comparison above uses full precision, so
    // a window short by four minutes fails rather than rounding to pass.
    shortfall_hours,
    terms: {
      spots_remaining,
      pace_hours,
      notice_hours,
      buffer_hours: auction_final_block_buffer_hours,
      minimum_election_window_hours: AUCTION_MINIMUM_ELECTION_WINDOW_HOURS
    }
  }
}

/**
 * A one-line report naming the shortfall in hours.
 *
 * The output oracle is distinct from the exit code on purpose: a caller that
 * checks only whether this threw learns nothing about how short the window is,
 * and "move the period start 5.3 hours earlier" is the whole actionable content.
 */
export const describe_auction_window = (result) => {
  const round = (value) => Math.round(value * 10) / 10

  if (result.is_valid) {
    return `auction window OK: ${round(result.available_hours)}h available against ${round(result.required_hours)}h required`
  }

  const { terms } = result
  return (
    `auction window SHORT by ${round(result.shortfall_hours)}h: ` +
    `${round(result.available_hours)}h available against ${round(result.required_hours)}h required ` +
    `(${terms.spots_remaining} spots x pace = ${round(terms.pace_hours)}h, ` +
    `notice ${round(terms.notice_hours)}h, buffer ${terms.buffer_hours}h, ` +
    `election window ${terms.minimum_election_window_hours}h)`
  )
}

/**
 * The league's unfilled active roster spots.
 *
 * This is what `spots_remaining` means, and it is NOT the count of unnominated
 * players. Rosters are fixed for the period, so unfilled spots is exactly the
 * number of players the auction still has to place, and it falls to zero when
 * the auction ends. Counting players instead would size the reservation against
 * the several hundred free agents carrying a projection rather than the ~69
 * signings, and pull the final block absurdly early.
 */
export const get_auction_spots_remaining = async ({
  lid,
  season_year = current_season.year
}) => {
  const league = await getLeague({ lid })
  const teams = await db('teams').where({ lid, season_year })

  let spots = 0
  for (const team of teams) {
    const roster = new Roster({
      roster: await getRoster({ tid: team.team_id }),
      league
    })
    spots += Math.max(roster.availableSpace, 0)
  }
  return spots
}

/**
 * The constitutional bound on the period end, derived rather than trusted.
 *
 * Article XII Section 6 puts the end of the free agency period at the start of
 * the Regular Season, which is the first Tuesday of week 1 -- nine days before
 * the always-Thursday opener, not opening day itself. The operator's two-hour
 * margin sits inside that.
 *
 * Derived from the `Season` anchor because the column has no derivation and no
 * validation anywhere: `get_free_agent_period` reads it raw, which is exactly
 * how it drifted two hours PAST the boundary with nothing complaining.
 */
export const derive_free_agency_period_end_limit = () =>
  current_season.regular_season_start.add(1, 'week').subtract(2, 'hours')

/**
 * Validate a league-season's auction window against the live configuration.
 *
 * Call at league-season configuration write and again at auction start. Returns
 * the verdict rather than throwing, so a caller can decide between refusing a
 * write and raising a signal on a schedule.
 */
export const validate_auction_window = async ({
  lid,
  season_year = current_season.year
}) => {
  const rows = await db('seasons').where({ lid, season_year })
  const season = rows[0]
  if (!season) {
    throw new Error(`no season row for league ${lid} in ${season_year}`)
  }

  const period = get_free_agent_period(season)
  if (!period.start) {
    return {
      is_valid: false,
      available_hours: 0,
      required_hours: 0,
      shortfall_hours: 0,
      terms: {},
      message: `league ${lid} has no free_agency_period_start, so it has no free agency period`
    }
  }

  const spots_remaining = await get_auction_spots_remaining({
    lid,
    season_year
  })

  const result = calculate_auction_window({
    period_start: period.start,
    period_end: period.end,
    spots_remaining,
    auction_block_notice_minutes: season.auction_block_notice_minutes,
    auction_final_block_pace_minutes: season.auction_final_block_pace_minutes,
    auction_final_block_buffer_hours: season.auction_final_block_buffer_hours
  })

  // A separate failure from the inequality, and reported alongside it rather
  // than instead of it: a window can be long enough AND still run past the
  // constitutional boundary.
  const period_end_limit = derive_free_agency_period_end_limit()
  const is_period_end_within_limit = !dayjs(period.end).isAfter(
    period_end_limit
  )

  return {
    ...result,
    is_valid: result.is_valid && is_period_end_within_limit,
    is_period_end_within_limit,
    period_end_limit,
    message: is_period_end_within_limit
      ? describe_auction_window(result)
      : `${describe_auction_window(result)}; free_agency_period_end is after the Article XII Section 6 limit of ${period_end_limit.toISOString()}`
  }
}

export default {
  calculate_auction_window,
  describe_auction_window,
  get_auction_spots_remaining,
  derive_free_agency_period_end_limit,
  validate_auction_window
}
