import db from '#db'
import { constants } from '#common'
import getPlayerTransactions from './get-player-transactions.mjs'

export default async function ({
  textSearch,
  leagueId,
  pids = [],
  all = false,
  teamId,
  baseline_players = false
}) {
  const leaguePlayerIds = []
  const baselinePlayerIds = []

  const projectionLeagueId = leagueId || constants.DEFAULTS.LEAGUE_ID

  if (teamId) {
    const query = db('rosters_players')
      .join('rosters', 'rosters_players.rid', 'rosters.uid')
      .where('rosters.tid', teamId)
      .where('rosters.year', constants.season.year)
      .groupBy('rosters_players.pid')

    if (pids.length) {
      query.whereIn('rosters_players.pid', pids)
    }

    const playerSlots = await query
    playerSlots.forEach((s) => leaguePlayerIds.push(s.pid))
  } else if (leagueId) {
    const query = db('rosters_players')
      .join('rosters', 'rosters_players.rid', 'rosters.uid')
      .where('rosters.lid', leagueId)
      .where('rosters.year', constants.season.year)
      .groupBy('rosters_players.pid')

    if (pids.length) {
      query.whereIn('rosters_players.pid', pids)
    }

    const playerSlots = await query
    playerSlots.forEach((s) => leaguePlayerIds.push(s.pid))
  }

  if (baseline_players) {
    const baselines = await db('league_baselines')
      .select('pid')
      .where({ lid: projectionLeagueId })
      .groupBy('pid')
    baselines.forEach((b) => baselinePlayerIds.push(b.pid))
  }

  const selects = [
    'player.pid',
    'player.fname',
    'player.lname',
    'player.pname',
    'player.start',
    'player.col',
    'player.dv',
    'player.pos',
    'player.posd',
    'player.cteam',
    'player.gsisid',
    'player.gsispid',
    'player.espn_id',
    'player.status',
    'player.injury_status',
    'practice.status as gamestatus'
  ]

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
  } else if (all) {
    query.orWhere(function () {
      this.whereIn('player.pos', constants.positions).whereNot(
        'player.cteam',
        'INA'
      )
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
  }

  if (leaguePlayerIds.length) {
    query.orWhereIn('player.pid', leaguePlayerIds)
  }

  if (baselinePlayerIds.length) {
    query.orWhereIn('player.pid', baselinePlayerIds)
  }

  const player_rows = await query

  const players_by_pid = {}
  for (const player_row of player_rows) {
    player_row.value = null
    player_row.points = {}
    player_row.vorp = {}
    player_row.vorp_adj = {}
    player_row.market_salary = {}
    player_row.projection = {}
    players_by_pid[player_row.pid] = player_row
  }

  const returnedPlayerIds = Object.keys(players_by_pid)
  const playerIdsInLeague = returnedPlayerIds.filter((pid) =>
    leaguePlayerIds.includes(pid)
  )

  if (playerIdsInLeague.length) {
    const playerTransactions = await getPlayerTransactions({
      lid: leagueId,
      pids: playerIdsInLeague
    })

    for (const tran of playerTransactions) {
      const player_row = player_rows.find((p) => p.pid === tran.pid)
      player_row.value = tran.value
    }
  }

  const leaguePointsProj = await db('league_player_projection_points')
    .where({
      lid: projectionLeagueId,
      year: constants.season.year
    })
    .whereIn('pid', returnedPlayerIds)

  for (const pointProjection of leaguePointsProj) {
    players_by_pid[pointProjection.pid].points[pointProjection.week] =
      pointProjection
  }

  const leagueValuesProj = await db('league_player_projection_values')
    .where({
      lid: projectionLeagueId,
      year: constants.season.year
    })
    .whereIn('pid', returnedPlayerIds)

  for (const pointProjection of leagueValuesProj) {
    const { vorp, vorp_adj, market_salary, market_salary_adj } = pointProjection
    players_by_pid[pointProjection.pid].vorp[pointProjection.week] = vorp
    players_by_pid[pointProjection.pid].vorp_adj[pointProjection.week] =
      vorp_adj
    players_by_pid[pointProjection.pid].market_salary[pointProjection.week] =
      market_salary

    if (pointProjection.week === '0') {
      players_by_pid[pointProjection.pid].market_salary_adj = market_salary_adj
    }
  }

  const projections = await db('projections')
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

  return Object.values(players_by_pid)
}
