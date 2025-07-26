import express from 'express'
import dayjs from 'dayjs'

import {
  constants,
  Roster,
  isDraftWindowOpen,
  getDraftDates,
  get_last_consecutive_pick
} from '#libs-shared'
import {
  getRoster,
  sendNotifications,
  verifyUserTeam,
  verifyReserveStatus,
  getLeague
} from '#libs-server'

const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * components:
 *   schemas:
 *     DraftPick:
 *       type: object
 *       description: Fantasy draft pick information
 *       properties:
 *         uid:
 *           type: integer
 *           description: Draft pick ID
 *           example: 1542
 *         tid:
 *           type: integer
 *           description: Team ID that owns the pick
 *           example: 13
 *         lid:
 *           type: integer
 *           description: League ID
 *           example: 2
 *         year:
 *           type: integer
 *           description: Draft year
 *           example: 2024
 *         round:
 *           type: integer
 *           description: Draft round (1-based)
 *           example: 1
 *         pick:
 *           type: integer
 *           description: Overall pick number
 *           example: 3
 *         pick_str:
 *           type: string
 *           description: Formatted pick string (e.g., "1.03")
 *           example: "1.03"
 *         otid:
 *           type: integer
 *           nullable: true
 *           description: Original team ID (if pick was traded)
 *           example: 15
 *         pid:
 *           type: string
 *           nullable: true
 *           description: Player ID if pick has been used
 *           example: "4017"
 *         selection_timestamp:
 *           type: integer
 *           nullable: true
 *           description: Unix timestamp when pick was made
 *           example: 1698765432
 *
 *     DraftPicksResponse:
 *       type: object
 *       properties:
 *         picks:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/DraftPick'
 *           description: Array of draft picks
 *
 *     MakeDraftPickRequest:
 *       type: object
 *       required:
 *         - teamId
 *         - pid
 *         - pickId
 *       properties:
 *         teamId:
 *           type: integer
 *           description: Team ID making the pick
 *           example: 13
 *         pid:
 *           type: string
 *           description: Player ID being drafted
 *           example: "4017"
 *         pickId:
 *           type: integer
 *           description: Draft pick ID being used
 *           example: 1542
 *
 *     MakeDraftPickResponse:
 *       type: object
 *       properties:
 *         uid:
 *           type: integer
 *           description: Draft pick ID
 *           example: 1542
 *         pid:
 *           type: string
 *           description: Player ID that was drafted
 *           example: "4017"
 *         lid:
 *           type: integer
 *           description: League ID
 *           example: 2
 *         tid:
 *           type: integer
 *           description: Team ID that made the pick
 *           example: 13
 */

