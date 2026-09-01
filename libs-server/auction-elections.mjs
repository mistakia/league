import db from '#db'
import { Roster } from '#libs-shared'
import { current_season } from '#constants'
import {
  lock_auction_for_league,
  get_active_auction_nomination,
  get_auction_team_capacities,
  get_outstanding_team_ids,
  settle_auction_player_if_complete
} from './auction-settlement.mjs'
import getRoster from './get-roster.mjs'
import getLeague from './get-league.mjs'
import debug from 'debug'

const log = debug('auction-elections')

// Follows restricted-free-agency-bid-error.mjs: a factory rather than a class,
// so the caller can distinguish a rejected instruction from a database fault
// without matching on message text.
export const auction_election_error = (message) =>
  Object.assign(new Error(message), { is_auction_election_error: true })

const get_live_election = async ({ trx, lid, season_year, pid, tid }) => {
  const rows = await trx('auction_elections')
    .where({ lid, season_year, pid, tid })
    .whereNull('withdrawn_at')
    .whereNull('settled_at')
  return rows[0]
}

/**
 * Record or revise a team's election on a player.
 *
 * A maximum and a decline are ONE operation: `maximum_bid` null is the decline.
 * Both are revisable until the player settles, because both are INSTRUCTIONS
 * rather than bids -- an authorization to bid up to a ceiling, and authorization
 * is revocable going forward. What is never rescindable is a bid already placed,
 * which is why withdrawing a $30 ceiling while leading at $11 leaves the team
 * leading at $11: that rule lives in `build_auction_claims`, not here.
 *
 * Elections are accepted on ANY player at ANY point in the free agency period,
 * before or after nomination. Submission-time validation below runs for
 * immediate feedback only and is never authoritative -- standing maximums across
 * many players will routinely exceed a team's budget in aggregate, which is
 * expected and must not be rejected. Each is checked against remaining budget
 * and roster space when its own player settles.
 */
export const submit_auction_election = async ({
  lid,
  tid,
  pid,
  user_id,
  maximum_bid = null,
  season_year = current_season.year
}) => {
  if (maximum_bid !== null && maximum_bid !== undefined) {
    if (!Number.isInteger(maximum_bid) || maximum_bid < 0) {
      throw auction_election_error('maximum bid must be a whole dollar')
    }
  }

  const normalized_maximum = maximum_bid === undefined ? null : maximum_bid

  const league = await getLeague({ lid })
  const players = await db('player').where('pid', pid)
  const player_row = players[0]
  if (!player_row) {
    throw auction_election_error('unknown player')
  }

  const rostered = await db('rosters_players')
    .where({ lid, season_year, pid })
    .limit(1)
  if (rostered.length) {
    throw auction_election_error('player is already rostered')
  }

  return db.transaction(async (trx) => {
    // Under the same lock the settlement takes, and held across the write AND
    // the completeness check below. Two teams filing the last two elections at
    // once could otherwise each observe the other missing, and with no clock in
    // election mode the nomination would hang forever -- the exact shape of the
    // Redis pass race this design retires.
    await lock_auction_for_league({ trx, lid })

    const nomination = await get_active_auction_nomination({
      lid,
      season_year,
      db_client: trx
    })
    const is_active_nomination = nomination && nomination.pid === pid

    // Nominating is bidding, so a team cannot decline the player it nominated.
    if (
      is_active_nomination &&
      normalized_maximum === null &&
      nomination.nominating_team_id === tid
    ) {
      throw auction_election_error(
        'cannot decline a player you nominated -- nominating is bidding'
      )
    }

    const now = new Date()
    const existing = await get_live_election({
      trx,
      lid,
      season_year,
      pid,
      tid
    })

    if (existing) {
      const is_same_amount = existing.maximum_bid === normalized_maximum
      await trx('auction_elections')
        .where('election_id', existing.election_id)
        .update({
          user_id,
          maximum_bid: normalized_maximum,
          // `amount_set_at` moves ONLY when the amount moves. The tie rule
          // compares when the winning amount was last set, so rewriting it on a
          // no-op resubmit would let a manager refresh their priority for free.
          amount_set_at: is_same_amount ? existing.amount_set_at : now
        })
    } else {
      await trx('auction_elections').insert({
        lid,
        season_year,
        pid,
        tid,
        user_id,
        maximum_bid: normalized_maximum,
        submitted_at: now,
        amount_set_at: now
      })
    }

    log(
      `team ${tid} elected ${normalized_maximum === null ? 'decline' : `$${normalized_maximum}`} on ${pid}`
    )

    const settlement = is_active_nomination
      ? await settle_auction_player_if_complete({
          lid,
          season_year,
          league,
          trx
        })
      : null

    return { settlement }
  })
}

