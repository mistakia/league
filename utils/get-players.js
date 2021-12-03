const db = require('../db')
const { constants } = require('../common')
const getPlayerTransactions = require('./get-player-transactions')

module.exports = async function ({
  textSearch,
  userId,
  leagueId,
  playerIds = []
}) {
  const leaguePlayerIds = []
  const baselinePlayerIds = []

  const projectionLeagueId = leagueId || constants.DEFAULTS.LEAGUE_ID

  if (leagueId) {
    const query = db('rosters_players')
      .join('rosters', 'rosters_players.rid', 'rosters.uid')
      .where('rosters.lid', leagueId)
      .where('rosters.year', constants.season.year)
      .groupBy('rosters_players.player')

    if (playerIds.length) {
      query.whereIn('rosters_players.player', playerIds)
    }

    const playerSlots = await query
    playerSlots.forEach((s) => leaguePlayerIds.push(s.player))
  }

  const baselines = await db('league_baselines')
    .select('player')
    .where({ lid: projectionLeagueId })
    .groupBy('player')
  baselines.forEach((b) => baselinePlayerIds.push(b.player))

  const selects = [
    'player.player',
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
      this.on('player.player', '=', 'practice.player')
        .andOn('practice.week', '=', constants.season.week)
        .andOn('practice.year', '=', constants.season.year)
    })
    .whereIn('player.pos', constants.positions)
    .groupBy('player.player')

  if (textSearch) {
    query.whereRaw('MATCH(fname, lname) AGAINST(? IN BOOLEAN MODE)', textSearch)
  } else if (playerIds.length) {
    query.whereIn('player.player', playerIds)
  } else {
    if (leaguePlayerIds.length) {
      query.orWhereIn('player.player', leaguePlayerIds)
    }

    if (baselinePlayerIds.length) {
      query.orWhereIn('player.player', baselinePlayerIds)
    }

    query.whereNot('player.cteam', 'INA')

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

  const data = await query

  const playerMap = {}
  for (const player of data) {
    player.value = null
    player.points = {}
    player.vorp = {}
    player.vorp_adj = {}
    player.market_salary = {}
    player.projection = {}
    playerMap[player.player] = player
  }

  const returnedPlayerIds = Object.keys(playerMap)
  const playerIdsInLeague = returnedPlayerIds.filter((player) =>
    leaguePlayerIds.includes(player)
  )

  if (playerIdsInLeague.length) {
    // TODO - get extension count for player
    const transactions = await db('transactions')
      .select(
        'transactions.type',
        'transactions.value',
        'transactions.timestamp',
        'transactions.tid',
        'transactions.lid',
        'transactions.player'
      )
      .join('rosters_players', 'transactions.player', 'rosters_players.player')
      .join('rosters', function () {
        this.on('rosters_players.rid', '=', 'rosters.uid')
        this.on('transactions.tid', '=', 'rosters.tid')
      })
      .where('rosters.week', constants.season.week)
      .where('rosters.year', constants.season.year)
      .where('rosters.lid', leagueId)
      .whereIn('type', [constants.transactions.EXTENSION])
      .whereIn('transactions.player', playerIdsInLeague)

    if (transactions.length) {
      for (const player of data) {
        player.extensions = transactions.filter(
          (p) => p.player === player.player
        )
      }
    }

    // include player restricted free agency bid
    if (userId) {
      const query1 = await db('teams')
        .select('teams.*')
        .join('users_teams', 'teams.uid', 'users_teams.tid')
        .where('users_teams.userid', userId)
        .where('teams.lid', leagueId)

      if (query1.length) {
        const tid = query1[0].uid
        const bids = await db('transition_bids')
          .where('tid', tid)
          .where('year', constants.season.year)
          .whereNull('cancelled')
          .whereNull('processed')

        if (bids.length) {
          for (const player of data) {
            const { bid } = bids.find((b) => b.player === player.player) || {}
            player.bid = bid
          }
        }
      }
    }

    const playerTransactions = await getPlayerTransactions({
      lid: leagueId,
      playerIds: playerIdsInLeague
    })

    for (const tran of playerTransactions) {
      const player = data.find((p) => p.player === tran.player)
      player.value = tran.value
    }
  }

  const leaguePointsProj = await db('league_player_projection_points')
    .where({
      lid: projectionLeagueId,
      year: constants.season.year
    })
    .whereIn('player', returnedPlayerIds)

  for (const pointProjection of leaguePointsProj) {
    playerMap[pointProjection.player].points[
      pointProjection.week
    ] = pointProjection
  }

  const leagueValuesProj = await db('league_player_projection_values')
    .where({
      lid: projectionLeagueId,
      year: constants.season.year
    })
    .whereIn('player', returnedPlayerIds)

  for (const pointProjection of leagueValuesProj) {
    const { vorp, vorp_adj, market_salary } = pointProjection
    playerMap[pointProjection.player].vorp[pointProjection.week] = vorp
    playerMap[pointProjection.player].vorp_adj[pointProjection.week] = vorp_adj
    playerMap[pointProjection.player].market_salary[
      pointProjection.week
    ] = market_salary
  }

  const projections = await db('projections')
    .where('sourceid', constants.sources.AVERAGE)
    .where('year', constants.season.year)
    .where('week', '>=', constants.season.week)
    .whereIn('player', returnedPlayerIds)

  const rosProjections = await db('ros_projections')
    .where('sourceid', constants.sources.AVERAGE)
    .where('year', constants.season.year)
    .whereIn('player', returnedPlayerIds)

  for (const projection of projections) {
    playerMap[projection.player].projection[projection.week] = projection
  }

  for (const rosProjection of rosProjections) {
    playerMap[rosProjection.player].projection.ros = rosProjection
  }

  return Object.values(playerMap)
}
