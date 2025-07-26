import express from 'express'

import {
  constants,
  isSlotActive,
  Roster,
  get_free_agent_period
} from '#libs-shared'
import {
  verifyUserTeam,
  sendNotifications,
  processRelease,
  getLeague,
  getRoster
} from '#libs-server'

const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * /teams/{teamId}/release:
 *   post:
 *     tags:
 *       - Fantasy Teams
 *     summary: Release a player
 *     description: |
 *       Release a player from the team roster. Cannot release active roster players
 *       during free agency period (unless commissioner).
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
 *                 description: Player ID to release
 *                 example: "JORD-LOVE-2020-1998-11-02"
 *               teamId:
 *                 type: integer
 *                 description: Team ID
 *                 example: 5
 *               leagueId:
 *                 type: integer
 *                 description: League ID
 *                 example: 2
 *             required:
 *               - pid
 *               - teamId
 *               - leagueId
 *           examples:
 *             releasePlayer:
 *               summary: Release player from roster
 *               value:
 *                 pid: "JORD-LOVE-2020-1998-11-02"
 *                 teamId: 5
 *                 leagueId: 2
 *     responses:
 *       200:
 *         description: Player released successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pid:
 *                   type: string
 *                   description: Player ID
 *                   example: "JORD-LOVE-2020-1998-11-02"
 *                 tid:
 *                   type: integer
 *                   description: Team ID
 *                   example: 5
 *                 slot:
 *                   type: integer
 *                   description: Previous slot
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
    const { pid, teamId, leagueId } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (constants.season.week > constants.season.finalWeek) {
      return res.status(400).send({ error: 'player locked' })
    }

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    // verify teamId
    let team
    try {
      team = await verifyUserTeam({
        userId: req.auth.userId,
        teamId,
        leagueId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }
    const tid = Number(teamId)
    const lid = Number(leagueId)

    // verify player id
    const player_rows = await db('player').where({ pid }).limit(1)
    if (!player_rows.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const player_row = player_rows[0]

    // if active roster, verify not during FA Auction Period
    const league = await getLeague({ lid: leagueId })
    const is_commish = league.commishid === req.auth.userId

    if (league.free_agency_live_auction_start) {
      const rosterRow = await getRoster({ tid })
      const roster = new Roster({ roster: rosterRow, league })
      if (!roster.has(pid)) {
        return res.status(400).send({
          error: 'player not on roster'
        })
      }

      const rosterPlayer = roster.get(pid)
      const isOnActiveRoster = isSlotActive(rosterPlayer.slot)

      const faPeriod = get_free_agent_period(league)
      if (
        constants.season.now.isAfter(faPeriod.start) &&
        constants.season.now.isBefore(faPeriod.end) &&
        isOnActiveRoster &&
        !is_commish
      ) {
        return res.status(400).send({
          error: 'Unable to release player from active roster during FA period'
        })
      }
    }

    let result
    try {
      result = await processRelease({
        release_pid: pid,
        tid,
        lid,
        userid: req.auth.userId
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    const data = result[0]
    res.send(data)
    broadcast(lid, {
      type: 'ROSTER_TRANSACTION',
      payload: { data }
    })

    // send notification
    const message = `${team.name} (${team.abbrv}) has released ${player_row.fname} ${player_row.lname} (${player_row.pos}).`

    await sendNotifications({
      league,
      teamIds: [],
      voice: false,
      notifyLeague: true,
      message
    })
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

export default router
