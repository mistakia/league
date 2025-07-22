import express from 'express'
import dayjs from 'dayjs'

import { constants } from '#libs-shared'
import {
  getTransactionsSinceAcquisition,
  getTransactionsSinceFreeAgent
} from '#libs-server'

const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * components:
 *   schemas:
 *     Transaction:
 *       type: object
 *       description: Fantasy league transaction record
 *       properties:
 *         uid:
 *           type: integer
 *           description: Transaction ID
 *           example: 12345
 *         tid:
 *           type: integer
 *           description: Team ID
 *           example: 13
 *         lid:
 *           type: integer
 *           description: League ID
 *           example: 2
 *         pid:
 *           type: string
 *           description: Player ID
 *           example: "4017"
 *         type:
 *           type: integer
 *           description: Transaction type (constants.transactions)
 *           enum: [1, 2, 3, 4, 5, 6, 7, 8, 9]
 *           example: 1
 *         userid:
 *           type: integer
 *           nullable: true
 *           description: User ID who made the transaction
 *           example: 5
 *         value:
 *           type: integer
 *           description: Transaction value/cost
 *           example: 15
 *         week:
 *           type: integer
 *           description: NFL week when transaction occurred
 *           example: 8
 *         year:
 *           type: integer
 *           description: Season year
 *           example: 2024
 *         timestamp:
 *           type: integer
 *           description: Unix timestamp when transaction occurred
 *           example: 1698765432
 *         pick:
 *           type: integer
 *           nullable: true
 *           description: Draft pick number (for draft transactions)
 *           example: 15
 *         pick_str:
 *           type: string
 *           nullable: true
 *           description: Formatted draft pick string (for draft transactions)
 *           example: "2.03"
 *
 *     TransactionPlayerHistory:
 *       type: object
 *       description: Player transaction history for a team
 *       properties:
 *         sinceFA:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Transaction'
 *           description: Transactions since player became free agent
 *         sinceAcquisition:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Transaction'
 *           description: Transactions since team acquired the player
 */

