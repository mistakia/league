import db from '#db'
import { Roster, get_free_agent_period } from '#libs-shared'
import { current_season } from '#constants'
import {
  lock_auction_for_league,
  get_active_auction_nomination,
  get_auction_team_capacities,
  get_outstanding_election_team_ids,
  settle_auction_player_if_complete
} from './auction-settlement.mjs'
import getRoster from './get-roster.mjs'
import getLeague from './get-league.mjs'
import emit_signal from '#libs-server/emit-signal.mjs'
import debug from 'debug'

const log = debug('auction-elections')

const SETTLEMENT_SIGNAL_SOURCE = 'libs-server/auction-elections.mjs'

// THE SEAM FOR THE SETTLEMENT-REFUSAL SIGNAL, injected for the same reason the
// socket's mode signal and the Discord announcer are: `emit_signal` no-ops
// whenever BASE_API_URL and its companions are unset, which is every
// environment but production. An uninjected spec would pass with the call site
// deleted, and this subsystem has shipped exactly that defect twice.
export const real_auction_election_signals = { emit: emit_signal }

// Follows restricted-free-agency-bid-error.mjs: a factory rather than a class,
// so the caller can distinguish a rejected instruction from a database fault
// without matching on message text.
export const auction_election_error = (message) =>
  Object.assign(new Error(message), { is_auction_election_error: true })

/**
 * Run a settlement that shares its caller's transaction, and REFUSE the write
 * that triggered it if the settlement cannot be written.
 *
 * THE ELECTION AND THE SETTLEMENT ARE ONE TRANSACTION, so any throw inside
 * `persist_auction_settlement` already erased the manager's election. That is
 * not a bug to be caught away -- it is the only outcome that keeps the design's
 * one invariant. Completeness is the sole thing that advances an election-mode
 * auction and there is no clock, so committing the election while abandoning
 * the settlement reaches a set that is EMPTY and UNSETTLED, with no remaining
 * write able to trigger a sale. The player would sit open forever while the
 * board showed the auction waiting on nobody.
 *
 * Leaving the team outstanding is therefore the repair, not the damage: the set
 * stays non-empty, the manager's own resubmission IS the retry path, and it
 * cannot loop because it runs at human pace.
 *
 * WHAT CHANGES IS ONLY THE ERROR SURFACE. Every throw in the settlement is a
 * bare `Error`, so it reached the manager as a 500 that says nothing while the
 * `team N elected X` line had already printed ABOVE the settle call -- a wiped
 * election was indistinguishable from an ordinary one in the log, and the
 * manager was told nothing at all. An `auction_election_error` takes the branch
 * the routes already carry and turns that into a 400 they can read.
 *
 * THE SIGNAL IS EMITTED OUTSIDE THE TRANSACTION, and the placement is
 * load-bearing rather than tidy. `emit_signal` posts over the network with a
 * ten-second timeout, and this transaction holds the league's advisory lock --
 * emitting inside it would block every other settlement in the league for the
 * length of an HTTP call.
 *
 * EMIT WITHOUT A RESOLVE ARM, deliberately. The mode-resolution signal resolves
 * because it reports a persistent state a later poll can observe recovering;
 * this reports a single refused write. Gating a resolve on the next successful
 * settlement would put a network call on the hot success path for a condition
 * that has never fired in production, which is the wrong trade. An operator
 * closes it after fixing the cause.
 */
const settle_or_refuse = async ({
  settle,
  signals,
  lid,
  pid,
  tid,
  verb,
  faults
}) => {
  try {
    return await settle()
  } catch (error) {
    // Recorded for the caller to emit once the transaction has unwound, rather
    // than emitted here under the lock.
    faults.push({ error, lid, pid, tid, verb, signals })
    throw auction_election_error(
      `your ${verb} was not recorded: it completed the field for this player and the sale could not be written. Nothing changed -- submit it again.`
    )
  }
}

/**
 * Emit the refusal signals a rolled-back transaction recorded. Never throws:
 * `emit_signal` swallows its own transport errors, and a signal able to take
 * down the write it instruments is worse than one that is mute.
 */
