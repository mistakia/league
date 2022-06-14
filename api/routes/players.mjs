import express from 'express'
import cron from 'node-cron'

import { constants } from '#common'
import cache from '#api/cache.mjs'
import { getPlayers, updatePlayersWithTransitionBids } from '#utils'

const router = express.Router()

const leagueIds = [0, 1]
const loadPlayers = async () => {
  for (const leagueId of leagueIds) {
    const players = await getPlayers({ leagueId })
    const cacheKey = `/players/${leagueId}`
    cache.set(cacheKey, players, 1800) // 30 mins
  }
}

if (process.env.NODE_ENV === 'production') {
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
      const cacheValue = cache.get(cacheKey)
      if (cacheValue) {
        logger('USING CACHE')
        if (userId) {
          updatePlayersWithTransitionBids({
            players: cacheValue,
            userId,
            leagueId
          })
        }

        return res.send(cacheValue)
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
      updatePlayersWithTransitionBids({ players, userId, leagueId })
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
