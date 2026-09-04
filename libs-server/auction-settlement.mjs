import db from '#db'
import { Roster, get_auction_team_capacity } from '#libs-shared'
import {
  current_season,
  roster_slot_types,
  transaction_types,
  auction_election_outcomes
} from '#constants'
import { resolve_auction_player } from './resolve-auction-player.mjs'
import getRoster from './get-roster.mjs'
import getLeague from './get-league.mjs'
import sendNotifications from './send-notifications.mjs'
import { format_nomination_complete_message } from './format-auction-discord-message.mjs'
import { get_auction_nominating_team_id } from './auction-completion.mjs'
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
 * THE ROSTER READ, and nothing else. The predicate itself is
 * `get_auction_team_capacity` in libs-shared, where the bid bar reaches it too:
 * the client has to decide whether to offer a manager a bid, a decline or a
 * maximum at all, and that is the same question this one answers, asked of the
 * same three terms. A second copy on the client would be the shape of the
 * three-disagreeing-comparisons defect this design removed -- so the rule, its
 * `>=` budget comparison and the argument for both live in one module and this
 * one supplies the roster.
 */
export const get_team_auction_capacity = async ({
  tid,
  league,
  player_position,
  current_price,
  db_client = db
}) => {
  const roster_row = await getRoster({ tid, db_client })
  const roster = new Roster({ roster: roster_row, league })

  return get_auction_team_capacity({ roster, player_position, current_price })
}

/**
 * Every team's capacity for the open player.
 *
 * `db_client` MUST BE THE CALLER'S `trx` WHEN THE CALLER HOLDS THE LEAGUE LOCK.
 * This is a roster read PER TEAM and each one issues several queries, so on the
 * module pool a settlement holding the advisory lock acquires connections that
 * the teams blocked on that lock are themselves holding. At league size that
 * exhausts the pool, and the deadlock resolves only when knex's acquire timeout
 * fires and rolls the settlement back -- leaving the player open with no clock
 * to retry it, which is the stall the whole design exists to prevent.
 *
 * The reads stay SEQUENTIAL rather than becoming `Promise.all`, deliberately: on
 * one transaction connection they serialize regardless, and concurrency here is
 * what would reintroduce the multi-connection shape this parameter removes.
 */
