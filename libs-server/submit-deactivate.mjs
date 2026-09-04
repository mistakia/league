import dayjs from 'dayjs'

import { Roster } from '#libs-shared'
import {
  active_roster_slots,
  current_season,
  reserve_slots,
  roster_slot_types,
  transaction_types
} from '#constants'
import getLeague from './get-league.mjs'
import getRoster from './get-roster.mjs'
import getTransactionsSinceAcquisition from './get-transactions-since-acquisition.mjs'
import getTransactionsSinceFreeAgent from './get-transactions-since-free-agent.mjs'
import sendNotifications from './send-notifications.mjs'
import { is_auction_in_progress } from './auction-completion.mjs'
import db from '#db'

/**
 * Refuse an active-roster demotion while the free agency auction is running.
 *
 * Rosters are fixed for the auction, and this is the SECOND of the two slot
 * changes that can break that -- `submit-reserve.mjs` is the first and refuses
 * for the same reason. Moving an active-roster player to the practice squad
 * leaves the `rosters_players` row count identical while `availableSpace` and
 * `availableCap` both RISE, because `Roster` derives both from the ACTIVE slots
 * alone, so a team that had dropped out of an open player's eligible set
 * re-enters it.
 *
 * REFUSED RATHER THAN HOOKED INTO `reevaluate_auction_after_roster_change`.
 * That call settles a nomination whose eligible set is now complete, which is
 * the right answer for a change that only ever REMOVES capacity; this one adds
 * it, so re-evaluating would faithfully record a set that should never have
 * grown. Monotonicity is the assumption second-price settlement rests on, and
 * the freeze is what makes `is_auction_complete` monotone in the first place.
 *
 * EXPORTED BECAUSE THE ROUTE HAS TO ASK BEFORE IT WRITES. `POST /teams/:tid/deactivate`
 * takes an optional `release_pid` and processes that release FIRST, to make
 * practice squad room for the demotion -- and `process-release.mjs` runs on the
 * module connection with no transaction, so it is committed by the time this
 * throws from inside `submitDeactivate`. That half-applied the request: the
 * released player was gone and the demotion never happened, with a 400 as the
 * only signal. The client sends `release_pid` exactly when the practice squad is
 * full, which is the ordinary case, so every such request would have half-applied
 * for the length of the auction.
 *
 * Checking it here as well as at the call site is deliberate duplication of a
 * READ, not of the rule: the rule lives in this function, and the route calls it
 * before its first write.
 *
 * The source slot has to be checked, not just the auction: a practice squad
 * activation moves no active roster row and cannot change either quantity.
 */
export const assert_deactivate_allowed_during_auction = async ({
  lid,
  slot
}) => {
  if (!active_roster_slots.includes(slot)) return
  if (!(await is_auction_in_progress({ lid }))) return

  throw new Error(
    'active roster players can not be moved to the practice squad during the free agency auction'
  )
}

