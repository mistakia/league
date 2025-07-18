import express from 'express'

import { constants, uniqBy } from '#libs-shared'
import { getPlayByPlayQuery } from '#libs-server'

const router = express.Router()

/**
 * @swagger
 * /scoreboard:
 *   get:
 *     tags:
 *       - Scoreboard
 *     summary: Get scoreboard data for a specific week
 *     description: Retrieve comprehensive scoreboard data including play-by-play information and player statistics for a specified fantasy football week. This endpoint combines play data with player performance statistics.
 *     parameters:
 *       - $ref: '#/components/parameters/week'
 *     responses:
 *       200:
 *         description: Scoreboard data with plays and player statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/NFLPlay'
 *                   - type: object
 *                     properties:
 *                       playStats:
 *                         type: array
 *                         items:
 *                           $ref: '#/components/schemas/NFLPlayStats'
 *                         description: Player statistics for this specific play
 *             examples:
 *               scoreboard_data:
 *                 summary: Sample scoreboard data
 *                 value:
 *                   - esbid: "2024120801"
 *                     playId: 1
 *                     week: 13
 *                     year: 2024
 *                     seas_type: "REG"
 *                     off: "KC"
 *                     def: "LV"
 *                     down: 1
 *                     yards_to_go: 10
 *                     yfog: 25
 *                     play_type: "PASS"
 *                     yards_gained: 15
 *                     playStats:
 *                       - pid: "PATR-MAHO-2017-1995-09-17"
 *                         stat_type: "PASSING"
 *                         yards: 15
 *                         touchdown: false
 *                         interception: false
 *                       - pid: "TRAV-KELC-2013-1989-10-05"
 *                         stat_type: "RECEIVING"
 *                         yards: 15
 *                         touchdown: false
 *                         targets: 1
 *                         receptions: 1
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *         examples:
 *           invalid_week:
 *             summary: Invalid week parameter
 *             value:
 *               error: "invalid week"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const week = parseInt(req.query.week || constants.season.week, 10)

    if (isNaN(week)) {
      return res.status(400).send({ error: 'invalid week' })
    }

    if (!constants.fantasyWeeks.includes(week)) {
      return res.status(400).send({ error: 'invalid week' })
    }

    const query = getPlayByPlayQuery(db)
    const plays = await query
      .where('nfl_plays_current_week.week', week)
      .where('nfl_plays_current_week.seas_type', 'REG')
    const esbids = Array.from(uniqBy(plays, 'esbid')).map((p) => p.esbid)
    const playStats = await db('nfl_play_stats_current_week').whereIn(
      'esbid',
      esbids
    )

    for (const play of plays) {
      play.playStats = playStats.filter(
        (p) => p.playId === play.playId && p.esbid === play.esbid
      )
    }

    res.send(plays)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