/**
 * @swagger
 * /api/leagues/{leagueId}/transactions:
 *   get:
 *     summary: Get fantasy league transactions
 *     description: |
 *       Retrieves transaction history for a fantasy league with flexible filtering options.
 *       Includes all types of roster moves, trades, drafts, and other league activity.
 *
 *       **Key Features:**
 *       - Paginated results with configurable limit/offset
 *       - Filter by transaction type, team, player, or date
 *       - Includes draft pick information for draft transactions
 *       - Ordered by most recent transactions first
 *
 *       **Fantasy Football Context:**
 *       - Tracks all roster moves and league activity
 *       - Shows transaction costs and values
 *       - Includes draft picks, trades, waivers, and free agent moves
 *       - Maintains complete audit trail of league activity
 *
 *       **Transaction Types:**
 *       - **Draft**: Rookie draft selections
 *       - **Trade**: Player/pick exchanges between teams
 *       - **Waiver**: Waiver wire claims
 *       - **Free Agent**: Free agent acquisitions
 *       - **Release**: Player releases
 *       - **Practice Squad**: Practice squad moves
 *       - **Activation**: Player activations
 *
 *       **Filtering Options:**
 *       - **By Type**: Filter specific transaction types
 *       - **By Team**: Show only specific team transactions
 *       - **By Player**: Show all transactions for a player
 *       - **By Date**: Show transactions since a timestamp
 *
 *       **Pagination:**
 *       - Default limit: 100 transactions
 *       - Configurable offset for browsing history
 *       - Ordered by timestamp (newest first)
 *     tags:
 *       - Leagues
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 500
 *           default: 100
 *         description: Maximum number of transactions to return
 *         example: 50
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of transactions to skip (for pagination)
 *         example: 0
 *       - name: types
 *         in: query
 *         schema:
 *           oneOf:
 *             - type: integer
 *             - type: array
 *               items:
 *                 type: integer
 *         description: |
 *           Transaction type(s) to filter by. Can be single value or array.
 *           Common types: 1=Draft, 2=Trade, 3=Waiver, 4=Free Agent, 5=Release
 *         example: [1, 2]
 *       - name: teams
 *         in: query
 *         schema:
 *           oneOf:
 *             - type: integer
 *             - type: array
 *               items:
 *                 type: integer
 *         description: Team ID(s) to filter by. Can be single value or array.
 *         example: [13, 14]
 *       - name: pid
 *         in: query
 *         schema:
 *           type: string
 *         description: Player ID to filter transactions for
 *         example: "4017"
 *       - name: since
 *         in: query
 *         schema:
 *           type: integer
 *         description: Unix timestamp to show transactions since
 *         example: 1698700000
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Transaction'
 *             examples:
 *               recent_transactions:
 *                 summary: Recent league transactions
 *                 value:
 *                   - uid: 12345
 *                     tid: 13
 *                     lid: 2
 *                     pid: "4017"
 *                     type: 1
 *                     userid: 5
 *                     value: 15
 *                     week: 8
 *                     year: 2024
 *                     timestamp: 1698765432
 *                     pick: 15
 *                     pick_str: "2.03"
 *                   - uid: 12344
 *                     tid: 14
 *                     lid: 2
 *                     pid: "3892"
 *                     type: 3
 *                     userid: 7
 *                     value: 8
 *                     week: 8
 *                     year: 2024
 *                     timestamp: 1698765400
 *                     pick: null
 *                     pick_str: null
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params

    // TODO validate
    const { limit = 100, offset = 0, pid, since } = req.query
    const types = req.query.types
      ? Array.isArray(req.query.types)
        ? req.query.types
        : [req.query.types]
      : []
    const teams = req.query.teams
      ? Array.isArray(req.query.teams)
        ? req.query.teams
        : [req.query.teams]
      : []

    let query = db('transactions')
      .leftJoin('draft', function () {
        this.on('transactions.pid', '=', 'draft.pid')
          .andOn('transactions.lid', '=', 'draft.lid')
          .andOn(
            'transactions.type',
            '=',
            db.raw('?', [constants.transactions.DRAFT])
          )
      })
      .select('transactions.*', 'draft.pick', 'draft.pick_str')
      .where({ 'transactions.lid': leagueId })
      .orderBy('transactions.timestamp', 'desc')
      .orderBy('transactions.uid', 'desc')
      .limit(limit)
      .offset(offset)

    if (types.length) {
      query = query.whereIn('transactions.type', types)
    }

    if (teams.length) {
      query = query.whereIn('transactions.tid', teams)
    }

    if (pid) {
      query = query.where('transactions.pid', pid)
    }

    if (since) {
      query = query.where('transactions.timestamp', '>', since)
    }

    const transactions = await query

    res.send(transactions)
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

/**
 * @swagger
 * /api/leagues/{leagueId}/transactions/release:
 *   get:
 *     summary: Get recent release-related transactions
 *     description: |
 *       Retrieves recent transactions related to player releases and acquisitions
 *       from the last 48 hours. Used for monitoring recent roster activity.
 *
 *       **Key Features:**
 *       - Shows last 48 hours of release activity
 *       - Includes roster adds, releases, and practice squad moves
 *       - Ordered by most recent first
 *       - Focused on roster churn monitoring
 *
 *       **Fantasy Football Context:**
 *       - Tracks recent roster changes and player movement
 *       - Helps identify available players and recent releases
 *       - Shows practice squad activity and roster churn
 *       - Useful for waiver wire and free agent analysis
 *
 *       **Transaction Types Included:**
 *       - **Roster Add**: Players added to active rosters
 *       - **Roster Release**: Players released from teams
 *       - **Practice Add**: Players added to practice squads
 *
 *       **Time Window:**
 *       - Fixed 48-hour lookback period
 *       - Automatically calculated from current time
 *       - Captures recent roster activity patterns
 *     tags:
 *       - Leagues
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     responses:
 *       200:
 *         description: Recent release transactions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Transaction'
 *             examples:
 *               recent_releases:
 *                 summary: Recent 48-hour release activity
 *                 value:
 *                   - uid: 12350
 *                     tid: 13
 *                     lid: 2
 *                     pid: "2041"
 *                     type: 5
 *                     userid: 5
 *                     value: 0
 *                     week: 8
 *                     year: 2024
 *                     timestamp: 1698765000
 *                     pick: null
 *                     pick_str: null
 *                   - uid: 12349
 *                     tid: 14
 *                     lid: 2
 *                     pid: "1889"
 *                     type: 4
 *                     userid: 7
 *                     value: 3
 *                     week: 8
 *                     year: 2024
 *                     timestamp: 1698764800
 *                     pick: null
 *                     pick_str: null
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/release', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const cutoff = dayjs().subtract('48', 'hours').unix()
    const types = [
      constants.transactions.ROSTER_ADD,
      constants.transactions.ROSTER_RELEASE,
      constants.transactions.PRACTICE_ADD
    ]
    const transactions = await db('transactions')
      .where({
        lid: leagueId
      })
      .whereIn('type', types)
      .where('timestamp', '>', cutoff)
      .orderBy('timestamp', 'desc')
      .orderBy('uid', 'desc')

    res.send(transactions)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /api/leagues/{leagueId}/transactions/teams/{tid}/players/{pid}:
 *   get:
 *     summary: Get player transaction history for a team
 *     description: |
 *       Retrieves complete transaction history for a specific player on a specific team,
 *       including transactions since the player became a free agent and since the team
 *       acquired the player.
 *
 *       **Key Features:**
 *       - Shows complete player transaction timeline
 *       - Separates transactions since free agency vs. team acquisition
 *       - Useful for contract and roster management analysis
 *       - Tracks player value and cost history
 *
 *       **Fantasy Football Context:**
 *       - Helps evaluate player acquisition costs and history
 *       - Shows transaction patterns and team investment
 *       - Useful for trade analysis and player valuation
 *       - Tracks roster moves and player development
 *
 *       **Transaction Categories:**
 *       - **Since Free Agent**: All transactions since player last became FA
 *       - **Since Acquisition**: Transactions since current team acquired player
 *
 *       **Use Cases:**
 *       - Player valuation and cost analysis
 *       - Trade negotiation research
 *       - Roster management history
 *       - Contract and salary cap analysis
 *     tags:
 *       - Leagues
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *       - name: tid
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         description: Team ID
 *         example: 13
 *       - name: pid
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Player ID
 *         example: "4017"
 *     responses:
 *       200:
 *         description: Player transaction history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TransactionPlayerHistory'
 *             examples:
 *               player_history:
 *                 summary: Player transaction history for team
 *                 value:
 *                   sinceFA:
 *                     - uid: 12340
 *                       tid: 13
 *                       lid: 2
 *                       pid: "4017"
 *                       type: 4
 *                       userid: 5
 *                       value: 12
 *                       week: 5
 *                       year: 2024
 *                       timestamp: 1698600000
 *                       pick: null
 *                       pick_str: null
 *                   sinceAcquisition:
 *                     - uid: 12340
 *                       tid: 13
 *                       lid: 2
 *                       pid: "4017"
 *                       type: 4
 *                       userid: 5
 *                       value: 12
 *                       week: 5
 *                       year: 2024
 *                       timestamp: 1698600000
 *                       pick: null
 *                       pick_str: null
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/teams/:tid/players/:pid', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { pid, leagueId, tid } = req.params
    const sinceFA = await getTransactionsSinceFreeAgent({ lid: leagueId, pid })
    const sinceAcquisition = await getTransactionsSinceAcquisition({
      lid: leagueId,
      pid,
      tid
    })
    res.send({
      sinceFA,
      sinceAcquisition
    })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
