import express from 'express'
import cron from 'node-cron'

import cache from '#api/cache.mjs'
import { getPlayers, getTransitionBids } from '#libs-server'

const router = express.Router({ mergeParams: true })

const leagueIds = [1]
const loadPlayers = async () => {
  for (const leagueId of leagueIds) {
    const players = await getPlayers({ leagueId })
    const cacheKey = `/players/${leagueId}/teams`
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
    const { leagueId } = req.params
    const userId = req.auth ? req.auth.userId : null

    // TODO  verify leagueId

    const cacheKey = `/players/leagues/${leagueId}`
    let players = cache.get(cacheKey)
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

    players = await getPlayers({ leagueId })
    cache.set(cacheKey, players, 1800) // 30 mins

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

export default router