const report_settlement_refusals = async (faults) => {
  for (const fault of faults) {
    await fault.signals.emit({
      source: SETTLEMENT_SIGNAL_SOURCE,
      kind: 'pipeline_failure',
      severity: 'high',
      title: `league ${fault.lid} refused a manager's ${fault.verb} on ${fault.pid}`,
      payload: {
        lid: fault.lid,
        pid: fault.pid,
        tid: fault.tid,
        verb: fault.verb,
        error: fault.error.message,
        // The consequence rather than the symptom. The guards read committed
        // state, so this repeats for every retry until the cause is fixed --
        // one manager cannot record anything on this player until then.
        consequence: `team ${fault.tid} cannot record a ${fault.verb} on ${fault.pid} until this is resolved, and the player will not sell`
      },
      dedup_key: `pipeline_failure:${SETTLEMENT_SIGNAL_SOURCE}:${fault.lid}:${fault.pid}`
    })
  }
}

/**
 * Refuse an election outside the free agency period.
 *
 * The period IS the auction under this design, so a write before it opens or
 * after it closes is bidding on an auction that has not started or has already
 * finished. Everything else in this module said "at any point in the free
 * agency period" and enforced only the first half of that sentence -- the module
 * did not import a date library at all.
 *
 * No commissioner exception. A commissioner is a competing manager here, and an
 * election placed outside the window is not an administrative act.
 */
const assert_within_free_agency_period = (league) => {
  const period = get_free_agent_period(league)

  if (!period.start) {
    throw auction_election_error(
      'this league has no free agency period configured'
    )
  }

  if (current_season.now.isBefore(period.start)) {
    throw auction_election_error('free agency period has not opened')
  }

  if (current_season.now.isAfter(period.end)) {
    throw auction_election_error('free agency period has closed')
  }
}

const get_live_election = async ({ trx, lid, season_year, pid, tid }) => {
  const rows = await trx('auction_elections')
    .where({ lid, season_year, pid, tid })
    .whereNull('withdrawn_at')
    .whereNull('settled_at')
  return rows[0]
}

/**
 * Write or revise one team's election, inside a transaction the CALLER owns.
 *
 * Split out of `submit_auction_election` so a nomination can carry its
 * nominator's maximum. The nomination bid and that election have to land in one
 * transaction or a crash between them opens a player whose nominator has no
 * election -- and since a nomination no longer discharges anyone, that player
 * would then wait on its own nominator until someone noticed.
 *
 * It takes `trx` rather than opening its own and it does NOT take the advisory
 * lock or settle. Each caller holds the lock for its own reason and decides its
 * own ordering, and those reasons DIFFER -- see `_create_nomination_bid`, which
 * holds it against a concurrent settlement rather than across a completeness
 * check. Taking the lock here would say the ordering is this function's
 * business when it is the caller's.
 */
