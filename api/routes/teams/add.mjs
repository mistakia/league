import express from 'express'

import { current_season, roster_slot_types } from '#constants'
import {
  submitAcquisition,
  verifyUserTeam,
  verify_reserve_status
} from '#libs-server'
import { require_auth } from '../leagues/middleware.mjs'

const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * /teams/{teamId}/add:
 *   post:
 *     tags:
 *       - Fantasy Teams
 *     summary: Add a free agent player
 *     description: |
 *       Add a free agent player to team roster. Can add to bench or practice squad.
 *       Must not be during waiver period for regular season.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/teamId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pid:
 *                 type: string
 *                 description: Player ID to add
 *                 example: "ALVI-KAME-2022-1999-02-05"
 *               teamId:
 *                 type: integer
 *                 description: Team ID
 *                 example: 5
 *               leagueId:
 *                 type: integer
 *                 description: League ID
 *                 example: 2
 *               slot:
 *                 type: integer
 *                 description: Target slot (bench or practice squad)
 *                 enum: [4, 5]
 *                 example: 4
 *               release:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Player IDs to release (optional)
 *                 example: ["JORD-LOVE-2020-1998-11-02"]
 *             required:
 *               - pid
 *               - teamId
 *               - leagueId
 *               - slot
 *           examples:
 *             addToBench:
 *               summary: Add player to bench
 *               value:
 *                 pid: "ALVI-KAME-2022-1999-02-05"
 *                 teamId: 5
 *                 leagueId: 2
 *                 slot: 4
 *             addToPracticeSquad:
 *               summary: Add player to practice squad
 *               value:
 *                 pid: "ALVI-KAME-2022-1999-02-05"
 *                 teamId: 5
 *                 leagueId: 2
 *                 slot: 5
 *             addWithRelease:
 *               summary: Add player and release another
 *               value:
 *                 pid: "ALVI-KAME-2022-1999-02-05"
 *                 teamId: 5
 *                 leagueId: 2
 *                 slot: 4
 *                 release: ["JORD-LOVE-2020-1998-11-02"]
 *     responses:
 *       200:
 *         description: Player added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   pid:
 *                     type: string
 *                     description: Player ID
 *                     example: "ALVI-KAME-2022-1999-02-05"
 *                   tid:
 *                     type: integer
 *                     description: Team ID
 *                     example: 5
 *                   slot:
 *                     type: integer
 *                     description: Player slot
 *                     example: 4
 *                   rid:
 *                     type: integer
 *                     description: Roster ID
 *                     example: 1234
 *                   pos:
 *                     type: string
 *                     description: Player position
 *                     example: "RB"
 *                   transaction:
 *                     type: object
 *                     properties:
 *                       userid:
 *                         type: integer
 *                         description: User ID who made the transaction
 *                         example: 1
 *                       tid:
 *                         type: integer
 *                         description: Team ID
 *                         example: 5
 *                       lid:
 *                         type: integer
 *                         description: League ID
 *                         example: 2
 *                       pid:
 *                         type: string
 *                         description: Player ID
 *                         example: "ALVI-KAME-2022-1999-02-05"
 *                       type:
 *                         type: integer
 *                         description: Transaction type
 *                         example: 1
 *                       week:
 *                         type: integer
 *                         description: Week number
 *                         example: 4
 *                       year:
 *                         type: integer
 *                         description: Year
 *                         example: 2024
 *                       timestamp:
 *                         type: integer
 *                         description: Unix timestamp
 *                         example: 1640995200
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/?', async (req, res) => {
  const { db, logger, broadcast } = req.app.locals
  try {
    const { pid, leagueId, teamId, slot } = req.body
    let { release } = req.body
    if (!Array.isArray(release)) {
      release = release ? [release] : []
    }

    if (!require_auth(req, res)) return

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    if (!slot) {
      return res.status(400).send({ error: 'missing slot' })
    }

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId' })
    }

    const validSlots = [roster_slot_types.BENCH, roster_slot_types.PS]

    if (!validSlots.includes(slot)) {
      return res.status(400).send({ error: 'invalid slot' })
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
    const tid = Number(teamId)

    if (current_season.week > current_season.finalWeek) {
      return res.status(400).send({ error: 'player is locked' })
    }

    // verify player does not have outstanding unprocessed waiver claim
    const waivers = await db('waivers')
      .where({ pid, lid: leagueId })
      .whereNull('cancelled')
      .whereNull('processed')

    if (waivers.length) {
      return res.status(400).send({ error: 'player has pending waiver claim' })
    }

    // verify not in waiver period during the regular season
    if (current_season.isRegularSeason && current_season.isWaiverPeriod) {
      return res.status(400).send({ error: 'player is on waivers' })
    }

    try {
      await verify_reserve_status({ team_id: teamId, league_id: leagueId })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    let transactions = []
    try {
      transactions = await submitAcquisition({
        leagueId,
        release,
        pid,
        teamId: tid,
        userId: req.auth.userId,
        slot
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    res.send(transactions)
    broadcast(leagueId, {
      type: 'ROSTER_TRANSACTIONS',
      payload: {
        data: transactions
      }
    })
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

export default router
