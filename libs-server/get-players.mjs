import debug from 'debug'

import db from '#db'
import { constants } from '#libs-shared'
import get_player_transactions from './get-player-transactions.mjs'
import getLeague from './get-league.mjs'

const log = debug('get_players')

export default async function ({
  textSearch,
  teamId,
  leagueId,
  scoring_format_hash,
  league_format_hash,
  columns = [],
  pids = [],
  include_all_active_players = false,
  include_baseline_players = false
}) {
  const league_roster_player_ids = []
  const baseline_player_ids = []

  const projectionLeagueId = leagueId || constants.DEFAULTS.LEAGUE_ID
  const league = await getLeague({ lid: projectionLeagueId })

  if (!league_format_hash) {
    league_format_hash = league.league_format_hash
  }

  if (!scoring_format_hash) {
    scoring_format_hash = league.scoring_format_hash
  }

  if (teamId) {
    const query = db('rosters_players')
      .where({ tid: teamId, year: constants.season.year })
      .groupBy(
        'rosters_players.pid',
        'rosters_players.rid',
        'rosters_players.tid',
        'rosters_players.lid',
        'rosters_players.week',
        'rosters_players.year',
        'rosters_players.slot',
        'rosters_players.pos',
        'rosters_players.tag',
        'rosters_players.extensions'
      )

    if (pids.length) {
      query.whereIn('rosters_players.pid', pids)
    }

    const playerSlots = await query
    playerSlots.forEach((s) => league_roster_player_ids.push(s.pid))
  } else if (leagueId) {
    const query = db('rosters_players')
      .where({ lid: leagueId, year: constants.season.year })
      .groupBy(
        'rosters_players.pid',
        'rosters_players.rid',
        'rosters_players.tid',
        'rosters_players.lid',
        'rosters_players.week',
        'rosters_players.year',
        'rosters_players.slot',
        'rosters_players.pos',
        'rosters_players.tag',
        'rosters_players.extensions'
      )

    if (pids.length) {
      query.whereIn('rosters_players.pid', pids)
    }

    const playerSlots = await query
    playerSlots.forEach((s) => league_roster_player_ids.push(s.pid))
  }

  if (include_baseline_players && leagueId) {
    const baselines = await db('league_baselines')
      .select('pid')
      .where({ lid: leagueId })
      .groupBy('pid')
    baselines.forEach((b) => baseline_player_ids.push(b.pid))
  }

  const query = db('player')
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
    // First join to prior week's game (to detect if it was a bye week)
    query.leftJoin('nfl_games as prior_week_game', function () {
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
    // Join to reference week game (week - 2 if prior week was bye, else week - 1)
    query.leftJoin('nfl_games as reference_week_game', function () {
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
        .andOn('reference_week_game.year', '=', constants.season.year)
        .andOn(db.raw("reference_week_game.seas_type = 'REG'"))
    })
    // Then join to player's gamelog for the reference week game
    query.leftJoin('player_gamelogs as prior_week_gamelog', function () {
      this.on('prior_week_gamelog.pid', '=', 'player.pid').andOn(
        'prior_week_gamelog.esbid',
        '=',
        'reference_week_game.esbid'
      )
    })
  }

  const selects = ['player.pid']

  if (columns.length) {
    for (const column of columns) {
      // TODO check if table needs to be joined
      selects.push(`${column.table_name}.${column.column_name}`)
    }

    query.select(db.raw(selects.join(',')))
    query.groupBy(db.raw(selects.join(',')))
  } else {
    const default_columns = [
      'player.fname',
      'player.lname',
      'player.pname',
      'player.nfl_draft_year',
      'player.col',
      'player.dv',
      'player.pos',
      'player.round',
      'player.current_nfl_team',
      'player.gsisid',
      'player.gsispid',
      'player.espn_id',
      'player.nfl_status',
      'player.injury_status'
    ]

    selects.push(...default_columns)

    query.select(db.raw(selects.join(',')))
    query.groupBy(db.raw(selects.join(',')))

    query.select('practice.formatted_status as game_status')
    query.groupBy('game_status')

    // Include practice day columns for reserve eligibility checking
    query.select(
      'practice.m',
      'practice.tu',
      'practice.w',
      'practice.th',
      'practice.f',
      'practice.s',
      'practice.su',
      'practice.status',
      'practice.formatted_status'
    )
    query.groupBy(
      'practice.m',
      'practice.tu',
      'practice.w',
      'practice.th',
      'practice.f',
      'practice.s',
      'practice.su',
      'practice.status',
      'practice.formatted_status'
    )

    query.select('nfl_games.day as game_day')
    query.groupBy('game_day')

    // Calculate prior_week_inactive: true if no gamelog OR gamelog.active is false
    if (constants.season.week > 1) {
      query.select(
        db.raw(
          'CASE WHEN prior_week_gamelog.pid IS NULL OR prior_week_gamelog.active = false THEN true ELSE false END as prior_week_inactive'
        )
      )
      query.groupBy('prior_week_gamelog.pid', 'prior_week_gamelog.active')
    }
  }

  if (textSearch) {
    query
      .whereRaw(
        "name_search_vector @@ plainto_tsquery('english', ?)",
        textSearch
      )
      .whereIn('player.pos', constants.positions)
  } else if (pids.length) {
    query.whereIn('player.pid', pids)
  } else if (include_all_active_players) {
    query.orWhere(function () {
      this.whereIn('player.pos', constants.positions)
        .whereNot('player.current_nfl_team', 'INA')
        .where(function () {
          this.whereNotIn('player.nfl_status', [
            constants.player_nfl_status.RETIRED
          ]).orWhereNull('player.nfl_status')
        })
    })

    // include rookies during offseason
    if (constants.season.week === 0) {
      query.orWhere(function () {
        this.where('player.nfl_draft_year', constants.season.year).whereIn(
          'player.pos',
          constants.positions
        )
      })
    }
  } else if (league_roster_player_ids.length) {
    // only limit to players on league rosters when other conditions are not met
    query.whereIn('player.pid', league_roster_player_ids)
  }

  if (league_format_hash) {
    const league_format_player_seasonlogs_selects = [
      'league_format_player_seasonlogs.startable_games',
      'league_format_player_seasonlogs.points_added',
      'league_format_player_seasonlogs.points_added_per_game',
      'league_format_player_seasonlogs.points_added_rnk',
      'league_format_player_seasonlogs.points_added_pos_rnk'
    ]
    query
      .leftJoin('league_format_player_seasonlogs', function () {
        this.on('league_format_player_seasonlogs.pid', 'player.pid')
        this.andOn(
          'league_format_player_seasonlogs.year',
          constants.season.year
        )
        this.andOn(
          db.raw(
            `league_format_player_seasonlogs.league_format_hash = '${league_format_hash}'`
          )
        )
      })
      .select(db.raw(league_format_player_seasonlogs_selects.join(',')))
      .groupBy(db.raw(league_format_player_seasonlogs_selects.join(',')))
  }

  if (scoring_format_hash) {
    const scoring_format_player_seasonlogs_selects = [
      'scoring_format_player_seasonlogs.points',
      'scoring_format_player_seasonlogs.points_per_game',
      'scoring_format_player_seasonlogs.points_rnk',
      'scoring_format_player_seasonlogs.points_pos_rnk'
    ]

    query
      .leftJoin('scoring_format_player_seasonlogs', function () {
        this.on('scoring_format_player_seasonlogs.pid', 'player.pid')
        this.andOn(
          'scoring_format_player_seasonlogs.year',
          constants.season.year
        )
        this.andOn(
          db.raw(
            `scoring_format_player_seasonlogs.scoring_format_hash = '${scoring_format_hash}'`
          )
        )
      })
      .select(db.raw(scoring_format_player_seasonlogs_selects.join(',')))
      .groupBy(db.raw(scoring_format_player_seasonlogs_selects.join(',')))
  }

  if (baseline_player_ids.length) {
    query.orWhereIn('player.pid', baseline_player_ids)
  }

  log(query.toString())
  const player_rows = await query

  const players_by_pid = {}
  for (const player_row of player_rows) {
    player_row.value = null
    player_row.points = {}
    player_row.pts_added = {}
    player_row.salary_adj_pts_added = {}
    player_row.market_salary = {}
    player_row.projection = {}
    players_by_pid[player_row.pid] = player_row
  }

  const returnedPlayerIds = Object.keys(players_by_pid)
  const playerIdsInLeague = returnedPlayerIds.filter((pid) =>
    league_roster_player_ids.includes(pid)
  )

  if (playerIdsInLeague.length) {
    // include league player salary values
    const playerTransactions = await get_player_transactions({
      lid: leagueId,
      pids: playerIdsInLeague
    })

    for (const tran of playerTransactions) {
      const player_row = player_rows.find((p) => p.pid === tran.pid)
      player_row.value = tran.value
    }
  }

  if (scoring_format_hash) {
    // include projected fantasy point values
    const leaguePointsProj = await db('scoring_format_player_projection_points')
      .where({
        scoring_format_hash,
        year: constants.season.year
      })
      .whereIn('pid', returnedPlayerIds)

    for (const pointProjection of leaguePointsProj) {
      players_by_pid[pointProjection.pid].points[pointProjection.week] =
        pointProjection
    }
  }

  if (league_format_hash) {
    // include points added and market salary
    const league_format_values = await db(
      'league_format_player_projection_values'
    )
      .where({
        league_format_hash,
        year: constants.season.year
      })
      .whereIn('pid', returnedPlayerIds)

    for (const row of league_format_values) {
      const { pid, week, pts_added, market_salary } = row
      players_by_pid[pid].pts_added[week] = pts_added
      players_by_pid[pid].market_salary[week] = market_salary
    }
  }

  if (leagueId) {
    // include salary adjusted points added and inflation adjusted market salary
    const leagueValuesProj = await db('league_player_projection_values')
      .where({
        lid: leagueId,
        year: constants.season.year
      })
      .whereIn('pid', returnedPlayerIds)

    for (const pointProjection of leagueValuesProj) {
      const { pid, week, salary_adj_pts_added, market_salary_adj } =
        pointProjection
      players_by_pid[pid].salary_adj_pts_added[week] = salary_adj_pts_added

      if (pointProjection.week === '0') {
        players_by_pid[pid].market_salary_adj = market_salary_adj
      }
    }
  }

  // include player season, week and ros projections
  const projections = await db('projections_index')
    .where('sourceid', constants.sources.AVERAGE)
    .where('year', constants.season.year)
    .where('week', '>=', constants.season.week)
    .whereIn('pid', returnedPlayerIds)
    .where('seas_type', 'REG')
  const rosProjections = await db('ros_projections')
    .where('sourceid', constants.sources.AVERAGE)
    .where('year', constants.season.year)
    .whereIn('pid', returnedPlayerIds)

  for (const projection of projections) {
    players_by_pid[projection.pid].projection[projection.week] = projection
  }

  for (const rosProjection of rosProjections) {
    players_by_pid[rosProjection.pid].projection.ros = rosProjection
  }

  if (
    !include_all_active_players &&
    !textSearch &&
    !pids.length &&
    (teamId || leagueId)
  ) {
    const params = leagueId ? { lid: leagueId } : { tid: teamId }
    const contributions = await db('league_team_lineup_contributions').where(
      params
    )
    const contribution_weeks = await db(
      'league_team_lineup_contribution_weeks'
    ).where(params)

    for (const player_contribution of contributions) {
      const { pid, starts, sp, bp } = player_contribution
      if (!players_by_pid[pid]) continue

      const player_contribution_weeks = contribution_weeks.filter(
        (w) => w.pid === player_contribution.pid
      )
      const weeks = {}
      for (const { week, start, sp, bp } of player_contribution_weeks) {
        weeks[week] = { week, start, sp, bp }
      }

      players_by_pid[pid].lineups = {
        starts,
        sp,
        bp,
        weeks
      }
    }
  }

  return Object.values(players_by_pid)
}
