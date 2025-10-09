import db from '#db'
import getRoster from './get-roster.mjs'
import getLeague from './get-league.mjs'
import {
  constants,
  Roster,
  isReserveEligible,
  isReserveCovEligible
} from '#libs-shared'

export default async function ({ teamId, leagueId }) {
  const league = await getLeague({ lid: leagueId })
  const rosterRow = await getRoster({ tid: teamId })
  const roster = new Roster({ roster: rosterRow, league })
  const reserve_pids = roster.reserve.map((p) => p.pid)

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

  const player_rows = await player_query.whereIn('player.pid', reserve_pids)

  for (const roster_player of roster.reserve) {
    const player_row = player_rows.find((p) => p.pid === roster_player.pid)
    if (!player_row) {
      throw new Error('Reserve player violation')
    }

    const { nfl_status, injury_status, prior_week_inactive, game_day } =
      player_row

    if (
      (roster_player.slot === constants.slots.RESERVE_SHORT_TERM ||
        roster_player.slot === constants.slots.RESERVE_LONG_TERM) &&
      !isReserveEligible({
        nfl_status,
        injury_status,
        prior_week_inactive,
        week: constants.season.week,
        is_regular_season: constants.season.isRegularSeason,
        game_day
      })
    ) {
      throw new Error('Reserve player violation')
    } else if (
      roster_player.slot === constants.slots.COV &&
      !isReserveCovEligible({ nfl_status })
    ) {
      throw new Error('Reserve player violation')
    }
  }
}
