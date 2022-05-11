import express from 'express'

import { constants } from '#common'
import { getPlayers } from '#utils'

const router = express.Router()

router.get('/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const search = req.query.q
    const { leagueId } = req.query

    /* const cacheKey = `/players/${leagueId || 0}`
     * if (!search) {
     *   const cacheValue = cache.get(cacheKey)
     *   if (cacheValue) {
     *     return res.send(cacheValue)
     *   }
     * }
     */
    const players = await getPlayers({
      leagueId,
      userId: req.user ? req.user.userId : null,
      textSearch: search
    })

    /* if (!search) {
     *   cache.set(cacheKey, players, 14400) // 4 hours
     * } */
    res.send(players)
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

export default router
