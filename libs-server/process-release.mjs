import dayjs from 'dayjs'

import db from '#db'
import { Roster } from '#libs-shared'
import {
  current_season,
  roster_slot_types,
  transaction_types,
  waiver_types
} from '#constants'
import isPlayerLocked from './is-player-locked.mjs'
import getRoster from './get-roster.mjs'
import getLastTransaction from './get-last-transaction.mjs'
import sendNotifications from './send-notifications.mjs'
import getLeague from './get-league.mjs'
import get_super_priority_status from './get-super-priority-status.mjs'
import { verify_assets_not_trade_protected } from './get-trade-veto-window.mjs'

// Helper function to check for super priority on release
async function handle_super_priority_on_release({ pid, releasing_tid, lid }) {
  // Quick check: was this player poached by the releasing team?
  const poach_check = await db('transactions')
    .where({
      pid,
      lid,
      type: transaction_types.POACHED,
      tid: releasing_tid
    })
    .limit(1)

  if (!poach_check.length) {
    return // Player was not poached by this team, no super priority possible
  }

  // Quick check: is there already a claimed super priority for this player?
  const claimed_check = await db('super_priority')
    .where({ pid, lid, poaching_tid: releasing_tid, claimed: 1 })
    .limit(1)

  if (claimed_check.length) {
    return // Super priority already claimed, nothing to do
  }

  // Get comprehensive super priority status
  const super_priority_status = await get_super_priority_status({
    pid,
    lid,
    release_tid: releasing_tid
  })

  if (!super_priority_status.eligible) {
    return // Player not eligible for super priority
  }

  // Determine if manual waiver is needed
  let requires_waiver = 0

  // Check if player was originally a PS (signed) player, not PSD (drafted)
  const original_roster = await db('rosters_players')
    .join('rosters', 'rosters_players.roster_id', 'rosters.uid')
    .where({
      'rosters_players.pid': pid,
      'rosters_players.tid': super_priority_status.original_tid,
      'rosters_players.lid': lid
    })
    .where('rosters.season_year', current_season.year)
    .whereIn('rosters_players.slot', [
      roster_slot_types.PS,
      roster_slot_types.PSP
    ]) // PS or PSP
    .orderBy('rosters.week', 'desc')
    .first()

  if (original_roster) {
    // Player was originally PS (signed), check if original team has open PS slot
    const original_team_roster = await getRoster({
      tid: super_priority_status.original_tid
    })
    const league = await getLeague({ lid })
    const roster = new Roster({ roster: original_team_roster, league })

    if (roster.practice.length >= league.practice_squad_slot_count) {
      requires_waiver = 1 // No open PS slot, requires manual waiver
    }
  }

  // Create or update super_priority record
  const existing_record = await db('super_priority')
    .where({
      pid,
      original_tid: super_priority_status.original_tid,
      poaching_tid: releasing_tid,
      lid,
      poach_timestamp: super_priority_status.poach_timestamp
    })
    .first()

  if (!existing_record) {
    await db('super_priority').insert({
      pid,
      original_tid: super_priority_status.original_tid,
      poaching_tid: releasing_tid,
      lid,
      poach_timestamp: super_priority_status.poach_timestamp,
      eligible: 1,
      claimed: 0,
      requires_waiver
    })
  } else if (!existing_record.eligible) {
    // Update existing record to mark as eligible and set waiver requirement
    await db('super_priority')
      .where({ uid: existing_record.uid })
      .update({ eligible: 1, requires_waiver })
  }

  // Automatically create waiver for all eligible super priority cases
  // Team can update the waiver to include a release if roster space is needed
  // Super priority waivers are always FREE_AGENCY_PRACTICE type
  await db('waivers').insert({
    user_id: 0,
    pid,
    tid: super_priority_status.original_tid,
    lid,
    submitted: new Date(),
    bid_amount: 0,
    priority_order: 0,
    type: waiver_types.FREE_AGENCY_PRACTICE,
    super_priority: 1
  })
}