export const get_auction_team_capacities = async ({
  team_ids,
  league,
  player_position,
  current_price,
  db_client = db
}) => {
  const capacities = new Map()
  for (const tid of team_ids) {
    capacities.set(
      tid,
      await get_team_auction_capacity({
        tid,
        league,
        player_position,
        current_price,
        db_client
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
 * ONLY AN ELECTION DISCHARGES. A BID DOES NOT, and neither does a nomination.
 * This is the whole rule, and it is the one term the original had no argument
 * for: it seeded the set with the nominating team and every team holding a bid,
 * so any bid discharged its bidder permanently.
 *
 * The two are different KINDS of statement and the distinction is the price:
 *
 * - An election is PRICE-INDEPENDENT. A maximum is a standing position at every
 *   price, which is exactly what completeness needs to claim -- that the field
 *   is known at whatever price this settles at. That is also why a standing
 *   maximum BELOW the current price still discharges: the team's position at
 *   this price is known, and it is "out". Without that a team holds a
 *   nomination open indefinitely by declining to revise a stale maximum.
 * - A bid is PRICE-SPECIFIC. Bidding $11 says the team was in at $11 and says
 *   nothing about $12. Treating it as a discharge let a team that bid and was
 *   then outbid settle away without ever being asked about the higher price --
 *   and in election mode there is no clock, so completeness was the only thing
 *   that could have asked.
 *
 * BINDING IS THE OTHER AXIS AND IT STILL COUNTS BIDS. `build_auction_claims`
 * owns it: a placed bid binds the bidder to pay it, a nomination binds the
 * nominator to its opening bid, and that is why every nominated player still
 * sells and there is no `unsold` outcome. Binding and discharging were conflated
 * here; they are separate questions and only this one turns on electing.
 */
export const get_outstanding_election_team_ids = ({
  capacities,
  elections
}) => {
  const has_elected = new Set()
  for (const election of elections) has_elected.add(election.tid)

  const outstanding = []
  for (const [tid, capacity] of capacities) {
    if (has_elected.has(tid)) continue
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
 *
 * BUT BIDDING IS NOT ELECTING, and the two rules above are the reason that has
 * to be said here rather than only in `get_outstanding_election_team_ids`.
 * Binding a team to what it bid says what it OWES at this price; it says
 * nothing about its position at the next one, so it cannot discharge the team
 * from the outstanding set. Reading "nominating is bidding" as "nominating is
 * electing" is exactly the conflation that let a nomination settle a player
 * whose nominator had never stated a ceiling.
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
  // RESOLVED BEFORE THE TRANSACTION OPENS, and that placement is the point.
  // `getLeague` reads the MODULE POOL and issues several queries, so resolving
  // it inside the locked region makes the lock holder ask for a connection the
  // teams queued on its lock are already holding -- the same deadlock the
  // per-team roster reads had, needing only one connection instead of N.
  //
  // Hoisted rather than pushed onto the callers. Two of the four passed no
  // `league` (`withdraw_auction_election` and
  // `reevaluate_auction_after_roster_change`), and fixing those two would leave
  // the next caller free to reintroduce it. Resolving it here means no caller
  // can get it wrong.
  const league = provided_league || (await getLeague({ lid }))

  const run = async (trx) => {
    await lock_auction_for_league({ trx, lid })

    const nomination = await get_active_auction_nomination({
      lid,
      season_year,
      db_client: trx
    })
    if (!nomination) return null

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
      current_price: nomination.current_price,
      // Through `trx`, because this runs under the league's advisory lock. On
      // the module pool the lock holder would be acquiring connections held by
      // the very teams waiting on its lock.
      db_client: trx
    })

    const outstanding = get_outstanding_election_team_ids({
      capacities,
      elections
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
  const roster_row = await getRoster({ tid: winner_tid, db_client: trx })
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

  // AND THE BUDGET ONLY FALLS. The other half of monotonicity, and the half a
  // roster count cannot see: a team whose remaining cap ROSE across a settlement
  // re-enters eligible sets it had left, and completeness once reached would
  // stop staying reached.
  //
  // WHAT THIS GUARD CAN AND CANNOT SEE, since it was carrying an open question:
  //
  // It cannot fire on THIS transaction's own writes, and that is arithmetic
  // rather than an observation about fixtures. `availableCap` is
  // `league.salary_cap` minus the salaries of the ACTIVE roster, and between the
  // two reads this function adds exactly one active player and touches no other
  // team's row: `cap_after` is `cap_before` minus that player's charge, and the
  // charge is `price` (or `price` plus the extension step before the deadline),
  // which `resolve_auction_player` floors at the opening bid and so at zero. A
  // non-negative charge cannot raise the cap. The three earlier attempts to trip
  // it failed for that reason and not for want of a better fixture.
  //
  // It CAN fire on a write this transaction did not make. Reads here are READ
  // COMMITTED, so a roster change on the winner's team that commits between the
  // two reads becomes visible to the second one. Two shapes, and only one
  // reaches here: a RELEASE removes a roster row and the count guard above
  // catches it first, but a RESERVE OR PRACTICE-SQUAD DESIGNATION moves an
  // active player to a non-active slot, leaving the row count identical while
  // the active salary total falls. `submit-reserve.mjs` and
  // `submit-deactivate.mjs` are the two writers, neither refuses during the free
  // agency period, and neither calls
  // `reevaluate_auction_after_roster_change` -- so this guard is the only thing
  // in the settlement path that can see that class at all.
  //
  // Read through `trx` because of the above: a check that reads outside the
  // transaction it guards reports the state before the write. `getRoster` read
  // the module pool until it took a `db_client`, which made `cap_after` the
  // pre-update cap.
  const cap_after = new Roster({
    roster: await getRoster({ tid: winner_tid, db_client: trx }),
    league
  }).availableCap
  if (cap_after > cap_before) {
    throw new Error(
      `auction settlement raised team ${winner_tid}'s available cap: $${cap_before} -> $${cap_after}`
    )
  }

  // THE CHARGE LANDED, ON THE ROW IT WAS AIMED AT. An EQUALITY, not an
  // inequality, and the difference is the whole value of the check.
  //
  // This asked whether `teams.salary_cap` had RISEN above `cap_before`, which
  // is a state that cannot occur: this transaction is the only writer of that
  // column anywhere in `api/` or `libs-server/`, it had just set it to
  // `cap_before - price` twenty lines above, and `price` is non-negative -- so
  // the check restated its own input and could only ever pass. Worse, it was
  // written `team_after && ...`, so the one failure that IS reachable took the
  // false branch: an `update` matching NO row is not an error in knex, and the
  // `select` behind it then returns nothing, so a settlement that never charged
  // the winner committed clean and silent.
  // A MISSING ROW FAILS THIS RATHER THAN SKIPPING IT. `team_after` is undefined
  // when the update matched nothing, and undefined is not the expected charge,
  // so absence and a wrong value take the same branch. That is deliberately one
  // named state instead of two: "the charge is not what this function computed"
  // is the thing worth refusing, and which way it went wrong is in the message.
  const [team_after] = await trx('teams')
    .where({ team_id: winner_tid, season_year })
    .select('salary_cap')
  const charged = team_after ? team_after.salary_cap : null
  if (charged !== cap_before - price) {
    throw new Error(
      `auction settlement did not charge team ${winner_tid}: expected $${cap_before - price}, found ${charged === null ? 'no teams row' : `$${charged}`}`
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

/**
 * Build and send the Discord message for one settled player.
 *
 * Split out of `broadcast_auction_settlement` so the call can be OBSERVED. The
 * sibling block announcer is injected for exactly this reason, and its comment
 * says why: a one-line call at the end of a handler is the shape that ships
 * unexercised, and this subsystem has lost a Discord message that way once
 * already. It then lost the settlement message the same way -- the fix that
 * added this fan-out added no seam, so no spec could reach the call and the
 * only thing asserting it was a comment.
 *
 * It resolves the league itself rather than taking a resolved one, unlike
 * `announce_auction_block`. The REST settle paths pass no league and the lookup
 * used to sit inside the guarded block, so hoisting it into the caller would
 * turn a swallowed `getLeague` failure into one that takes the whole fan-out
 * down. Behavior preservation beats symmetry here.
 *
 * It does NOT guard itself. `broadcast_auction_settlement` owns that guard, so
 * the invariant holds for an injected announcer too rather than only for this
 * one.
 */
export const announce_auction_settlement = async ({
  lid,
  league,
  settlement
}) => {
  const resolved_league = league || (await getLeague({ lid }))
  const message = await format_nomination_complete_message({
    player_id: settlement.pid,
    winning_bid_amount: settlement.price,
    winning_team_id: settlement.winner_tid
  })

  if (!message) return null

  await sendNotifications({
    league: resolved_league,
    message,
    notifyLeague: true
  })

  return message
}

/**
 * Announce a settlement: Discord, then every client in the league.
 *
 * IN ELECTION MODE THE SOCKET IS NOT THE WRITER. Managers elect over REST and
 * settlement fires from the write path, so a settlement happens somewhere the
 * socket never hears about and every socket cache of `transactions` is stale by
 * default. Without this the connected clients sit on a board showing a player
 * that has already sold, and the socket's own view of whose nomination turn it
 * is never advances.
 *
 * ALL FOUR EFFECTS BELONG TOGETHER, and splitting them is what went wrong. This
 * used to broadcast `AUCTION_PROCESSED` alone while the socket's own settle path
 * did four things, so an election-mode settlement -- which is EVERY settlement
 * in 2026 -- left two of them undone:
 *
 * - The turn never advanced on the client. `auction-targets` gates the nominate
 *   button on `nominating_team_id === app.teamId`, so the team whose turn it now
 *   was had no control to nominate with until they reloaded the page. Nomination
 *   is the design's identified bottleneck and it is manual in election mode, so
 *   this stalled the auction after every single sale.
 * - No Discord message went out. With no clock in election mode, being told a
 *   player has sold and the turn has moved is a manager's only prompt to act.
 *
 * One function so none of that can drift between the three places a REST
 * settlement can originate -- an election, a trade, and a commissioner override
 * release -- or between those and the socket.
 */
export const broadcast_auction_settlement = async ({
  broadcast,
  lid,
  settlement,
  season_year = current_season.year,
  league,
  logger,
  // Injected for the same reason the block announcer is: a spec cannot
  // otherwise reach this call, and a deleted call site is invisible to a suite
  // that only ever exercises the message builder.
  announce = announce_auction_settlement
}) => {
  try {
    await announce({ lid, league, settlement })
  } catch (error) {
    // A notification failure must never take the settlement broadcast down with
    // it. The sale has already committed; a silent Discord is a degraded
    // auction, a client left on a sold player is a stalled one.
    log(`settlement notification failed for league ${lid}`)
    if (logger) logger(error)
  }

  broadcast(Number(lid), {
    type: 'AUCTION_PROCESSED',
    payload: {
      pid: settlement.pid,
      tid: settlement.winner_tid,
      player_salary: settlement.price
    }
  })

  const nominating_team_id = await get_auction_nominating_team_id({
    lid,
    season_year
  })

  if (!nominating_team_id) {
    return broadcast(Number(lid), { type: 'AUCTION_COMPLETE' })
  }

  return broadcast(Number(lid), {
    type: 'AUCTION_NOMINATION_INFO',
    payload: { nominating_team_id }
  })
}

/**
 * Re-evaluate the active nomination after a roster change the auction did not
 * make, and settle it if the eligible set is now complete.
 *
 * ELIGIBILITY IS OTHERWISE MONOTONE. Rosters are fixed for the whole free agency
 * period -- no releases, no poaches, no waiver claims -- so open spots only fall
 * and a team that leaves an eligible set never re-enters it. Exactly two things
 * break that, and both are why this exists:
 *
 * - A TRADE. `trade_deadline_at` for 2026 is in December, so trades are legal
 *   throughout the auction. A trade that fills a team's last active spot drops
 *   them out of the eligible set for the open player, and without this call the
 *   outstanding set is never recomputed -- the player waits on a team that can
 *   no longer sign anyone and stalls to the final block. A two-for-one runs the
 *   other way and can pull a team BACK into a set it had left, which is the one
 *   non-monotone lever in the design.
 * - A COMMISSIONER OVERRIDE RELEASE. Voluntary active-roster releases are
 *   refused for the whole period; the commissioner is the sanctioned exception,
 *   and it has to go through this path rather than around it.
 *
 * A DIRECT CALL, NOT A `jobs/` RUNNER. One player is open at a time and there is
 * no settlement cascade, so folding it into the two handlers that can cause the
 * change removes a runner, its log, its channel and its failure signal.
 *
 * It never fails its caller. The trade or the release has already committed by
 * the time this runs, and refusing a completed trade because a settlement threw
 * would be strictly worse than the stall it is preventing -- the auction is
 * degraded, not corrupt, and the next election or the final block resolves it.
 * The throw is logged rather than swallowed so it is attributable.
 */
export const reevaluate_auction_after_roster_change = async ({
  lid,
  season_year = current_season.year,
  broadcast,
  logger,
  trigger
}) => {
  try {
    const settlement = await settle_auction_player_if_complete({
      lid,
      season_year
    })

    if (!settlement) return null

    log(
      `${trigger} completed the eligible set: settled ${settlement.pid} to team ${settlement.winner_tid} at $${settlement.price}`
    )

    if (broadcast) {
      await broadcast_auction_settlement({
        broadcast,
        lid,
        settlement,
        season_year,
        logger
      })
    }

    return settlement
  } catch (error) {
    log(`auction re-evaluation after ${trigger} failed for league ${lid}`)
    if (logger) logger(error)
    return null
  }
}

export default {
  get_active_auction_nomination,
  get_auction_team_capacities,
  get_outstanding_election_team_ids,
  build_auction_claims,
  settle_auction_player_if_complete,
  announce_auction_settlement,
  broadcast_auction_settlement,
  reevaluate_auction_after_roster_change,
  sweep_unnominated_auction_elections
}
