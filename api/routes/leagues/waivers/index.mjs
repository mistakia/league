import dayjs from 'dayjs'
import express from 'express'

import report from './report.mjs'

import {
  constants,
  Roster,
  getDraftDates,
  isSantuaryPeriod,
  get_free_agent_period
} from '#libs-shared'
import {
  getRoster,
  getLeague,
  isPlayerRostered,
  isPlayerOnWaivers,
  verifyUserTeam,
  verifyReserveStatus,
  get_super_priority_status
} from '#libs-server'

const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * /leagues/{leagueId}/waivers/super-priority/{pid}:
 *   get:
 *     summary: Get super priority waiver status for a player
 *     description: |
 *       Retrieves the super priority waiver claim status for a specific player.
 *       Super priority allows a team to reclaim a player they previously had on their practice squad
 *       who was poached by another team and subsequently released.
 *     tags:
 *       - Waivers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *       - name: pid
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Player ID
 *         example: 'ALVI-KAME-2022-1999-02-05'
 *     responses:
 *       200:
 *         description: Super priority status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuperPriorityStatus'
 *             examples:
 *               eligible:
 *                 value:
 *                   eligible: true
 *                   original_tid: 5
 *                   player_id: 'ALVI-KAME-2022-1999-02-05'
 *               not_eligible:
 *                 value:
 *                   eligible: false
 *                   original_tid: null
 *                   player_id: 'ALVI-KAME-2022-1999-02-05'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/super-priority/:pid', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const { pid } = req.params

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    const super_priority_status = await get_super_priority_status({
      pid,
      lid: leagueId
    })

    res.send(super_priority_status)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/waivers:
 *   get:
 *     summary: Get processed waiver claims for a league
 *     description: |
 *       Retrieves all processed waiver claims for a specific league and waiver type.
 *       Returns historical waiver claims that have been processed, including any player releases
 *       associated with each claim.
 *     tags:
 *       - Waivers
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *       - name: type
 *         in: query
 *         required: true
 *         schema:
 *           type: integer
 *           enum: [1, 2, 3]
 *         description: |
 *           Waiver type:
 *           - 1: FREE_AGENCY (active roster waivers)
 *           - 2: POACH (practice squad poaching waivers)
 *           - 3: FREE_AGENCY_PRACTICE (practice squad waivers)
 *         example: 1
 *     responses:
 *       200:
 *         description: Processed waiver claims retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ProcessedWaiverClaim'
 *             examples:
 *               processed_claims:
 *                 value:
 *                   - uid: 12345
 *                     processed: 1640995200
 *                     release:
 *                       - pid: 'JORD-LOVE-2020-1998-11-02'
 *                   - uid: 12346
 *                     processed: 1640908800
 *                     release: []
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const type = Number(req.query.type)

    if (!type) {
      return res.status(400).send({ error: 'missing type' })
    }

    const types = Object.values(constants.waivers)
    if (!types.includes(type)) {
      return res.status(400).send({ error: 'invalid type' })
    }

    const waivers = await db('waivers')
      .select('uid', 'processed')
      .where('lid', leagueId)
      .where('type', type)
      .whereNotNull('processed')
      .groupBy('processed', 'uid')
      .orderBy('processed', 'desc')
    const waiverIds = waivers.map((p) => p.uid)
    const waiverReleases = await db('waiver_releases').whereIn(
      'waiverid',
      waiverIds
    )
    for (const waiver of waivers) {
      waiver.release = waiverReleases.filter((p) => p.waiverid === waiver.uid)
    }

    res.send(waivers)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/waivers:
 *   post:
 *     summary: Submit a new waiver claim
 *     description: |
 *       Submits a new waiver claim for a player. The claim will be processed during the next waiver run.
 *       Supports different waiver types including free agency, practice squad, and poaching claims.
 *       Can optionally include players to release and a bid amount for free agency claims.
 *     tags:
 *       - Waivers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WaiverClaimRequest'
 *           examples:
 *             free_agency_claim:
 *               summary: Free agency waiver claim with bid and release
 *               value:
 *                 pid: 'ALVI-KAME-2022-1999-02-05'
 *                 teamId: 5
 *                 leagueId: 2
 *                 type: 1
 *                 bid: 50
 *                 release: ['JORD-LOVE-2020-1998-11-02']
 *             practice_squad_claim:
 *               summary: Practice squad waiver claim
 *               value:
 *                 pid: 'DAMI-HARR-2019-1997-01-09'
 *                 teamId: 5
 *                 leagueId: 2
 *                 type: 3
 *                 bid: 0
 *                 release: []
 *             poach_claim:
 *               summary: Practice squad poaching claim
 *               value:
 *                 pid: 'ISAI-PACH-2022-1999-07-22'
 *                 teamId: 5
 *                 leagueId: 2
 *                 type: 2
 *                 bid: 0
 *                 release: []
 *             super_priority_claim:
 *               summary: Super priority practice squad claim
 *               value:
 *                 pid: 'ALVI-KAME-2022-1999-02-05'
 *                 teamId: 5
 *                 leagueId: 2
 *                 type: 3
 *                 bid: 0
 *                 release: []
 *                 super_priority: true
 *     responses:
 *       200:
 *         description: Waiver claim submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WaiverClaim'
 *             examples:
 *               successful_claim:
 *                 value:
 *                   uid: 12345
 *                   tid: 5
 *                   userid: 1
 *                   lid: 2
 *                   pid: 'ALVI-KAME-2022-1999-02-05'
 *                   po: 9999
 *                   submitted: 1640995200
 *                   bid: 50
 *                   type: 1
 *                   super_priority: 0
 *                   release: ['JORD-LOVE-2020-1998-11-02']
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
    const { pid, leagueId, type, teamId, super_priority } = req.body
    let { release } = req.body
    let bid = Number(req.body.bid || 0)

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!Array.isArray(release)) {
      release = release ? [release] : []
    }

    if (constants.season.week > constants.season.finalWeek) {
      return res.status(400).send({ error: 'player is locked' })
    }

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    if (typeof type === 'undefined' || type === null) {
      return res.status(400).send({ error: 'missing type' })
    }

    if (!Object.values(constants.waivers).includes(type)) {
      return res.status(400).send({ error: 'invalid type' })
    }

    // Super priority can only be used for practice squad waivers
    if (super_priority && type !== constants.waivers.FREE_AGENCY_PRACTICE) {
      return res
        .status(400)
        .send({ error: 'super priority only valid for practice squad waivers' })
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

    const pids = [pid]
    if (release.length) {
      release.forEach((release_pid) => pids.push(release_pid))
    }
    const player_rows = await db('player').whereIn('pid', pids)
    if (player_rows.length !== pids.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const player_row = player_rows.find((p) => p.pid === pid)

    // Validate super priority claim
    if (super_priority) {
      const super_priority_status = await get_super_priority_status({
        pid,
        lid: leagueId
      })

      if (!super_priority_status.eligible) {
        return res
          .status(400)
          .send({ error: 'super priority not available for this player' })
      }

      if (super_priority_status.original_tid !== tid) {
        return res
          .status(400)
          .send({ error: 'super priority not available for this team' })
      }
    }

    if (type === constants.waivers.FREE_AGENCY_PRACTICE) {
      // set bid to zero for practice squad waivers
      bid = 0

      // TODO - verify player was not previously on team active roster
    }

    const transactions = await db('transactions')
      .where('pid', pid)
      .where({ lid: leagueId })
      .orderBy('timestamp', 'desc')
      .orderBy('uid', 'desc')

    if (
      constants.season.isRegularSeason &&
      !constants.season.isWaiverPeriod &&
      !transactions.length
    ) {
      return res.status(400).send({ error: 'player is not on waivers' })
    }

    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    const faPeriod = get_free_agent_period(league)

    // check free agency waivers
    if (
      type === constants.waivers.FREE_AGENCY ||
      type === constants.waivers.FREE_AGENCY_PRACTICE
    ) {
      // make sure player is not rostered
      const isRostered = await isPlayerRostered({ pid, leagueId })
      if (isRostered) {
        return res.status(400).send({ error: 'player rostered' })
      }

      if (constants.season.isRegularSeason) {
        // if regular season and not during waiver period, check if player is on release waivers
        if (!constants.season.isWaiverPeriod) {
          const isOnWaivers = await isPlayerOnWaivers({ pid, leagueId })
          if (!isOnWaivers) {
            return res.status(400).send({ error: 'player is not on waivers' })
          }
        }

        // otherwise, it's a waiver period and all players are on waivers
      } else {
        // Offseason

        // reject active roster waivers before start of free agenct period
        if (
          type === constants.waivers.FREE_AGENCY &&
          (!league.free_agency_live_auction_start ||
            dayjs().isBefore(faPeriod.start))
        ) {
          return res
            .status(400)
            .send({ error: 'active roster waivers not open' })
        }

        if (type === constants.waivers.FREE_AGENCY_PRACTICE) {
          const picks = await db('draft')
            .where({
              year: constants.season.year,
              lid: leagueId
            })
            .orderBy('pick', 'asc')
          const last_pick = picks[picks.length - 1]

          // Get the season data to check for explicit completion timestamp
          const season = await db('seasons')
            .where({
              lid: leagueId,
              year: constants.season.year
            })
            .first()

          const draft_dates = getDraftDates({
            start: league.draft_start,
            type: league.draft_type,
            min: league.draft_hour_min,
            max: league.draft_hour_max,
            picks: last_pick?.pick, // TODO — should be total number of picks in case some picks are missing due to decommissoned teams
            last_selection_timestamp: last_pick
              ? last_pick.selection_timestamp
              : null,
            rookie_draft_completed_at: season
              ? season.rookie_draft_completed_at
              : null
          })

          // if player is a rookie
          if (player_row.nfl_draft_year === constants.season.year) {
            // reject practice waivers before day after draft
            if (!league.draft_start || dayjs().isBefore(draft_dates.draftEnd)) {
              return res.status(400).send({
                error: 'practice squad waivers are not open for rookies'
              })
            }

            // if after rookie draft waivers cleared and before free agency period, check if player is on release waivers
            // Skip this check for super priority claims which have their own eligibility rules
            if (
              !super_priority &&
              league.draft_start &&
              dayjs().isAfter(draft_dates.waiverEnd) &&
              (!league.free_agency_live_auction_start ||
                dayjs().isBefore(faPeriod.start))
            ) {
              const isOnWaivers = await isPlayerOnWaivers({ pid, leagueId })
              if (!isOnWaivers) {
                return res
                  .status(400)
                  .send({ error: 'player is not on waivers' })
              }
            }
          } else {
            // reject practice waivers for veterans before fa period
            // Skip this check for super priority claims which can be made anytime after poaching
            if (
              !super_priority &&
              (!league.free_agency_live_auction_start ||
                dayjs().isBefore(faPeriod.start))
            ) {
              return res.status(400).send({
                error: 'practice squad waivers are not open for non-rookies'
              })
            }
          }
        }
      }

      // check for duplicate claims
      const claimsQuery = db('waivers')
        .where({ pid, lid: leagueId, tid, type })
        .whereNull('processed')
        .whereNull('cancelled')

      if (bid) {
        claimsQuery.where('bid', bid)
      }

      const claims = await claimsQuery

      if (claims.length) {
        // compare releases
        for (const claim of claims) {
          const release_rows = await db('waiver_releases').where(
            'waiverid',
            claim.uid
          )
          const existing_release_pids = release_rows.map((r) => r.pid)
          if (
            existing_release_pids.sort().join(',') === release.sort().join(',')
          ) {
            return res.status(400).send({ error: 'duplicate waiver claim' })
          }
        }
      }
    } else if (type === constants.waivers.POACH) {
      const is_sanctuary_period = isSantuaryPeriod(league)

      // player can not be on waivers if he has no transactions
      if (!is_sanctuary_period && !transactions.length) {
        return res.status(400).send({ error: 'player is not on waivers' })
      }

      // player has been deactivated
      if (
        !is_sanctuary_period &&
        transactions[0].type !== constants.transactions.ROSTER_DEACTIVATE &&
        transactions[0].type !== constants.transactions.PRACTICE_ADD &&
        transactions[0].type !== constants.transactions.DRAFT
      ) {
        return res.status(400).send({ error: 'player is not on waivers' })
      }

      // transaction should have been within the last 48 hours
      if (
        !is_sanctuary_period &&
        (dayjs().isAfter(
          dayjs.unix(transactions[0].timestamp).add('48', 'hours')
        ) ||
          dayjs().isBefore(
            dayjs.unix(transactions[0].timestamp).add('24', 'hours')
          ))
      ) {
        return res.status(400).send({ error: 'player is not on waivers' })
      }

      // verify player is on practice squad
      const slots = await db('rosters_players')
        .where({
          lid: leagueId,
          week: constants.season.week,
          year: constants.season.year,
          pid
        })
        .where(function () {
          this.where({
            slot: constants.slots.PS
          }).orWhere({
            slot: constants.slots.PSD
          })
        })
      if (!slots.length) {
        return res.status(400).send({
          error: 'player is not in an unprotected practice squad slot'
        })
      }

      // check for duplicate waiver
      const claims = await db('waivers')
        .where({ pid, lid: leagueId, tid })
        .whereNull('processed')
        .whereNull('cancelled')

      if (claims.length) {
        return res.status(400).send({ error: 'duplicate waiver claim' })
      }
    }

    // verify team has space for player on active roster
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })
    if (release.length) {
      for (const release_pid of release) {
        if (!roster.has(release_pid)) {
          return res.status(400).send({ error: 'invalid release' })
        }

        const releasePlayer = roster.get(release_pid)
        if (
          releasePlayer.slot === constants.slots.PSP ||
          releasePlayer.slot === constants.slots.PSDP
        ) {
          return res.status(400).send({ error: 'invalid release' })
        }
        roster.removePlayer(release_pid)
      }
    }
    const hasSlot =
      type === constants.waivers.FREE_AGENCY_PRACTICE
        ? roster.hasOpenPracticeSquadSlot()
        : roster.hasOpenBenchSlot(player_row.pos)
    if (!hasSlot) {
      return res.status(400).send({ error: 'exceeds roster limits' })
    }

    // check team reserve status
    try {
      await verifyReserveStatus({ teamId, leagueId })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    const data = {
      tid,
      userid: req.auth.userId,
      lid: leagueId,
      pid,
      po: 9999,
      submitted: Math.round(Date.now() / 1000),
      bid,
      type,
      super_priority: super_priority ? 1 : 0
    }
    const ids = await db('waivers').insert(data).returning('uid')
    const waiverId = ids[0].uid
    data.uid = waiverId

    if (release.length) {
      const releaseInserts = release.map((pid) => ({
        waiverid: waiverId,
        pid
      }))
      await db('waiver_releases').insert(releaseInserts)
    }

    data.release = release

    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/waivers/order:
 *   put:
 *     summary: Update waiver claim priority order
 *     description: |
 *       Updates the priority order of pending waiver claims for a team.
 *       Lower priority values are processed first (0 is highest priority).
 *       Claims are processed in order of priority when waivers run.
 *     tags:
 *       - Waivers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WaiverOrderRequest'
 *           examples:
 *             reorder_claims:
 *               summary: Reorder waiver claims by priority
 *               value:
 *                 teamId: 5
 *                 leagueId: 2
 *                 waivers: [12345, 12347, 12346]
 *     responses:
 *       200:
 *         description: Waiver order updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: integer
 *               description: Array of waiver IDs in their new priority order
 *             examples:
 *               updated_order:
 *                 value: [12345, 12347, 12346]
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/order', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { waivers, teamId, leagueId } = req.body

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId param' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId param' })
    }

    if (!waivers || !Array.isArray(waivers)) {
      return res.status(400).send({ error: 'missing waivers array' })
    }

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

    const tid = Number(teamId)

    const result = []
    for (const [index, waiverId] of waivers.entries()) {
      await db('waivers').update('po', index).where({
        uid: waiverId,
        tid,
        lid: leagueId
      })
      result.push(waiverId)
    }
    res.send(result)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/waivers/{waiverId}:
 *   put:
 *     summary: Update an existing waiver claim
 *     description: |
 *       Updates an existing pending waiver claim. Can modify the bid amount and/or
 *       players to be released. Only pending (unprocessed) claims can be updated.
 *     tags:
 *       - Waivers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *       - name: waiverId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: Waiver claim ID
 *         example: 12345
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WaiverUpdateRequest'
 *           examples:
 *             update_bid_and_release:
 *               summary: Update bid amount and release players
 *               value:
 *                 teamId: 5
 *                 leagueId: 2
 *                 bid: 75
 *                 release: ['JORD-LOVE-2020-1998-11-02', 'DAMI-HARR-2019-1997-01-09']
 *             update_bid_only:
 *               summary: Update bid amount only
 *               value:
 *                 teamId: 5
 *                 leagueId: 2
 *                 bid: 100
 *                 release: []
 *     responses:
 *       200:
 *         description: Waiver claim updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WaiverUpdateResponse'
 *             examples:
 *               updated_claim:
 *                 value:
 *                   uid: 12345
 *                   bid: 75
 *                   release: ['JORD-LOVE-2020-1998-11-02', 'DAMI-HARR-2019-1997-01-09']
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/:waiverId', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { waiverId } = req.params
    const { teamId, leagueId } = req.body
    let { release } = req.body
    const bid = Number(req.body.bid || 0)

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!Array.isArray(release)) {
      release = release ? [release] : []
    }

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    if (
      typeof bid !== 'undefined' &&
      (isNaN(bid) || bid < 0 || bid % 1 !== 0)
    ) {
      return res.status(400).send({ error: 'invalid bid' })
    }

    // verify teamId, leagueId belongs to user
    let team
    try {
      team = await verifyUserTeam({
        userId: req.auth.userId,
        leagueId,
        teamId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    const tid = Number(teamId)

    // verify waiverId belongs to teamId
    const waivers = await db('waivers')
      .where({
        uid: waiverId,
        tid,
        lid: leagueId
      })
      .whereNull('processed')
      .whereNull('cancelled')

    if (!waivers.length) {
      return res.status(400).send({ error: 'invalid waiverId' })
    }
    const waiver = waivers[0]

    // if bid - make sure it is below available faab
    if (bid > team.faab) {
      return res.status(400).send({ error: 'bid exceeds available faab' })
    }

    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const player_rows = await db('player').where('pid', waiver.pid).limit(1)
    if (!player_rows.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const player_row = player_rows[0]

    // verify team has space for player on active roster
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })
    if (release.length) {
      for (const release_pid of release) {
        if (!roster.has(release_pid)) {
          return res.status(400).send({ error: 'invalid release' })
        }
        roster.removePlayer(release_pid)
      }
    }
    const hasSlot =
      waiver.type === constants.waivers.FREE_AGENCY_PRACTICE
        ? roster.hasOpenPracticeSquadSlot()
        : roster.hasOpenBenchSlot(player_row.pos)
    if (!hasSlot) {
      return res.status(400).send({ error: 'exceeds roster limits' })
    }

    await db('waivers').update({ bid }).where({ uid: waiverId })
    if (release.length) {
      const releaseInserts = release.map((pid) => ({
        waiverid: waiverId,
        pid
      }))
      await db('waiver_releases')
        .insert(releaseInserts)
        .onConflict(['waiverid', 'pid'])
        .merge()
    }
    await db('waiver_releases')
      .del()
      .where('waiverid', waiverId)
      .whereNotIn('pid', release)

    res.send({ bid, release, uid: waiverId })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/waivers/{waiverId}/cancel:
 *   post:
 *     summary: Cancel a pending waiver claim
 *     description: |
 *       Cancels a pending waiver claim. Only pending (unprocessed) claims can be cancelled.
 *       Once cancelled, the claim will not be processed during the next waiver run.
 *     tags:
 *       - Waivers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *       - name: waiverId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: Waiver claim ID to cancel
 *         example: 12345
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WaiverCancelRequest'
 *           examples:
 *             cancel_claim:
 *               summary: Cancel a waiver claim
 *               value:
 *                 teamId: 5
 *                 leagueId: 2
 *     responses:
 *       200:
 *         description: Waiver claim cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WaiverCancelResponse'
 *             examples:
 *               cancelled_claim:
 *                 value:
 *                   uid: 12345
 *                   tid: 5
 *                   lid: 2
 *                   cancelled: 1640995200
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/:waiverId/cancel', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (isNaN(req.params.waiverId)) {
      return res.status(400).send({ error: 'invalid waiverId' })
    }

    const waiverId = Number(req.params.waiverId)
    const { teamId, leagueId } = req.body

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

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

    const tid = Number(teamId)

    // verify waiverId belongs to teamId
    const waivers = await db('waivers')
      .where({
        uid: waiverId,
        tid,
        lid: leagueId
      })
      .whereNull('processed')
      .whereNull('cancelled')

    if (!waivers.length) {
      return res.status(400).send({ error: 'invalid waiverId' })
    }

    const cancelled = Math.round(Date.now() / 1000)
    await db('waivers').update('cancelled', cancelled).where('uid', waiverId)

    res.send({
      uid: waiverId,
      tid,
      lid: leagueId,
      cancelled
    })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.use('/report', report)

export default router
