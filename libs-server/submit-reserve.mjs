import {
  constants,
  Roster,
  isReserveCovEligible,
  isReserveEligible
} from '#libs-shared'
import getLeague from './get-league.mjs'
import getRoster from './get-roster.mjs'
import db from '#db'
import sendNotifications from './send-notifications.mjs'
import getAcquisitionTransaction from './get-acquisition-transaction.mjs'
import isPlayerLocked from './is-player-locked.mjs'
import getLastTransaction from './get-last-transaction.mjs'

export default async function ({
  slot,
  tid,
  reserve_pid,
  leagueId,
  userId,
  activate_pid
}) {
  const data = []

  const slots = [
    constants.slots.RESERVE_SHORT_TERM,
    constants.slots.COV,
    constants.slots.RESERVE_LONG_TERM
  ]
  if (!slots.includes(slot)) {
    throw new Error('invalid slot')
  }

  const player_query = db('player')
    .leftJoin('practice', function () {
      this.on('player.pid', '=', 'practice.pid')
        .andOn('practice.week', '=', constants.season.week)
        .andOn('practice.year', '=', constants.season.year)
    })
    .leftJoin('nfl_games', function () {
      this.on(function () {
        this.on('nfl_games.h', '=', 'player.current_nfl_team').orOn(
          'nfl_games.v',
          '=',
          'player.current_nfl_team'
        )
      })
        .andOn('nfl_games.week', '=', constants.season.week)
        .andOn('nfl_games.year', '=', constants.season.year)
        .andOn(db.raw("nfl_games.seas_type = 'REG'"))
    })

  // Only join prior week gamelog data if week > 1
  if (constants.season.week > 1) {
    const prior_week = constants.season.week - 1
    // First join to prior week's game
    player_query.leftJoin('nfl_games as prior_week_game', function () {
      this.on(function () {
        this.on('prior_week_game.h', '=', 'player.current_nfl_team').orOn(
          'prior_week_game.v',
          '=',
          'player.current_nfl_team'
        )
      })
        .andOn('prior_week_game.week', '=', prior_week)
        .andOn('prior_week_game.year', '=', constants.season.year)
        .andOn(db.raw("prior_week_game.seas_type = 'REG'"))
    })
    // Then join to player's gamelog for that game
    player_query.leftJoin('player_gamelogs as prior_week_gamelog', function () {
      this.on('prior_week_gamelog.pid', '=', 'player.pid').andOn(
        'prior_week_gamelog.esbid',
        '=',
        'prior_week_game.esbid'
      )
    })
    player_query.select(
      'player.*',
      'practice.formatted_status as game_status',
      'nfl_games.day as game_day',
      db.raw(
        'CASE WHEN prior_week_gamelog.pid IS NULL OR prior_week_gamelog.active = false THEN true ELSE false END as prior_week_inactive'
      )
    )
  } else {
    player_query.select(
      'player.*',
      'practice.formatted_status as game_status',
      'nfl_games.day as game_day'
    )
  }

  const player_rows = await player_query.where({ 'player.pid': reserve_pid })

  const player_row = player_rows[0]

  if (!player_row) {
    throw new Error('invalid player')
  }

  // make sure player is on active roster
  const league = await getLeague({ lid: leagueId })
  if (!league) {
    throw new Error('invalid leagueId')
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
    rosterPlayer.slot === constants.slots.PSP ||
    rosterPlayer.slot === constants.slots.PSDP
  ) {
    throw new Error('protected players are not reserve eligible')
  }

  // check if practice squad player has active poaching claims
  if (
    rosterPlayer.slot === constants.slots.PS ||
    rosterPlayer.slot === constants.slots.PSD
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
  if (slot === constants.slots.COV) {
    if (constants.season.week === 0) {
      throw new Error(
        'player is not eligible for Reserve/COV during the Offseason'
      )
    }

    const { nfl_status } = player_row
    if (!isReserveCovEligible({ nfl_status })) {
      throw new Error('player not eligible for Reserve/COV')
    }
  } else {
    const { nfl_status, injury_status, prior_week_inactive, game_day } =
      player_row
    if (
      !isReserveEligible({
        nfl_status,
        injury_status,
        prior_week_inactive,
        week: constants.season.week,
        is_regular_season: constants.season.isRegularSeason,
        game_day
      })
    ) {
      throw new Error('player not eligible for Reserve')
    }
  }

  // make sure player was on previous week roster, unless acquired via a trade
  const prevRosterRow = await getRoster({
    tid,
    week: Math.max(constants.season.week - 1, 0),
    year: constants.season.year
  })
  const prevRoster = new Roster({ roster: prevRosterRow, league })
  const acquisitionTransaction = await getAcquisitionTransaction({
    lid: leagueId,
    pid: reserve_pid,
    tid
  })
  if (
    acquisitionTransaction.type !== constants.transactions.TRADE &&
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
  if (activate_pid && slot !== constants.slots.RESERVE_LONG_TERM) {
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
          p.slot !== constants.slots.RESERVE_SHORT_TERM
      )
    ) {
      throw new Error('player is not on reserve')
    }

    roster.removePlayer(reserve_pid)
    if (!roster.hasOpenBenchSlot(activate_player_row.pos)) {
      throw new Error('exceeds roster limits')
    }

    // activate player
    await db('rosters_players').update({ slot: constants.slots.BENCH }).where({
      rid: rosterRow.uid,
      pid: activate_pid
    })

    const { value } = await getLastTransaction({
      pid: activate_pid,
      lid: leagueId,
      tid
    })
    const transaction = {
      userid: userId,
      tid,
      lid: leagueId,
      pid: activate_pid,
      type: constants.transactions.ROSTER_ACTIVATE,
      value,
      week: constants.season.week,
      year: constants.season.year,
      timestamp: Math.round(Date.now() / 1000)
    }
    await db('transactions').insert(transaction)

    // return data
    data.push({
      pid: activate_pid,
      tid,
      slot: constants.slots.BENCH,
      rid: roster.uid,
      pos: activate_player_row.pos,
      transaction
    })

    // update roster
    roster.updateSlot(activate_pid, constants.slots.BENCH)
  }

  if (
    slot === constants.slots.RESERVE_SHORT_TERM &&
    !roster.has_open_reserve_short_term_slot()
  ) {
    throw new Error('exceeds roster limits')
  }

  const type =
    slot === constants.slots.RESERVE_SHORT_TERM
      ? constants.transactions.RESERVE_IR
      : slot === constants.slots.RESERVE_LONG_TERM
        ? constants.transactions.RESERVE_LONG_TERM
        : constants.transactions.RESERVE_COV
  await db('rosters_players').update({ slot }).where({
    rid: rosterRow.uid,
    pid: reserve_pid
  })

  const { value } = await getLastTransaction({
    pid: reserve_pid,
    lid: leagueId,
    tid
  })
  const transaction = {
    userid: userId,
    tid,
    lid: leagueId,
    pid: reserve_pid,
    type,
    value,
    week: constants.season.week,
    year: constants.season.year,
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
    year: constants.season.year
  })
  const team = teams[0]
  let message = `${team.name} (${team.abbrv}) has placed ${player_row.fname} ${player_row.lname} (${player_row.pos}) on ${constants.transactionsDetail[type]}.`

  if (activate_player_row) {
    message += ` ${activate_player_row.fname} ${activate_player_row.lname} (${activate_player_row.pos}) has been activated`
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
    pos: player_row.pos
  })

  return data
}
