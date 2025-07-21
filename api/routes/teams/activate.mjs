import express from 'express'

import { constants } from '#libs-shared'
import {
  submitReserve,
  submitActivate,
  processRelease,
  verifyUserTeam
} from '#libs-server'

const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * /api/teams/{teamId}/activate:
 *   post:
 *     tags:
 *       - Teams
 *     summary: Activate a player
 *     description: |
 *       Activate a player from practice squad or reserve to active roster.
 *       Can optionally release another player or move a player to reserve to make room.
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
 *               activate_pid:
 *                 type: string
 *                 description: Player ID to activate
 *                 example: "JALE-HURT-2020-1998-08-07"
 *               leagueId:
 *                 type: integer
 *                 description: League ID
 *                 example: 2
 *               release_pid:
 *                 type: string
 *                 description: Player ID to release (optional)
 *                 example: "JORD-LOVE-2020-1998-11-02"
 *               reserve_pid:
 *                 type: string
 *                 description: Player ID to move to reserve (optional)
 *                 example: "JACO-BURR-2020-1996-12-10"
 *               slot:
 *                 type: integer
 *                 description: Reserve slot type (required if reserve_pid provided)
 *                 enum: [7, 8]
 *                 example: 7
 *             required:
 *               - activate_pid
 *               - leagueId
 *           examples:
 *             simpleActivation:
 *               summary: Simple activation from practice squad
 *               value:
 *                 activate_pid: "JALE-HURT-2020-1998-08-07"
 *                 leagueId: 2
 *             activateWithRelease:
 *               summary: Activate player and release another
 *               value:
 *                 activate_pid: "JALE-HURT-2020-1998-08-07"
 *                 leagueId: 2
 *                 release_pid: "JORD-LOVE-2020-1998-11-02"
 *             activateWithReserve:
 *               summary: Activate player and move another to IR
 *               value:
 *                 activate_pid: "JALE-HURT-2020-1998-08-07"
 *                 leagueId: 2
 *                 reserve_pid: "JACO-BURR-2020-1996-12-10"
 *                 slot: 7
 *     responses:
 *       200:
 *         description: Player activated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pid:
 *                   type: string
 *                   description: Player ID
 *                   example: "JALE-HURT-2020-1998-08-07"
 *                 tid:
 *                   type: integer
 *                   description: Team ID
 *                   example: 13
 *                 slot:
 *                   type: integer
 *                   description: New slot (active roster)
 *                   example: 4
 *                 rid:
 *                   type: integer
 *                   description: Roster ID
 *                   example: 1234
 *                 pos:
 *                   type: string
 *                   description: Player position
 *                   example: "QB"
 *                 transaction:
 *                   $ref: '#/components/schemas/Transaction'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/?', async (req, res) => {
  const { logger, broadcast } = req.app.locals
  try {
    const { teamId } = req.params
    const { activate_pid, leagueId, release_pid, reserve_pid, slot } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (constants.season.week > constants.season.finalWeek) {
      return res.status(400).send({ error: 'player locked' })
    }

    if (!activate_pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
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

    const tid = parseInt(teamId, 10)

    // process release
    if (release_pid) {
      let releaseData
      try {
        releaseData = await processRelease({
          release_pid,
          tid,
          lid: leagueId,
          userid: req.auth.userId,
          activate_pid,
          create_notification: true
        })
      } catch (error) {
        return res.status(400).send({ error: error.message })
      }

      for (const item of releaseData) {
        broadcast(leagueId, {
          type: 'ROSTER_TRANSACTION',
          payload: { data: item }
        })
      }

      // return activate transaction data
      res.send(releaseData[1])
    } else if (reserve_pid) {
      let reserveData
      try {
        reserveData = await submitReserve({
          slot,
          tid,
          reserve_pid,
          leagueId,
          userId: req.auth.userId,
          activate_pid
        })
      } catch (error) {
        return res.status(400).send({ error: error.message })
      }

      for (const item of reserveData) {
        broadcast(leagueId, {
          type: 'ROSTER_TRANSACTION',
          payload: { data: item }
        })
      }

      // return activate transaction data
      res.send(reserveData[1])
    } else {
      let data
      try {
        data = await submitActivate({
          tid,
          activate_pid,
          leagueId,
          userId: req.auth.userId
        })
      } catch (error) {
        return res.status(400).send({ error: error.message })
      }

      broadcast(leagueId, {
        type: 'ROSTER_TRANSACTION',
        payload: { data }
      })

      res.send(data)
    }
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

export default router
