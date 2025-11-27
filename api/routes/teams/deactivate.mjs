import express from 'express'

import { Roster } from '#libs-shared'
import {
  getRoster,
  getLeague,
  sendNotifications,
  verifyUserTeam,
  processRelease,
  submitDeactivate
} from '#libs-server'

const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * /teams/{teamId}/deactivate:
 *   post:
 *     tags:
 *       - Fantasy Teams
 *     summary: Deactivate a player to practice squad
 *     description: |
 *       Move a player from active roster to practice squad. Player must be eligible
 *       (not poached, not previously activated, within 48 hours on active roster).
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
 *               deactivate_pid:
 *                 type: string
 *                 description: Player ID to deactivate
 *                 example: "JALE-HURT-2020-1998-08-07"
 *               leagueId:
 *                 type: integer
 *                 description: League ID
 *                 example: 2
 *               release_pid:
 *                 type: string
 *                 description: Player ID to release from practice squad (optional)
 *                 example: "JORD-LOVE-2020-1998-11-02"
 *             required:
 *               - deactivate_pid
 *               - leagueId
 *           examples:
 *             deactivatePlayer:
 *               summary: Simple deactivation
 *               value:
 *                 deactivate_pid: "JALE-HURT-2020-1998-08-07"
 *                 leagueId: 2
 *             deactivateWithRelease:
 *               summary: Deactivate and release practice squad player
 *               value:
 *                 deactivate_pid: "JALE-HURT-2020-1998-08-07"
 *                 leagueId: 2
 *                 release_pid: "JORD-LOVE-2020-1998-11-02"
 *     responses:
 *       200:
 *         description: Player deactivated successfully
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
 *                   description: New slot (practice squad)
 *                   example: 5
 *                 rid:
 *                   type: integer
 *                   description: Roster ID
 *                   example: 1234
 *                 pos:
 *                   type: string
 *                   description: Player position
 *                   example: "QB"
 *                 transaction:
 *                   type: object
 *                   description: Transaction details
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
    const { teamId } = req.params
    const { deactivate_pid, leagueId, release_pid } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!deactivate_pid) {
      return res.status(400).send({ error: 'missing deactivate_pid' })
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

    const tid = Number(teamId)

    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })

    if (release_pid) {
      // confirm player is on practice squad
      if (!roster.practice.find((p) => p.pid === release_pid)) {
        return res.status(400).send({ error: 'invalid release_pid' })
      }

      // remove from roster for space check
      roster.removePlayer(release_pid)
    }

    // process release first if specified
    if (release_pid) {
      const result = await processRelease({
        release_pid,
        lid: leagueId,
        tid,
        userid: req.auth.userId
      })
      for (const release_data of result) {
        broadcast(leagueId, {
          type: 'ROSTER_TRANSACTION',
          payload: { data: release_data }
        })
      }
    }

    const data = await submitDeactivate({
      tid,
      deactivate_pid,
      leagueId,
      userId: req.auth.userId,
      roster
    })

    res.send(data)
    broadcast(leagueId, {
      type: 'ROSTER_TRANSACTION',
      payload: { data }
    })

    // send additional release notification if release_pid was provided
    if (release_pid) {
      const release_player_rows = await db('player')
        .where('pid', release_pid)
        .limit(1)
      const release_player_row = release_player_rows[0]

      await sendNotifications({
        league,
        notifyLeague: true,
        message: `${release_player_row.fname} ${release_player_row.lname} (${release_player_row.pos}) has been released.`
      })
    }
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.message })
  }
})

export default router
