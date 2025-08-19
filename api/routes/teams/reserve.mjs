import express from 'express'

import { constants } from '#libs-shared'
import { verifyUserTeam, submitReserve } from '#libs-server'

const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * /teams/{teamId}/reserve:
 *   post:
 *     tags:
 *       - Fantasy Teams
 *     summary: Move player to injured reserve
 *     description: |
 *       Move a player to injured reserve (IR) or long-term IR.
 *       Can optionally activate another player from reserve.
 *
 *       **Reserve Eligibility Rules:**
 *       - Player must be on the team and meet standard reserve requirements
 *       - Protected practice squad players (PSP, PSDP) cannot be placed on reserve
 *       - Unprotected practice squad players (PS, PSD) can ONLY be placed on reserve if they have an active poaching claim
 *       - Player must have been rostered for at least one week (unless acquired via trade)
 *       - Player must meet NFL injury status requirements for the reserve type
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
 *               reserve_pid:
 *                 type: string
 *                 description: Player ID to move to reserve
 *                 example: "JALE-HURT-2020-1998-08-07"
 *               leagueId:
 *                 type: integer
 *                 description: League ID
 *                 example: 2
 *               slot:
 *                 type: integer
 *                 description: Reserve slot type (7=IR, 8=Long-term IR)
 *                 enum: [7, 8]
 *                 example: 7
 *               activate_pid:
 *                 type: string
 *                 description: Player ID to activate from reserve (optional)
 *                 example: "JACO-BURR-2020-1996-12-10"
 *             required:
 *               - reserve_pid
 *               - leagueId
 *               - slot
 *           examples:
 *             moveToIR:
 *               summary: Move player to IR
 *               value:
 *                 reserve_pid: "JALE-HURT-2020-1998-08-07"
 *                 leagueId: 2
 *                 slot: 7
 *             moveToIRAndActivate:
 *               summary: Move to IR and activate another
 *               value:
 *                 reserve_pid: "JALE-HURT-2020-1998-08-07"
 *                 leagueId: 2
 *                 slot: 7
 *                 activate_pid: "JACO-BURR-2020-1996-12-10"
 *     responses:
 *       200:
 *         description: Player moved to reserve successfully
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
 *                   description: New slot (reserve)
 *                   example: 7
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
 *         description: Bad request - validation failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message
 *             examples:
 *               protectedPlayer:
 *                 summary: Protected practice squad player
 *                 value:
 *                   error: "protected players are not reserve eligible"
 *               practiceSquadNoPoach:
 *                 summary: Practice squad player without active poach
 *                 value:
 *                   error: "practice squad players can only be placed on reserve if they have an active poaching claim"
 *               notEligible:
 *                 summary: Player not reserve eligible
 *                 value:
 *                   error: "player not eligible for Reserve"
 *               notRosteredLongEnough:
 *                 summary: Player not rostered long enough
 *                 value:
 *                   error: "not eligible, not rostered long enough"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/?', async (req, res) => {
  const { logger, broadcast } = req.app.locals
  try {
    const { teamId } = req.params
    const { reserve_pid, leagueId, slot, activate_pid } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (constants.season.week > constants.season.finalWeek) {
      return res.status(400).send({ error: 'player locked' })
    }

    if (!reserve_pid) {
      return res.status(400).send({ error: 'missing reserve_pid' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    if (!slot) {
      return res.status(400).send({ error: 'missing slot' })
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
    let data
    try {
      data = await submitReserve({
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

    for (const item of data) {
      broadcast(leagueId, {
        type: 'ROSTER_TRANSACTION',
        payload: { data: item }
      })
    }

    res.send(data[0])
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

export default router
