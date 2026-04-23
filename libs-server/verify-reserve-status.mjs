import db from '#db'
import getRoster from './get-roster.mjs'
import getLeague from './get-league.mjs'
import {
  Roster,
  isReserveEligible,
  isReserveCovEligible,
  nfl_week_identifier
} from '#libs-shared'
import { current_season, roster_slot_types } from '#constants'
import apply_practice_current_week_join from './data-views/join-practice-current-week.mjs'
import apply_nfl_games_current_week_join from './data-views/join-nfl-games-current-week.mjs'
import apply_nfl_games_offset_week_join from './data-views/join-nfl-games-offset-week.mjs'

export default async function ({ team_id, league_id }) {
  const league = await getLeague({ lid: league_id })
  const rosterRow = await getRoster({ tid: team_id })
  const roster = new Roster({ roster: rosterRow, league })
  const reserve_pids = roster.reserve.map((p) => p.pid)

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
