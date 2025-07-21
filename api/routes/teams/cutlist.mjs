import express from 'express'

import { Roster, constants } from '#libs-shared'
import { getRoster, verifyUserTeam, getLeague } from '#libs-server'

const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * /api/teams/{teamId}/cutlist:
 *   get:
 *     tags:
 *       - Teams
 *     summary: Get fantasy team cutlist
 *     description: |
 *       Get the ordered list of players on the fantasy team's cutlist for automated cuts.
 *       Cutlist determines order of player releases during roster moves.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/teamId'
 *     responses:
 *       200:
 *         description: Cutlist retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *                 description: Player ID
 *                 example: "JORD-LOVE-2020-1998-11-02"
 *               example: ["JORD-LOVE-2020-1998-11-02", "ALVI-KAME-2022-1999-02-05"]
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    // verify teamId belongs to userId
    try {
      await verifyUserTeam({
        userId: req.auth.userId,
        teamId
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    const cutlist = await db('league_cutlist')
      .select('pid')
      .where('tid', teamId)
      .orderBy('order', 'asc')

    res.send(cutlist.map((p) => p.pid))
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

/**
 * @swagger
 *   post:
 *     tags:
 *       - Teams
 *     summary: Update fantasy team cutlist
 *     description: |
 *       Set the ordered list of players on the fantasy team's cutlist for automated cuts.
 *       Players must be on the team roster and not restricted free agents.
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
 *               leagueId:
 *                 type: integer
 *                 description: League ID
 *                 example: 2
 *               pids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Ordered list of player IDs (first to be cut first)
 *                 example: ["JORD-LOVE-2020-1998-11-02", "ALVI-KAME-2022-1999-02-05"]
 *             required:
 *               - leagueId
 *               - pids
 *           examples:
 *             setCutlist:
 *               summary: Set cutlist order
 *               value:
 *                 leagueId: 2
 *                 pids: ["JORD-LOVE-2020-1998-11-02", "ALVI-KAME-2022-1999-02-05"]
 *     responses:
 *       200:
 *         description: Cutlist updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *                 description: Player ID
 *                 example: "JORD-LOVE-2020-1998-11-02"
 *               example: ["JORD-LOVE-2020-1998-11-02", "ALVI-KAME-2022-1999-02-05"]
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const { leagueId } = req.body
    let { pids } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!pids) {
      return res.status(400).send({ error: 'missing pids' })
    }

    if (!Array.isArray(pids)) {
      pids = [pids]
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

    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })

    // make sure all players are on roster
    for (const pid of pids) {
      if (!roster.has(pid)) {
        return res.status(400).send({ error: 'invalid player' })
      }

      const rosterPlayer = roster.get(pid)
      if (rosterPlayer.tag === constants.tags.RESTRICTED_FREE_AGENCY) {
        return res
          .status(400)
          .send({ error: 'restricted free agents are ineligible' })
      }
    }

    // TODO - remove any duplicates

    // save
    const result = []
    for (const [index, pid] of pids.entries()) {
      result.push({
        tid,
        pid,
        order: index
      })
    }

    if (result.length) {
      await db('league_cutlist')
        .insert(result)
        .onConflict(['tid', 'pid'])
        .merge()
    }

    await db('league_cutlist').del().whereNotIn('pid', pids).where('tid', tid)
    res.send(pids)
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

export default router
