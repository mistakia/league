import express from 'express'

import cache from '#api/cache.mjs'
import { getPlayers, getRestrictedFreeAgencyBids } from '#libs-server'
import { constants } from '#libs-shared'

const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * /teams/{teamId}/players:
 *   get:
 *     tags:
 *       - Teams
 *     summary: Get fantasy team players
 *     description: |
 *       Get all players on the fantasy team roster with their current information.
 *       Includes restricted free agency bid information for fantasy team managers.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/teamId'
 *       - name: leagueId
 *         in: query
 *         required: true
 *         schema:
 *           type: integer
 *         description: League ID
 *         example: 2
 *     responses:
 *       200:
 *         description: Team players retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/Player'
 *                   - type: object
 *                     properties:
 *                       bid:
 *                         type: integer
 *                         description: Restricted free agency bid (if applicable)
 *                         example: 50
 *                       restricted_free_agency_conditional_releases:
 *                         type: array
 *                         items:
 *                           type: string
 *                         description: Players to release if RFA bid succeeds
 *                         example: ["JORD-LOVE-2020-1998-11-02"]
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
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

        const bids = await getRestrictedFreeAgencyBids({
          userId,
          leagueId
        })

        if (!bids.length) {
          return res.send(players)
        }

        return res.send(
          players.map((p) => {
            const bid = bids.find((b) => b.pid === p.pid)
            return {
              ...p,
              bid: bid?.bid,
              restricted_free_agency_conditional_releases:
                bid?.restricted_free_agency_conditional_releases || []
            }
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

      const bids = await getRestrictedFreeAgencyBids({ userId, leagueId })
      if (!bids.length) {
        return res.send(players)
      }

      return res.send(
        players.map((p) => {
          const bid = bids.find((b) => b.pid === p.pid)
          return {
            ...p,
            bid: bid?.bid,
            restricted_free_agency_conditional_releases:
              bid?.restricted_free_agency_conditional_releases || []
          }
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
