import express from 'express'
import dayjs from 'dayjs'

import { constants, Roster } from '#libs-shared'
import get_default_trade_slot from '#libs-shared/get-default-trade-slot.mjs'
import validate_trade_roster_slots from '#libs-server/validate-trade-roster-slots.mjs'
import {
  getRoster,
  getLeague,
  verifyRestrictedFreeAgency,
  verifyUserTeam
} from '#libs-server'
import trade, { get_trade } from './trade.mjs'

const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateTradeRequest:
 *       type: object
 *       required:
 *         - propose_tid
 *         - accept_tid
 *       properties:
 *         propose_tid:
 *           type: integer
 *           description: Proposing team ID
 *           example: 13
 *         accept_tid:
 *           type: integer
 *           description: Accepting team ID
 *           example: 14
 *         proposingTeamPlayers:
 *           oneOf:
 *             - type: string
 *             - type: array
 *               items:
 *                 type: string
 *           description: Player ID(s) from proposing team
 *           example: ["4017", "3892"]
 *         acceptingTeamPlayers:
 *           oneOf:
 *             - type: string
 *             - type: array
 *               items:
 *                 type: string
 *           description: Player ID(s) from accepting team
 *           example: ["2041"]
 *         proposingTeamPicks:
 *           oneOf:
 *             - type: integer
 *             - type: array
 *               items:
 *                 type: integer
 *           description: Draft pick ID(s) from proposing team
 *           example: [1542]
 *         acceptingTeamPicks:
 *           oneOf:
 *             - type: integer
 *             - type: array
 *               items:
 *                 type: integer
 *           description: Draft pick ID(s) from accepting team
 *           example: [1543]
 *         releasePlayers:
 *           oneOf:
 *             - type: string
 *             - type: array
 *               items:
 *                 type: string
 *           description: Player ID(s) to release from proposing team
 *           example: ["1889"]
 *
 *     TradesListResponse:
 *       type: object
 *       description: List of trade proposals
 *       example:
 *         - uid: 1234
 *           lid: 2
 *           propose_tid: 13
 *           accept_tid: 14
 *           userid: 5
 *           proposed: 1698765432
 *           accepted: null
 *           rejected: null
 *           cancelled: null
 *           vetoed: null
 *           proposingTeamPlayers: ["4017", "3892"]
 *           acceptingTeamPlayers: ["2041"]
 *           proposingTeamPicks: []
 *           acceptingTeamPicks: []
 *           proposingTeamReleasePlayers: []
 *           acceptingTeamReleasePlayers: []
 */

