import express from 'express'
import dayjs from 'dayjs'

import restricted_free_agency from './restricted-free-agency.mjs'
import { constants, Roster } from '#libs-shared'
import {
  getRoster,
  getLeague,
  verifyUserTeam,
  verifyReserveStatus,
  validate_franchise_tag
} from '#libs-server'

const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * /teams/{teamId}/tag:
 *   post:
 *     tags:
 *       - Teams
 *     summary: Tag a player
 *     description: |
 *       Apply a tag to a player (franchise, transition, etc.).
 *       Player must be on active roster and within tag limits.
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
 *                 description: Player ID to tag
 *                 example: "JALE-HURT-2020-1998-08-07"
 *               leagueId:
 *                 type: integer
 *                 description: League ID
 *                 example: 2
 *               tag:
 *                 type: integer
 *                 description: Tag type (see constants.tags)
 *                 example: 3
 *               remove:
 *                 type: string
 *                 description: Player ID to remove existing tag from (optional)
 *                 example: "JORD-LOVE-2020-1998-11-02"
 *             required:
 *               - pid
 *               - leagueId
 *               - tag
 *           examples:
 *             franchiseTag:
 *               summary: Apply franchise tag
 *               value:
 *                 pid: "JALE-HURT-2020-1998-08-07"
 *                 leagueId: 2
 *                 tag: 3
 *             transitionTag:
 *               summary: Apply transition tag
 *               value:
 *                 pid: "JALE-HURT-2020-1998-08-07"
 *                 leagueId: 2
 *                 tag: 4
 *             tagWithRemove:
 *               summary: Tag player and remove existing tag
 *               value:
 *                 pid: "JALE-HURT-2020-1998-08-07"
 *                 leagueId: 2
 *                 tag: 3
 *                 remove: "JORD-LOVE-2020-1998-11-02"
 *     responses:
 *       200:
 *         description: Player tagged successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
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
    let { tag } = req.body
    const { pid, leagueId, remove } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    if (!tag) {
      return res.status(400).send({ error: 'missing tag' })
    }

    const validTags = Object.values(constants.tags)
    tag = parseInt(tag, 10)
    if (!validTags.includes(tag)) {
      return res.status(400).send({ error: 'invalid tag' })
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

    // check for reserve violations
    try {
      await verifyReserveStatus({ teamId, leagueId })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    // make sure player is on roster
    if (!roster.has(pid)) {
      return res.status(400).send({ error: 'invalid player' })
    }

    if (remove && !roster.has(remove)) {
      return res.status(400).send({ error: 'invalid remove player' })
    }

    // make sure player is on active roster
    if (!roster.active.find((r) => r.pid === pid)) {
      return res.status(400).send({ error: 'player is not on active roster' })
    }

    // Check if player has been franchise tagged for the past two consecutive years
    if (tag === constants.tags.FRANCHISE) {
      const is_valid_franchise_tag = await validate_franchise_tag({
        pid,
        tid
      })

      if (!is_valid_franchise_tag) {
        return res.status(400).send({
          error: 'player cannot be franchise tagged for three consecutive years'
        })
      }
    }

    // make sure extension has not passed
    if (
      constants.season.week === 0 &&
      league.ext_date &&
      constants.season.now.isAfter(dayjs.unix(league.ext_date))
    ) {
      return res.status(400).send({ error: 'extension deadline has passed' })
    }

    // make sure tag does not exceed limits
    if (remove) {
      roster.removeTag(remove)
    }
    const isEligible = roster.isEligibleForTag({ tag })
    if (!isEligible) {
      return res.status(400).send({ error: 'exceeds tag limit' })
    }

    if (remove) {
      await db('rosters_players').update({ tag: 1 }).where({
        rid: rosterRow.uid,
        pid: remove
      })
    }

    // cancel existing restricted free agency bids
    const timestamp = Math.round(Date.now() / 1000)
    await db('restricted_free_agency_bids')
      .update('cancelled', timestamp)
      .where({
        year: constants.season.year,
        pid,
        tid
      })
      .whereNull('cancelled')
      .whereNull('processed')

    await db('rosters_players').update({ tag }).where({
      rid: rosterRow.uid,
      pid
    })

    res.send({ success: true })
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

/**
 * @swagger
 *   delete:
 *     tags:
 *       - Teams
 *     summary: Remove player tag
 *     description: |
 *       Remove a tag from a player. Player must be on active roster.
 *       Must be before extension deadline.
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
 *                 description: Player ID to remove tag from
 *                 example: "JALE-HURT-2020-1998-08-07"
 *               leagueId:
 *                 type: integer
 *                 description: League ID
 *                 example: 2
 *             required:
 *               - pid
 *               - leagueId
 *           examples:
 *             removeTag:
 *               summary: Remove player tag
 *               value:
 *                 pid: "JALE-HURT-2020-1998-08-07"
 *                 leagueId: 2
 *     responses:
 *       200:
 *         description: Tag removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 pid:
 *                   type: string
 *                   description: Player ID
 *                   example: "JALE-HURT-2020-1998-08-07"
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const { pid, leagueId } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!pid) {
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

    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })

    // make sure player is on roster
    if (!roster.has(pid)) {
      return res.status(400).send({ error: 'invalid player' })
    }

    // make sure player is on active roster
    if (!roster.active.find((r) => r.pid === pid)) {
      return res.status(400).send({ error: 'player is not on active roster' })
    }

    // make sure extension has not passed
    if (
      constants.season.week === 0 &&
      league.ext_date &&
      constants.season.now.isAfter(dayjs.unix(league.ext_date))
    ) {
      return res.status(400).send({ error: 'extension deadline has passed' })
    }

    await db('rosters_players').update({ tag: 1 }).where({
      rid: rosterRow.uid,
      pid
    })

    res.send({ success: true, pid })
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

router.use('/restricted-free-agency', restricted_free_agency)

export default router
