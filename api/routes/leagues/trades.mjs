import express from 'express'
import dayjs from 'dayjs'

import { constants, Roster } from '#libs-shared'
import {
  getRoster,
  getLeague,
  verifyRestrictedFreeAgency,
  verifyUserTeam
} from '#libs-server'
import trade, { getTrade } from './trade.mjs'

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
 * /api/leagues/{leagueId}/trades:
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
 *       - Leagues
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
 * /api/leagues/{leagueId}/trades:
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
 *       - Leagues
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

      // validate proposing team roster
      const sub = db('transactions')
        .select(db.raw('max(uid) as uid'))
        .whereIn('pid', acceptingTeamPlayers)
        .where('lid', leagueId)
        .groupBy('pid')
        .as('sub_query')

      const players = await db
        .select('player.*', 'transactions.value')
        .from(sub)
        .join('transactions', 'sub_query.uid', 'transactions.uid')
        .join('player', 'transactions.pid', 'player.pid')
        .whereIn('player.pid', acceptingTeamPlayers)

      releasePlayers.forEach((p) => proposingTeamRoster.removePlayer(p))
      proposingTeamPlayers.forEach((p) => proposingTeamRoster.removePlayer(p))
      for (const pid of acceptingTeamPlayers) {
        const player = players.find((p) => p.pid === pid)
        const hasSlot = proposingTeamRoster.hasOpenBenchSlot(player.pos)
        if (!hasSlot) {
          return res.status(400).send({ error: 'no slots available' })
        }
        proposingTeamRoster.addPlayer({
          slot: constants.slots.BENCH,
          pid,
          pos: player.pos,
          value: player.value
        })
      }

      // insert trade
      const result = await db('trades')
        .insert({
          propose_tid,
          accept_tid,
          userid: req.auth.userId,
          year: constants.season.year,
          lid: leagueId,
          offered: Math.round(Date.now() / 1000)
        })
        .returning('uid')
      const tradeid = result[0].uid

      // insert join entries
      const insertPlayers = []
      const insertPicks = []
      for (const pid of proposingTeamPlayers) {
        insertPlayers.push({
          tradeid,
          tid: propose_tid,
          pid
        })
      }
      for (const pid of acceptingTeamPlayers) {
        insertPlayers.push({
          tradeid,
          tid: accept_tid,
          pid
        })
      }
      for (const pickid of proposingTeamPicks) {
        insertPicks.push({
          tradeid,
          pickid,
          tid: propose_tid
        })
      }
      for (const pickid of acceptingTeamPicks) {
        insertPicks.push({
          tradeid,
          pickid,
          tid: accept_tid
        })
      }

      const insertReleases = []
      for (const pid of releasePlayers) {
        insertReleases.push({
          tradeid,
          pid,
          tid: propose_tid
        })
      }

      if (insertPicks.length) {
        await db('trades_picks').insert(insertPicks)
      }

      if (insertPlayers.length) {
        await db('trades_players').insert(insertPlayers)
      }

      if (insertReleases.length) {
        await db('trade_releases').insert(insertReleases)
      }

      req.params.tradeId = tradeid
      next()
    } catch (error) {
      logger(error)
      res.status(500).send({ error: error.toString() })
    }
  },
  getTrade
)

router.use('/:tradeId([0-9]+)', trade)

export default router
