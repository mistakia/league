const express = require('express')
const router = express.Router()

const { constants } = require('../../common')
const { getPlayerTransactions } = require('../../utils')

router.get('/?', async (req, res) => {
  const { db, logger, cache } = req.app.locals
  try {
    const search = req.query.q
    const { leagueId } = req.query

    const topPlayerIds = []
    const latestRanking = db('rankings')
      .select(db.raw('max(timestamp) as maxtime'))
      .where('year', constants.season.year)
      .where('sf', 1)
      .where('rookie', 0)
      .where('ppr', constants.scoring.HALF)
      .where('sourceid', constants.sources.FANTASYPROS)
      .where('dynasty', 0)
    const maxtime = latestRanking.length ? latestRanking[0].maxtime : null

    if (maxtime) {
      const topPlayers = db('rankings').where({
        timestamp: maxtime,
        sf: 1,
        dynasty: 0,
        ppr: constants.scoring.HALF,
        rookie: 0,
        year: constants.season.year,
        sourceid: constants.sources.FANTASYPROS
      })

      topPlayers.forEach((p) => topPlayerIds.push(p.player))
    }

    const leaguePlayerIds = []
    if (req.user && !search && leagueId) {
      const playerSlots = await db('rosters_players')
        .join('rosters', 'rosters_players.rid', 'rosters.uid')
        .where('rosters.lid', leagueId)
        .where('rosters.year', constants.season.year)
        .groupBy('rosters_players.player')

      playerSlots.forEach((s) => leaguePlayerIds.push(s.player))
    }

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

    if (search) {
      query.whereRaw('MATCH(fname, lname) AGAINST(? IN BOOLEAN MODE)', search)
    } else {
      const includePlayerIds = [...topPlayerIds, ...leaguePlayerIds]
      if (includePlayerIds.length) {
        query.whereIn('player.player', includePlayerIds)
      }

      query
        .orWhere(function () {
          this.where('player.pos', 'QB')
            .whereNot('player.posd', 'PS')
            .whereNot('player.cteam', 'INA')
        })
        .orWhere(function () {
          this.where('player.pos', 'RB')
            .where('player.posd', 'RB')
            .whereNot('player.cteam', 'INA')
        })
        .orWhere(function () {
          this.where('player.pos', 'WR')
            .whereNot('player.posd', 'PS')
            .whereNot('player.cteam', 'INA')
        })
        .orWhere(function () {
          this.where('player.pos', 'TE')
            .whereNot('player.posd', 'PS')
            .whereNot('player.cteam', 'INA')
        })
        .orWhere(function () {
          this.where('player.pos', 'K')
            .whereNot('player.posd', 'PS')
            .whereNot('player.cteam', 'INA')
        })
        .orWhere('player.pos', 'DST')

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

    if (leaguePlayerIds.length) {
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
        .join(
          'rosters_players',
          'transactions.player',
          'rosters_players.player'
        )
        .join('rosters', function () {
          this.on('rosters_players.rid', '=', 'rosters.uid')
          this.on('transactions.tid', '=', 'rosters.tid')
        })
        .where('rosters.week', constants.season.week)
        .where('rosters.year', constants.season.year)
        .where('rosters.lid', leagueId)
        .whereIn('type', [constants.transactions.EXTENSION])
        .whereIn('transactions.player', leaguePlayerIds)

      if (transactions.length) {
        for (const player of data) {
          player.extensions = transactions.filter(
            (p) => p.player === player.player
          )
        }
      }

      const query1 = await db('teams')
        .select('teams.*')
        .join('users_teams', 'teams.uid', 'users_teams.tid')
        .where('users_teams.userid', req.user.userId)
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

      const playerTransactions = await getPlayerTransactions({
        lid: leagueId,
        playerIds: leaguePlayerIds
      })

      for (const tran of playerTransactions) {
        const player = data.find((p) => p.player === tran.player)
        player.value = tran.value
      }
    }

    const playerMap = {}
    for (const player of data) {
      player.value =
        typeof player.value === 'undefined' || player.value === null
          ? null
          : player.value
      player.points = {}
      player.vorp = {}
      player.vorp_adj = {}
      player.market_salary = {}
      player.market_salary_adj = {}
      player.projection = {}
      playerMap[player.player] = player
    }

    if (leagueId) {
      const pointsCacheKey = `/league/${leagueId}/points`
      let leaguePointsProj = cache.get(pointsCacheKey)
      if (!leaguePointsProj) {
        leaguePointsProj = await db('league_player_projection_points')
          .where({
            lid: leagueId,
            year: constants.season.year
          })
          .whereIn('player', Object.keys(playerMap))
        cache.set(pointsCacheKey, leaguePointsProj, 14400) // 4 hours
      }

      for (const pointProjection of leaguePointsProj) {
        playerMap[pointProjection.player].points[
          pointProjection.week
        ] = pointProjection
      }

      const valuesCacheKey = `/league/${leagueId}/values`
      let leagueValuesProj = cache.get(valuesCacheKey)
      if (!leagueValuesProj) {
        leagueValuesProj = await db('league_player_projection_values')
          .where({
            lid: leagueId,
            year: constants.season.year
          })
          .whereIn('player', Object.keys(playerMap))
        cache.set(valuesCacheKey, leagueValuesProj, 14400) // 4 hours
      }

      for (const pointProjection of leagueValuesProj) {
        const {
          vorp,
          vorp_adj,
          market_salary,
          market_salary_adj
        } = pointProjection
        playerMap[pointProjection.player].vorp[pointProjection.week] = vorp
        playerMap[pointProjection.player].vorp_adj[
          pointProjection.week
        ] = vorp_adj
        playerMap[pointProjection.player].market_salary[
          pointProjection.week
        ] = market_salary
        playerMap[pointProjection.player].market_salary_adj[
          pointProjection.week
        ] = market_salary_adj
      }
    }

    let projections = cache.get('projections')
    if (!projections) {
      projections = await db('projections')
        .where('sourceid', constants.sources.AVERAGE)
        .where('year', constants.season.year)
        .where('week', '>=', constants.season.week)
        .whereIn('player', Object.keys(playerMap))
      cache.set('projections', projections, 14400) // 4 hours
    }

    for (const projection of projections) {
      playerMap[projection.player].projection[projection.week] = projection
    }

    logger(`responding with ${data.length} players`)
    res.send(Object.values(playerMap))
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/:playerId', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { playerId } = req.params

    const players = await db('player').where({ player: playerId }).limit(1)
    const player = players[0]
    const practice = await db('practice').where({
      player: playerId,
      year: constants.season.year
    })

    // snaps per game by year

    // redzone stats by year

    // injury stats

    // penalties and yardage by year

    // advanced
    // - charted stats

    // advanced rushing
    // - yardage by direction
    res.send({ ...player, practice })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