export default async function ({
  tid,
  deactivate_pid,
  leagueId,
  userId,
  roster: existing_roster,
  skip_practice_squad_space_check = false
}) {
  const league = await getLeague({ lid: leagueId })
  if (!league) {
    throw new Error('invalid leagueId')
  }

  const occurred_at = new Date()

  let roster = existing_roster
  if (!roster) {
    const rosterRow = await getRoster({ tid })
    roster = new Roster({ roster: rosterRow, league })
  }

  // make sure player is on roster
  if (!roster.has(deactivate_pid)) {
    throw new Error('invalid deactivate_pid')
  }

  // make sure player is not on practice squad
  if (roster.practice.find((p) => p.pid === deactivate_pid)) {
    throw new Error('player is already on practice squad')
  }

  // A reserve player can not be returned to the practice squad. The
  // previously-activated check below catches most of them, but a player signed
  // straight to the active roster and then placed on reserve carries no
  // ROSTER_ACTIVATE row -- and the 48-hour cutoff is gated on `isActive`, which
  // is false for a reserve player, so nothing else here stops the move.
  if (reserve_slots.includes(roster.get(deactivate_pid).slot)) {
    throw new Error('reserve players can not be placed on the practice squad')
  }

  await assert_deactivate_allowed_during_auction({
    lid: leagueId,
    slot: roster.get(deactivate_pid).slot
  })

  const player_rows = await db('player').where('pid', deactivate_pid).limit(1)
  const player_row = player_rows[0]

  const transactionsSinceAcquisition = await getTransactionsSinceAcquisition({
    lid: leagueId,
    tid,
    pid: deactivate_pid
  })
  const sortedTransactions = transactionsSinceAcquisition.sort(
    (a, b) => new Date(a.occurred_at) - new Date(b.occurred_at)
  )
  const lastTransaction = sortedTransactions[sortedTransactions.length - 1]
  const firstTransaction = sortedTransactions[0]
  const isActive = Boolean(roster.active.find((p) => p.pid === deactivate_pid))

  // make sure player has not been on the active roster for more than 48 hours
  const cutoff = dayjs(lastTransaction.occurred_at).add('48', 'hours')
  if (isActive && dayjs().isAfter(cutoff)) {
    throw new Error('player has exceeded 48 hours on active roster')
  }

  const transactionsSinceFA = await getTransactionsSinceFreeAgent({
    lid: leagueId,
    pid: deactivate_pid
  })

  // make sure player has not been poached since the last time they were a free agent
  if (transactionsSinceFA.find((t) => t.type === transaction_types.POACHED)) {
    throw new Error('player can not be deactivated once poached')
  }

  // make sure player has not been previously activated since they were a free agent
  if (
    transactionsSinceFA.find(
      (t) => t.type === transaction_types.ROSTER_ACTIVATE
    )
  ) {
    throw new Error('player can not be deactivated once previously activated')
  }

  // players acquired through market bidding are ineligible
  const acceptable_types = [
    transaction_types.ROSTER_ADD,
    transaction_types.PRACTICE_ADD,
    transaction_types.TRADE,
    transaction_types.DRAFT
  ]
  if (!acceptable_types.includes(firstTransaction.type)) {
    throw new Error('player is not eligible')
  }

  // if signed through waivers, make sure player had no competing bids
  if (firstTransaction.waiver_id) {
    const waivers = await db('waivers').where({
      waiver_id: firstTransaction.waiver_id
    })
    const transactionWaiver = waivers[0]

    // search for competing waivers
    if (transactionWaiver) {
      const competingWaivers = await db('waivers')
        .where({
          pid: deactivate_pid,
          processed: transactionWaiver.processed,
          is_successful: 0,
          type: 1,
          lid: leagueId,
          reason: 'player is not a free agent'
        })
        .whereNot({
          tid: transactionWaiver.tid
        })
      if (competingWaivers.length) {
        throw new Error('player is not eligible, had competing waivers')
      }
    }
  }

  const isDraftedRookie = transactionsSinceAcquisition.find(
    (t) => t.type === transaction_types.DRAFT
  )

  // make sure team has space on practice squad (unless skipped for combined operations)
  if (!skip_practice_squad_space_check && !isDraftedRookie) {
    if (!roster.hasOpenPracticeSquadSlot()) {
      throw new Error('no available space on practice squad')
    }
  }

  const slot = isDraftedRookie ? roster_slot_types.PSD : roster_slot_types.PS

  await db('rosters_players').update({ slot }).where({
    roster_id: roster.roster_id,
    pid: deactivate_pid
  })

  await db('league_cutlist').where({ pid: deactivate_pid, tid }).del()

  const transaction = {
    user_id: userId,
    tid,
    lid: leagueId,
    pid: deactivate_pid,
    type: transaction_types.ROSTER_DEACTIVATE,
    player_salary: lastTransaction.player_salary,
    week: current_season.week,
    season_year: current_season.year,
    occurred_at
  }
  await db('transactions').insert(transaction)

  const data = {
    pid: deactivate_pid,
    tid,
    slot,
    rid: roster.roster_id,
    pos: player_row.primary_position,
    transaction
  }

  const teams = await db('teams').where({
    team_id: tid,
    season_year: current_season.year
  })
  const team = teams[0]

  const message = `${team.name} (${team.abbreviation}) has placed ${player_row.first_name} ${player_row.last_name} (${player_row.primary_position}) on the practice squad.`

  await sendNotifications({
    league,
    notifyLeague: true,
    message
  })

  return data
}
