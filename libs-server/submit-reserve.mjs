import {
  Roster,
  isReserveCovEligible,
  isReserveEligible,
  nfl_week_identifier
} from '#libs-shared'
import {
  current_season,
  roster_slot_types,
  transaction_types,
  transaction_type_display_names
} from '#constants'
import getLeague from './get-league.mjs'
import getRoster from './get-roster.mjs'
import db from '#db'
import sendNotifications from './send-notifications.mjs'
import getAcquisitionTransaction from './get-acquisition-transaction.mjs'
import isPlayerLocked from './is-player-locked.mjs'
import getLastTransaction from './get-last-transaction.mjs'
import apply_practice_current_week_join from './data-views/join-practice-current-week.mjs'
import apply_nfl_games_current_week_join from './data-views/join-nfl-games-current-week.mjs'
import apply_nfl_games_offset_week_join from './data-views/join-nfl-games-offset-week.mjs'

export default async function ({
  slot,
  tid,
  reserve_pid,
  league_id,
  user_id,
  activate_pid
}) {
  const data = []

  const slots = [
    roster_slot_types.RESERVE_SHORT_TERM,
    roster_slot_types.COV,
    roster_slot_types.RESERVE_LONG_TERM
  ]
  if (!slots.includes(slot)) {
    throw new Error('invalid slot')
  }

  const player_query = db('player')
  apply_practice_current_week_join({ db, query: player_query })
  apply_nfl_games_current_week_join({ db, query: player_query })

  const reference_params = nfl_week_identifier.reference_week_fallback_params()

  if (reference_params) {
    const { prior_params: prior_week_params, fallback_params } =
      reference_params
    apply_nfl_games_offset_week_join({
      db,
      query: player_query,
      offset: -1,
      alias: 'prior_week_game'
    })

    const fallback_week = fallback_params.week
    const fallback_year = fallback_params.year
    const fallback_seas_type = fallback_params.seas_type

    player_query.leftJoin('nfl_games as reference_week_game', function () {
      this.on(function () {
        this.on('reference_week_game.h', '=', 'player.current_nfl_team').orOn(
          'reference_week_game.v',
          '=',
          'player.current_nfl_team'
        )
      })
        .andOn(
          'reference_week_game.week',
          '=',
          db.raw(
            `CASE WHEN prior_week_game.esbid IS NULL THEN ?::int ELSE ?::int END`,
            [fallback_week, prior_week_params.week]
          )
        )
        .andOn(
          'reference_week_game.year',
          '=',
          db.raw(
            `CASE WHEN prior_week_game.esbid IS NULL THEN ?::int ELSE ?::int END`,
            [fallback_year, prior_week_params.year]
          )
        )
        .andOn(
          'reference_week_game.seas_type',
          '=',
          db.raw(
            `CASE WHEN prior_week_game.esbid IS NULL THEN ?::text ELSE ?::text END`,
            [fallback_seas_type, prior_week_params.seas_type]
          )
        )
    })
    // Then join to player's gamelog for the reference week game
    player_query.leftJoin('player_gamelogs as prior_week_gamelog', function () {
      this.on('prior_week_gamelog.pid', '=', 'player.pid').andOn(
        'prior_week_gamelog.esbid',
        '=',
        'reference_week_game.esbid'
      )
    })
    player_query.select(
      'player.*',
      'practice.m',
      'practice.tu',
      'practice.w',
      'practice.th',
      'practice.f',
      'practice.s',
      'practice.su',
      'nfl_games.day as game_day',
      db.raw(
        'CASE WHEN prior_week_gamelog.pid IS NULL OR prior_week_gamelog.active = false THEN true ELSE false END as prior_week_inactive'
      ),
      db.raw(
        'CASE WHEN prior_week_gamelog.ruled_out_in_game = true THEN true ELSE false END as prior_week_ruled_out'
      )
    )
  } else {
    player_query.select(
      'player.*',
      'practice.m',
      'practice.tu',
      'practice.w',
      'practice.th',
      'practice.f',
      'practice.s',
      'practice.su',
      'nfl_games.day as game_day'
    )
  }

  const player_rows = await player_query.where({ 'player.pid': reserve_pid })

  const player_row = player_rows[0]

  if (!player_row) {
    throw new Error('invalid player')
  }

  // make sure player is on active roster
  const league = await getLeague({ lid: league_id })
  if (!league) {
    throw new Error('invalid league_id')
  }
  const rosterRow = await getRoster({ tid })
  const roster = new Roster({ roster: rosterRow, league })
  const rosterPlayer = roster.get(reserve_pid)
  if (!rosterPlayer) {
    throw new Error('player not on roster')
  }

  if (rosterPlayer.slot === slot) {
    throw new Error('player already on reserve')
  }

  // make sure player is not protected
  if (
    rosterPlayer.slot === roster_slot_types.PSP ||
    rosterPlayer.slot === roster_slot_types.PSDP
  ) {
    throw new Error('protected players are not reserve eligible')
  }

  // check if practice squad player has active poaching claims
  if (
    rosterPlayer.slot === roster_slot_types.PS ||
    rosterPlayer.slot === roster_slot_types.PSD
  ) {
    const activePoaches = await db('poaches')
      .where({ pid: reserve_pid })
      .whereNull('processed')

    if (activePoaches.length === 0) {
      throw new Error(
        'practice squad players can only be placed on reserve if they have an active poaching claim'
      )
    }
  }

  // make sure player is reserve eligible
  if (slot === roster_slot_types.COV) {
    if (current_season.week === 0) {
      throw new Error(
        'player is not eligible for Reserve/COV during the Offseason'
      )
    }

    const { roster_status } = player_row
    if (!isReserveCovEligible({ roster_status })) {
      throw new Error('player not eligible for Reserve/COV')
    }
  } else {
    const {
      roster_status,
      game_designation,
      prior_week_inactive,
      prior_week_ruled_out,
      game_day,
      m,
      tu,
      w,
      th,
      f,
      s,
      su
    } = player_row

    const practice_data =
      m !== undefined ||
      tu !== undefined ||
      w !== undefined ||
      th !== undefined ||
      f !== undefined ||
      s !== undefined ||
      su !== undefined
        ? { m, tu, w, th, f, s, su }
        : null

    if (
      !isReserveEligible({
        roster_status,
        game_designation,
        prior_week_inactive,
        prior_week_ruled_out,
        week: current_season.week,
        is_regular_season: current_season.isRegularSeason,
        game_day,
        practice: practice_data
      })
    ) {
      throw new Error('player not eligible for Reserve')
    }
  }

  // make sure player was on previous week roster, unless acquired via a trade
  const prevRosterRow = await getRoster({
    tid,
    week: Math.max(current_season.week - 1, 0),
    year: current_season.year
  })
  const prevRoster = new Roster({ roster: prevRosterRow, league })
  const acquisitionTransaction = await getAcquisitionTransaction({
    lid: league_id,
    pid: reserve_pid,
    tid
  })
  if (
    acquisitionTransaction.type !== transaction_types.TRADE &&
    !prevRoster.has(reserve_pid)
  ) {
    throw new Error('not eligible, not rostered long enough')
  }

  // verify player is not locked and is a starter
  const isLocked = await isPlayerLocked(reserve_pid)
  const isStarter = Boolean(roster.starters.find((p) => p.pid === reserve_pid))
  if (isLocked && isStarter) {
    throw new Error('not eligible, locked starter')
  }

  // can not activate long term Reserve player
  let activate_player_row
  if (activate_pid && slot !== roster_slot_types.RESERVE_LONG_TERM) {
    const player_rows = await db('player').where('pid', activate_pid)
    activate_player_row = player_rows[0]

    // make sure player is on team
    if (!roster.has(activate_pid)) {
      throw new Error('invalid player')
    }

    // make sure player is not on active roster
    if (roster.active.find((p) => p.pid === activate_pid)) {
      throw new Error('player is on active roster')
    }

    // make sure player is on reserve
    if (
      roster.players.find(
        (p) =>
          p.pid === activate_pid &&
          p.slot !== roster_slot_types.RESERVE_SHORT_TERM
      )
    ) {
      throw new Error('player is not on reserve')
    }

    roster.removePlayer(reserve_pid)
    if (
      !roster.has_bench_space_for_position(activate_player_row.primary_position)
    ) {
      throw new Error('exceeds roster limits')
    }

    // activate player
    await db('rosters_players')
      .update({ slot: roster_slot_types.BENCH })
      .where({
        rid: rosterRow.uid,
        pid: activate_pid
      })

    const { value } = await getLastTransaction({
      pid: activate_pid,
      lid: league_id,
      tid
    })
    const transaction = {
      userid: user_id,
      tid,
      lid: league_id,
      pid: activate_pid,
      type: transaction_types.ROSTER_ACTIVATE,
      value,
      week: current_season.week,
      year: current_season.year,
      timestamp: Math.round(Date.now() / 1000)
    }
    await db('transactions').insert(transaction)

    // return data
    data.push({
      pid: activate_pid,
      tid,
      slot: roster_slot_types.BENCH,
      rid: roster.uid,
      pos: activate_player_row.primary_position,
      transaction
    })

    // update roster
    roster.updateSlot(activate_pid, roster_slot_types.BENCH)
  }

  if (
    slot === roster_slot_types.RESERVE_SHORT_TERM &&
    !roster.has_open_reserve_short_term_slot()
  ) {
    throw new Error('exceeds roster limits')
  }

  const type =
    slot === roster_slot_types.RESERVE_SHORT_TERM
      ? transaction_types.RESERVE_IR
      : slot === roster_slot_types.RESERVE_LONG_TERM
        ? transaction_types.RESERVE_LONG_TERM
        : transaction_types.RESERVE_COV
  await db('rosters_players').update({ slot }).where({
    rid: rosterRow.uid,
    pid: reserve_pid
  })

  const { value } = await getLastTransaction({
    pid: reserve_pid,
    lid: league_id,
    tid
  })
  const transaction = {
    userid: user_id,
    tid,
    lid: league_id,
    pid: reserve_pid,
    type,
    value,
    week: current_season.week,
    year: current_season.year,
    timestamp: Math.round(Date.now() / 1000)
  }
  await db('transactions').insert(transaction)

  await db('league_cutlist')
    .where({
      pid: reserve_pid,
      tid
    })
    .del()

  const teams = await db('teams').where({
    uid: tid,
    year: current_season.year
  })
  const team = teams[0]
  let message = `${team.name} (${team.abbrv}) has placed ${player_row.first_name} ${player_row.last_name} (${player_row.primary_position}) on ${transaction_type_display_names[type]}.`

  if (activate_player_row) {
    message += ` ${activate_player_row.first_name} ${activate_player_row.last_name} (${activate_player_row.primary_position}) has been activated`
  }

  await sendNotifications({
    league,
    notifyLeague: true,
    message
  })

  data.unshift({
    transaction,
    slot,
    pid: reserve_pid,
    rid: roster.uid,
    tid,
    pos: player_row.primary_position
  })

  return data
}
