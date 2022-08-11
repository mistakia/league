import express from 'express'

import cache from '#api/cache.mjs'
import { getPlayers, getTransitionBids, verifyUserTeam } from '#utils'

const router = express.Router({ mergeParams: true })

router.get('/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { teamId } = req.params
    const { leagueId } = req.query
    const userId = req.auth ? req.auth.userId : null

    const cacheKey = `/players/${leagueId}/${teamId}`
    let players = cache.get(cacheKey)
    if (players) {
      logger('USING CACHE')
      if (userId) {
        // verify teamId
        try {
          await verifyUserTeam({
            userId,
            teamId,
            leagueId,
            requireLeague: true
          })
        } catch (error) {
          return res.status(400).send({ error: error.message })
        }

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

    players = await getPlayers({ teamId, leagueId })
    cache.set(cacheKey, players, 1800) // 30 mins

    if (userId) {
      // verify teamId
      try {
        await verifyUserTeam({
          userId,
          teamId,
          leagueId,
          requireLeague: true
        })
      } catch (error) {
        return res.status(400).send({ error: error.message })
      }

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
