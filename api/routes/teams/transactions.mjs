import express from 'express'

import { current_season, roster_slot_types } from '#constants'
import { verifyUserTeam, getTransactionsSinceFreeAgent } from '#libs-server'

const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * /teams/{teamId}/transactions/reserve:
 *   get:
 *     tags:
 *       - Fantasy Teams
 *     summary: Get reserve transactions
 *     description: |
 *       Get all transactions for players currently on injured reserve.
 *       Shows transaction history since they became free agents.
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
 *         description: Reserve transactions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   userid:
 *                     type: integer
 *                     description: User ID who made the transaction
 *                     example: 1
 *                   tid:
 *                     type: integer
 *                     description: Team ID
 *                     example: 13
 *                   lid:
 *                     type: integer
 *                     description: League ID
 *                     example: 2
 *                   pid:
 *                     type: string
 *                     description: Player ID
 *                     example: "JALE-HURT-2020-1998-08-07"
 *                   type:
 *                     type: integer
 *                     description: Transaction type
 *                     example: 7
 *                   value:
 *                     type: integer
 *                     description: Transaction value
 *                     example: 5
 *                   week:
 *                     type: integer
 *                     description: Week number
 *                     example: 4
 *                   year:
 *                     type: integer
 *                     description: Year
 *                     example: 2024
 *                   timestamp:
 *                     type: integer
 *                     description: Unix timestamp
 *                     example: 1640995200
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/reserve', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const { leagueId } = req.query

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    // verify teamId
    try {
      await verifyUserTeam({
        userId: req.auth.userId,
        teamId,
        leagueId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    const tid = teamId
    const lid = leagueId
    const { week, year } = current_season

    const reserve_roster_rows = await db('rosters_players')
      .whereIn('rosters_players.slot', [
        roster_slot_types.RESERVE_SHORT_TERM,
        roster_slot_types.RESERVE_LONG_TERM
      ])
      .where({ tid, year, week })

    let data = []
    for (const { pid } of reserve_roster_rows) {
      const transactions = await getTransactionsSinceFreeAgent({
        lid,
        pid,
        tid
      })
      data = data.concat(transactions)
    }

    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