export const upsert_auction_election = async ({
  trx,
  lid,
  season_year,
  pid,
  tid,
  user_id,
  maximum_bid
}) => {
  const now = new Date()

  const existing = await get_live_election({ trx, lid, season_year, pid, tid })

  if (!existing) {
    return trx('auction_elections').insert({
      lid,
      season_year,
      pid,
      tid,
      user_id,
      maximum_bid,
      submitted_at: now,
      amount_set_at: now
    })
  }

  const is_same_amount = existing.maximum_bid === maximum_bid
  return trx('auction_elections')
    .where('election_id', existing.election_id)
    .update({
      user_id,
      maximum_bid,
      // `amount_set_at` moves ONLY when the amount moves. The tie rule compares
      // when the winning amount was last set, so rewriting it on a no-op
      // resubmit would let a manager refresh their priority for free.
      amount_set_at: is_same_amount ? existing.amount_set_at : now
    })
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
  season_year = current_season.year,
  signals = real_auction_election_signals
}) => {
  if (maximum_bid !== null && maximum_bid !== undefined) {
    if (!Number.isInteger(maximum_bid) || maximum_bid < 0) {
      throw auction_election_error('maximum bid must be a whole dollar')
    }
  }

  const normalized_maximum = maximum_bid === undefined ? null : maximum_bid

  const league = await getLeague({ lid })
  assert_within_free_agency_period(league)

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

  // Collected inside the transaction and emitted after it has unwound, so a
  // ten-second signal post never runs while the league's advisory lock is held.
  const faults = []

  try {
    return await db.transaction(async (trx) => {
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

      await upsert_auction_election({
        trx,
        lid,
        season_year,
        pid,
        tid,
        user_id,
        maximum_bid: normalized_maximum
      })

      log(
        `team ${tid} elected ${normalized_maximum === null ? 'decline' : `$${normalized_maximum}`} on ${pid}`
      )

      // The outstanding set comes back with the settlement because the settle
      // call has already computed it. Without a nomination there is nothing open,
      // so nobody is outstanding.
      const result = is_active_nomination
        ? await settle_or_refuse({
            settle: () =>
              settle_auction_player_if_complete({
                lid,
                season_year,
                league,
                trx
              }),
            signals,
            lid,
            pid,
            tid,
            verb: 'election',
            faults
          })
        : { settlement: null, outstanding: [] }

      return result
    })
  } finally {
    await report_settlement_refusals(faults)
  }
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
  season_year = current_season.year,
  signals = real_auction_election_signals
}) => {
  assert_within_free_agency_period(await getLeague({ lid }))

  const faults = []

  try {
    return await db.transaction(async (trx) => {
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
      //
      // So this path carries the identical wedge the election path does, for the
      // identical reason -- the withdrawal and the settlement share one
      // transaction -- and it is refused the same way. Its route already carries
      // the same `is_auction_election_error` branch.
      return settle_or_refuse({
        settle: () =>
          settle_auction_player_if_complete({
            lid,
            season_year,
            trx
          }),
        signals,
        lid,
        pid,
        tid,
        verb: 'withdrawal',
        faults
      })
    })
  } finally {
    await report_settlement_refusals(faults)
  }
}

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

  // READ BEFORE THE CAPACITIES, because it decides which of them are needed.
  const elections = await db('auction_elections')
    .where({ lid, season_year, pid: nomination.pid })
    .whereNull('withdrawn_at')
    .whereNull('settled_at')

  // ONLY THE TEAMS THAT HAVE NOT ELECTED. This answers one question -- who is
  // the auction waiting on -- and `get_outstanding_election_team_ids` discharges
  // an elected team before it ever looks at that team's capacity. Reading a
  // roster to compute a value the next line skips is the whole of the waste, and
  // it is not the same scope the settlement path needs: that one also reads
  // CONTENDERS, because the resolver ranks them. This one ranks nothing.
  const elected = new Set(elections.map((election) => election.tid))
  const capacities = await get_auction_team_capacities({
    team_ids: teams
      .map((team) => team.team_id)
      .filter((tid) => !elected.has(tid)),
    league,
    player_position: players[0].primary_position,
    current_price: nomination.current_price
  })

  return {
    nomination: {
      pid: nomination.pid,
      current_price: nomination.current_price,
      opening_bid: nomination.opening_bid,
      nominating_team_id: nomination.nominating_team_id
    },
    outstanding_election_tids: get_outstanding_election_team_ids({
      capacities,
      elections,
      bids: nomination.bids
    })
  }
}

/**
 * Broadcast who the auction is now waiting on.
 *
 * THE OUTSTANDING SET IS DERIVED FROM STATE REST MOVES, so it has to be
 * re-broadcast from the write path. The socket recomputed it only on its own
 * events -- a nomination or a bid -- and in election mode neither of those is
 * how a team elects. So every client sat on the outstanding list as it stood at
 * nomination and watched it never shrink, for the entire time nine managers
 * were electing one at a time. The settlement status display IS the design's
 * only forcing function, and it was frozen on the one path the auction takes.
 *
 * Recomputed server-side rather than patched on the client. The eligible-set
 * predicate is the single thing that advances the auction, and a client-side
 * "drop this tid from the list" would be a second implementation of it -- the
 * exact shape of the three-disagreeing-comparisons defect this redesign
 * removed. It also gets withdrawal right for free: withdrawing a decline puts a
 * team BACK into the outstanding set, which no subtractive client rule could
 * express.
 *
 * `outstanding` IS THE SET THE CALLER ALREADY HAS, not a hint. Every write path
 * that reaches here has just run `settle_auction_player_if_complete`, which
 * computed this exact set under the league lock in order to decide whether to
 * settle -- so recomputing it here read every roster a second time on the same
 * request. Passing it is not merely cheaper: the value computed under the lock
 * is the serialized truth as of the write being announced, whereas a recompute
 * afterwards can pick up a LATER election and announce it under this request,
 * whose own request will announce it again.
 *
 * Omitting it still works and still recomputes, for the callers that have no
 * settle call behind them.
 */
export const broadcast_auction_settlement_status = async ({
  broadcast,
  lid,
  season_year = current_season.year,
  outstanding
}) => {
  const outstanding_election_tids =
    outstanding ||
    (await get_auction_settlement_status({ lid, season_year }))
      .outstanding_election_tids

  return broadcast(Number(lid), {
    type: 'AUCTION_SETTLEMENT_STATUS',
    payload: { outstanding_election_tids }
  })
}

export default {
  submit_auction_election,
  upsert_auction_election,
  withdraw_auction_election,
  get_team_auction_elections,
  get_auction_settlement_status,
  broadcast_auction_settlement_status,
  auction_election_error,
  real_auction_election_signals
}
