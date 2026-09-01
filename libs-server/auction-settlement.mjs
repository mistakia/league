import db from '#db'
import { Roster } from '#libs-shared'
import {
  current_season,
  roster_slot_types,
  transaction_types,
  auction_election_outcomes
} from '#constants'
import { resolve_auction_player } from './resolve-auction-player.mjs'
import getRoster from './get-roster.mjs'
import getLeague from './get-league.mjs'
import debug from 'debug'

const log = debug('auction-settlement')

// Every settlement for a league serializes on this lock, taken inside the
// settling transaction and released when it commits.
//
// It is the whole answer to the failure this design retires. The Redis pass
// mechanic recorded a pass with a non-atomic read-modify-write on a JSON array
// and then asked, separately, whether the nomination was complete; two teams
// acting at once could each observe the other missing, so neither settled and
// the nomination hung indefinitely with no timer to rescue it. Holding the lock
// across the election write AND the completeness check makes the second actor
// block until the first commits, so it reads the first's row and settles.
//
// pg_advisory_xact_lock takes two int4 keys. The first is a namespace constant
// so this cannot collide with an unrelated advisory lock; the second is the
// league.
const AUCTION_ADVISORY_LOCK_NAMESPACE = 815_121

export const lock_auction_for_league = async ({ trx, lid }) =>
  trx.raw('SELECT pg_advisory_xact_lock(?, ?)', [
    AUCTION_ADVISORY_LOCK_NAMESPACE,
    lid
  ])

/**
 * The open player, its opening bid and its current price, derived from
 * `transactions` alone.
 *
 * There is deliberately NO nomination-state table. The open player, the current
 * bid and the leader are the latest AUCTION_BID row, which is exactly how the
 * live socket already derives them; persisting them again would create a second
 * source of truth for what the transaction log owns.
 */
export const get_active_auction_nomination = async ({
  lid,
  season_year = current_season.year,
  db_client = db
}) => {
  const latest = await db_client('transactions')
    .where({ lid, season_year })
    .whereIn('type', [
      transaction_types.AUCTION_BID,
      transaction_types.AUCTION_PROCESSED
    ])
    .orderBy('occurred_at', 'desc')
    .orderBy('transaction_id', 'desc')
    .limit(1)

  const latest_transaction = latest[0]

  // An AUCTION_PROCESSED on top means the last nomination closed and nothing is
  // open: the next player is not open until someone nominates it, and its
  // eligible set is computed fresh at that moment. That is why there is no
  // settlement cascade and no reconciliation sweep as the mechanism.
  if (
    !latest_transaction ||
    latest_transaction.type === transaction_types.AUCTION_PROCESSED
  ) {
    return null
  }

  const bids = await db_client('transactions')
    .where({
      lid,
      season_year,
      pid: latest_transaction.pid,
      type: transaction_types.AUCTION_BID
    })
    .orderBy('occurred_at', 'asc')
    .orderBy('transaction_id', 'asc')

  const nomination = bids[0]
  const leading_bid = bids[bids.length - 1]

  return {
    pid: latest_transaction.pid,
    bids,
    opening_bid: nomination.player_salary,
    nominating_team_id: nomination.tid,
    current_price: leading_bid.player_salary,
    leading_team_id: leading_bid.tid
  }
}

/**
 * A team's capacity for one player at settlement time.
 *
 * The three terms are the league's existing acquisition predicate, verbatim
 * from process-restricted-free-agency-bid.mjs, with the current price in place
 * of the bid amount. `isEligibleForSlot` on a BENCH slot delegates to
 * `has_bench_space_for_position`, which is `!isFull && has_position_capacity`,
 * so it already subsumes the roster-space term -- but the space term is kept
 * separate because the resolver reports roster_full and position_limit as
 * different outcomes and a manager needs to be told which one applied.
 *
 * The budget comparison is `>=`, not `>`. min_bid is $0 and 36% of historical
 * wins went for exactly $0, so a team with an open roster spot participates at
 * $0 regardless of remaining budget; the strict form would silently exclude a
 * $0-cap team from every free player, which is a change from all five prior
 * auctions and simply wrong, since matching $0 can win under the nomination
 * tiebreak. Three disagreeing comparisons existed in the socket before this;
 * the bid path's `>=` is the one kept.
 */
