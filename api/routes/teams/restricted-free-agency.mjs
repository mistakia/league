import express from 'express'
import dayjs from 'dayjs'

import { constants, Roster } from '#libs-shared'
import {
  getRoster,
  getLeague,
  verifyUserTeam,
  verifyReserveStatus
} from '#libs-server'

const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * /api/teams/{teamId}/tag/restricted-free-agency:
 *   get:
 *     tags:
 *       - Teams
 *     summary: Get restricted free agency bids
 *     description: |
 *       Get all active restricted free agency bids for the team.
 *       Shows bids that have not been processed or cancelled.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/teamId'
 *     responses:
 *       200:
 *         description: Restricted free agency bids retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   uid:
 *                     type: integer
 *                     description: Bid ID
 *                     example: 123
 *                   tid:
 *                     type: integer
 *                     description: Team ID
 *                     example: 13
 *                   userid:
 *                     type: integer
 *                     description: User ID
 *                     example: 1
 *                   lid:
 *                     type: integer
 *                     description: League ID
 *                     example: 2
 *                   pid:
 *                     type: string
 *                     description: Player ID
 *                     example: "JALE-HURT-2020-1998-08-07"
 *                   submitted:
 *                     type: integer
 *                     description: Submission timestamp
 *                     example: 1640995200
 *                   year:
 *                     type: integer
 *                     description: Year
 *                     example: 2024
 *                   bid:
 *                     type: integer
 *                     description: Bid amount
 *                     example: 25
 *                   player_tid:
 *                     type: integer
 *                     description: Original team ID
 *                     example: 5
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

    const restrictedFreeAgencyBids = await db('restricted_free_agency_bids')
      .where({
        tid: teamId,
        year: constants.season.year
      })
      .whereNull('processed')
      .whereNull('cancelled')

    res.send(restrictedFreeAgencyBids)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 *   post:
 *     tags:
 *       - Teams
 *     summary: Create restricted free agency bid
 *     description: |
 *       Create a restricted free agency bid for a player. Can be either an original
 *       team bid or a competing bid from another team.
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
 *                 description: Player ID
 *                 example: "JALE-HURT-2020-1998-08-07"
 *               leagueId:
 *                 type: integer
 *                 description: League ID
 *                 example: 2
 *               bid:
 *                 type: integer
 *                 description: Bid amount
 *                 example: 25
 *               playerTid:
 *                 type: integer
 *                 description: Original team ID
 *                 example: 5
 *               release:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Players to release if bid succeeds
 *                 example: ["JORD-LOVE-2020-1998-11-02"]
 *               remove:
 *                 type: string
 *                 description: Player to remove tag from (original team only)
 *                 example: "JACO-BURR-2020-1996-12-10"
 *             required:
 *               - pid
 *               - leagueId
 *               - bid
 *               - playerTid
 *           examples:
 *             originalTeamBid:
 *               summary: Original team sets RFA bid
 *               value:
 *                 pid: "JALE-HURT-2020-1998-08-07"
 *                 leagueId: 2
 *                 bid: 25
 *                 playerTid: 5
 *             competingBid:
 *               summary: Competing team makes offer
 *               value:
 *                 pid: "JALE-HURT-2020-1998-08-07"
 *                 leagueId: 2
 *                 bid: 30
 *                 playerTid: 5
 *                 release: ["JORD-LOVE-2020-1998-11-02"]
 *     responses:
 *       200:
 *         description: Bid created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uid:
 *                   type: integer
 *                   description: Bid ID
 *                   example: 123
 *                 tid:
 *                   type: integer
 *                   description: Team ID
 *                   example: 13
 *                 userid:
 *                   type: integer
 *                   description: User ID
 *                   example: 1
 *                 lid:
 *                   type: integer
 *                   description: League ID
 *                   example: 2
 *                 pid:
 *                   type: string
 *                   description: Player ID
 *                   example: "JALE-HURT-2020-1998-08-07"
 *                 submitted:
 *                   type: integer
 *                   description: Submission timestamp
 *                   example: 1640995200
 *                 year:
 *                   type: integer
 *                   description: Year
 *                   example: 2024
 *                 bid:
 *                   type: integer
 *                   description: Bid amount
 *                   example: 25
 *                 player_tid:
 *                   type: integer
 *                   description: Original team ID
 *                   example: 5
 *                 release:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Players to release
 *                   example: ["JORD-LOVE-2020-1998-11-02"]
 *                 remove:
 *                   type: string
 *                   description: Player tag removed
 *                   example: "JACO-BURR-2020-1996-12-10"
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
    const { pid, leagueId, remove } = req.body
    const playerTid = Number(req.body.playerTid || 0)
    let { release } = req.body
    const bid = Number(req.body.bid || 0)

    if (!Array.isArray(release)) {
      release = release ? [release] : []
    }

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    if (typeof bid === 'undefined') {
      return res.status(400).send({ error: 'missing bid' })
    }

    if (!playerTid) {
      return res.status(400).send({ error: 'missing playerTid' })
    }

    if (pid === remove) {
      return res.status(400).send({ error: 'invalid remove' })
    }

    if (release.includes(pid)) {
      return res.status(400).send({ error: 'invalid release' })
    }

    if (
      typeof bid !== 'undefined' &&
      (isNaN(bid) || bid < 0 || bid % 1 !== 0)
    ) {
      return res.status(400).send({ error: 'invalid bid' })
    }

    const tid = Number(teamId)

    // verify teamId, leagueId belongs to user
    try {
      await verifyUserTeam({
        userId: req.auth.userId,
        leagueId,
        teamId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    // get players info
    const pids = [pid]
    if (release.length) {
      release.forEach((pid) => pids.push(pid))
    }
    const player_rows = await db('player').whereIn('pid', pids)
    if (player_rows.length !== pids.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const player_row = player_rows[0]

    // get league info
    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // get roster
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })

    // check for reserve violations
    try {
      await verifyReserveStatus({ teamId, leagueId })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    // check if release players are on team
    if (release.length) {
      for (const release_pid of release) {
        if (!roster.has(release_pid)) {
          return res.status(400).send({ error: 'invalid release' })
        }
        roster.removePlayer(release_pid)
      }
    }

    if (remove && !roster.has(remove)) {
      return res.status(400).send({ error: 'invalid remove player' })
    }

    // if original bid, check if on team
    if (playerTid === tid) {
      if (!roster.has(pid)) {
        return res.status(400).send({ error: 'invalid player' })
      }

      // make sure restricted free agency period has not passed
      if (
        league.tran_end &&
        constants.season.now.isAfter(dayjs.unix(league.tran_end))
      ) {
        return res
          .status(400)
          .send({ error: 'restricted free agency deadline has passed' })
      }

      // update value to bid
      roster.updateValue(pid, bid)

      // make sure tag does not exceed limits
      if (remove) {
        roster.removeTag(remove)
      }
      const isEligible = roster.isEligibleForTag({
        tag: constants.tags.RESTRICTED_FREE_AGENCY
      })
      if (!isEligible) {
        return res.status(400).send({ error: 'exceeds tag limit' })
      }

      // make sure bid is within $10 of market salary
      const market_salary = await db('league_format_player_projection_values')
        .select('market_salary')
        .where({
          pid,
          week: 0,
          year: constants.season.year,
          league_format_hash: league.league_format_hash
        })
        .first()

      // TODO setup mocks for tests
      // if (!market_salary) {
      //   return res.status(400).send({ error: 'market salary not found' })
      // }

      if (market_salary) {
        const salary_difference = bid - market_salary.market_salary
        if (salary_difference < -10) {
          return res.status(400).send({
            error: 'bid must not be more than $10 below market salary'
          })
        }
      }
    } else {
      // check if restricted free agency bid exists
      const restricted_free_agency_bid = await db('restricted_free_agency_bids')
        .where({
          pid,
          tid: playerTid,
          lid: leagueId,
          year: constants.season.year
        })
        .whereNull('processed')
        .whereNull('cancelled')
        .first()

      if (!restricted_free_agency_bid) {
        return res.status(400).send({ error: 'invalid player' })
      }
    }

    const cutlist = await db('league_cutlist').select('pid').where('tid', tid)

    for (const row of cutlist) {
      roster.removePlayer(row.pid)
    }

    // if competing bid, make sure there is roster space
    if (playerTid !== tid) {
      if (!roster.hasOpenBenchSlot(player_row.pos)) {
        return res.status(400).send({ error: 'exceeds roster limits' })
      }

      // add to roster
      roster.addPlayer({
        slot: constants.slots.BENCH,
        pid,
        pos: player_row.pos,
        value: bid,
        restricted_free_agency_original_team: playerTid
      })
    }

    // make sure there is enough cap space
    // TODO
    /* if (roster.availableCap < 0) {
     *   return res.status(400).send({ error: 'exceeds salary cap' })
     * }
     */

    if (playerTid === tid) {
      await db('rosters_players')
        .update({ tag: constants.tags.RESTRICTED_FREE_AGENCY })
        .where({
          rid: rosterRow.uid,
          pid
        })

      await db('league_cutlist')
        .where({
          pid,
          tid
        })
        .del()

      if (remove) {
        await db('rosters_players').update({ tag: 1 }).where({
          rid: rosterRow.uid,
          pid: remove
        })

        await db('restricted_free_agency_bids')
          .where({
            pid: remove,
            tid,
            year: constants.season.year
          })
          .update({
            cancelled: Math.round(Date.now() / 1000)
          })
      }
    }

    // insert into restrictedFreeAgencyBids
    const data = {
      tid,
      userid: req.auth.userId,
      lid: leagueId,
      pid,
      submitted: Math.round(Date.now() / 1000),
      year: constants.season.year,
      bid,
      player_tid: playerTid
    }

    const query = await db('restricted_free_agency_bids')
      .insert(data)
      .returning('uid')
    const restricted_free_agency_bid_id = query[0].uid
    data.uid = restricted_free_agency_bid_id

    if (release.length) {
      const releaseInserts = release.map((pid) => ({
        restricted_free_agency_bid_id,
        pid
      }))
      await db('restricted_free_agency_releases').insert(releaseInserts)
    }

    data.release = release
    data.remove = remove

    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 *   delete:
 *     tags:
 *       - Teams
 *     summary: Cancel restricted free agency bid
 *     description: |
 *       Cancel an existing restricted free agency bid.
 *       Cannot cancel if already processed or announced.
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
 *                 description: Player ID
 *                 example: "JALE-HURT-2020-1998-08-07"
 *               leagueId:
 *                 type: integer
 *                 description: League ID
 *                 example: 2
 *             required:
 *               - pid
 *               - leagueId
 *           examples:
 *             cancelBid:
 *               summary: Cancel RFA bid
 *               value:
 *                 pid: "JALE-HURT-2020-1998-08-07"
 *                 leagueId: 2
 *     responses:
 *       200:
 *         description: Bid cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uid:
 *                   type: integer
 *                   description: Bid ID
 *                   example: 123
 *                 tid:
 *                   type: integer
 *                   description: Team ID
 *                   example: 13
 *                 lid:
 *                   type: integer
 *                   description: League ID
 *                   example: 2
 *                 cancelled:
 *                   type: integer
 *                   description: Cancellation timestamp
 *                   example: 1640995200
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

    const tid = parseInt(teamId, 10)

    // verify teamId, leagueId belongs to user
    try {
      await verifyUserTeam({
        userId: req.auth.userId,
        leagueId,
        teamId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    // get roster
    const rosterRow = await getRoster({ tid })

    // get league info
    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // make sure restricted free agency deadline has not passed
    if (
      league.tran_end &&
      constants.season.now.isAfter(dayjs.unix(league.tran_end))
    ) {
      return res
        .status(400)
        .send({ error: 'restricted free agency deadline has passed' })
    }

    // verify restricted free agency bid exists
    const query1 = await db('restricted_free_agency_bids')
      .where({
        pid,
        tid,
        year: constants.season.year
      })
      .whereNull('cancelled')

    if (!query1.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const restrictedFreeAgencyBid = query1[0]

    // check if bid has already been processed
    if (restrictedFreeAgencyBid.processed) {
      return res.status(400).send({ error: 'bid has already been processed' })
    }

    const is_current_manager_bid =
      restrictedFreeAgencyBid.player_tid === restrictedFreeAgencyBid.tid
    if (is_current_manager_bid && restrictedFreeAgencyBid.announced) {
      return res
        .status(400)
        .send({ error: 'restricted free agent has already been announced' })
    }

    // cancel bid
    const cancelled = Math.round(Date.now() / 1000)
    await db('restricted_free_agency_bids')
      .update('cancelled', cancelled)
      .where('uid', restrictedFreeAgencyBid.uid)

    // TODO cancel any pending competing bids

    // update tag
    await db('rosters_players').update({ tag: constants.tags.REGULAR }).where({
      rid: rosterRow.uid,
      pid
    })

    res.send({ ...restrictedFreeAgencyBid, cancelled })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 *   put:
 *     tags:
 *       - Teams
 *     summary: Update restricted free agency bid
 *     description: |
 *       Update an existing restricted free agency bid amount and/or release players.
 *       Cannot update if already processed.
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
 *                 description: Player ID
 *                 example: "JALE-HURT-2020-1998-08-07"
 *               leagueId:
 *                 type: integer
 *                 description: League ID
 *                 example: 2
 *               bid:
 *                 type: integer
 *                 description: New bid amount
 *                 example: 30
 *               release:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Updated players to release
 *                 example: ["JORD-LOVE-2020-1998-11-02"]
 *             required:
 *               - pid
 *               - leagueId
 *               - bid
 *           examples:
 *             updateBid:
 *               summary: Update bid amount
 *               value:
 *                 pid: "JALE-HURT-2020-1998-08-07"
 *                 leagueId: 2
 *                 bid: 30
 *                 release: ["JORD-LOVE-2020-1998-11-02"]
 *     responses:
 *       200:
 *         description: Bid updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uid:
 *                   type: integer
 *                   description: Bid ID
 *                   example: 123
 *                 bid:
 *                   type: integer
 *                   description: Updated bid amount
 *                   example: 30
 *                 userid:
 *                   type: integer
 *                   description: User ID
 *                   example: 1
 *                 release:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Updated release players
 *                   example: ["JORD-LOVE-2020-1998-11-02"]
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const { pid, leagueId } = req.body
    let { release } = req.body
    const bid = parseInt(req.body.bid || 0, 10)

    if (!Array.isArray(release)) {
      release = release ? [release] : []
    }

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    if (typeof bid === 'undefined') {
      return res.status(400).send({ error: 'missing bid' })
    }

    if (
      typeof bid !== 'undefined' &&
      (isNaN(bid) || bid < 0 || bid % 1 !== 0)
    ) {
      return res.status(400).send({ error: 'invalid bid' })
    }

    const tid = parseInt(teamId, 10)

    // verify teamId, leagueId belongs to user
    try {
      await verifyUserTeam({
        userId: req.auth.userId,
        leagueId,
        teamId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    // verify restricted free agency bid exists
    const query1 = await db('restricted_free_agency_bids')
      .where({
        pid,
        tid,
        year: constants.season.year
      })
      .whereNull('cancelled')

    if (!query1.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const restrictedFreeAgencyBid = query1[0]

    // get players info
    const pids = [pid]
    if (release.length) {
      release.forEach((pid) => pids.push(pid))
    }
    const player_rows = await db('player').whereIn('pid', pids)
    if (player_rows.length !== pids.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const player_row = player_rows[0]

    // get league info
    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // get roster
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })

    // check if release players are on team
    if (release.length) {
      for (const release_pid of release) {
        if (!roster.has(release_pid)) {
          return res.status(400).send({ error: 'invalid release' })
        }
        roster.removePlayer(release_pid)
      }
    }

    const cutlist = await db('league_cutlist')
      .select('pid')
      .where('tid', teamId)

    // remove cutlist players
    for (const row of cutlist) {
      roster.removePlayer(row.pid)
    }

    if (restrictedFreeAgencyBid.processed) {
      return res.status(400).send({ error: 'bid has already been processed' })
    }

    // if competing bid, make sure there is roster space
    if (restrictedFreeAgencyBid.player_tid !== teamId) {
      if (!roster.hasOpenBenchSlot(player_row.pos)) {
        return res.status(400).send({ error: 'exceeds roster limits' })
      }

      // add to roster
      roster.addPlayer({
        slot: constants.slots.BENCH,
        pid,
        pos: player_row.pos,
        value: bid,
        restricted_free_agency_original_team: restrictedFreeAgencyBid.player_tid
      })
    } else {
      // update value to bid
      roster.updateValue(pid, bid)

      // check that the bid is within 10 dollars of the market salary
      const market_salary = await db('league_format_player_projection_values')
        .select('market_salary')
        .where({
          pid,
          week: 0,
          year: constants.season.year,
          league_format_hash: league.league_format_hash
        })
        .first()

      // TODO setup mocks for tests
      // if (!market_salary) {
      //   return res.status(400).send({ error: 'market salary not found' })
      // }

      if (market_salary) {
        const salary_difference = bid - market_salary.market_salary
        if (salary_difference < -10) {
          return res.status(400).send({
            error: 'bid must not be more than $10 below market salary'
          })
        }
      }
    }

    // make sure there is enough cap space
    // TODO
    /* if (!roster.availableCap) {
     *   return res.stauts(400).send({ error: 'exceeds cap space' })
     * }
     */
    if (restrictedFreeAgencyBid.player_tid === teamId) {
      await db('rosters_players')
        .update({ tag: constants.tags.RESTRICTED_FREE_AGENCY })
        .where({
          rid: rosterRow.uid,
          pid
        })
    }

    // insert into restrictedFreeAgencyBids
    await db('restricted_free_agency_bids')
      .update({
        userid: req.auth.userId,
        bid
      })
      .where('uid', restrictedFreeAgencyBid.uid)

    if (release.length) {
      const releaseInserts = release.map((pid) => ({
        restricted_free_agency_bid_id: restrictedFreeAgencyBid.uid,
        pid
      }))
      await db('restricted_free_agency_releases')
        .insert(releaseInserts)
        .onConflict(['restricted_free_agency_bid_id', 'pid'])
        .merge()
    }

    await db('restricted_free_agency_releases')
      .del()
      .where('restricted_free_agency_bid_id', restrictedFreeAgencyBid.uid)
      .whereNotIn('pid', release)

    res.send({
      ...restrictedFreeAgencyBid,
      bid,
      userid: req.auth.userId,
      release
    })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /api/teams/{teamId}/tag/restricted-free-agency/nominate:
 *   post:
 *     tags:
 *       - Teams
 *     summary: Nominate player for restricted free agency
 *     description: |
 *       Nominate a restricted free agent for the bidding process.
 *       Only the original team can nominate their RFA players.
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
 *                 description: Player ID to nominate
 *                 example: "JALE-HURT-2020-1998-08-07"
 *               leagueId:
 *                 type: integer
 *                 description: League ID
 *                 example: 2
 *             required:
 *               - pid
 *               - leagueId
 *           examples:
 *             nominatePlayer:
 *               summary: Nominate RFA player
 *               value:
 *                 pid: "JALE-HURT-2020-1998-08-07"
 *                 leagueId: 2
 *     responses:
 *       200:
 *         description: Player nominated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 nominated:
 *                   type: integer
 *                   description: Nomination timestamp
 *                   example: 1640995200
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/nominate/?', async (req, res) => {
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

    const tid = parseInt(teamId, 10)

    // verify teamId, leagueId belongs to user
    try {
      await verifyUserTeam({
        userId: req.auth.userId,
        leagueId,
        teamId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    // Check if the restricted free agency bid exists and belongs to the original manager
    const restricted_free_agency_bid = await db('restricted_free_agency_bids')
      .where({
        pid,
        tid,
        player_tid: tid,
        year: constants.season.year
      })
      .whereNull('cancelled')
      .first()

    if (!restricted_free_agency_bid) {
      return res
        .status(400)
        .send({ error: 'invalid restricted free agent bid' })
    }

    if (restricted_free_agency_bid.processed) {
      return res.status(400).send({ error: 'bid has already been processed' })
    }

    if (restricted_free_agency_bid.announced) {
      return res.status(400).send({ error: 'bid has already been announced' })
    }

    // clear any other unannounced nominations for this team
    await db('restricted_free_agency_bids')
      .where({
        tid,
        player_tid: tid
      })
      .whereNull('announced')
      .whereNotNull('nominated')
      .whereNull('processed')
      .whereNull('cancelled')
      .update({ nominated: null })

    const nominated_timestamp = Math.round(Date.now() / 1000)

    // Update the restricted free agency bid to mark it as announced
    await db('restricted_free_agency_bids')
      .where('uid', restricted_free_agency_bid.uid)
      .update({ nominated: nominated_timestamp })

    res.send({ nominated: nominated_timestamp })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 *   delete:
 *     tags:
 *       - Teams
 *     summary: Cancel restricted free agency nomination
 *     description: |
 *       Cancel the nomination of a restricted free agent.
 *       Cannot cancel if already announced or processed.
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
 *                 description: Player ID
 *                 example: "JALE-HURT-2020-1998-08-07"
 *               leagueId:
 *                 type: integer
 *                 description: League ID
 *                 example: 2
 *             required:
 *               - pid
 *               - leagueId
 *           examples:
 *             cancelNomination:
 *               summary: Cancel RFA nomination
 *               value:
 *                 pid: "JALE-HURT-2020-1998-08-07"
 *                 leagueId: 2
 *     responses:
 *       200:
 *         description: Nomination cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: "Restricted free agent nomination successfully cancelled"
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/nominate/?', async (req, res) => {
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

    const tid = parseInt(teamId, 10)

    // verify teamId, leagueId belongs to user
    try {
      await verifyUserTeam({
        userId: req.auth.userId,
        leagueId,
        teamId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    // Check if the restricted free agency bid exists and belongs to the original manager
    const restricted_free_agency_bid = await db('restricted_free_agency_bids')
      .where({
        pid,
        tid,
        player_tid: tid,
        year: constants.season.year
      })
      .whereNull('cancelled')
      .first()

    if (!restricted_free_agency_bid) {
      return res
        .status(400)
        .send({ error: 'invalid restricted free agent bid' })
    }

    if (restricted_free_agency_bid.cancelled) {
      return res.status(400).send({ error: 'bid has already been cancelled' })
    }

    if (restricted_free_agency_bid.processed) {
      return res.status(400).send({ error: 'bid has already been processed' })
    }

    if (restricted_free_agency_bid.announced) {
      return res.status(400).send({ error: 'bid has already been announced' })
    }

    // Cancel the nomination
    await db('restricted_free_agency_bids')
      .where('uid', restricted_free_agency_bid.uid)
      .update({ nominated: null })

    res.send({
      message: 'Restricted free agent nomination successfully cancelled'
    })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