/**
 * Withdraw a live election.
 *
 * Withdrawing a DECLINE puts the team back in the outstanding set and settlement
 * waits for them again -- the un-pass that did not exist anywhere in the
 * codebase under slow mode, where a misclicked pass could only be undone by
 * another team bidding.
 *
 * Withdrawing a MAXIMUM stops future engine action and nothing more. If the team
 * is leading on a bid already placed, it stays leading at that amount.
 */
export const withdraw_auction_election = async ({
  lid,
  tid,
  pid,
  season_year = current_season.year
}) =>
  db.transaction(async (trx) => {
    await lock_auction_for_league({ trx, lid })

    const existing = await get_live_election({
      trx,
      lid,
      season_year,
      pid,
      tid
    })
    if (!existing) {
      throw auction_election_error('no live election to withdraw')
    }

    await trx('auction_elections')
      .where('election_id', existing.election_id)
      .update({ withdrawn_at: new Date() })

    log(`team ${tid} withdrew its election on ${pid}`)

    // Withdrawing a maximum can COMPLETE a set rather than only reopen one: the
    // withdrawing team keeps its claim if it has a bid on record, and the
    // remaining claims may now be the whole eligible field.
    const settlement = await settle_auction_player_if_complete({
      lid,
      season_year,
      trx
    })

    return { settlement }
  })

/**
 * Every live election a team holds, with the effective maximum each would carry
 * if its player settled right now.
 *
 * MAXIMUMS ARE PRIVATE. This is scoped to one team on purpose and there is no
 * commissioner variant -- in this league the commissioner is a competing
 * manager, so the surface that would most naturally show every ceiling is the
 * one that must not.
 */
export const get_team_auction_elections = async ({
  lid,
  tid,
  season_year = current_season.year
}) => {
  const elections = await db('auction_elections')
    .where({ lid, season_year, tid })
    .whereNull('withdrawn_at')
    .orderBy('amount_set_at', 'asc')

  const league = await getLeague({ lid })
  const roster = new Roster({ roster: await getRoster({ tid }), league })

  return elections.map((election) => ({
    ...election,
    // A team can win an early player and leave a later ceiling unfundable.
    // Capping rather than invalidating keeps them in contention at a price they
    // can afford, so this is the number the standing-elections view shows -- and
    // an aggregate-overcommitment warning is deliberately NOT shown, because
    // summing several hundred maximums exceeds a $200 cap almost always and a
    // flag that is always on says nothing.
    effective_maximum:
      election.maximum_bid === null
        ? null
        : Math.min(election.maximum_bid, roster.availableCap),
    is_capped:
      election.maximum_bid !== null &&
      election.maximum_bid > roster.availableCap
  }))
}

/**
 * Which teams the auction is still waiting on for the open player, by team id.
 *
 * Names WHO the auction is waiting on and never WHAT they intend. With no
 * forcing function in election mode, making that visible IS the forcing
 * function.
 */
export const get_auction_settlement_status = async ({
  lid,
  season_year = current_season.year
}) => {
  const nomination = await get_active_auction_nomination({ lid, season_year })
  if (!nomination) {
    return { nomination: null, outstanding_election_tids: [] }
  }

  const league = await getLeague({ lid })
  const players = await db('player').where('pid', nomination.pid)
  const teams = await db('teams').where({ lid, season_year })

  const capacities = await get_auction_team_capacities({
    team_ids: teams.map((team) => team.team_id),
    league,
    player_position: players[0].primary_position,
    current_price: nomination.current_price
  })

  const elections = await db('auction_elections')
    .where({ lid, season_year, pid: nomination.pid })
    .whereNull('withdrawn_at')
    .whereNull('settled_at')

  return {
    nomination: {
      pid: nomination.pid,
      current_price: nomination.current_price,
      opening_bid: nomination.opening_bid,
      nominating_team_id: nomination.nominating_team_id
    },
    outstanding_election_tids: get_outstanding_team_ids({
      capacities,
      elections,
      bids: nomination.bids,
      nominating_team_id: nomination.nominating_team_id
    })
  }
}

export default {
  submit_auction_election,
  withdraw_auction_election,
  get_team_auction_elections,
  get_auction_settlement_status,
  auction_election_error
}