export const get_team_auction_capacity = async ({
  tid,
  league,
  player_position,
  current_price
}) => {
  const roster_row = await getRoster({ tid })
  const roster = new Roster({ roster: roster_row, league })

  const is_eligible_for_slot = roster.isEligibleForSlot({
    slot: roster_slot_types.BENCH,
    pos: player_position
  })

  return {
    available_space: roster.availableSpace,
    available_cap: roster.availableCap,
    is_eligible_for_slot,
    // The three terms together. `is_eligible_for_slot` and `available_space` are
    // reported separately above because the resolver distinguishes position_limit
    // from roster_full and a manager needs to be told which one applied.
    is_eligible:
      is_eligible_for_slot &&
      roster.availableSpace >= 1 &&
      roster.availableCap >= current_price
  }
}

export const get_auction_team_capacities = async ({
  team_ids,
  league,
  player_position,
  current_price
}) => {
  const capacities = new Map()
  for (const tid of team_ids) {
    capacities.set(
      tid,
      await get_team_auction_capacity({
        tid,
        league,
        player_position,
        current_price
      })
    )
  }
  return capacities
}

/**
 * The teams the auction is still waiting on for the open player.
 *
 * PURE. Eligibility is monotone -- rosters are fixed for the whole period, so
 * open spots only fall, spent budget only rises and position counts only climb
 * -- which means a team that leaves this set can never re-enter it except by
 * trade, and completeness once reached stays reached.
 *
 * A standing maximum BELOW the current price still counts as an election and
 * satisfies completeness. Without that rule a team holds a nomination open
 * indefinitely by declining to revise a stale maximum, which would be a
 * forcing-function hole in a design that has none.
 */
export const get_outstanding_team_ids = ({
  capacities,
  elections,
  bids = [],
  nominating_team_id
}) => {
  const has_acted = new Set([nominating_team_id])
  for (const election of elections) has_acted.add(election.tid)
  for (const bid of bids) has_acted.add(bid.tid)

  const outstanding = []
  for (const [tid, capacity] of capacities) {
    if (has_acted.has(tid)) continue
    if (!capacity.is_eligible) continue
    outstanding.push(tid)
  }
  return outstanding
}

/**
 * The claim set the resolver ranks, from the elections and the bids on record.
 *
 * PURE. Two rules live here rather than in the resolver, because both are about
 * what a claim IS rather than how claims rank:
 *
 * - A PLACED BID IS BINDING. A maximum is an instruction and is revocable going
 *   forward; a bid already on the wire is not. So a team that bid $11 and then
 *   withdrew its $30 ceiling still holds a claim at $11 and wins there if
 *   nobody outbids. Revoking a ceiling stops future engine action, it does not
 *   unwind past action.
 * - NOMINATING IS BIDDING. The nominating team always holds a claim at least
 *   its opening bid, which is why there is no all-decline case and no unsold
 *   outcome: an uncontested nominated player sells to its nominator.
 */
export const build_auction_claims = ({
  elections,
  bids = [],
  opening_bid = 0,
  nominating_team_id
}) => {
  const claims = new Map()

  for (const election of elections) {
    claims.set(election.tid, {
      tid: election.tid,
      election_id: election.election_id,
      user_id: election.user_id,
      maximum_bid: election.maximum_bid,
      amount_set_at: election.amount_set_at
    })
  }

  for (const bid of bids) {
    const existing = claims.get(bid.tid)
    const bound = bid.player_salary
    if (!existing) {
      claims.set(bid.tid, {
        tid: bid.tid,
        election_id: null,
        user_id: bid.user_id,
        maximum_bid: bound,
        amount_set_at: bid.occurred_at
      })
      continue
    }
    if (existing.maximum_bid === null || existing.maximum_bid < bound) {
      existing.maximum_bid = bound
      existing.amount_set_at = bid.occurred_at
    }
  }

  const nominator = claims.get(nominating_team_id)
  if (!nominator) {
    claims.set(nominating_team_id, {
      tid: nominating_team_id,
      election_id: null,
      user_id: null,
      maximum_bid: opening_bid,
      amount_set_at: null
    })
  } else if (
    nominator.maximum_bid === null ||
    nominator.maximum_bid < opening_bid
  ) {
    nominator.maximum_bid = opening_bid
  }

  return Array.from(claims.values())
}

