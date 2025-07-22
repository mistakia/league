import express from 'express'
import cron from 'node-cron'

import cache from '#api/cache.mjs'
import { getPlayers, getRestrictedFreeAgencyBids } from '#libs-server'

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

/**
 * @swagger
 * /leagues/{leagueId}/players:
 *   get:
 *     summary: Get all players for a fantasy league
 *     description: |
 *       Retrieves all NFL players available in a fantasy league, including their basic information,
 *       current NFL team, roster status, and fantasy-specific data. If the user is authenticated
 *       and has restricted free agency bids, those bids and conditional releases will be included.
 *
 *       **Fantasy Context**: This endpoint returns players from the perspective of a fantasy league,
 *       not just raw NFL player data. Players are formatted for fantasy football use cases.
 *
 *       **Caching**: Results are cached for 30 minutes to improve performance.
 *
 *       **Authentication**: Optional. If authenticated, restricted free agency bid information
 *       will be included for the user's team.
 *     tags:
 *       - Players
 *       - Fantasy Leagues
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     responses:
 *       '200':
 *         description: Successfully retrieved players for the league
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
 *                         type: number
 *                         description: "User's restricted free agency bid amount (only present if authenticated and bid exists)"
 *                         example: 25
 *                       restricted_free_agency_conditional_releases:
 *                         type: array
 *                         items:
 *                           type: string
 *                         description: "List of player IDs that would be released if this bid is successful (only present if authenticated and releases exist)"
 *                         example: ['JACO-MYER-2020-1996-09-10', 'DANT-JONE-2019-1994-12-29']
 *             examples:
 *               unauthenticated_response:
 *                 summary: Response for unauthenticated user
 *                 value:
 *                   - pid: 'PATR-MAHO-2017-1995-09-17'
 *                     fname: 'Patrick'
 *                     lname: 'Mahomes'
 *                     pname: 'P.Mahomes'
 *                     formatted: 'patrick mahomes'
 *                     pos: 'QB'
 *                     pos1: 'QB'
 *                     pos2: null
 *                     height: 75
 *                     weight: 230
 *                     current_nfl_team: 'KC'
 *                     jnum: 15
 *                     nfl_draft_year: 2017
 *                     round: 1
 *                     col: 'Texas Tech'
 *                     status: 'Active'
 *                     nfl_status: 'ACTIVE'
 *                     injury_status: null
 *                     dob: '1995-09-17'
 *               authenticated_with_bids:
 *                 summary: Response for authenticated user with restricted free agency bids
 *                 value:
 *                   - pid: 'PATR-MAHO-2017-1995-09-17'
 *                     fname: 'Patrick'
 *                     lname: 'Mahomes'
 *                     pname: 'P.Mahomes'
 *                     formatted: 'patrick mahomes'
 *                     pos: 'QB'
 *                     pos1: 'QB'
 *                     pos2: null
 *                     height: 75
 *                     weight: 230
 *                     current_nfl_team: 'KC'
 *                     jnum: 15
 *                     nfl_draft_year: 2017
 *                     round: 1
 *                     col: 'Texas Tech'
 *                     status: 'Active'
 *                     nfl_status: 'ACTIVE'
 *                     injury_status: null
 *                     dob: '1995-09-17'
 *                     bid: 45
 *                     restricted_free_agency_conditional_releases:
 *                       - 'JACO-MYER-2020-1996-09-10'
 *                       - 'DANT-JONE-2019-1994-12-29'
 *       '400':
 *         $ref: '#/components/responses/BadRequestError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const userId = req.auth ? req.auth.userId : null

    // TODO  verify leagueId

    const cacheKey = `/players/leagues/${leagueId}`
    let players = cache.get(cacheKey)
    if (!players) {
      players = await getPlayers({ leagueId })
      cache.set(cacheKey, players, 1800) // 30 mins
    } else {
      logger('USING CACHE')
    }

    if (userId) {
      const bids = await getRestrictedFreeAgencyBids({
        userId,
        leagueId
      })

      if (bids.length) {
        const bidMap = new Map(bids.map((b) => [b.pid, b.bid]))
        const releases_map = new Map(
          bids.map((b) => [
            b.pid,
            b.restricted_free_agency_conditional_releases || []
          ])
        )
        players = players.map((p) => ({
          ...p,
          bid: bidMap.get(p.pid) || undefined,
          restricted_free_agency_conditional_releases: releases_map.get(p.pid)
        }))
      }
    }

    res.send(players)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
