import dayjs from 'dayjs'
import express from 'express'

import { constants, Roster, toStringArray, nth } from '#libs-shared'
import validate_trade_roster_slots from '#libs-server/validate-trade-roster-slots.mjs'
import {
  getRoster,
  getLeague,
  sendNotifications,
  verifyRestrictedFreeAgency,
  isPlayerLocked,
  verifyUserTeam
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
 *         userid:
 *           type: integer
 *           description: User ID who proposed the trade
 *           example: 5
 *         proposed:
 *           type: integer
 *           description: Unix timestamp when trade was proposed
 *           example: 1698765432
 *         accepted:
 *           type: integer
 *           nullable: true
 *           description: Unix timestamp when trade was accepted
 *           example: null
 *         rejected:
 *           type: integer
 *           nullable: true
 *           description: Unix timestamp when trade was rejected
 *           example: null
 *         cancelled:
 *           type: integer
 *           nullable: true
 *           description: Unix timestamp when trade was cancelled
 *           example: null
 *         vetoed:
 *           type: integer
 *           nullable: true
 *           description: Unix timestamp when trade was vetoed
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
      res.status(400).send({ error: `could not find tradeid: ${tradeId}` })
    }

    const release_rows = await db('trade_releases').where({ tradeid: tradeId })
    const trades_players_rows = await db('trades_players').where({
      tradeid: tradeId
    })
    const picks = await db('trades_picks')
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
      .where({ tradeid: tradeId })
      .join('draft', 'trades_picks.pickid', 'draft.uid')

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
 *                   userid: 5
 *                   proposed: 1698765432
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
 *                       year: 2025
 *                       round: 1
 *                       pick: 4
 *                       pick_str: "1.04"
 *                       otid: 13
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
 *                   error: "could not find tradeid: 1234"
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
 *                   userid: 5
 *                   proposed: 1698765432
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
 *                   error: "no valid trade with tradeid: 1234"
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
          this.andOn(db.raw('users_teams.year = ?', [constants.season.year]))
        })
        .where('trades.uid', tradeId)
        .where('users_teams.userid', req.auth.userId)
        .whereNull('accepted')
        .whereNull('rejected')
        .whereNull('cancelled')
        .whereNull('vetoed')

      // verify trade exists
      const trade = trades[0]
      if (!trade) {
        res
          .status(400)
          .send({ error: `no valid trade with tradeid: ${tradeId}` })
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
        constants.slots.BENCH,
        constants.slots.PS,
        constants.slots.PSP,
        constants.slots.PSD,
        constants.slots.PSDP,
        constants.slots.RESERVE_SHORT_TERM,
        constants.slots.RESERVE_LONG_TERM,
        constants.slots.COV
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
        tradeid: tradeId
      })
      const proposingTeamReleasePlayerIds = proposing_release_rows.map(
        ({ pid }) => pid
      )

      // gather traded players
      const trades_players_rows = await db('trades_players').where({
        tradeid: tradeId
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
      const deadline = dayjs.unix(league.tddate)
      if (dayjs().isAfter(deadline)) {
        return res.status(400).send({ error: 'deadline has passed' })
      }

      // check for restricted free agency players during RFA
      try {
        await verifyRestrictedFreeAgency({ league, pids: all_pids })
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

      // Get extension counts before removing players
      const proposingPlayerExtensions = {}
      for (const pid of proposingTeamPlayers) {
        const player = proposingTeamRoster.get(pid)
        proposingPlayerExtensions[pid] = player?.extensions || 0
      }

      const acceptingPlayerExtensions = {}
      for (const pid of acceptingTeamPlayers) {
        const player = acceptingTeamRoster.get(pid)
        acceptingPlayerExtensions[pid] = player?.extensions || 0
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
        week: constants.season.week,
        is_regular_season: constants.season.isRegularSeason,
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
        week: constants.season.week,
        is_regular_season: constants.season.isRegularSeason,
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

      const pickRows = await db('trades_picks').where({ tradeid: tradeId })

      // Use transaction to ensure all trade acceptance operations are atomic
      await db.transaction(async (trx) => {
        // clear any existing poaching claims
        if (activePoaches.length) {
          await trx('poaches')
            .update('processed', Math.round(Date.now() / 1000))
            .update('reason', 'Player traded')
            .update('succ', 0)
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
            tradeid: tradeId,
            pid,
            tid: trade.accept_tid
          })
        }
        if (release_inserts.length) {
          await trx('trade_releases').insert(release_inserts)
        }

        await trx('trades')
          .where({ uid: tradeId })
          .update({ accepted: Math.round(Date.now() / 1000) })

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

        // insert transactions
        const insertTransactions = []
        for (const pid of acceptingTeamPlayers) {
          insertTransactions.push({
            userid: trade.userid,
            tid: trade.propose_tid,
            lid: leagueId,
            pid,
            type: constants.transactions.TRADE,
            value: transaction_history.find((t) => t.pid === pid).value,
            week: constants.season.week,
            year: constants.season.year,
            timestamp: Math.round(Date.now() / 1000)
          })
        }
        for (const pid of proposingTeamPlayers) {
          insertTransactions.push({
            userid: req.auth.userId,
            tid: trade.accept_tid,
            lid: leagueId,
            pid,
            type: constants.transactions.TRADE,
            value: transaction_history.find((t) => t.pid === pid).value,
            week: constants.season.week,
            year: constants.season.year,
            timestamp: Math.round(Date.now() / 1000)
          })
        }

        // insert trade transactions
        if (insertTransactions.length) {
          const tranIds = await trx('transactions')
            .insert(insertTransactions)
            .returning('uid')
          await trx('trades_transactions').insert(
            tranIds.map((t) => ({ transactionid: t.uid, tradeid: trade.uid }))
          )
        }

        if (releasePlayers.length) {
          const releaseTransactions = []
          for (const pid of proposingTeamReleasePlayerIds) {
            releaseTransactions.push({
              userid: trade.userid,
              tid: trade.propose_tid,
              lid: leagueId,
              pid,
              type: constants.transactions.ROSTER_RELEASE,
              value: 0,
              week: constants.season.week,
              year: constants.season.year,
              timestamp: Math.round(Date.now() / 1000)
            })
          }

          for (const pid of acceptingTeamReleasePlayers) {
            releaseTransactions.push({
              userid: req.auth.userId,
              tid: trade.accept_tid,
              lid: leagueId,
              pid,
              type: constants.transactions.ROSTER_RELEASE,
              value: 0,
              week: constants.season.week,
              year: constants.season.year,
              timestamp: Math.round(Date.now() / 1000)
            })
          }

          await trx('transactions').insert(releaseTransactions)
        }

        // update receiving roster
        if (acceptingTeamPlayers.length || proposingTeamPlayers.length) {
          await trx('rosters_players')
            .del()
            .where({ rid: acceptingTeamRoster.uid })
          await trx('rosters_players').insert(
            acceptingTeamRoster.rosters_players
          )
        }

        // update proposing team roster
        if (acceptingTeamPlayers.length || proposingTeamPlayers.length) {
          await trx('rosters_players')
            .del()
            .where({ rid: proposingTeamRoster.uid })
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
            .where({ uid: pick.pickid })
        }

        // cancel other trades that include any picks in this trade
        const pickTradeRows = await trx('trades')
          .innerJoin('trades_picks', 'trades.uid', 'trades_picks.tradeid')
          .whereIn(
            'trades_picks.pickid',
            pickRows.map((p) => p.pickid)
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
            .update({ cancelled: Math.round(Date.now() / 1000) })
        }

        // cancel other trades that include any players in this trade
        const playerTradeRows = await trx('trades')
          .innerJoin('trades_players', 'trades.uid', 'trades_players.tradeid')
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
          .update('cancelled', Math.round(Date.now() / 1000))
          .whereIn('pid', all_pids)
          .whereNull('cancelled')
          .whereNull('processed')
          .where('lid', leagueId)
          .where('year', constants.season.year)

        if (playerTradeRows.length) {
          // TODO - broadcast on WS
          // TODO - broadcast notifications
          const tradeids = playerTradeRows.map((t) => t.uid)
          await trx('trades')
            .whereIn('uid', tradeids)
            .update({ cancelled: Math.round(Date.now() / 1000) })
        }
      }) // Close transaction

      const teams = await db('teams').where({
        lid: leagueId,
        year: constants.season.year
      })
      const proposingTeam = teams.find((t) => t.uid === trade.propose_tid)
      const acceptingTeam = teams.find((t) => t.uid === trade.accept_tid)
      const proposingTeamItems = []
      const acceptingTeamItems = []
      for (const pid of proposingTeamPlayers) {
        const player_row = player_rows.find((p) => p.pid === pid)
        proposingTeamItems.push(
          `${player_row.fname} ${player_row.lname} (${player_row.pos})`
        )
      }
      for (const pid of acceptingTeamPlayers) {
        const player_row = player_rows.find((p) => p.pid === pid)
        acceptingTeamItems.push(
          `${player_row.fname} ${player_row.lname} (${player_row.pos})`
        )
      }

      const picks = await db('draft').whereIn(
        'uid',
        pickRows.map((p) => p.pickid)
      )
      for (const pick of picks) {
        const pick_team = teams.find((t) => t.uid === pick.otid)
        let pick_str = pick.pick_str
          ? `${pick.pick_str}`
          : `${pick.year} ${pick.round}${nth(pick.round)}`

        if (pick_team) {
          pick_str = `${pick_str} (${pick_team.name})`
        }

        // pick.tid is the team the pick belongs to
        const pickTradeInfo = pickRows.find((p) => p.pickid === pick.uid)
        if (pickTradeInfo.tid === trade.propose_tid) {
          proposingTeamItems.push(pick_str)
        } else {
          acceptingTeamItems.push(pick_str)
        }
      }
      const proposingTeamStr = toStringArray(proposingTeamItems)
      const acceptingTeamStr = toStringArray(acceptingTeamItems)

      let message = `${proposingTeam.name} has traded ${proposingTeamStr} to ${acceptingTeam.name} in exchange for ${acceptingTeamStr}.`

      if (releasePlayers.length) {
        const releaseItems = []
        for (const pid of releasePlayers) {
          const { fname, lname, pos } = player_rows.find((p) => p.pid === pid)
          releaseItems.push(`${fname} ${lname} (${pos})`)
        }
        const releaseItemsStr = toStringArray(releaseItems)
        message = `${message} ${releaseItemsStr} have been released.`
      }

      if (activePoaches.length) {
        const poachItems = []
        for (const poach of activePoaches) {
          const { fname, lname, pos } = player_rows.find(
            (p) => p.pid === poach.pid
          )
          poachItems.push(`${fname} ${lname} (${pos})`)
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
 *       This action permanently closes the trade proposal and notifies the proposing team.
 *
 *       **Key Features:**
 *       - Marks trade as rejected with timestamp
 *       - Sends notification to proposing team
 *       - Permanently closes the trade proposal
 *       - Returns updated trade details
 *
 *       **Fantasy Football Context:**
 *       - Only the accepting team owner can reject trades
 *       - Rejected trades cannot be reopened or modified
 *       - Proposing team receives notification of rejection
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
 *                   error: "no valid trade with tradeid: 1234"
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
        .join('teams', 'trades.accept_tid', 'teams.uid')
        .join('users_teams', function () {
          this.on('trades.accept_tid', '=', 'users_teams.tid')
          this.andOn(db.raw('users_teams.year = ?', [constants.season.year]))
        })
        .where('trades.uid', tradeId)
        .where('teams.year', constants.season.year)
        .where('users_teams.userid', req.auth.userId)
        .whereNull('accepted')
        .whereNull('vetoed')
        .whereNull('cancelled')
        .whereNull('rejected')

      if (!trades.length) {
        return res
          .status(400)
          .send({ error: `no valid trade with tradeid: ${tradeId}` })
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
        .update({ rejected: Math.round(Date.now() / 1000) })

      const league = await getLeague({ lid: leagueId })
      await sendNotifications({
        league,
        teamIds: [trade.propose_tid],
        message: `${trade.name} (${trade.abbrv}) has rejected your trade offer.`
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
 * /leagues/{leagueId}/trade/{tradeId}/cancel:
 *   post:
 *     summary: Cancel a trade proposal
 *     description: |
 *       Cancels a trade proposal. Only the proposing team owner can cancel their own trade.
 *       This action permanently closes the trade proposal and notifies the accepting team.
 *
 *       **Key Features:**
 *       - Marks trade as cancelled with timestamp
 *       - Sends notification to accepting team
 *       - Permanently closes the trade proposal
 *       - Returns updated trade details
 *
 *       **Fantasy Football Context:**
 *       - Only the proposing team owner can cancel their trades
 *       - Cancelled trades cannot be reopened or modified
 *       - Accepting team receives notification of cancellation
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
 *                   error: "no valid trade with tradeid: 1234"
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
          this.andOn(db.raw('users_teams.year = ?', [constants.season.year]))
        })
        .join('teams', 'trades.propose_tid', 'teams.uid')
        .where('trades.uid', tradeId)
        .where('teams.year', constants.season.year)
        .where('users_teams.userid', req.auth.userId)
        .whereNull('accepted')
        .whereNull('vetoed')
        .whereNull('cancelled')
        .whereNull('rejected')

      if (!trades.length) {
        return res
          .status(400)
          .send({ error: `no valid trade with tradeid: ${tradeId}` })
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
        .update({ cancelled: Math.round(Date.now() / 1000) })

      const league = await getLeague({ lid: leagueId })
      await sendNotifications({
        league,
        teamIds: [trade.accept_tid],
        message: `${trade.name} (${trade.abbrv}) has cancelled their trade offer.`
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
 *                   error: "no valid trade with tradeid: 1234"
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
      if (league.commishid !== req.auth.userId) {
        return res
          .status(401)
          .send({ error: 'only the commissioner can veto trades' })
      }

      const trades = await db('trades').where({ uid: tradeId, lid: leagueId })
      if (!trades.length) {
        return res
          .status(400)
          .send({ error: `no valid trade with tradeid: ${tradeId}` })
      }

      const trade = trades[0]

      await db('trades')
        .where({ uid: tradeId, lid: leagueId })
        .update({ vetoed: Math.round(Date.now() / 1000) })

      const message = `The commissioner has vetoed trade #${tradeId}.`

      await sendNotifications({
        league,
        notifyLeague: true,
        teamIds: [trade.accept_tid, trade.propose_tid],
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

export default router