/**
 * @swagger
 * /leagues/{leagueId}/draft:
 *   get:
 *     summary: Get fantasy league draft picks
 *     description: |
 *       Retrieves all draft picks for a fantasy league, optionally filtered by year.
 *       Returns both used and unused picks with their current ownership and selection status.
 *
 *       **Key Features:**
 *       - Returns all draft picks for the specified league
 *       - Shows pick ownership (including traded picks)
 *       - Indicates which picks have been used and when
 *       - Supports historical draft data via year parameter
 *
 *       **Fantasy Football Context:**
 *       - Draft picks are used to select rookie players in annual drafts
 *       - Each pick has a specific round and position within that round
 *       - Picks can be traded between teams, changing ownership
 *       - Used picks show which player was selected and when
 *
 *       **Pick Status:**
 *       - Unused picks have null pid (player ID)
 *       - Used picks have pid and selection_timestamp populated
 *       - Original team ID (otid) shows if pick was traded
 *     tags:
 *       - Fantasy Leagues
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *       - name: year
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2030
 *         description: |
 *           Draft year to retrieve picks for.
 *           Defaults to current season if not specified.
 *         example: 2024
 *     responses:
 *       200:
 *         description: Successfully retrieved draft picks
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DraftPicksResponse'
 *             examples:
 *               success:
 *                 summary: Draft picks with used and unused picks
 *                 value:
 *                   picks:
 *                     - uid: 1542
 *                       tid: 13
 *                       lid: 2
 *                       year: 2024
 *                       round: 1
 *                       pick: 3
 *                       pick_str: "1.03"
 *                       otid: null
 *                       pid: "4017"
 *                       selection_timestamp: 1698765432
 *                     - uid: 1543
 *                       tid: 14
 *                       lid: 2
 *                       year: 2024
 *                       round: 1
 *                       pick: 4
 *                       pick_str: "1.04"
 *                       otid: 13
 *                       pid: null
 *                       selection_timestamp: null
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const year = req.query.year || constants.season.year

    const picks = await db('draft').where({ lid: leagueId, year })
    res.send({ picks })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/draft:
 *   post:
 *     summary: Make a draft pick
 *     description: |
 *       Makes a draft pick for a team in the fantasy league's rookie draft.
 *       This endpoint handles the complex logic of validating draft timing, pick ownership,
 *       player eligibility, and roster constraints.
 *
 *       **Key Features:**
 *       - Validates draft timing (must be within draft window)
 *       - Ensures proper pick sequence and ownership
 *       - Verifies player eligibility (must be rookie)
 *       - Checks roster space and reserve violations
 *       - Creates transaction records and broadcasts pick
 *       - Automatically cancels related trade proposals
 *
 *       **Fantasy Football Context:**
 *       - Only rookie players (current year NFL draft class) can be drafted
 *       - Picks must be made in sequence unless draft window is open
 *       - Each pick has value based on draft position for salary purposes
 *       - Making a pick creates a roster transaction and adds player to practice squad
 *
 *       **Draft Timing Rules:**
 *       - Draft must have started (based on league draft_start setting)
 *       - Draft must not have ended (all picks completed or draft window closed)
 *       - Previous pick must be made OR team's draft window must be open
 *       - Draft windows are calculated based on league draft type and timing settings
 *
 *       **Player Requirements:**
 *       - Player must be from current year's NFL draft class
 *       - Player must not already be rostered by any team
 *       - Player position must be valid
 *
 *       **Team Requirements:**
 *       - User must own the team making the pick
 *       - Team must own the specific draft pick being used
 *       - Team must have roster space (checked via reserve violations)
 *       - No pending reserve violations that would prevent the pick
 *
 *       **Automatic Actions:**
 *       - Adds player to team's practice squad (PSD slot)
 *       - Creates draft transaction with calculated value
 *       - Updates draft pick with player ID and timestamp
 *       - Cancels any pending trades involving the used pick
 *       - Broadcasts pick to league via WebSocket
 *       - Sends notification to league members
 *     tags:
 *       - Fantasy Leagues
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MakeDraftPickRequest'
 *           examples:
 *             make_pick:
 *               summary: Make first round pick
 *               value:
 *                 teamId: 13
 *                 pid: "4017"
 *                 pickId: 1542
 *     responses:
 *       200:
 *         description: Draft pick made successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MakeDraftPickResponse'
 *             examples:
 *               success:
 *                 summary: Successful draft pick
 *                 value:
 *                   uid: 1542
 *                   pid: "4017"
 *                   lid: 2
 *                   tid: 13
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missing_team_id:
 *                 summary: Missing team ID
 *                 value:
 *                   error: missing teamId
 *               missing_player_id:
 *                 summary: Missing player ID
 *                 value:
 *                   error: missing pid
 *               missing_pick_id:
 *                 summary: Missing pick ID
 *                 value:
 *                   error: missing pickId
 *               draft_not_started:
 *                 summary: Draft has not started
 *                 value:
 *                   error: draft has not started
 *               draft_ended:
 *                 summary: Draft has ended
 *                 value:
 *                   error: draft has ended
 *               invalid_pick_id:
 *                 summary: Invalid or already used pick ID
 *                 value:
 *                   error: invalid pickId
 *               not_on_clock:
 *                 summary: Pick not available yet
 *                 value:
 *                   error: draft pick not on the clock
 *               invalid_player:
 *                 summary: Invalid player (not rookie or invalid)
 *                 value:
 *                   error: invalid pid
 *               player_rostered:
 *                 summary: Player already rostered
 *                 value:
 *                   error: player rostered
 *               team_verification_failed:
 *                 summary: User doesn't own team or team invalid
 *                 value:
 *                   error: Team verification failed
 *               reserve_violation:
 *                 summary: Reserve or roster constraint violation
 *                 value:
 *                   error: Reserve violation details
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/?', async (req, res) => {
  const { db, logger, broadcast } = req.app.locals
  try {
    const { leagueId } = req.params
    const { teamId, pid, pickId } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId' })
    }

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    if (!pickId) {
      return res.status(400).send({ error: 'missing pickId' })
    }

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
    const lid = Number(leagueId)

    // make sure draft has started
    const league = await getLeague({ lid })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    const draftStart = dayjs.unix(league.draft_start)
    if (constants.season.now.isBefore(draftStart)) {
      return res.status(400).send({ error: 'draft has not started' })
    }

    // make sure draft has not ended
    const last_pick = await db('draft')
      .where({
        year: constants.season.year,
        lid: leagueId
      })
      .orderBy('pick', 'desc')
      .first()

    const draftDates = getDraftDates({
      start: league.draft_start,
      type: league.draft_type,
      min: league.draft_hour_min,
      max: league.draft_hour_max,
      picks: last_pick?.pick, // TODO — should be total number of picks in case some picks are missing due to decommissoned teams
      last_selection_timestamp: last_pick ? last_pick.selection_timestamp : null
    })

    if (constants.season.now.isAfter(draftDates.draftEnd)) {
      return res.status(400).send({ error: 'draft has ended' })
    }

    // check if previous pick has been made
    const picks = await db('draft').where({ uid: pickId }).whereNull('pid')
    const pick = picks[0]
    if (!pick) {
      return res.status(400).send({ error: 'invalid pickId' })
    }
    if (pick.tid !== teamId) {
      return res.status(400).send({ error: 'invalid pickId' })
    }

    // previous pick might not be pick - 1 if it belonged to a commissioned team
    const prev_pick = await db('draft')
      .where({
        lid,
        year: constants.season.year
      })
      .where('pick', '<', pick.pick)
      .orderBy('pick', 'desc')
      .first()
    const isPreviousSelectionMade =
      pick.pick === 1 || Boolean(prev_pick && prev_pick.pid)

    // locate the last consecutive pick going back to the first pick
    const draft_picks = await db('draft')
      .where({ lid, year: constants.season.year })
      .orderBy('pick', 'asc')
    const last_consective_pick = get_last_consecutive_pick(draft_picks)

    // if previous selection is not made make, check if teams window has opened
    const isWindowOpen = isDraftWindowOpen({
      last_consective_pick,
      start: league.draft_start,
      pickNum: pick.pick,
      min: league.draft_hour_min,
      max: league.draft_hour_max,
      type: league.draft_type
    })

    if (!isPreviousSelectionMade && !isWindowOpen) {
      return res.status(400).send({ error: 'draft pick not on the clock' })
    }

    // verify no reserve violations
    try {
      await verifyReserveStatus({ teamId, leagueId })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    // make sure player is a rookie
    const player_rows = await db('player').where({ pid })
    const player_row = player_rows[0]
    if (!player_row || player_row.nfl_draft_year !== constants.season.year) {
      return res.status(400).send({ error: 'invalid pid' })
    }

    // make sure player is available/undrafted
    const rosterPlayers = await db('rosters_players').where({
      lid,
      year: constants.season.year,
      week: 0,
      pid
    })
    if (rosterPlayers.length) {
      return res.status(400).send({ error: 'player rostered' })
    }

    // make sure team has an open slot
    const rosterRow = await getRoster({
      tid: teamId,
      year: constants.season.year,
      week: 0
    })
    const roster = new Roster({ roster: rosterRow, league })
    const value =
      league.num_teams - pick.pick + 1 > 0
        ? league.num_teams - pick.pick + 1
        : 1

    await db('rosters_players').insert({
      rid: roster.uid,
      pid,
      pos: player_row.pos,
      slot: constants.slots.PSD,
      extensions: 0,
      tid: teamId,
      lid,
      year: constants.season.year,
      week: 0
    })

    await db('transactions').insert({
      userid: req.auth.userId,
      tid: teamId,
      lid,
      pid,
      type: constants.transactions.DRAFT,
      week: constants.season.week,
      year: constants.season.year,
      timestamp: Math.round(Date.now() / 1000),
      value
    })

    await db('draft')
      .where({ uid: pickId })
      .update({
        pid,
        selection_timestamp: Math.round(Date.now() / 1000)
      })

    const trades = await db('trades')
      .innerJoin('trades_picks', 'trades.uid', 'trades_picks.tradeid')
      .where('trades_picks.pickid', pickId)
      .whereNull('trades.accepted')
      .whereNull('trades.cancelled')
      .whereNull('trades.rejected')
      .whereNull('trades.vetoed')

    if (trades.length) {
      // TODO - broadcast on WS
      // TODO - broadcast notifications
      const tradeids = trades.map((t) => t.uid)
      await db('trades')
        .whereIn('uid', tradeids)
        .update({ cancelled: Math.round(Date.now() / 1000) })
    }

    const data = { uid: pickId, pid, lid, tid: teamId }
    broadcast(lid, {
      type: 'DRAFTED_PLAYER',
      payload: { data }
    })
    res.send(data)

    const teams = await db('teams').where({
      uid: teamId,
      year: constants.season.year
    })
    const team = teams[0]

    let message = `${team.name} has selected ${player_row.fname} ${player_row.lname} (${player_row.pos}) with `
    if (pick.pick === 1) {
      message += 'the first overall pick '
    } else {
      message += `pick #${pick.pick} (${pick.pick_str}) `
    }
    message += `in the ${constants.season.year} draft`

    await sendNotifications({
      league,
      notifyLeague: true,
      message
    })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

export default router
