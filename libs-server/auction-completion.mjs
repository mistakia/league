import db from '#db'
import { Roster, get_free_agent_period } from '#libs-shared'
import { current_season } from '#constants'
import getRoster from './get-roster.mjs'
import getLeague from './get-league.mjs'

/**
 * The league's unfilled active roster spots.
 *
 * This is what `spots_remaining` means, and it is NOT the count of unnominated
 * players. Rosters are fixed for the period, so unfilled spots is exactly the
 * number of players the auction still has to place, and it falls to zero when
 * the auction ends. Counting players instead would size the final block's
 * reservation against the several hundred free agents carrying a projection
 * rather than the ~69 signings.
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
 * Has the auction finished?
 *
 * DERIVED, NEVER RECORDED. An exhausted nomination rotation IS the
 * auction-complete condition: the socket's rotation walk returns null when no
 * team has active roster space, and every team signs exactly as many players as
 * it has open spots. So "no team has an open active spot" and "the rotation is
 * exhausted" are the same fact, and this computes it from the rosters.
 *
 * A recorded auction-end timestamp would reintroduce exactly the state the
 * timestamp collapse deleted, and it can disagree with the rosters in a way the
 * derivation cannot. It is also monotone -- rosters only fill during the period
 * -- so this never flips back to false once true.
 *
 * THE PERIOD END IS THE BACKSTOP. If one team never fills its last spot the
 * rotation never exhausts, so the auction is also over when the free agency
 * period is.
 */
export const is_auction_complete = async ({
  lid,
  season_year = current_season.year
}) => {
  const league = await getLeague({ lid })

  // A league with no free agency period has no auction to be waiting on.
  if (!league.free_agency_period_start) return true

  const period = get_free_agent_period(league)
  if (!current_season.now.isBefore(period.end)) return true

  const spots_remaining = await get_auction_spots_remaining({
    lid,
    season_year
  })
  return spots_remaining === 0
}

/**
 * May free agency waivers run for this league right now?
 *
 * WAIVERS OPEN WHEN THE AUCTION COMPLETES, and if it completes early they open
 * then. Before this the runners skipped a league only while `now` was BEFORE the
 * period start, which under the old shape meant "skip until the auction is
 * imminent" -- the auction was a point in time and waivers began the day after
 * it. Now the period start IS the auction start, so the same condition ran
 * waivers at 3pm every day OF the auction.
 *
 * The rules violation is the smaller half. A waiver award fills an active
 * roster spot WITHOUT passing through settlement, so a team leaves an eligible
 * set for a reason the auction never sees -- and eligibility monotonicity is the
 * assumption second-price settlement rests on.
 *
 * Practice squad waivers are deliberately NOT gated by this: a practice squad
 * add consumes no active roster spot and no cap, since `Roster.availableSpace`
 * and `availableCap` both read the ACTIVE roster only. They cannot move a team
 * in or out of an eligible set, so they cannot break monotonicity.
 */
export const may_process_free_agency_waivers = async ({
  lid,
  season_year = current_season.year
}) => {
  const league = await getLeague({ lid })

  if (!league.free_agency_period_start) return false

  const period = get_free_agent_period(league)

  // Before the period opens there is no free agency at all.
  if (current_season.now.isBefore(period.start)) return false

  return is_auction_complete({ lid, season_year })
}

export default {
  get_auction_spots_remaining,
  is_auction_complete,
  may_process_free_agency_waivers
}
