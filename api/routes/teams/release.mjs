import express from 'express'

import { isSlotActive, Roster, get_free_agent_period } from '#libs-shared'
import { current_season } from '#constants'
import {
  verifyUserTeam,
  sendNotifications,
  processRelease,
  getLeague,
  getRoster
} from '#libs-server'
import { require_auth } from '#api/routes/leagues/middleware.mjs'
import { reevaluate_auction_after_roster_change } from '#libs-server/auction-settlement.mjs'

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
 *                 example: "JORD-LOVE-001990"
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
 *                 pid: "JORD-LOVE-001990"
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
 *                   example: "JORD-LOVE-001990"
 *                 tid:
 *                   type: integer
 *                   description: Team ID
 *                   example: 5
 *                 slot:
 *                   type: integer
 *                   description: Previous slot
 *                   example: 4
 *                 roster_id:
 *                   type: integer
 *                   description: Roster ID
 *                   example: 1234
 *                 player_position:
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

    if (!require_auth(req, res)) return

    if (current_season.week > current_season.final_week) {
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
    const is_commish = league.commissioner_user_id === req.auth.userId

    if (league.free_agency_period_start) {
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
        current_season.now.isAfter(faPeriod.start) &&
        current_season.now.isBefore(faPeriod.end) &&
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
        user_id: req.auth.userId
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

    // A commissioner override release is the second of the two things that can
    // change auction eligibility while a player is open, and the rarer one.
    // Every other release is refused for the whole free agency period by the
    // guard above, so nothing else reaches here mid-auction. Freeing a spot can
    // pull a team back into an eligible set it had left, which leaves the
    // outstanding set stale until it is recomputed.
    await reevaluate_auction_after_roster_change({
      lid,
      broadcast,
      logger,
      trigger: `commissioner release of ${pid}`
    })

    // send notification
    const message = `${team.name} (${team.abbreviation}) has released ${player_row.first_name} ${player_row.last_name} (${player_row.primary_position}).`

    await sendNotifications({
      league,
      notifyLeague: true,
      message
    })
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

export default router