const get_live_elections = async ({ trx, lid, season_year, pid }) =>
  trx('auction_elections')
    .where({ lid, season_year, pid })
    .whereNull('withdrawn_at')
    .whereNull('settled_at')

/**
 * Settle the open player if every eligible team has elected on it.
 *
 * Completeness evaluation and settlement happen in ONE transaction, under the
 * league's advisory lock. Nothing else advances the auction in election mode --
 * no deadline, no timer, no commissioner nudge.
 *
 * @returns {Promise<null|{pid: string, winner_tid: number, price: number}>}
 *   null when the set is not yet complete or nothing is open.
 */
export const settle_auction_player_if_complete = async ({
  lid,
  season_year = current_season.year,
  league: provided_league,
  trx: provided_trx
} = {}) => {
  const run = async (trx) => {
    await lock_auction_for_league({ trx, lid })

    const nomination = await get_active_auction_nomination({
      lid,
      season_year,
      db_client: trx
    })
    if (!nomination) return null

    const league = provided_league || (await getLeague({ lid }))
    const players = await trx('player').where('pid', nomination.pid)
    const player_row = players[0]
    if (!player_row) {
      log(`cannot settle unknown player ${nomination.pid}`)
      return null
    }

    const teams = await trx('teams').where({ lid, season_year })
    const team_ids = teams.map((team) => team.team_id)

    const elections = await get_live_elections({
      trx,
      lid,
      season_year,
      pid: nomination.pid
    })

    const capacities = await get_auction_team_capacities({
      team_ids,
      league,
      player_position: player_row.primary_position,
      current_price: nomination.current_price
    })

    const outstanding = get_outstanding_team_ids({
      capacities,
      elections,
      bids: nomination.bids,
      nominating_team_id: nomination.nominating_team_id
    })

    if (outstanding.length) {
      log(
        `${nomination.pid} waiting on ${outstanding.length} team(s): ${outstanding.join(', ')}`
      )
      return null
    }

    const claims = build_auction_claims({
      elections,
      bids: nomination.bids,
      opening_bid: nomination.opening_bid,
      nominating_team_id: nomination.nominating_team_id
    })

    const { winner_tid, price, outcomes } = resolve_auction_player({
      claims,
      rosters: capacities,
      nominating_team_id: nomination.nominating_team_id,
      // The CURRENT price, not the opening bid, because a placed bid is binding.
      // The two are the same number for the whole election-mode mainline, where
      // the nomination is the only bid on the player; they diverge the moment a
      // manager bids in a live block, and there the floor has to be what was
      // actually bid or a team that folded would drag the price back down.
      opening_bid: nomination.current_price
    })

    if (!winner_tid) {
      // Unreachable by construction: the nominating team always holds a claim
      // at its opening bid, and it passed the eligibility check to nominate.
      // Left loud rather than silent -- reaching it means the nominator was
      // disqualified between nominating and settling, which is a state this
      // design says cannot occur.
      throw new Error(
        `auction settlement resolved no winner for ${nomination.pid}`
      )
    }

    await persist_auction_settlement({
      trx,
      lid,
      season_year,
      league,
      player_row,
      winner_tid,
      price,
      outcomes,
      claims,
      elections,
      nomination
    })

    log(`settled ${nomination.pid} to team ${winner_tid} at $${price}`)
    return { pid: nomination.pid, winner_tid, price, outcomes }
  }

  return provided_trx ? run(provided_trx) : db.transaction(run)
}

/**
 * Write the settlement: the winning bid, the processed transaction, the roster
 * row, the team's remaining cap, and one outcome per election.
 *
 * THE AUCTION ONLY SIGNS. The whole eligibility model rests on monotonicity, so
 * this asserts rather than trusts: a settlement adds exactly one active player
 * and never releases one, and the winner's remaining cap never rises.
 */
