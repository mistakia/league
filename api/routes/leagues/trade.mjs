import dayjs from 'dayjs'
import express from 'express'

import { Roster, toStringArray, nth } from '#libs-shared'
import {
  current_season,
  roster_slot_types,
  transaction_types
} from '#constants'
import validate_trade_roster_slots from '#libs-server/validate-trade-roster-slots.mjs'
import {
  getRoster,
  getLeague,
  sendNotifications,
  verifyRestrictedFreeAgency,
  isPlayerLocked,
  verifyUserTeam,
  is_trade_within_veto_window,
  get_trade_veto_deadline,
  verify_assets_not_trade_protected
} from '#libs-server'

const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * components:
 *   schemas:
 *     TradePlayer:
 *       type: object
 *       description: Player included in a trade
 *       properties:
 *         pid:
 *           type: string
 *           description: Player ID
 *           example: "4017"
 *         tid:
 *           type: integer
 *           description: Team ID
 *           example: 13
 *
 *     TradePick:
 *       type: object
 *       description: Draft pick included in a trade
 *       allOf:
 *         - $ref: '#/components/schemas/DraftPick'
 *         - type: object
 *           properties:
 *             tid:
 *               type: integer
 *               description: Team ID that owns the pick in the trade
 *               example: 13
 *
 *     TradeRelease:
 *       type: object
 *       description: Player to be released as part of a trade
 *       properties:
 *         pid:
 *           type: string
 *           description: Player ID to release
 *           example: "2041"
 *         tid:
 *           type: integer
 *           description: Team ID releasing the player
 *           example: 13
 *
 *     Trade:
 *       type: object
 *       description: Trade proposal between two teams
 *       properties:
 *         uid:
 *           type: integer
 *           description: Trade ID
 *           example: 1234
 *         lid:
 *           type: integer
 *           description: League ID
 *           example: 2
 *         propose_tid:
 *           type: integer
 *           description: Proposing team ID
 *           example: 13
 *         accept_tid:
 *           type: integer
 *           description: Accepting team ID
 *           example: 14
 *         user_id:
 *           type: integer
 *           description: User ID who proposed the trade
 *           example: 5
 *         offered:
 *           type: string
 *           format: date-time
 *           description: ISO-8601 timestamp when trade was offered
 *           example: '2026-08-08T12:30:32.000Z'
 *         accepted:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: ISO-8601 timestamp when trade was accepted
 *           example: null
 *         rejected:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: ISO-8601 timestamp when trade was rejected
 *           example: null
 *         cancelled:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: ISO-8601 timestamp when trade was cancelled
 *           example: null
 *         vetoed:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: ISO-8601 timestamp when trade was vetoed
 *           example: null
 *         approved:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: >-
 *             ISO-8601 timestamp when the commissioner approved the trade,
 *             closing the veto window early
 *           example: null
 *         proposingTeamPlayers:
 *           type: array
 *           items:
 *             type: string
 *           description: Player IDs from proposing team
 *           example: ["4017", "3892"]
 *         acceptingTeamPlayers:
 *           type: array
 *           items:
 *             type: string
 *           description: Player IDs from accepting team
 *           example: ["2041"]
 *         proposingTeamPicks:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TradePick'
 *           description: Draft picks from proposing team
 *         acceptingTeamPicks:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TradePick'
 *           description: Draft picks from accepting team
 *         proposingTeamReleasePlayers:
 *           type: array
 *           items:
 *             type: string
 *           description: Players proposing team will release
 *           example: []
 *         acceptingTeamReleasePlayers:
 *           type: array
 *           items:
 *             type: string
 *           description: Players accepting team will release
 *           example: []
 *
 *     AcceptTradeRequest:
 *       type: object
 *       properties:
 *         releasePlayers:
 *           oneOf:
 *             - type: string
 *             - type: array
 *               items:
 *                 type: string
 *           description: Player ID(s) to release (if roster space needed)
 *           example: ["2041", "1889"]
 */

export const get_trade = async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { tradeId } = req.params

    // validate trade exists
    const trades = await db('trades').where({ uid: tradeId })
    const trade = trades[0]
    if (!trade) {
      return res
        .status(400)
        .send({ error: `could not find trade_id: ${tradeId}` })
    }

    const release_rows = await db('trade_releases').where({ trade_id: tradeId })
    const trades_players_rows = await db('trades_players').where({
      trade_id: tradeId
    })
    const picks = await db('trades_picks')
      .select(
        'trades_picks.*',
        'draft.draft_pick_id',
        'draft.pick',
        'draft.pick_string',
        'draft.round',
        'draft.season_year',
        'draft.lid',
        'draft.original_team_id'
      )
      .where({ trade_id: tradeId })
      .join('draft', 'trades_picks.draft_pick_id', 'draft.draft_pick_id')

    trade.proposingTeamReleasePlayers = []
    trade.acceptingTeamReleasePlayers = []
    trade.proposingTeamPlayers = []
    trade.acceptingTeamPlayers = []
    trade.proposingTeamPicks = []
    trade.acceptingTeamPicks = []

    for (const release_row of release_rows) {
      if (release_row.tid === trade.propose_tid) {
        trade.proposingTeamReleasePlayers.push(release_row.pid)
      } else {
        trade.acceptingTeamReleasePlayers.push(release_row.pid)
      }
    }

    for (const pick of picks) {
      if (pick.tid === trade.propose_tid) {
        trade.proposingTeamPicks.push(pick)
      } else {
        trade.acceptingTeamPicks.push(pick)
      }
    }

    for (const trades_players_row of trades_players_rows) {
      if (trades_players_row.tid === trade.propose_tid) {
        trade.proposingTeamPlayers.push(trades_players_row.pid)
      } else {
        trade.acceptingTeamPlayers.push(trades_players_row.pid)
      }
    }

    // Load slot assignments for both teams
    const trades_slots_rows = await db('trades_slots').where({
      trade_uid: tradeId
    })

    trade.proposingTeamSlots = {}
    trade.acceptingTeamSlots = {}

    for (const row of trades_slots_rows) {
      if (row.tid === trade.propose_tid) {
        trade.proposingTeamSlots[row.pid] = row.slot
      } else {
        trade.acceptingTeamSlots[row.pid] = row.slot
      }
    }

    res.send(trade)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
}

