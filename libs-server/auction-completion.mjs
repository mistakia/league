import db from '#db'
import { Roster, get_free_agent_period } from '#libs-shared'
import { current_season, transaction_types } from '#constants'
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

/**
 * Is the free agency auction currently holding rosters fixed?
 *
 * The complement of `is_auction_complete` inside the period, with the
 * pre-period window carved out: before the period opens there is no auction to
 * be holding anything, and `is_auction_complete` alone cannot tell that from a
 * not-yet-complete state.
 *
 * The freeze is what makes the derivation in `is_auction_complete` monotone:
 * "no team has an open active spot" only stays true because nothing may add one
 * back while the auction runs. A caller enforcing the freeze must also check
 * the player's source slot, since a practice squad activation moves no active
 * roster row and so is untouched by it.
 */
export const is_auction_in_progress = async ({
  lid,
  season_year = current_season.year
}) => {
  const league = await getLeague({ lid })

  if (!league.free_agency_period_start) return false

  const period = get_free_agent_period(league)

  // Before the period opens there is no auction.
  if (current_season.now.isBefore(period.start)) return false

  return !(await is_auction_complete({ lid, season_year }))
}

/**
 * Whose nomination turn is it, from the auction's transaction log.
 *
 * PURE, and the ONE implementation of the rotation rule. The socket used to own
 * this outright, reading its own cached `_transactions` and `_teams`, which made
 * the rule unreachable from the REST paths that settle a player in election
 * mode -- so a settlement advanced the turn on the server and left every
 * connected client showing the previous team on the clock. The nominate button
 * is gated on that value, so the team whose turn it now was had no control to
 * act with until they reloaded.
 *
 * The rule itself: find the nomination that opened the newest player -- the
 * `AUCTION_BID` row whose next-older neighbour is absent or is an
 * `AUCTION_PROCESSED`. If a player is still open the nominator holds the clock;
 * otherwise the turn walks the draft order from the last nominator and stops at
 * the first team with an open active spot. `null` means every team is full,
 * which IS the auction-complete condition rather than an error.
 *
 * @param {object} params
 * @param {object[]} params.transactions AUCTION_BID and AUCTION_PROCESSED rows,
 *   newest first by `occurred_at` then `transaction_id`.
 * @param {Array<number>} params.tids team ids in `draft_order`.
 * @param {object[]} params.teams team rows carrying `team_id` and `availableSpace`.
 * @returns {number|null}
 */
export const resolve_nominating_team_id = ({ transactions, tids, teams }) => {
  const latest = transactions[0]
  if (!latest) return tids[0]

  const last_nomination = transactions.find((transaction, index) => {
    const older = transactions[index + 1]
    return (
      transaction.type === transaction_types.AUCTION_BID &&
      (!older || older.type === transaction_types.AUCTION_PROCESSED)
    )
  })

  // A log carrying AUCTION_PROCESSED rows with no opening bid behind them is
  // not a state this auction reaches on its own, but a cloned board can arrive
  // that way. Fall back to the head of the rotation rather than throwing on an
  // undefined row, which is what the socket's own copy of this did.
  if (!last_nomination) return tids[0]

  if (latest.type === transaction_types.AUCTION_BID) {
    return last_nomination.tid
  }

  const index = tids.indexOf(last_nomination.tid)
  const rotation = tids.slice(index + 1).concat(tids.slice(0, index + 1))

  for (const tid of rotation) {
    const team = teams.find((candidate) => candidate.team_id === tid)
    if (team && team.availableSpace) return tid
  }

  return null
}

/**
 * Whose nomination turn is it, read from the database rather than from a cache.
 *
 * IN ELECTION MODE THE SOCKET IS NOT THE WRITER, so a REST settlement has to be
 * able to answer this without a socket instance -- and reading the database
 * rather than a cache is also the correct side of the staleness invariant this
 * subsystem keeps tripping over.
 */
export const get_auction_nominating_team_id = async ({
  lid,
  season_year = current_season.year
}) => {
  const league = await getLeague({ lid })
  const teams = (await db('teams').where({ lid, season_year })).sort(
    (a, b) => a.draft_order - b.draft_order
  )
  const tids = teams.map((team) => team.team_id)
  if (!tids.length) return null

  for (const team of teams) {
    const roster = new Roster({
      roster: await getRoster({ tid: team.team_id }),
      league
    })
    team.availableSpace = roster.availableSpace
  }

  const transactions = await db('transactions')
    .whereIn('tid', tids)
    .where('season_year', season_year)
    .whereIn('type', [
      transaction_types.AUCTION_BID,
      transaction_types.AUCTION_PROCESSED
    ])
    .orderBy('occurred_at', 'desc')
    .orderBy('transaction_id', 'desc')

  return resolve_nominating_team_id({ transactions, tids, teams })
}

export default {
  get_auction_spots_remaining,
  is_auction_complete,
  may_process_free_agency_waivers,
  is_auction_in_progress,
  resolve_nominating_team_id,
  get_auction_nominating_team_id
}
