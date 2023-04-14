import express from 'express'
import cron from 'node-cron'

import cache from '#api/cache.mjs'
import { getPlayers, getTransitionBids } from '#utils'

const router = express.Router()

const leagueIds = [0, 1]
const loadPlayers = async () => {
  for (const leagueId of leagueIds) {
    const players = await getPlayers({ leagueId, all: true })
    const cacheKey = `/players/${leagueId}`
    cache.set(cacheKey, players, 1800) // 30 mins
  }
}

if (process.env.NODE_ENV !== 'test') {
  loadPlayers()

  cron.schedule('*/5 * * * *', loadPlayers)
}

router.post('/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const search = req.body.q
    const { leagueId } = req.body
    const userId = req.auth ? req.auth.userId : null
    const pids = req.body.pids
      ? Array.isArray(req.body.pids)
        ? req.body.pids
        : [req.body.pids]
      : []

    const cacheKey = `/players/${leagueId || 0}`
    if (!search && !pids.length) {
      const players = cache.get(cacheKey)
      if (players) {
        logger('USING CACHE')
        if (userId) {
          const bids = await getTransitionBids({
            userId,
            leagueId
          })

          if (!bids.length) {
            return res.send(players)
          }

          return res.send(
            players.map((p) => {
              const { bid } = bids.find((b) => b.pid === p.pid) || {}
              return { bid, ...p }
            })
          )
        }

        return res.send(players)
      }
    }

    const players = await getPlayers({
      leagueId,
      pids,
      textSearch: search,
      all: !pids.length
    })

    if (!search && !pids.length) {
      cache.set(cacheKey, players, 1800) // 30 mins
    }

    if (userId) {
      const bids = await getTransitionBids({ userId, leagueId })
      if (!bids.length) {
        return res.send(players)
      }

      return res.send(
        players.map((p) => {
          const { bid } = bids.find((b) => b.pid === p.pid) || {}
          return { bid, ...p }
        })
      )
    }

    res.send(players)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/:pid', async (req, res) => {
  const { db, logger, cache } = req.app.locals
  try {
    const { pid } = req.params

    const cacheKey = `/player/${pid}`
    const cached_player_row = cache.get(cacheKey)
    if (cached_player_row) {
      return res.send(cached_player_row)
    }

    const player_rows = await db('player').where({ pid }).limit(1)
    const player_row = player_rows[0]

    // snaps per game by year

    // redzone stats by year

    // injury stats

    // penalties and yardage by year

    // advanced
    // - charted stats

    // advanced rushing
    // - yardage by direction

    cache.set(cacheKey, player_row, 1800) // 30 mins
    res.send(player_row)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/:pid/practices/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { pid } = req.params
    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    const data = await db('practice').where({ pid })
    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/:pid/gamelogs/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { pid } = req.params
    const leagueId = Number(req.query.leagueId || 0) || 0
    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    const query = db('player_gamelogs')
      .select(
        'player_gamelogs.*',
        'nfl_games.day',
        'nfl_games.date',
        'nfl_games.week',
        'nfl_games.year',
        'nfl_games.seas_type',
        'nfl_games.timestamp'
      )
      .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
      .where('player_gamelogs.pid', pid)

    if (leagueId) {
      query
        .leftJoin('league_player_gamelogs', function () {
          this.on(
            'league_player_gamelogs.pid',
            '=',
            'player_gamelogs.pid'
          ).andOn('league_player_gamelogs.esbid', '=', 'player_gamelogs.esbid')
        })
        .select(
          'league_player_gamelogs.points',
          'league_player_gamelogs.points_added',
          'league_player_gamelogs.pos_rnk'
        )
        .where(function () {
          this.where('league_player_gamelogs.lid', leagueId).orWhereNull(
            'league_player_gamelogs.lid'
          )
        })
    }

    const data = await query
    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