/**
 * @swagger
 * /leagues/{leagueId}/trade/{tradeId}:
 *   get:
 *     summary: Get trade details
 *     description: |
 *       Retrieves detailed information about a specific trade proposal including
 *       all players, draft picks, and release requirements for both teams.
 *
 *       **Key Features:**
 *       - Returns complete trade details with players and picks organized by team
 *       - Shows all release requirements for both teams
 *       - Includes draft pick details with full context
 *       - Displays trade status and timestamps
 *
 *       **Fantasy Football Context:**
 *       - Trades allow teams to exchange players and draft picks
 *       - Teams may need to release players to make roster space
 *       - Draft picks include original team information if traded
 *       - Trade status indicates proposal, acceptance, rejection, or veto
 *
 *       **Trade Components:**
 *       - **Players**: Active roster players being exchanged
 *       - **Picks**: Future draft picks being traded
 *       - **Releases**: Players that must be released for roster space
 *       - **Status**: Current state of the trade proposal
 *     tags:
 *       - Fantasy Leagues
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *       - name: tradeId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: Trade ID
 *         example: 1234
 *     responses:
 *       200:
 *         description: Trade details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Trade'
 *             examples:
 *               trade_proposal:
 *                 summary: Active trade proposal
 *                 value:
 *                   uid: 1234
 *                   lid: 2
 *                   propose_tid: 13
 *                   accept_tid: 14
 *                   user_id: 5
 *                   offered: '2026-08-08T12:30:32.000Z'
 *                   accepted: null
 *                   rejected: null
 *                   cancelled: null
 *                   vetoed: null
 *                   proposingTeamPlayers: ["4017", "3892"]
 *                   acceptingTeamPlayers: ["2041"]
 *                   proposingTeamPicks: []
 *                   acceptingTeamPicks:
 *                     - uid: 1542
 *                       tid: 14
 *                       lid: 2
 *                       season_year: 2025
 *                       round: 1
 *                       pick: 4
 *                       pick_string: "1.04"
 *                       original_team_id: 13
 *                       pid: null
 *                   proposingTeamReleasePlayers: []
 *                   acceptingTeamReleasePlayers: []
 *       400:
 *         description: Trade not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               trade_not_found:
 *                 summary: Trade not found
 *                 value:
 *                   error: "could not find trade_id: 1234"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/?', get_trade)

/**
 * @swagger
 * /leagues/{leagueId}/trade/{tradeId}/accept:
 *   post:
 *     summary: Accept a trade proposal
 *     description: |
 *       Accepts a trade proposal and executes the trade, transferring players and picks
 *       between teams. This endpoint handles complex validation and roster management.
 *
 *       **Key Features:**
 *       - Validates trade deadline and player availability
 *       - Checks roster space and locked player restrictions
 *       - Transfers players and draft picks between teams
 *       - Creates transaction records and notifications
 *       - Cancels conflicting trade proposals and poaching claims
 *       - Handles optional player releases for roster space
 *
 *       **Fantasy Football Context:**
 *       - Only the accepting team owner can accept a trade
 *       - Must occur before league trade deadline
 *       - Cannot trade locked starters (players in active lineups)
 *       - Automatic roster management ensures league rules compliance
 *       - Creates permanent transaction history
 *
 *       **Validation Rules:**
 *       - **Trade Deadline**: Must be before league trade deadline
 *       - **Player Locks**: Cannot trade locked starters
 *       - **Roster Space**: Both teams must have adequate space
 *       - **RFA Restrictions**: Cannot trade restricted free agents
 *       - **Team Ownership**: User must own the accepting team
 *
 *       **Automatic Actions:**
 *       - **Player Transfers**: Moves players between team rosters
 *       - **Pick Transfers**: Updates draft pick ownership
 *       - **Releases**: Processes any required player releases
 *       - **Transactions**: Creates trade and release transaction records
 *       - **Cancellations**: Cancels conflicting trades and poaching claims
 *       - **Notifications**: Sends league-wide trade notification
 *
 *       **Roster Management:**
 *       - Players moved to bench slots on receiving teams
 *       - Roster space validated before trade execution
 *       - Release players removed from rosters
 *       - Salary cap and roster constraints enforced
 *
 *       **Conflict Resolution:**
 *       - Cancels other pending trades involving same players/picks
 *       - Removes players from cutlists
 *       - Cancels RFA bids for traded players
 *       - Processes active poaching claims
 *     tags:
 *       - Fantasy Leagues
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *       - name: tradeId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: Trade ID to accept
 *         example: 1234
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AcceptTradeRequest'
 *           examples:
 *             with_releases:
 *               summary: Accept trade with player releases
 *               value:
 *                 releasePlayers: ["2041", "1889"]
 *             without_releases:
 *               summary: Accept trade without releases
 *               value: {}
 *     responses:
 *       200:
 *         description: Trade accepted and executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Trade'
 *             examples:
 *               accepted_trade:
 *                 summary: Successfully accepted trade
 *                 value:
 *                   uid: 1234
 *                   lid: 2
 *                   propose_tid: 13
 *                   accept_tid: 14
 *                   user_id: 5
 *                   offered: '2026-08-08T12:30:32.000Z'
 *                   accepted: 1698765500
 *                   rejected: null
 *                   cancelled: null
 *                   vetoed: null
 *                   proposingTeamPlayers: ["4017", "3892"]
 *                   acceptingTeamPlayers: ["2041"]
 *                   proposingTeamPicks: []
 *                   acceptingTeamPicks: []
 *                   proposingTeamReleasePlayers: []
 *                   acceptingTeamReleasePlayers: ["1889"]
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalid_trade:
 *                 summary: Invalid trade ID
 *                 value:
 *                   error: "no valid trade with trade_id: 1234"
 *               deadline_passed:
 *                 summary: Trade deadline has passed
 *                 value:
 *                   error: deadline has passed
 *               locked_starter:
 *                 summary: Player is a locked starter
 *                 value:
 *                   error: player in trade is a locked starter
 *               no_roster_space:
 *                 summary: Insufficient roster space
 *                 value:
 *                   error: no slots available on accepting team roster
 *               release_player_error:
 *                 summary: Invalid release player
 *                 value:
 *                   error: release player not on accepting team
 *               rfa_violation:
 *                 summary: Restricted free agency violation
 *                 value:
 *                   error: RFA restriction details
 *               team_verification_failed:
 *                 summary: User doesn't own accepting team
 *                 value:
 *                   error: Team verification failed
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  '/accept',
  async (req, res, next) => {
    const { db, logger } = req.app.locals
    try {
      const { tradeId, leagueId } = req.params

      const trades = await db('trades')
        .join('users_teams', function () {
          this.on('trades.accept_tid', '=', 'users_teams.tid')
          this.andOn(
            db.raw('users_teams.season_year = ?', [current_season.year])
          )
        })
        .where('trades.uid', tradeId)
        .where('users_teams.user_id', req.auth.userId)
        .whereNull('accepted')
        .whereNull('rejected')
        .whereNull('cancelled')
        .whereNull('vetoed')

      // verify trade exists
      const trade = trades[0]
      if (!trade) {
        return res
          .status(400)
          .send({ error: `no valid trade with trade_id: ${tradeId}` })
      }

      try {
        await verifyUserTeam({
          userId: req.auth.userId,
          leagueId,
          teamId: trade.accept_tid,
          requireLeague: true
        })
      } catch (error) {
        return res.status(400).send({ error: error.message })
      }

      const acceptingTeamReleasePlayers = req.body.releasePlayers
        ? Array.isArray(req.body.releasePlayers)
          ? req.body.releasePlayers
          : [req.body.releasePlayers]
        : []

      // Parse accepting team slot overrides (if provided)
      const accepting_team_slot_overrides = req.body.accepting_team_slots || {}

      // Validate slot assignment inputs
      const valid_slots = [
        roster_slot_types.BENCH,
        roster_slot_types.PS,
        roster_slot_types.PSP,
        roster_slot_types.PSD,
        roster_slot_types.PSDP,
        roster_slot_types.RESERVE_SHORT_TERM,
        roster_slot_types.RESERVE_LONG_TERM,
        roster_slot_types.COV
      ]

      for (const [pid, slot] of Object.entries(accepting_team_slot_overrides)) {
        if (typeof pid !== 'string' || pid.length === 0) {
          return res.status(400).send({
            error: 'Invalid player ID in slot assignments'
          })
        }
        if (!Number.isInteger(slot)) {
          return res.status(400).send({
            error: `Invalid slot value for player ${pid}`
          })
        }
        if (!valid_slots.includes(slot)) {
          return res.status(400).send({
            error: `Invalid slot ${slot} for player ${pid}. Only BENCH, PS, PSD, and RESERVE slots are allowed for trades.`
          })
        }
      }

      const proposing_release_rows = await db('trade_releases').where({
        trade_id: tradeId
      })
      const proposingTeamReleasePlayerIds = proposing_release_rows.map(
        ({ pid }) => pid
      )

      // gather traded players
      const trades_players_rows = await db('trades_players').where({
        trade_id: tradeId
      })
      const proposingTeamPlayers = [] // players on proposing team
      const acceptingTeamPlayers = [] // players on accepting team
      for (const row of trades_players_rows) {
        if (row.tid === trade.propose_tid) {
          proposingTeamPlayers.push(row.pid)
        } else {
          acceptingTeamPlayers.push(row.pid)
        }
      }

      // Load stored slot assignments from trades_slots table
      const trades_slots_rows = await db('trades_slots').where({
        trade_uid: tradeId
      })

      // Build slot assignment maps for each team
      const stored_proposing_team_slots = {}
      const stored_accepting_team_slots = {}
      for (const row of trades_slots_rows) {
        if (row.tid === trade.propose_tid) {
          // Proposing team receives these players
          stored_proposing_team_slots[row.pid] = row.slot
        } else {
          // Accepting team receives these players
          stored_accepting_team_slots[row.pid] = row.slot
        }
      }

      // Validate accepting team overrides only apply to players they're receiving
      for (const pid of Object.keys(accepting_team_slot_overrides)) {
        if (!proposingTeamPlayers.includes(pid)) {
          return res.status(400).send({
            error: `Cannot override slot for player ${pid} - not receiving this player`
          })
        }
      }

      // Merge accepting team overrides with stored assignments
      // Proposing team assignments are immutable (cannot be changed during acceptance)
      const proposing_team_slots = stored_proposing_team_slots
      const accepting_team_slots = {
        ...stored_accepting_team_slots,
        ...accepting_team_slot_overrides
      }

      const tradedPlayers = proposingTeamPlayers.concat(acceptingTeamPlayers)
      const releasePlayers = acceptingTeamReleasePlayers.concat(
        proposingTeamReleasePlayerIds
      )
      const all_pids = tradedPlayers.concat(releasePlayers)

      const league = await getLeague({ lid: leagueId })

      // make sure trade deadline has not passed
      const deadline = dayjs(league.trade_deadline_at)
      if (dayjs().isAfter(deadline)) {
        return res.status(400).send({ error: 'deadline has passed' })
      }

      // check for restricted free agency players during RFA
      try {
        await verifyRestrictedFreeAgency({ league, pids: all_pids })
      } catch (error) {
        return res.status(400).send({ error: error.message })
      }

      // assets moved by a recently accepted trade are frozen until that trade's
      // veto window closes and can not be traded again in the meantime
      try {
        await verify_assets_not_trade_protected({
          league,
          pids: all_pids,
          pickids: (await db('trades_picks').where({ trade_id: tradeId })).map(
            ({ draft_pick_id }) => draft_pick_id
          )
        })
      } catch (error) {
        return res.status(400).send({ error: error.message })
      }

      const sub = db('transactions')
        .select(db.raw('max(uid) as uid'))
        .whereIn('pid', all_pids)
        .where('lid', leagueId)
        .groupBy('pid')
        .as('sub_query')

      const player_rows = await db
        .select(
          'player.*',
          'transactions.player_salary',
          'rosters_players.slot'
        )
        .from(sub)
        .join('transactions', 'sub_query.uid', 'transactions.uid')
        .join('player', 'transactions.pid', 'player.pid')
        .leftJoin('rosters_players', function () {
          this.on('player.pid', '=', 'rosters_players.pid')
            .andOn(
              'rosters_players.season_year',
              '=',
              db.raw('?', [current_season.year])
            )
            .andOn(
              'rosters_players.week',
              '=',
              db.raw('?', [current_season.week])
            )
        })
        .whereIn('player.pid', all_pids)

      // Load both team rosters first
      const acceptingTeamRosterRow = await getRoster({ tid: trade.accept_tid })
      const acceptingTeamRoster = new Roster({
        roster: acceptingTeamRosterRow,
        league
      })

      const proposingTeamRosterRow = await getRoster({ tid: trade.propose_tid })
      const proposingTeamRoster = new Roster({
        roster: proposingTeamRosterRow,
        league
      })

      // validate accepting team roster
      for (const pid of acceptingTeamReleasePlayers) {
        if (!acceptingTeamRoster.has(pid)) {
          return res
            .status(400)
            .send({ error: 'release player not on accepting team' })
        }

        // check if accepting team release player is a locked starter
        if (acceptingTeamRoster.isStarter(pid)) {
          const isLocked = await isPlayerLocked(pid)
          if (isLocked) {
            return res
              .status(400)
              .send({ error: 'release player is a locked starter' })
          }
        }
      }

      // check if accepting team trade players are a locked starter
      for (const pid of acceptingTeamPlayers) {
        if (acceptingTeamRoster.isStarter(pid)) {
          const isLocked = await isPlayerLocked(pid)
          if (isLocked) {
            return res
              .status(400)
              .send({ error: 'player in trade is a locked starter' })
          }
        }
      }

      // Get extension counts before removing players. Capture the slot each
      // player currently occupies at the same time: once the trade is accepted
      // that information is gone from the roster, and a veto needs it to put
      // the player back where they were rather than on the bench.
      const origin_slots = {}
      const proposingPlayerExtensions = {}
      for (const pid of proposingTeamPlayers) {
        const player = proposingTeamRoster.get(pid)
        proposingPlayerExtensions[pid] = player?.extensions || 0
        if (player) origin_slots[pid] = player.slot
      }

      const acceptingPlayerExtensions = {}
      for (const pid of acceptingTeamPlayers) {
        const player = acceptingTeamRoster.get(pid)
        acceptingPlayerExtensions[pid] = player?.extensions || 0
        if (player) origin_slots[pid] = player.slot
      }

      const release_origin_slots = {}
      for (const pid of acceptingTeamReleasePlayers) {
        const player = acceptingTeamRoster.get(pid)
        if (player) release_origin_slots[pid] = player.slot
      }
      for (const pid of proposingTeamReleasePlayerIds) {
        const player = proposingTeamRoster.get(pid)
        if (player) release_origin_slots[pid] = player.slot
      }

      acceptingTeamReleasePlayers.forEach((p) =>
        acceptingTeamRoster.removePlayer(p)
      )
      acceptingTeamPlayers.forEach((p) => acceptingTeamRoster.removePlayer(p))

      // Validate accepting team roster with slot-aware validation
      const accepting_team_validation_errors = validate_trade_roster_slots({
        incoming_player_ids: proposingTeamPlayers,
        player_rows,
        slot_assignments: accepting_team_slots,
        roster: acceptingTeamRoster,
        week: current_season.week,
        is_regular_season: current_season.isRegularSeason,
        player_extensions: proposingPlayerExtensions
      })

      if (accepting_team_validation_errors.length > 0) {
        return res.status(400).send({
          error: 'accepting team: slot validation failed',
          details: accepting_team_validation_errors
        })
      }

      // check if proposing team trade players are a locked starter
      for (const pid of proposingTeamPlayers) {
        if (proposingTeamRoster.isStarter(pid)) {
          const isLocked = await isPlayerLocked(pid)
          if (isLocked) {
            return res
              .status(400)
              .send({ error: 'player in trade is a locked starter' })
          }
        }
      }

      // check if proposing team release players are a locked starter
      for (const pid of proposingTeamReleasePlayerIds) {
        if (proposingTeamRoster.isStarter(pid)) {
          const isLocked = await isPlayerLocked(pid)
          if (isLocked) {
            return res
              .status(400)
              .send({ error: 'player in trade is a locked starter' })
          }
        }
      }

      // validate proposing team roster
      proposingTeamReleasePlayerIds.forEach((p) =>
        proposingTeamRoster.removePlayer(p)
      )
      proposingTeamPlayers.forEach((p) => proposingTeamRoster.removePlayer(p))

      // Validate proposing team roster with slot-aware validation
      const proposing_team_validation_errors = validate_trade_roster_slots({
        incoming_player_ids: acceptingTeamPlayers,
        player_rows,
        slot_assignments: proposing_team_slots,
        roster: proposingTeamRoster,
        week: current_season.week,
        is_regular_season: current_season.isRegularSeason,
        player_extensions: acceptingPlayerExtensions
      })

      if (proposing_team_validation_errors.length > 0) {
        return res.status(400).send({
          error: 'proposing team: slot validation failed',
          details: proposing_team_validation_errors
        })
      }

      // Fetch data needed for notifications before transaction
      const activePoaches = await db('poaches')
        .where('lid', leagueId)
        .whereNull('processed')
        .whereIn('pid', all_pids)

      const pickRows = await db('trades_picks').where({ trade_id: tradeId })

      // Use transaction to ensure all trade acceptance operations are atomic
      await db.transaction(async (trx) => {
        // clear any existing poaching claims
        if (activePoaches.length) {
          await trx('poaches')
            .update('processed', new Date())
            .update('reason', 'Player traded')
            .update('is_successful', 0)
            .where('lid', leagueId)
            .whereIn(
              'pid',
              activePoaches.map((p) => p.pid)
            )
        }

        // insert receiving team releases
        const release_inserts = []
        for (const pid of acceptingTeamReleasePlayers) {
          release_inserts.push({
            trade_id: tradeId,
            pid,
            tid: trade.accept_tid,
            origin_slot: release_origin_slots[pid]
          })
        }
        if (release_inserts.length) {
          await trx('trade_releases').insert(release_inserts)
        }

        await trx('trades')
          .where({ uid: tradeId })
          .update({ accepted: new Date() })

        // Update slot assignments if accepting team made any overrides
        if (Object.keys(accepting_team_slot_overrides).length > 0) {
          for (const [pid, slot] of Object.entries(
            accepting_team_slot_overrides
          )) {
            await trx('trades_slots')
              .where({
                trade_uid: tradeId,
                pid,
                tid: trade.accept_tid
              })
              .update({ slot })
          }
        }

        // Record where each traded player came from so a veto can reverse the
        // move exactly. Written per pid across both sides of the trade.
        for (const [pid, origin_slot] of Object.entries(origin_slots)) {
          await trx('trades_slots')
            .where({ trade_uid: tradeId, pid })
            .update({ origin_slot })
        }

        // Proposing-team release rows were written at propose time, before the
        // roster was read, so their origin slot is only known now.
        for (const pid of proposingTeamReleasePlayerIds) {
          await trx('trade_releases')
            .where({ trade_id: tradeId, pid })
            .update({ origin_slot: release_origin_slots[pid] })
        }

        const sub_query = trx('transactions')
          .select(
            trx.raw('max(uid) AS maxuid'),
            trx.raw("pid || '_' || lid AS group1")
          )
          .groupBy('group1')
          .whereIn('pid', tradedPlayers)
          .where({ lid: leagueId })
          .as('sub_query')

        const transaction_history = await trx
          .select('transactions.*')
          .from('transactions')
          .join(sub_query, function () {
            this.on('transactions.uid', '=', 'sub_query.maxuid')
            this.andOn(
              trx.raw("transactions.pid || '_' || transactions.lid"),
              '=',
              'sub_query.group1'
            )
          })

        // ONE instant for every row this acceptance writes. These used to share
        // an epoch SECOND, so `uid` broke the tie and insertion order decided
        // which row read as latest. timestamptz has millisecond resolution, so
        // a per-row `new Date()` would order them by construction time instead
        // and silently change which transaction is "last" for a player.
        const accepted_at = new Date()

        // insert transactions
        const insertTransactions = []
        for (const pid of acceptingTeamPlayers) {
          insertTransactions.push({
            user_id: trade.user_id,
            tid: trade.propose_tid,
            lid: leagueId,
            pid,
            type: transaction_types.TRADE,
            player_salary: transaction_history.find((t) => t.pid === pid)
              .player_salary,
            week: current_season.week,
            season_year: current_season.year,
            occurred_at: accepted_at
          })
        }
        for (const pid of proposingTeamPlayers) {
          insertTransactions.push({
            user_id: req.auth.userId,
            tid: trade.accept_tid,
            lid: leagueId,
            pid,
            type: transaction_types.TRADE,
            player_salary: transaction_history.find((t) => t.pid === pid)
              .player_salary,
            week: current_season.week,
            season_year: current_season.year,
            occurred_at: accepted_at
          })
        }

        // insert trade transactions
        if (insertTransactions.length) {
          const tranIds = await trx('transactions')
            .insert(insertTransactions)
            .returning('uid')
          await trx('trades_transactions').insert(
            tranIds.map((t) => ({ transaction_id: t.uid, trade_id: trade.uid }))
          )
        }

        if (releasePlayers.length) {
          const releaseTransactions = []
          for (const pid of proposingTeamReleasePlayerIds) {
            releaseTransactions.push({
              user_id: trade.user_id,
              tid: trade.propose_tid,
              lid: leagueId,
              pid,
              type: transaction_types.ROSTER_RELEASE,
              player_salary: 0,
              week: current_season.week,
              season_year: current_season.year,
              occurred_at: accepted_at
            })
          }

          for (const pid of acceptingTeamReleasePlayers) {
            releaseTransactions.push({
              user_id: req.auth.userId,
              tid: trade.accept_tid,
              lid: leagueId,
              pid,
              type: transaction_types.ROSTER_RELEASE,
              player_salary: 0,
              week: current_season.week,
              season_year: current_season.year,
              occurred_at: accepted_at
            })
          }

          await trx('transactions').insert(releaseTransactions)
        }

        // update receiving roster
        if (acceptingTeamPlayers.length || proposingTeamPlayers.length) {
          await trx('rosters_players')
            .del()
            .where({ roster_id: acceptingTeamRoster.roster_id })
          await trx('rosters_players').insert(
            acceptingTeamRoster.rosters_players
          )
        }

        // update proposing team roster
        if (acceptingTeamPlayers.length || proposingTeamPlayers.length) {
          await trx('rosters_players')
            .del()
            .where({ roster_id: proposingTeamRoster.roster_id })
          await trx('rosters_players').insert(
            proposingTeamRoster.rosters_players
          )
        }

        // update traded picks
        for (const pick of pickRows) {
          await trx('draft')
            .update({
              tid:
                pick.tid === trade.propose_tid
                  ? trade.accept_tid
                  : trade.propose_tid
            }) // swap team ids
            .where({ draft_pick_id: pick.draft_pick_id })
        }

        // cancel other trades that include any picks in this trade
        const pickTradeRows = await trx('trades')
          .innerJoin('trades_picks', 'trades.uid', 'trades_picks.trade_id')
          .whereIn(
            'trades_picks.draft_pick_id',
            pickRows.map((p) => p.draft_pick_id)
          )
          .whereNull('trades.accepted')
          .whereNull('trades.cancelled')
          .whereNull('trades.rejected')
          .whereNull('trades.vetoed')

        if (pickTradeRows.length) {
          // TODO - broadcast on WS
          // TODO - broadcast notifications
          const tradeids = pickTradeRows.map((t) => t.uid)
          await trx('trades')
            .whereIn('uid', tradeids)
            .update({ cancelled: new Date() })
        }

        // cancel other trades that include any players in this trade
        const playerTradeRows = await trx('trades')
          .innerJoin('trades_players', 'trades.uid', 'trades_players.trade_id')
          .whereIn('trades_players.pid', all_pids)
          .where('trades.lid', leagueId)
          .whereNull('trades.accepted')
          .whereNull('trades.cancelled')
          .whereNull('trades.rejected')
          .whereNull('trades.vetoed')

        // remove players from cutlist
        await trx('league_cutlist')
          .whereIn('pid', all_pids)
          .whereIn('tid', [trade.propose_tid, trade.accept_tid])
          .del()

        // cancel any restricted free agency bids
        await trx('restricted_free_agency_bids')
          .update('cancelled', new Date())
          .whereIn('pid', all_pids)
          .whereNull('cancelled')
          .whereNull('processed')
          .where('lid', leagueId)
          .where('season_year', current_season.year)

        if (playerTradeRows.length) {
          // TODO - broadcast on WS
          // TODO - broadcast notifications
          const tradeids = playerTradeRows.map((t) => t.uid)
          await trx('trades')
            .whereIn('uid', tradeids)
            .update({ cancelled: new Date() })
        }
      }) // Close transaction

      const teams = await db('teams').where({
        lid: leagueId,
        season_year: current_season.year
      })
      const proposingTeam = teams.find((t) => t.team_id === trade.propose_tid)
      const acceptingTeam = teams.find((t) => t.team_id === trade.accept_tid)
      const proposingTeamItems = []
      const acceptingTeamItems = []
      for (const pid of proposingTeamPlayers) {
        const player_row = player_rows.find((p) => p.pid === pid)
        proposingTeamItems.push(
          `${player_row.first_name} ${player_row.last_name} (${player_row.primary_position})`
        )
      }
      for (const pid of acceptingTeamPlayers) {
        const player_row = player_rows.find((p) => p.pid === pid)
        acceptingTeamItems.push(
          `${player_row.first_name} ${player_row.last_name} (${player_row.primary_position})`
        )
      }

      const picks = await db('draft').whereIn(
        'draft_pick_id',
        pickRows.map((p) => p.draft_pick_id)
      )
      for (const pick of picks) {
        const pick_team = teams.find((t) => t.team_id === pick.original_team_id)
        let pick_string = pick.pick_string
          ? `${pick.pick_string}`
          : `${pick.season_year} ${pick.round}${nth(pick.round)}`

        if (pick_team) {
          pick_string = `${pick_string} (${pick_team.name})`
        }

        // pick.tid is the team the pick belongs to
        const pickTradeInfo = pickRows.find(
          (p) => p.draft_pick_id === pick.draft_pick_id
        )
        if (pickTradeInfo.tid === trade.propose_tid) {
          proposingTeamItems.push(pick_string)
        } else {
          acceptingTeamItems.push(pick_string)
        }
      }
      const proposingTeamStr = toStringArray(proposingTeamItems)
      const acceptingTeamStr = toStringArray(acceptingTeamItems)

      let message = `${proposingTeam.name} has traded ${proposingTeamStr} to ${acceptingTeam.name} in exchange for ${acceptingTeamStr}.`

      if (releasePlayers.length) {
        const releaseItems = []
        for (const pid of releasePlayers) {
          const { first_name, last_name, primary_position } = player_rows.find(
            (p) => p.pid === pid
          )
          releaseItems.push(`${first_name} ${last_name} (${primary_position})`)
        }
        const releaseItemsStr = toStringArray(releaseItems)
        message = `${message} ${releaseItemsStr} have been released.`
      }

      if (activePoaches.length) {
        const poachItems = []
        for (const poach of activePoaches) {
          const { first_name, last_name, primary_position } = player_rows.find(
            (p) => p.pid === poach.pid
          )
          poachItems.push(`${first_name} ${last_name} (${primary_position})`)
        }
        const poachItemsStr = toStringArray(poachItems)

        message = `${message} Poaching claim(s) for ${poachItemsStr} have been cancelled.`
      }

      await sendNotifications({
        league,
        notifyLeague: true,
        message
      })

      next()
    } catch (error) {
      console.log(error)
      logger(error)
      res.status(500).send({ error: error.toString() })
    }
  },
  get_trade
)

/**
 * @swagger
 * /leagues/{leagueId}/trade/{tradeId}/reject:
 *   post:
 *     summary: Reject a trade proposal
 *     description: |
 *       Rejects a trade proposal. Only the accepting team owner can reject a trade.
 *       This action permanently closes the trade proposal.
 *
 *       **Key Features:**
 *       - Marks trade as rejected with timestamp
 *       - Permanently closes the trade proposal
 *       - Returns updated trade details
 *
 *       **Fantasy Football Context:**
 *       - Only the accepting team owner can reject trades
 *       - Rejected trades cannot be reopened or modified
 *       - Trade status permanently updated to rejected
 *
 *       **Access Control:**
 *       - Must be the owner of the accepting team
 *       - Trade must be in pending status (not already processed)
 *       - User must be authenticated
 *     tags:
 *       - Fantasy Leagues
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *       - name: tradeId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: Trade ID to reject
 *         example: 1234
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trade rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Trade'
 *       400:
 *         description: Invalid trade or insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalid_trade:
 *                 summary: Invalid trade ID
 *                 value:
 *                   error: "no valid trade with trade_id: 1234"
 *               team_verification_failed:
 *                 summary: User doesn't own accepting team
 *                 value:
 *                   error: Team verification failed
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  '/reject',
  async (req, res, next) => {
    const { db, logger } = req.app.locals
    try {
      const { tradeId, leagueId } = req.params

      const trades = await db('trades')
        .join('teams', 'trades.accept_tid', 'teams.team_id')
        .join('users_teams', function () {
          this.on('trades.accept_tid', '=', 'users_teams.tid')
          this.andOn(
            db.raw('users_teams.season_year = ?', [current_season.year])
          )
        })
        .where('trades.uid', tradeId)
        .where('teams.season_year', current_season.year)
        .where('users_teams.user_id', req.auth.userId)
        .whereNull('accepted')
        .whereNull('vetoed')
        .whereNull('cancelled')
        .whereNull('rejected')

      if (!trades.length) {
        return res
          .status(400)
          .send({ error: `no valid trade with trade_id: ${tradeId}` })
      }

      const trade = trades[0]

      try {
        await verifyUserTeam({
          userId: req.auth.userId,
          leagueId,
          teamId: trade.accept_tid,
          requireLeague: true
        })
      } catch (error) {
        return res.status(400).send({ error: error.message })
      }

      await db('trades')
        .where({ uid: tradeId })
        .update({ rejected: new Date() })

      next()
    } catch (error) {
      logger(error)
      res.status(500).send({ error: error.toString() })
    }
  },
  get_trade
)

/**
 * @swagger
 * /leagues/{leagueId}/trade/{tradeId}/cancel:
 *   post:
 *     summary: Cancel a trade proposal
 *     description: |
 *       Cancels a trade proposal. Only the proposing team owner can cancel their own trade.
 *       This action permanently closes the trade proposal.
 *
 *       **Key Features:**
 *       - Marks trade as cancelled with timestamp
 *       - Permanently closes the trade proposal
 *       - Returns updated trade details
 *
 *       **Fantasy Football Context:**
 *       - Only the proposing team owner can cancel their trades
 *       - Cancelled trades cannot be reopened or modified
 *       - Trade status permanently updated to cancelled
 *
 *       **Access Control:**
 *       - Must be the owner of the proposing team
 *       - Trade must be in pending status (not already processed)
 *       - User must be authenticated
 *
 *       **Use Cases:**
 *       - Change of mind before trade is accepted
 *       - Player injury or status change
 *       - Want to modify trade terms (requires new proposal)
 *       - No longer need the trade
 *     tags:
 *       - Fantasy Leagues
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *       - name: tradeId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: Trade ID to cancel
 *         example: 1234
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trade cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Trade'
 *       400:
 *         description: Invalid trade or insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalid_trade:
 *                 summary: Invalid trade ID
 *                 value:
 *                   error: "no valid trade with trade_id: 1234"
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
  '/cancel',
  async (req, res, next) => {
    const { db, logger } = req.app.locals
    try {
      const { tradeId, leagueId } = req.params

      const trades = await db('trades')
        .join('users_teams', function () {
          this.on('trades.propose_tid', '=', 'users_teams.tid')
          this.andOn(
            db.raw('users_teams.season_year = ?', [current_season.year])
          )
        })
        .join('teams', 'trades.propose_tid', 'teams.team_id')
        .where('trades.uid', tradeId)
        .where('teams.season_year', current_season.year)
        .where('users_teams.user_id', req.auth.userId)
        .whereNull('accepted')
        .whereNull('vetoed')
        .whereNull('cancelled')
        .whereNull('rejected')

      if (!trades.length) {
        return res
          .status(400)
          .send({ error: `no valid trade with trade_id: ${tradeId}` })
      }

      const trade = trades[0]

      try {
        await verifyUserTeam({
          userId: req.auth.userId,
          leagueId,
          teamId: trade.propose_tid,
          requireLeague: true
        })
      } catch (error) {
        return res.status(400).send({ error: error.message })
      }

      await db('trades')
        .where({ uid: tradeId })
        .update({ cancelled: new Date() })

      next()
    } catch (error) {
      logger(error)
      res.status(500).send({ error: error.toString() })
    }
  },
  get_trade
)

/**
 * @swagger
 * /leagues/{leagueId}/trade/{tradeId}/veto:
 *   post:
 *     summary: Veto a trade proposal
 *     description: |
 *       Vetoes a trade proposal. Only the league commissioner can veto trades.
 *       This action permanently blocks the trade and notifies both teams.
 *
 *       **Key Features:**
 *       - Marks trade as vetoed with timestamp
 *       - Sends notification to both teams and league
 *       - Permanently blocks the trade proposal
 *       - Returns updated trade details
 *
 *       **Fantasy Football Context:**
 *       - Only league commissioners can veto trades
 *       - Used to prevent unfair or collusive trades
 *       - Maintains competitive balance in the league
 *       - Vetoed trades cannot be reopened
 *
 *       **Commissioner Powers:**
 *       - Can veto any trade in the league
 *       - Should use sparingly to maintain league integrity
 *       - Responsible for explaining veto decisions
 *       - Final authority on trade fairness
 *
 *       **Access Control:**
 *       - Must be the league commissioner
 *       - Trade can be in any status except already vetoed
 *       - User must be authenticated
 *
 *       **Veto Reasons:**
 *       - Suspected collusion between teams
 *       - Grossly unfair trade terms
 *       - Violation of league rules
 *       - Competitive balance concerns
 *     tags:
 *       - Fantasy Leagues
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *       - name: tradeId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: Trade ID to veto
 *         example: 1234
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trade vetoed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Trade'
 *       400:
 *         description: Invalid trade ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalid_trade:
 *                 summary: Invalid trade ID
 *                 value:
 *                   error: "no valid trade with trade_id: 1234"
 *       401:
 *         description: Unauthorized - not commissioner
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               not_commissioner:
 *                 summary: User is not league commissioner
 *                 value:
 *                   error: only the commissioner can veto trades
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  '/veto',
  async (req, res, next) => {
    const { db, logger } = req.app.locals
    try {
      const { tradeId, leagueId } = req.params

      const league = await getLeague({ lid: leagueId })
      if (league.commissioner_user_id !== req.auth.userId) {
        return res
          .status(401)
          .send({ error: 'only the commissioner can veto trades' })
      }

      const trades = await db('trades').where({ uid: tradeId, lid: leagueId })
      if (!trades.length) {
        return res
          .status(400)
          .send({ error: `no valid trade with trade_id: ${tradeId}` })
      }

      const [trade] = trades
      if (trade.vetoed) {
        return res.status(400).send({ error: 'trade has already been vetoed' })
      }
      if (trade.cancelled || trade.rejected) {
        return res
          .status(400)
          .send({ error: 'trade is no longer open and can not be vetoed' })
      }
      // Checked before the window check below, not after: the shared helper
      // reports an approved trade as outside the window, so without this the
      // refusal would read "veto window has closed" and misdescribe why.
      if (trade.approved) {
        return res.status(400).send({
          error: 'trade has already been approved and can not be vetoed'
        })
      }

      // ONE instant for every row this veto writes. trades.vetoed and
      // transactions.occurred_at are both timestamptz, so the same Date binds to
      // both and the reversal rows cannot reorder against the TRADE rows they
      // reverse. Rounding through epoch seconds is what would move them up to
      // half a second in either direction.
      const vetoed_occurred_at = new Date()

      // A trade that was never accepted moved nothing, so vetoing it is just a
      // status change. Only an accepted trade needs reversing.
      if (!trade.accepted) {
        await db('trades')
          .where({ uid: tradeId, lid: leagueId })
          .update({ vetoed: vetoed_occurred_at })

        await sendNotifications({
          league,
          notifyLeague: true,
          message: `The commissioner has vetoed trade #${tradeId}.`
        })

        return next()
      }

      // Reversal is only well defined while the trade's assets are still frozen
      // by its veto window. Once the window closes they can move again, and
      // putting them back could require unwinding another team's decisions.
      if (!is_trade_within_veto_window({ trade, league })) {
        const deadline = get_trade_veto_deadline({ trade, league })
        return res.status(400).send({
          error: deadline
            ? 'veto window has closed; this trade can no longer be reversed'
            : 'veto is disabled for this league'
        })
      }

      const trades_players_rows = await db('trades_players').where({
        trade_id: tradeId
      })
      const release_rows = await db('trade_releases').where({
        trade_id: tradeId
      })
      const pick_rows = await db('trades_picks').where({ trade_id: tradeId })
      const slot_rows = await db('trades_slots').where({ trade_uid: tradeId })

      const origin_slot_by_pid = new Map(
        slot_rows.map((row) => [row.pid, row.origin_slot])
      )

      // Reversing a trade after a traded player has been locked into a scored
      // lineup would retroactively change results that already counted.
      for (const row of trades_players_rows) {
        if (await isPlayerLocked(row.pid)) {
          return res.status(400).send({
            error: `player ${row.pid} is locked and the trade can no longer be reversed`
          })
        }
      }

      const all_pids = trades_players_rows
        .map(({ pid }) => pid)
        .concat(release_rows.map(({ pid }) => pid))

      const player_rows = await db('player')
        .whereIn('pid', all_pids)
        .select('pid', 'primary_position')
      const pos_by_pid = new Map(
        player_rows.map((p) => [p.pid, p.primary_position])
      )

      // Value is carried on the TRADE transactions written at acceptance, so
      // the reversing rows can restore each player's salary exactly.
      const trade_transaction_rows = await db('transactions')
        .join(
          'trades_transactions',
          'transactions.uid',
          'trades_transactions.transaction_id'
        )
        .where('trades_transactions.trade_id', tradeId)
        .select('transactions.pid', 'transactions.player_salary')
      const value_by_pid = new Map(
        trade_transaction_rows.map((t) => [t.pid, t.player_salary])
      )

      const proposing_roster_row = await getRoster({ tid: trade.propose_tid })
      const accepting_roster_row = await getRoster({ tid: trade.accept_tid })
      const proposing_roster = new Roster({
        roster: proposing_roster_row,
        league
      })
      const accepting_roster = new Roster({
        roster: accepting_roster_row,
        league
      })

      const roster_for_tid = (tid) =>
        tid === trade.propose_tid ? proposing_roster : accepting_roster
      const other_tid = (tid) =>
        tid === trade.propose_tid ? trade.accept_tid : trade.propose_tid

      // Move every traded player off the roster that received them and back
      // onto the roster that sent them, in the slot they left. Roster.addPlayer
      // throws when a limit would be broken -- the freeze stops the traded
      // assets from moving, but the receiving team may have signed someone into
      // the space this trade opened up, so a reversal can still not fit.
      try {
        // Two phases: every traded player comes off its current roster before
        // any goes back on. Interleaving them would transiently push a roster
        // over its limit on a balanced trade, where each side is only made
        // whole by the departure of the player it is sending back.
        for (const row of trades_players_rows) {
          roster_for_tid(other_tid(row.tid)).removePlayer(row.pid)
        }

        for (const row of trades_players_rows) {
          roster_for_tid(row.tid).addPlayer({
            slot: origin_slot_by_pid.get(row.pid) ?? roster_slot_types.BENCH,
            pid: row.pid,
            pos: pos_by_pid.get(row.pid),
            player_salary: value_by_pid.get(row.pid) ?? 0
          })
        }

        // Players released to make room for the trade go back on the roster
        // that cut them. The freeze keeps them unsigned for the whole window.
        for (const row of release_rows) {
          roster_for_tid(row.tid).addPlayer({
            slot: row.origin_slot ?? roster_slot_types.BENCH,
            pid: row.pid,
            pos: pos_by_pid.get(row.pid),
            player_salary: value_by_pid.get(row.pid) ?? 0
          })
        }
      } catch (error) {
        return res.status(400).send({
          error: `trade can not be reversed: ${error.message}`
        })
      }

      try {
        await db.transaction(async (trx) => {
          const vetoed_count = await trx('trades')
            .where({ uid: tradeId, lid: leagueId })
            .whereNull('approved')
            .update({ vetoed: vetoed_occurred_at })

          // The read above and this write are not one statement, so an approve
          // could have landed in between. Throw rather than return: every write
          // below is part of the same transaction, and letting them commit with
          // `vetoed` still NULL would unwind a finalized trade with no record of
          // it. The throw is what rolls the whole reversal back.
          if (!vetoed_count) {
            const conflict = new Error(
              'trade was approved while this veto was in flight'
            )
            conflict.is_veto_write_conflict = true
            throw conflict
          }

          // Append compensating transactions rather than deleting the originals:
          // the ledger is the history, and it should read "moved, then moved
          // back" instead of silently losing the fact the trade ever executed.
          const reversal_transactions = trades_players_rows.map((row) => ({
            user_id: req.auth.userId,
            tid: row.tid,
            lid: leagueId,
            pid: row.pid,
            type: transaction_types.TRADE_REVERSAL,
            player_salary: value_by_pid.get(row.pid) ?? 0,
            week: current_season.week,
            season_year: current_season.year,
            occurred_at: vetoed_occurred_at
          }))

          for (const row of release_rows) {
            reversal_transactions.push({
              user_id: req.auth.userId,
              tid: row.tid,
              lid: leagueId,
              pid: row.pid,
              type: transaction_types.TRADE_REVERSAL,
              player_salary: value_by_pid.get(row.pid) ?? 0,
              week: current_season.week,
              season_year: current_season.year,
              occurred_at: vetoed_occurred_at
            })
          }

          if (reversal_transactions.length) {
            const transaction_ids = await trx('transactions')
              .insert(reversal_transactions)
              .returning('uid')
            await trx('trades_transactions').insert(
              transaction_ids.map((t) => ({
                transaction_id: t.uid,
                trade_id: trade.uid
              }))
            )
          }

          await trx('rosters_players')
            .del()
            .where({ roster_id: proposing_roster.roster_id })
          await trx('rosters_players').insert(proposing_roster.rosters_players)

          await trx('rosters_players')
            .del()
            .where({ roster_id: accepting_roster.roster_id })
          await trx('rosters_players').insert(accepting_roster.rosters_players)

          // Return traded picks to the team that gave them up.
          for (const pick of pick_rows) {
            await trx('draft')
              .update({ tid: pick.tid })
              .where({ draft_pick_id: pick.draft_pick_id })
          }
        })
      } catch (error) {
        if (error.is_veto_write_conflict) {
          return res.status(400).send({ error: error.message })
        }
        throw error
      }

      const message = `The commissioner has vetoed trade #${tradeId}. All players and picks have been returned.`

      await sendNotifications({
        league,
        notifyLeague: true,
        message
      })

      next()
    } catch (error) {
      logger(error)
      res.status(500).send({ error: error.toString() })
    }
  },
  get_trade
)

/**
 * @swagger
 * /leagues/{leagueId}/trades/{tradeId}/approve:
 *   post:
 *     summary: Approve a trade, closing its veto window early
 *     description: |
 *       Closes an accepted trade's veto window ahead of the clock. Only the
 *       league commissioner can approve trades.
 *
 *       **Key Features:**
 *       - Marks the trade approved with a timestamp
 *       - Immediately unlocks the traded players, picks, and released players
 *       - Removes the trade from the commissioner's vetoable list
 *       - Returns updated trade details
 *
 *       **Fantasy Football Context:**
 *       - Puts the trade in the state an expired window would, on the
 *         commissioner's say-so rather than the clock's
 *       - The traded assets can be moved again right away
 *       - Closes the in-app veto path only; the constitution's separate process
 *         for overturning a commissioner decision is unaffected
 *
 *       **Access Control:**
 *       - Must be the league commissioner
 *       - Trade must be accepted, not vetoed, cancelled, rejected, or already
 *         approved, and still inside its veto window
 *     tags:
 *       - Fantasy Leagues
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *       - name: tradeId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: Trade ID to approve
 *         example: 1234
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trade approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Trade'
 *       400:
 *         description: Trade can not be approved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalid_trade:
 *                 summary: Invalid trade ID
 *                 value:
 *                   error: "no valid trade with trade_id: 1234"
 *               not_accepted:
 *                 summary: Trade has not been accepted
 *                 value:
 *                   error: trade has not been accepted and can not be approved
 *               already_approved:
 *                 summary: Trade has already been approved
 *                 value:
 *                   error: trade has already been approved
 *               window_closed:
 *                 summary: Veto window has already closed
 *                 value:
 *                   error: veto window has already closed; there is nothing to approve
 *               veto_disabled:
 *                 summary: League has veto disabled
 *                 value:
 *                   error: veto is disabled for this league; there is no window to close
 *       401:
 *         description: Unauthorized - not commissioner
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               not_commissioner:
 *                 summary: User is not league commissioner
 *                 value:
 *                   error: only the commissioner can approve trades
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  '/approve',
  async (req, res, next) => {
    const { db, logger } = req.app.locals
    try {
      const { tradeId, leagueId } = req.params

      const league = await getLeague({ lid: leagueId })
      if (league.commissioner_user_id !== req.auth.userId) {
        return res
          .status(401)
          .send({ error: 'only the commissioner can approve trades' })
      }

      const trades = await db('trades').where({ uid: tradeId, lid: leagueId })
      if (!trades.length) {
        return res
          .status(400)
          .send({ error: `no valid trade with trade_id: ${tradeId}` })
      }

      const [trade] = trades
      if (trade.vetoed) {
        return res
          .status(400)
          .send({ error: 'trade has been vetoed and can not be approved' })
      }
      if (trade.cancelled || trade.rejected) {
        return res
          .status(400)
          .send({ error: 'trade is no longer open and can not be approved' })
      }
      // Approving an unaccepted trade has no meaning: nothing has moved, so
      // there is no window and nothing frozen to unlock.
      if (!trade.accepted) {
        return res.status(400).send({
          error: 'trade has not been accepted and can not be approved'
        })
      }
      if (trade.approved) {
        return res
          .status(400)
          .send({ error: 'trade has already been approved' })
      }

      // Approving closes the window early, so there has to be a window left to
      // close. A league with veto disabled has none at all, which is a
      // different refusal than a window that ran out.
      if (!is_trade_within_veto_window({ trade, league })) {
        const deadline = get_trade_veto_deadline({ trade, league })
        return res.status(400).send({
          error: deadline
            ? 'veto window has already closed; there is nothing to approve'
            : 'veto is disabled for this league; there is no window to close'
        })
      }

      // Conditional on the state the guards above read, so an approve or veto
      // that landed in between wins outright instead of both writing. One
      // statement, so a 0-row result needs no rollback -- nothing else has
      // been written.
      const approved_count = await db('trades')
        .where({ uid: tradeId, lid: leagueId })
        .whereNull('approved')
        .whereNull('vetoed')
        .update({ approved: new Date() })

      if (!approved_count) {
        return res
          .status(400)
          .send({ error: 'trade was already settled while this was in flight' })
      }

      await sendNotifications({
        league,
        notifyLeague: true,
        message: `The commissioner has approved trade #${tradeId}. Its veto window is closed and its assets are unlocked.`
      })

      next()
    } catch (error) {
      logger(error)
      res.status(500).send({ error: error.toString() })
    }
  },
  get_trade
)

export default router
