import express from 'express'
import cron from 'node-cron'

import { constants } from '#common'
import cache from '#api/cache.mjs'
import { getPlayers, getTransitionBids } from '#utils'

const router = express.Router()

const leagueIds = [0, 1]
const loadPlayers = async () => {
  for (const leagueId of leagueIds) {
    const players = await getPlayers({ leagueId })
    const cacheKey = `/players/${leagueId}`
    cache.set(cacheKey, players, 1800) // 30 mins
  }
}

if (process.env.NODE_ENV !== 'test') {
  loadPlayers()

  cron.schedule('*/5 * * * *', loadPlayers)
}

router.get('/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const search = req.query.q
    const { leagueId } = req.query
    const userId = req.auth ? req.auth.userId : null

    const cacheKey = `/players/${leagueId || 0}`
    if (!search) {
      const players = cache.get(cacheKey)
      if (players) {
        logger('USING CACHE')
        if (userId) {
          const bids = getTransitionBids({
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
      textSearch: search
    })

    if (!search) {
      cache.set(cacheKey, players, 1800) // 30 mins
    }

    if (userId) {
      const bids = getTransitionBids({ userId, leagueId })
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
  const { db, logger } = req.app.locals
  try {
    const { pid } = req.params

    const player_rows = await db('player').where({ pid }).limit(1)
    const player_row = player_rows[0]
    const practice = await db('practice').where({
      pid,
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
    res.send({ ...player_row, practice })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
