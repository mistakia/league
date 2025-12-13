import db from '#db'
import getRoster from './get-roster.mjs'
import getLeague from './get-league.mjs'
import { Roster, isReserveEligible, isReserveCovEligible } from '#libs-shared'
import { current_season, roster_slot_types } from '#constants'

export default async function ({ teamId, leagueId }) {
  const league = await getLeague({ lid: leagueId })
  const rosterRow = await getRoster({ tid: teamId })
  const roster = new Roster({ roster: rosterRow, league })
  const reserve_pids = roster.reserve.map((p) => p.pid)

  const player_query = db('player')
    .leftJoin('practice', function () {
      this.on('player.pid', '=', 'practice.pid')
        .andOn('practice.week', '=', current_season.week)
        .andOn('practice.year', '=', current_season.year)
    })
    .leftJoin('nfl_games', function () {
      this.on(function () {
        this.on('nfl_games.h', '=', 'player.current_nfl_team').orOn(
          'nfl_games.v',
          '=',
          'player.current_nfl_team'
        )
      })
        .andOn('nfl_games.week', '=', current_season.week)
        .andOn('nfl_games.year', '=', current_season.year)
        .andOn(db.raw("nfl_games.seas_type = 'REG'"))
    })

  // Only join prior week gamelog data if week > 1
  if (current_season.week > 1) {
    const prior_week = current_season.week - 1
    // First join to prior week's game (to detect if it was a bye week)
    player_query.leftJoin('nfl_games as prior_week_game', function () {
      this.on(function () {
        this.on('prior_week_game.h', '=', 'player.current_nfl_team').orOn(
          'prior_week_game.v',
          '=',
          'player.current_nfl_team'
        )
      })
        .andOn('prior_week_game.week', '=', prior_week)
        .andOn('prior_week_game.year', '=', current_season.year)
        .andOn(db.raw("prior_week_game.seas_type = 'REG'"))
    })
    // Join to reference week game (week - 2 if prior week was bye, else week - 1)
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
            `CASE WHEN prior_week_game.esbid IS NULL THEN ${prior_week - 1} ELSE ${prior_week} END`
          )
        )
        .andOn('reference_week_game.year', '=', current_season.year)
        .andOn(db.raw("reference_week_game.seas_type = 'REG'"))
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
      db.raw(
        'COALESCE(practice.game_designation, player.game_designation) as game_designation'
      ),
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
      db.raw(
        'COALESCE(practice.game_designation, player.game_designation) as game_designation'
      ),
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

  const player_rows = await player_query.whereIn('player.pid', reserve_pids)

  for (const roster_player of roster.reserve) {
    const player_row = player_rows.find((p) => p.pid === roster_player.pid)
    if (!player_row) {
      throw new Error('Reserve player violation')
    }

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
      (roster_player.slot === roster_slot_types.RESERVE_SHORT_TERM ||
        roster_player.slot === roster_slot_types.RESERVE_LONG_TERM) &&
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
      throw new Error('Reserve player violation')
    } else if (
      roster_player.slot === roster_slot_types.COV &&
      !isReserveCovEligible({ roster_status })
    ) {
      throw new Error('Reserve player violation')
    }
  }
}
