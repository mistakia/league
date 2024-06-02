import debug from 'debug'

import db from '#db'
import { constants } from '#libs-shared'
import getPlayerTransactions from './get-player-transactions.mjs'
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
      .groupBy('rosters_players.pid')

    if (pids.length) {
      query.whereIn('rosters_players.pid', pids)
    }

    const playerSlots = await query
    playerSlots.forEach((s) => league_roster_player_ids.push(s.pid))
  } else if (leagueId) {
    const query = db('rosters_players')
      .where({ lid: leagueId, year: constants.season.year })
      .groupBy('rosters_players.pid')

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

  const selects = ['player.pid']

  if (columns.length) {
    for (const column of columns) {
      // TODO check if table needs to be joined
      selects.push(`${column.table_name}.${column.column_name}`)
    }
  } else {
    const default_columns = [
      'player.fname',
      'player.lname',
      'player.pname',
      'player.start',
      'player.col',
      'player.dv',
      'player.pos',
      'player.round',
      'player.current_nfl_team',
      'player.gsisid',
      'player.gsispid',
      'player.espn_id',
      'player.nfl_status',
      'player.injury_status',
      'practice.formatted_status as game_status'
    ]

    selects.push(...default_columns)
  }

  const query = db('player')
    .select(db.raw(selects.join(',')))
    .leftJoin('practice', function () {
      this.on('player.pid', '=', 'practice.pid')
        .andOn('practice.week', '=', constants.season.week)
        .andOn('practice.year', '=', constants.season.year)
    })
    .groupBy('player.pid')

  if (textSearch) {
    query
      .whereRaw('MATCH(fname, lname) AGAINST(? IN BOOLEAN MODE)', textSearch)
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
        this.where('player.start', constants.season.year).whereIn(
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
      'league_format_player_seasonlogs.points',
      'league_format_player_seasonlogs.points_per_game',
      'league_format_player_seasonlogs.points_added',
      'league_format_player_seasonlogs.points_added_per_game',
      'league_format_player_seasonlogs.points_rnk',
      'league_format_player_seasonlogs.points_pos_rnk',
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
    const playerTransactions = await getPlayerTransactions({
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