const persist_auction_settlement = async ({
  trx,
  lid,
  season_year,
  league,
  player_row,
  winner_tid,
  price,
  outcomes,
  claims,
  elections,
  nomination
}) => {
  const roster_row = await getRoster({ tid: winner_tid })
  const roster_before = new Roster({ roster: roster_row, league })
  const cap_before = roster_before.availableCap

  // Counted through `trx`, not through `getRoster`. getRoster reads the module
  // connection, so it cannot see this transaction's own uncommitted insert --
  // an invariant check that reads outside the transaction it is guarding always
  // reports the state before the write and is therefore worthless.
  const count_roster_rows = async () => {
    const [row] = await trx('rosters_players')
      .where({ roster_id: roster_row.roster_id })
      .count('pid as count')
    return Number(row.count)
  }
  const roster_rows_before = await count_roster_rows()

  if (price > cap_before) {
    throw new Error(
      `auction settlement would overspend team ${winner_tid}: $${price} against $${cap_before}`
    )
  }
  if (roster_before.availableSpace < 1) {
    throw new Error(
      `auction settlement would overfill team ${winner_tid}'s active roster`
    )
  }

  const occurred_at = new Date()
  const winning_claim = claims.find((claim) => claim.tid === winner_tid)

  // The price is reached in ONE engine step, never a dollar at a time.
  // Incrementing would put dozens of bids on the wire in a second, exhaust every
  // ceiling in a blur and race a live block past players nobody saw.
  //
  // An engine bid carries the user_id of the election that authorized it -- the
  // manager who set the ceiling, which is factually who is responsible.
  // transactions.user_id is NOT NULL and there is no acting user for a proxy
  // step. Proxy provenance is deliberately not recorded: nothing branches on it,
  // and the question a manager actually asks -- why was my ceiling spent -- is
  // answered by the election row and the settlement price.
  if (
    price !== nomination.current_price ||
    winner_tid !== nomination.leading_team_id
  ) {
    await trx('transactions').insert({
      user_id: winning_claim.user_id || nomination.bids[0].user_id,
      tid: winner_tid,
      pid: player_row.pid,
      lid,
      type: transaction_types.AUCTION_BID,
      player_salary: price,
      week: 0,
      season_year,
      occurred_at
    })
  }

  await trx('rosters_players').insert({
    roster_id: roster_row.roster_id,
    slot: roster_slot_types.BENCH,
    player_position: player_row.primary_position,
    pid: player_row.pid,
    extensions: 0,
    tid: winner_tid,
    lid,
    season_year,
    week: 0
  })

  await trx('teams')
    .where({ team_id: winner_tid, season_year })
    .update('salary_cap', cap_before - price)

  await trx('transactions').insert({
    user_id: winning_claim.user_id || nomination.bids[0].user_id,
    tid: winner_tid,
    pid: player_row.pid,
    lid,
    type: transaction_types.AUCTION_PROCESSED,
    player_salary: price,
    week: 0,
    season_year,
    occurred_at
  })

  const settled_at = occurred_at
  for (const election of elections) {
    const outcome = outcomes.get(election.tid)
    await trx('auction_elections')
      .where('election_id', election.election_id)
      .update({
        settled_at,
        outcome: outcome
          ? outcome.outcome
          : auction_election_outcomes.PROCESSING_ERROR,
        outcome_detail: outcome ? null : 'no outcome assigned during settlement'
      })
  }

  // THE AUCTION ONLY SIGNS. Exactly one row added and none removed. The whole
  // eligibility model rests on rosters being monotone for the period, so a
  // settlement that released anything would break the completeness guarantee
  // silently; this turns that into a rollback.
  const roster_rows_after = await count_roster_rows()
  if (roster_rows_after !== roster_rows_before + 1) {
    throw new Error(
      `auction settlement did not add exactly one roster row to team ${winner_tid}: ${roster_rows_before} -> ${roster_rows_after}`
    )
  }
}

/**
 * Sweep every election on a player nobody nominated.
 *
 * Managers elect on far more than the ~69 players an auction actually fills --
 * 395 free agents carry a projection -- so without a terminal outcome the table
 * ends the auction full of permanently ambiguous rows.
 */
export const sweep_unnominated_auction_elections = async ({
  lid,
  season_year = current_season.year
}) => {
  const settled_at = new Date()
  return db('auction_elections')
    .where({ lid, season_year })
    .whereNull('settled_at')
    .whereNull('withdrawn_at')
    .update({
      settled_at,
      outcome: auction_election_outcomes.NOT_NOMINATED,
      outcome_detail: null
    })
}

export default {
  get_active_auction_nomination,
  get_auction_team_capacities,
  get_outstanding_team_ids,
  build_auction_claims,
  settle_auction_player_if_complete,
  sweep_unnominated_auction_elections
}