/**
 * @swagger
 * /leagues/{leagueId}/trades:
 *   get:
 *     summary: Get trade proposals for a team
 *     description: |
 *       Retrieves all trade proposals involving a specific team, including both
 *       proposed and received trades with their current status and details.
 *
 *       **Key Features:**
 *       - Returns all trades involving the specified team
 *       - Includes complete trade details with players and picks
 *       - Shows trade status (pending, accepted, rejected, etc.)
 *       - Organizes assets by proposing/accepting team
 *
 *       **Fantasy Football Context:**
 *       - Teams can view all their trade activity
 *       - Includes both sent and received trade proposals
 *       - Shows historical and active trade negotiations
 *       - Helps track trade proposal outcomes
 *
 *       **Trade Information:**
 *       - **Players**: Roster players being exchanged
 *       - **Picks**: Draft picks being traded
 *       - **Releases**: Players to be released for roster space
 *       - **Status**: Current state of each trade proposal
 *     tags:
 *       - Fantasy Leagues
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *       - name: teamId
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *         description: |
 *           Team ID to filter trades for. If not provided, returns all league trades.
 *           Shows trades where this team is either proposing or accepting.
 *         example: 13
 *     responses:
 *       200:
 *         description: Trade proposals retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TradesListResponse'
 *             examples:
 *               team_trades:
 *                 summary: Trades involving specific team
 *                 value:
 *                   - uid: 1234
 *                     lid: 2
 *                     propose_tid: 13
 *                     accept_tid: 14
 *                     userid: 5
 *                     proposed: 1698765432
 *                     accepted: null
 *                     rejected: null
 *                     cancelled: null
 *                     vetoed: null
 *                     proposingTeamPlayers: ["4017", "3892"]
 *                     acceptingTeamPlayers: ["2041"]
 *                     proposingTeamPicks: []
 *                     acceptingTeamPicks:
 *                       - uid: 1542
 *                         tid: 14
 *                         lid: 2
 *                         year: 2025
 *                         round: 1
 *                         pick: 4
 *                         pick_str: "1.04"
 *                         otid: 13
 *                         pid: null
 *                     proposingTeamReleasePlayers: []
 *                     acceptingTeamReleasePlayers: []
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.query
    const trades = await db('trades')
      .where('year', constants.season.year)
      .where(function () {
        this.where('propose_tid', teamId).orWhere('accept_tid', teamId)
      })
    const tradeids = trades.map((t) => t.uid)

    const trade_releases_rows = await db('trade_releases').whereIn(
      'tradeid',
      tradeids
    )
    const trade_players_rows = await db('trades_players').whereIn(
      'tradeid',
      tradeids
    )
    const trade_picks_rows = await db('trades_picks')
      .select(
        'trades_picks.*',
        'draft.uid',
        'draft.pick',
        'draft.pick_str',
        'draft.round',
        'draft.year',
        'draft.lid',
        'draft.otid'
      )
      .whereIn('tradeid', tradeids)
      .join('draft', 'trades_picks.pickid', 'draft.uid')

    for (const trade of trades) {
      trade.proposingTeamReleasePlayers = []
      trade.acceptingTeamReleasePlayers = []
      trade.proposingTeamPlayers = []
      trade.acceptingTeamPlayers = []
      trade.proposingTeamPicks = []
      trade.acceptingTeamPicks = []

      for (const row of trade_releases_rows) {
        if (row.tradeid !== trade.uid) continue
        if (row.tid === trade.propose_tid) {
          trade.proposingTeamReleasePlayers.push(row.pid)
        } else {
          trade.acceptingTeamReleasePlayers.push(row.pid)
        }
      }

      for (const row of trade_picks_rows) {
        if (row.tradeid !== trade.uid) continue
        if (row.tid === trade.propose_tid) {
          trade.proposingTeamPicks.push(row)
        } else {
          trade.acceptingTeamPicks.push(row)
        }
      }

      for (const row of trade_players_rows) {
        if (row.tradeid !== trade.uid) continue
        if (row.tid === trade.propose_tid) {
          trade.proposingTeamPlayers.push(row.pid)
        } else {
          trade.acceptingTeamPlayers.push(row.pid)
        }
      }
    }
    res.send(trades)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/trades:
 *   post:
 *     summary: Create a trade proposal
 *     description: |
 *       Creates a new trade proposal between two teams. This endpoint handles complex
 *       validation of players, picks, roster space, and league rules before creating
 *       the trade proposal for the accepting team to review.
 *
 *       **Key Features:**
 *       - Validates all trade components (players, picks, releases)
 *       - Checks roster space and trade deadline
 *       - Prevents trading locked or claimed players
 *       - Ensures proposing team owns all traded assets
 *       - Creates structured trade proposal for acceptance
 *
 *       **Fantasy Football Context:**
 *       - Only team owners can propose trades
 *       - Must occur before league trade deadline
 *       - Cannot trade players with active poaching claims
 *       - Validates roster space after hypothetical trade
 *       - Creates formal proposal requiring acceptance
 *
 *       **Validation Rules:**
 *       - **Trade Deadline**: Must be before league trade deadline
 *       - **Asset Ownership**: Proposing team must own all traded players/picks
 *       - **Roster Space**: Must have space for incoming players after releases
 *       - **Poaching Claims**: Cannot trade players with active claims
 *       - **RFA Restrictions**: Cannot trade restricted free agents
 *       - **Team Ownership**: User must own the proposing team
 *
 *       **Trade Components:**
 *       - **Players**: Active roster players being exchanged
 *       - **Picks**: Future draft picks being traded
 *       - **Releases**: Players to be released by proposing team for space
 *
 *       **Automatic Validation:**
 *       - Verifies player ownership on both teams
 *       - Checks draft pick ownership and availability
 *       - Validates roster space with hypothetical roster changes
 *       - Ensures no conflicting player statuses
 *       - Confirms trade deadline compliance
 *
 *       **Trade Proposal Creation:**
 *       - Creates pending trade in database
 *       - Links all players, picks, and releases to trade
 *       - Sets proposal timestamp and proposing user
 *       - Returns complete trade details for review
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
 *             $ref: '#/components/schemas/CreateTradeRequest'
 *           examples:
 *             player_trade:
 *               summary: Trade players between teams
 *               value:
 *                 propose_tid: 13
 *                 accept_tid: 14
 *                 proposingTeamPlayers: ["4017", "3892"]
 *                 acceptingTeamPlayers: ["2041"]
 *             pick_trade:
 *               summary: Trade draft picks
 *               value:
 *                 propose_tid: 13
 *                 accept_tid: 14
 *                 proposingTeamPicks: [1542]
 *                 acceptingTeamPicks: [1543]
 *             complex_trade:
 *               summary: Trade with players, picks, and releases
 *               value:
 *                 propose_tid: 13
 *                 accept_tid: 14
 *                 proposingTeamPlayers: ["4017"]
 *                 acceptingTeamPlayers: ["2041", "3156"]
 *                 proposingTeamPicks: []
 *                 acceptingTeamPicks: [1542]
 *                 releasePlayers: ["1889"]
 *     responses:
 *       200:
 *         description: Trade proposal created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Trade'
 *             examples:
 *               created_trade:
 *                 summary: Successfully created trade proposal
 *                 value:
 *                   uid: 1234
 *                   lid: 2
 *                   propose_tid: 13
 *                   accept_tid: 14
 *                   userid: 5
 *                   proposed: 1698765432
 *                   accepted: null
 *                   rejected: null
 *                   cancelled: null
 *                   vetoed: null
 *                   proposingTeamPlayers: ["4017", "3892"]
 *                   acceptingTeamPlayers: ["2041"]
 *                   proposingTeamPicks: []
 *                   acceptingTeamPicks: []
 *                   proposingTeamReleasePlayers: ["1889"]
 *                   acceptingTeamReleasePlayers: []
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missing_propose_tid:
 *                 summary: Missing proposing team ID
 *                 value:
 *                   error: missing param propose_tid
 *               missing_accept_tid:
 *                 summary: Missing accepting team ID
 *                 value:
 *                   error: missing param accept_tid
 *               deadline_passed:
 *                 summary: Trade deadline has passed
 *                 value:
 *                   error: deadline has passed
 *               player_not_on_team:
 *                 summary: Player not on proposing team
 *                 value:
 *                   error: proposing team player is not on proposing team
 *               invalid_pick:
 *                 summary: Invalid or unavailable draft pick
 *                 value:
 *                   error: pick is not valid
 *               pick_not_owned:
 *                 summary: Pick not owned by team
 *                 value:
 *                   error: pick is not owned by proposing team
 *               no_roster_space:
 *                 summary: Insufficient roster space
 *                 value:
 *                   error: no slots available
 *               poaching_claim:
 *                 summary: Player has active poaching claim
 *                 value:
 *                   error: player has poaching claim
 *               release_player_error:
 *                 summary: Release player not on team
 *                 value:
 *                   error: release player not on team
 *               rfa_violation:
 *                 summary: Restricted free agency violation
 *                 value:
 *                   error: RFA restriction details
 *               team_verification_failed:
 *                 summary: User doesn't own proposing team
 *                 value:
 *                   error: Team verification failed
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  '/?',
  async (req, res, next) => {
    const { db, logger } = req.app.locals
    try {
      const proposingTeamPlayers = req.body.proposingTeamPlayers
        ? Array.isArray(req.body.proposingTeamPlayers)
          ? req.body.proposingTeamPlayers
          : [req.body.proposingTeamPlayers]
        : []
      const acceptingTeamPlayers = req.body.acceptingTeamPlayers
        ? Array.isArray(req.body.acceptingTeamPlayers)
          ? req.body.acceptingTeamPlayers
          : [req.body.acceptingTeamPlayers]
        : []
      const proposingTeamPicks = req.body.proposingTeamPicks
        ? Array.isArray(req.body.proposingTeamPicks)
          ? req.body.proposingTeamPicks
          : [req.body.proposingTeamPicks]
        : []
      const acceptingTeamPicks = req.body.acceptingTeamPicks
        ? Array.isArray(req.body.acceptingTeamPicks)
          ? req.body.acceptingTeamPicks
          : [req.body.acceptingTeamPicks]
        : []
      const releasePlayers = req.body.releasePlayers
        ? Array.isArray(req.body.releasePlayers)
          ? req.body.releasePlayers
          : [req.body.releasePlayers]
        : []

      // Parse slot assignments (objects mapping pid to slot)
      const proposing_team_slots_input = req.body.proposing_team_slots || {}
      const accepting_team_slots_input = req.body.accepting_team_slots || {}

      // Validate slot assignment inputs
      const valid_slots = [
        constants.slots.BENCH,
        constants.slots.PS,
        constants.slots.PSP,
        constants.slots.PSD,
        constants.slots.PSDP,
        constants.slots.RESERVE_SHORT_TERM,
        constants.slots.RESERVE_LONG_TERM,
        constants.slots.COV
      ]

      for (const [pid, slot] of Object.entries(proposing_team_slots_input)) {
        if (typeof pid !== 'string' || pid.length === 0) {
          return res.status(400).send({
            error: 'Invalid player ID in proposing team slot assignments'
          })
        }
        if (!Number.isInteger(slot)) {
          return res.status(400).send({
            error: `Invalid slot value for player ${pid} in proposing team`
          })
        }
        if (!valid_slots.includes(slot)) {
          return res.status(400).send({
            error: `Invalid slot ${slot} for player ${pid} in proposing team. Only BENCH, PS, PSD, and RESERVE slots are allowed for trades.`
          })
        }
      }

      for (const [pid, slot] of Object.entries(accepting_team_slots_input)) {
        if (typeof pid !== 'string' || pid.length === 0) {
          return res.status(400).send({
            error: 'Invalid player ID in accepting team slot assignments'
          })
        }
        if (!Number.isInteger(slot)) {
          return res.status(400).send({
            error: `Invalid slot value for player ${pid} in accepting team`
          })
        }
        if (!valid_slots.includes(slot)) {
          return res.status(400).send({
            error: `Invalid slot ${slot} for player ${pid} in accepting team. Only BENCH, PS, PSD, and RESERVE slots are allowed for trades.`
          })
        }
      }

      const { leagueId } = req.params
      const { propose_tid, accept_tid } = req.body

      if (!propose_tid) {
        return res.status(400).send({ error: 'missing param propose_tid' })
      }

      if (!accept_tid) {
        return res.status(400).send({ error: 'missing param accept_tid' })
      }

      try {
        await verifyUserTeam({
          userId: req.auth.userId,
          leagueId,
          teamId: propose_tid,
          requireLeague: true
        })
      } catch (error) {
        return res.status(400).send({ error: error.message })
      }

      // make sure no player is on the practice squad with an existing poaching claim
      const trade_pids = proposingTeamPlayers.concat(
        acceptingTeamPlayers,
        releasePlayers
      )
      const psPlayers = await db('rosters_players')
        .join('poaches', 'rosters_players.pid', 'poaches.pid')
        .where({
          year: constants.season.year,
          week: constants.season.week
        })
        .where(function () {
          this.where({
            slot: constants.slots.PS
          }).orWhere({
            slot: constants.slots.PSD
          })
        })
        .whereNull('poaches.processed')
        .where('poaches.lid', leagueId)
        .whereIn('rosters_players.pid', trade_pids)

      if (psPlayers.length) {
        return res.status(400).send({ error: 'player has poaching claim' })
      }

      const league = await getLeague({ lid: leagueId })
      const now = dayjs()

      // check for restricted free agency players during RFA
      try {
        await verifyRestrictedFreeAgency({ league, pids: trade_pids })
      } catch (error) {
        return res.status(400).send({ error: error.message })
      }

      // make sure trade deadline has not passed
      const deadline = dayjs.unix(league.tddate)
      if (now.isAfter(deadline)) {
        return res.status(400).send({ error: 'deadline has passed' })
      }

      const proposingTeamRosterRow = await getRoster({ tid: propose_tid })
      const proposingTeamRoster = new Roster({
        roster: proposingTeamRosterRow,
        league
      })

      // valdiate release players
      for (const player of releasePlayers) {
        if (!proposingTeamRoster.has(player)) {
          return res.status(400).send({ error: 'release player not on team' })
        }
      }

      // validate sending players
      for (const player of proposingTeamPlayers) {
        if (!proposingTeamRoster.has(player)) {
          return res
            .status(400)
            .send({ error: 'proposing team player is not on proposing team' })
        }
      }

      const pickids = proposingTeamPicks.concat(acceptingTeamPicks)
      const draft_pick_rows = await db('draft')
        .whereIn('uid', pickids)
        .whereNull('pid')

      // validate sending picks
      for (const pick of proposingTeamPicks) {
        const p = draft_pick_rows.find((p) => p.uid === pick)
        if (!p) {
          return res.status(400).send({ error: 'pick is not valid' })
        }

        if (p.tid !== propose_tid) {
          return res
            .status(400)
            .send({ error: 'pick is not owned by proposing team' })
        }
      }

      // validate receiving players
      const acceptingTeamRosterRow = await getRoster({ tid: accept_tid })
      const acceptingTeamRoster = new Roster({
        roster: acceptingTeamRosterRow,
        league
      })
      for (const player of acceptingTeamPlayers) {
        if (!acceptingTeamRoster.has(player)) {
          return res
            .status(400)
            .send({ error: 'accepting team player not on accepting team' })
        }
      }

      // validate receiving picks
      for (const pick of acceptingTeamPicks) {
        const p = draft_pick_rows.find((p) => p.uid === pick)
        if (!p) {
          return res.status(400).send({ error: 'pick is not valid' })
        }

        if (p.tid !== accept_tid) {
          return res
            .status(400)
            .send({ error: 'pick is not owned by accepting team' })
        }
      }

      // Fetch player data for both teams' incoming players
      const all_incoming_pids =
        acceptingTeamPlayers.concat(proposingTeamPlayers)
      const sub = db('transactions')
        .select(db.raw('max(uid) as uid'))
        .whereIn('pid', all_incoming_pids)
        .where('lid', leagueId)
        .groupBy('pid')
        .as('sub_query')

      const players = await db
        .select('player.*', 'transactions.value', 'rosters_players.slot')
        .from(sub)
        .join('transactions', 'sub_query.uid', 'transactions.uid')
        .join('player', 'transactions.pid', 'player.pid')
        .leftJoin('rosters_players', function () {
          this.on('player.pid', '=', 'rosters_players.pid')
            .andOn(
              'rosters_players.year',
              '=',
              db.raw('?', [constants.season.year])
            )
            .andOn(
              'rosters_players.week',
              '=',
              db.raw('?', [constants.season.week])
            )
        })
        .whereIn('player.pid', all_incoming_pids)

      // Calculate slot assignments for proposing team (receiving accepting team players)
      const proposing_team_slots = {}
      for (const pid of acceptingTeamPlayers) {
        const player = players.find((p) => p.pid === pid)
        if (!player) {
          return res.status(400).send({ error: `player ${pid} not found` })
        }

        // Use provided slot or calculate default
        const assigned_slot =
          proposing_team_slots_input[pid] ||
          get_default_trade_slot({
            player,
            current_slot: player.slot,
            roster: proposingTeamRoster,
            week: constants.season.week,
            is_regular_season: constants.season.isRegularSeason
          })

        proposing_team_slots[pid] = assigned_slot
      }

      // Calculate slot assignments for accepting team (receiving proposing team players)
      const accepting_team_slots = {}
      for (const pid of proposingTeamPlayers) {
        const player = players.find((p) => p.pid === pid)
        if (!player) {
          return res.status(400).send({ error: `player ${pid} not found` })
        }

        // Use provided slot or calculate default
        const assigned_slot =
          accepting_team_slots_input[pid] ||
          get_default_trade_slot({
            player,
            current_slot: player.slot,
            roster: acceptingTeamRoster,
            week: constants.season.week,
            is_regular_season: constants.season.isRegularSeason
          })

        accepting_team_slots[pid] = assigned_slot
      }

      // Validate proposing team roster with slot-aware validation
      releasePlayers.forEach((p) => proposingTeamRoster.removePlayer(p))
      proposingTeamPlayers.forEach((p) => proposingTeamRoster.removePlayer(p))

      const proposing_team_validation_errors = validate_trade_roster_slots({
        incoming_player_ids: acceptingTeamPlayers,
        player_rows: players,
        slot_assignments: proposing_team_slots,
        roster: proposingTeamRoster,
        week: constants.season.week,
        is_regular_season: constants.season.isRegularSeason
      })

      console.log(
        'proposing_team_validation_errors',
        proposing_team_validation_errors
      )

      // if (proposing_team_validation_errors.length > 0) {
      //   return res.status(400).send({
      //     error: 'proposing team: slot validation failed',
      //     details: proposing_team_validation_errors
      //   })
      // }

      // Validate accepting team roster with slot-aware validation
      acceptingTeamPlayers.forEach((p) => acceptingTeamRoster.removePlayer(p))

      const accepting_team_validation_errors = validate_trade_roster_slots({
        incoming_player_ids: proposingTeamPlayers,
        player_rows: players,
        slot_assignments: accepting_team_slots,
        roster: acceptingTeamRoster,
        week: constants.season.week,
        is_regular_season: constants.season.isRegularSeason
      })

      console.log(
        'accepting_team_validation_errors',
        accepting_team_validation_errors
      )

      // if (accepting_team_validation_errors.length > 0) {
      //   return res.status(400).send({
      //     error: 'accepting team: slot validation failed',
      //     details: accepting_team_validation_errors
      //   })
      // }

      // Use transaction to ensure all trade data is inserted atomically
      const tradeid = await db.transaction(async (trx) => {
        // insert trade
        const result = await trx('trades')
          .insert({
            propose_tid,
            accept_tid,
            userid: req.auth.userId,
            year: constants.season.year,
            lid: leagueId,
            offered: Math.round(Date.now() / 1000)
          })
          .returning('uid')
        const trade_uid = result[0].uid

        // insert join entries
        const insertPlayers = []
        const insertPicks = []
        for (const pid of proposingTeamPlayers) {
          insertPlayers.push({
            tradeid: trade_uid,
            tid: propose_tid,
            pid
          })
        }
        for (const pid of acceptingTeamPlayers) {
          insertPlayers.push({
            tradeid: trade_uid,
            tid: accept_tid,
            pid
          })
        }
        for (const pickid of proposingTeamPicks) {
          insertPicks.push({
            tradeid: trade_uid,
            pickid,
            tid: propose_tid
          })
        }
        for (const pickid of acceptingTeamPicks) {
          insertPicks.push({
            tradeid: trade_uid,
            pickid,
            tid: accept_tid
          })
        }

        const insertReleases = []
        for (const pid of releasePlayers) {
          insertReleases.push({
            tradeid: trade_uid,
            pid,
            tid: propose_tid
          })
        }

        if (insertPicks.length) {
          await trx('trades_picks').insert(insertPicks)
        }

        if (insertPlayers.length) {
          await trx('trades_players').insert(insertPlayers)
        }

        if (insertReleases.length) {
          await trx('trade_releases').insert(insertReleases)
        }

        // Insert slot assignments for both teams
        const insert_slot_assignments = []
        for (const pid of acceptingTeamPlayers) {
          insert_slot_assignments.push({
            trade_uid,
            pid,
            tid: propose_tid, // proposing team receives these players
            slot: proposing_team_slots[pid]
          })
        }
        for (const pid of proposingTeamPlayers) {
          insert_slot_assignments.push({
            trade_uid,
            pid,
            tid: accept_tid, // accepting team receives these players
            slot: accepting_team_slots[pid]
          })
        }

        if (insert_slot_assignments.length) {
          await trx('trades_slots').insert(insert_slot_assignments)
        }

        return trade_uid
      })

      req.params.tradeId = tradeid
      next()
    } catch (error) {
      logger(error)
      res.status(500).send({ error: error.toString() })
    }
  },
  get_trade
)

router.use('/:tradeId([0-9]+)', trade)

export default router
