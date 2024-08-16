import express from 'express'

import cache from '#api/cache.mjs'
import { getPlayers, getTransitionBids } from '#libs-server'
import { constants } from '#libs-shared'

const router = express.Router({ mergeParams: true })

router.get('/?', async (req, res) => {
  const { logger, db } = req.app.locals
  try {
    const { teamId } = req.params
    const { leagueId } = req.query
    const userId = req.auth ? req.auth.userId : null

    const cacheKey = `/players/leagues/${leagueId}/teams/${teamId}`
    let players = cache.get(cacheKey)
    if (players) {
      logger('USING CACHE')
      if (userId) {
        // check if userId is a team manager
        const rows = await db('users_teams').where({
          userid: userId,
          tid: teamId,
          year: constants.season.year
        })

        if (!rows.length) {
          return res.send(players)
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
      // check if userId is a team manager
      const rows = await db('users_teams').where({
        userid: userId,
        tid: teamId,
        year: constants.season.year
      })

      if (!rows.length) {
        return res.send(players)
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