export default async function ({
  lid,
  tid,
  release_pid,
  user_id,
  activate_pid,
  create_notification = false
}) {
  // transactions.occurred_at is timestamptz and takes the instant directly.
  // Rounding it through epoch seconds moves it up to half a second in either
  // direction, which reorders it against a neighbouring transaction stamped
  // from an unrounded clock. `poaches.processed` is timestamptz as of the
  // 2026-08-08 lifecycle retype and takes the same instant, so there is no
  // longer an epoch-seconds consumer in this file.
  const occurred_at = new Date()
  const data = []

  // verify player id
  const player_rows = await db('player').where({ pid: release_pid }).limit(1)
  if (!player_rows.length) {
    throw new Error('invalid player')
  }
  const release_player_row = player_rows[0]

  // verify player is on current roster
  const league = await getLeague({ lid })
  if (!league) {
    throw new Error('invalid leagueId')
  }
  const rosterRow = await getRoster({ tid })
  const roster = new Roster({ roster: rosterRow, league })
  if (!roster.has(release_pid)) {
    throw new Error('player not on roster')
  }

  // a player moved by a recently accepted trade is frozen until that trade's
  // veto window closes, so a veto never has to unwind a third team's move
  await verify_assets_not_trade_protected({ league, pids: [release_pid] })

  // verify player is not protected
  if (
    roster.players.find(
      (p) =>
        p.pid === release_pid &&
        (p.slot === roster_slot_types.PSP || p.slot === roster_slot_types.PSDP)
    )
  ) {
    throw new Error('player is protected')
  }

  // verify player is not locked and is a starter
  const isLocked = await isPlayerLocked(release_pid)
  const isStarter = Boolean(roster.starters.find((p) => p.pid === release_pid))
  if (isLocked && isStarter) {
    throw new Error('starter is locked')
  }

  // verify player does not have a poaching claim
  const isOnPracticeSquad = Boolean(
    roster.practice.find((p) => p.pid === release_pid)
  )
  if (isOnPracticeSquad) {
    const poaches = await db('poaches')
      .where({ pid: release_pid, lid })
      .whereNull('processed')

    if (poaches.length) {
      throw new Error('player has a poaching claim')
    }
  }

  // verify player was not poached this offseason
  if (!current_season.isRegularSeason) {
    const poaches = await db('poaches')
      .where({ pid: release_pid, lid, tid, is_successful: 1 })
      .orderBy('processed', 'desc')

    if (poaches.length) {
      const poach = poaches[0]
      // `poaches.processed` is timestamptz, so `dayjs.unix()` of it would read
      // the Date as epoch seconds and render a year-58,000 instant that passes
      // isValid() -- silently making every poach look recent.
      if (dayjs(poach.processed).isAfter(current_season.offseason)) {
        throw new Error('player was poached')
      }
    }
  }

  let activate_player_row
  if (activate_pid) {
    const players = await db('player').where('pid', activate_pid)
    activate_player_row = players[0]

    // make sure player is on team
    if (!roster.has(activate_pid)) {
      throw new Error('invalid player')
    }

    // make sure player is not on active roster
    if (roster.active.find((p) => p.pid === activate_pid)) {
      throw new Error('player is on active roster')
    }

    // make sure player is not protected
    if (
      roster.players.find(
        (p) =>
          p.pid === activate_pid &&
          (p.slot === roster_slot_types.PSP ||
            p.slot === roster_slot_types.PSDP)
      )
    ) {
      throw new Error('player is protected')
    }

    // make sure roster has bench space
    roster.removePlayer(release_pid)
    if (!roster.has_bench_space()) {
      throw new Error('exceeds roster limits')
    }

    // activate player
    await db('rosters_players')
      .update({ slot: roster_slot_types.BENCH })
      .where({
        roster_id: rosterRow.uid,
        pid: activate_pid
      })

    const { player_salary } = await getLastTransaction({
      pid: activate_pid,
      lid,
      tid
    })
    const transaction = {
      user_id,
      tid,
      lid,
      pid: activate_pid,
      type: transaction_types.ROSTER_ACTIVATE,
      player_salary,
      week: current_season.week,
      season_year: current_season.year,
      occurred_at
    }
    const [inserted_transaction] = await db('transactions')
      .insert(transaction)
      .returning('uid')
    transaction.uid = inserted_transaction.uid

    // clear any pending poaching claims for player
    await db('poaches')
      .update({
        is_successful: 0,
        processed: occurred_at,
        reason: 'player is not on a practice squad' // TODO use constant
      })
      .where({
        lid,
        pid: activate_pid
      })
      .whereNull('processed')

    // return data
    data.push({
      pid: activate_pid,
      tid,
      slot: roster_slot_types.BENCH,
      roster_id: roster.uid,
      player_position: activate_player_row.primary_position,
      transaction
    })
  }

  // create transaction
  const transaction = {
    user_id,
    tid,
    lid,
    pid: release_pid,
    type: transaction_types.ROSTER_RELEASE,
    player_salary: 0,
    week: current_season.week,
    season_year: current_season.year,
    occurred_at
  }
  const [inserted_transaction] = await db('transactions')
    .insert(transaction)
    .returning('uid')
  transaction.uid = inserted_transaction.uid

  // remove release player from rosters
  const teamRosters = await db('rosters')
    .where('week', '>=', current_season.week)
    .where('season_year', current_season.year)
    .where('tid', tid)
  const rosterIds = teamRosters.map((r) => r.uid)
  await db('rosters_players')
    .whereIn('roster_id', rosterIds)
    .where('pid', release_pid)
    .del()
  await db('league_cutlist')
    .where({
      pid: release_pid,
      tid
    })
    .del()

  data.unshift({
    pid: release_pid,
    slot: null,
    tid,
    roster_id: roster.uid,
    player_position: release_player_row.primary_position,
    transaction
  })

  // Check for super priority eligibility when releasing a player
  await handle_super_priority_on_release({
    pid: release_pid,
    releasing_tid: tid,
    lid
  })

  if (create_notification) {
    const teams = await db('teams').where({
      uid: tid,
      lid,
      season_year: current_season.year
    })
    const team = teams[0]

    let message
    if (activate_pid) {
      message = `${team.name} (${team.abbreviation}) has activated ${activate_player_row.first_name} ${activate_player_row.last_name} (${activate_player_row.primary_position}). ${release_player_row.first_name} ${release_player_row.last_name} (${release_player_row.primary_position}) has been released.`
    } else {
      message = `${team.name} (${team.abbreviation}) has released ${release_player_row.first_name} ${release_player_row.last_name} (${release_player_row.primary_position}).`
    }

    await sendNotifications({
      league,
      notifyLeague: true,
      message
    })
  }

  return data
}
