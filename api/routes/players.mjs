import express from 'express'
import cron from 'node-cron'

import cache from '#api/cache.mjs'
import {
  getPlayers,
  getRestrictedFreeAgencyBids,
  getLeague
} from '#libs-server'

const router = express.Router()

const league_ids = [0, 1]
const load_players = async () => {
  for (const league_id of league_ids) {
    const players = await getPlayers({
      leagueId: league_id,
      include_all_active_players: true
    })
    const cache_key = `/players/${league_id}`
    cache.set(cache_key, players, 1800) // 30 mins
  }
}

if (process.env.NODE_ENV !== 'test') {
  load_players()

  cron.schedule('*/5 * * * *', load_players)
}

/**
 * @swagger
 * /players:
 *   post:
 *     tags:
 *       - Players
 *     summary: Search and retrieve players
 *     description: |
 *       Search for NFL players with optional filters and league context.
 *       Returns detailed player information including fantasy football context when authenticated.
 *
 *       **Key Features:**
 *       - Text search by player name
 *       - Filter by specific player IDs
 *       - Fantasy League-specific scoring context
 *       - Fantasy football bidding information (when authenticated)
 *       - Cached results for performance
 *
 *       **Performance Notes:**
 *       - Results are cached for 30 minutes when no search/filter parameters are provided
 *       - Cache is league-specific (separate cache for each league)
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               q:
 *                 type: string
 *                 description: Search query for player names (case-insensitive)
 *                 example: "Patrick Mahomes"
 *                 minLength: 1
 *                 maxLength: 100
 *               leagueId:
 *                 type: integer
 *                 description: League ID for context-specific data (scoring format, roster info)
 *                 example: 1
 *                 minimum: 0
 *                 default: 0
 *               pids:
 *                 oneOf:
 *                   - type: string
 *                     description: Single player ID
 *                     example: "PATR-MAHO-2017-1995-09-17"
 *                   - type: array
 *                     items:
 *                       type: string
 *                     description: Array of player IDs
 *                     example: ["PATR-MAHO-2017-1995-09-17", "JOSH-ALLE-2018-1996-05-21"]
 *                     maxItems: 100
 *                 description: Player ID(s) to retrieve specific players
 *     responses:
 *       200:
 *         description: List of players matching search criteria
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/Player'
 *                   - type: object
 *                     properties:
 *                       bid:
 *                         type: number
 *                         nullable: true
 *                         description: User's current bid on player in restricted free agency (only present when authenticated and bidding is active)
 *                         example: 150
 *                       restricted_free_agency_conditional_releases:
 *                         type: array
 *                         items:
 *                           type: string
 *                         nullable: true
 *                         description: List of player IDs that would be released if this bid is successful (only present when authenticated)
 *                         example: ["JORD-LOVE-2020-1998-11-02"]
 *             examples:
 *               search_results:
 *                 summary: Search results for "Mahomes"
 *                 value:
 *                   - pid: "PATR-MAHO-2017-1995-09-17"
 *                     fname: "Patrick"
 *                     lname: "Mahomes"
 *                     pname: "P.Mahomes"
 *                     formatted: "patrick mahomes"
 *                     pos: "QB"
 *                     current_nfl_team: "KC"
 *                     height: 75
 *                     weight: 230
 *                     jnum: 15
 *                     nfl_draft_year: 2017
 *                     round: 1
 *                     col: "Texas Tech"
 *                     status: "Active"
 *                     nfl_status: "ACTIVE"
 *                     bid: 200
 *                     restricted_free_agency_conditional_releases: []
 *               specific_player:
 *                 summary: Specific player by ID
 *                 value:
 *                   - pid: "JOSH-ALLE-2018-1996-05-21"
 *                     fname: "Josh"
 *                     lname: "Allen"
 *                     pname: "J.Allen"
 *                     formatted: "josh allen"
 *                     pos: "QB"
 *                     current_nfl_team: "BUF"
 *                     height: 77
 *                     weight: 237
 *                     jnum: 17
 *                     nfl_draft_year: 2018
 *                     round: 1
 *                     col: "Wyoming"
 *                     status: "Active"
 *                     nfl_status: "ACTIVE"
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const search = req.body.q
    const { leagueId } = req.body
    const user_id = req.auth ? req.auth.userId : null
    const pids = Array.isArray(req.body.pids)
      ? req.body.pids
      : req.body.pids
        ? [req.body.pids]
        : []

    const cache_key = `/players/${leagueId || 0}`
    let players

    if (!search && !pids.length) {
      players = cache.get(cache_key)
      if (players) {
        logger('USING CACHE')
      }
    }

    if (!players) {
      players = await getPlayers({
        leagueId,
        pids,
        textSearch: search,
        include_all_active_players: !pids.length
      })

      if (!search && !pids.length) {
        cache.set(cache_key, players, 1800) // 30 mins
      }
    }

    if (user_id) {
      const bids = await getRestrictedFreeAgencyBids({
        userId: user_id,
        leagueId
      })
      if (bids.length) {
        const bid_map = new Map(bids.map((b) => [b.pid, b.bid]))
        const releases_map = new Map(
          bids.map((b) => [
            b.pid,
            b.restricted_free_agency_conditional_releases || []
          ])
        )
        players = players.map((p) => ({
          ...p,
          bid: bid_map.get(p.pid),
          restricted_free_agency_conditional_releases: releases_map.get(p.pid)
        }))
      }
    }

    res.send(players)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /players/{pid}:
 *   get:
 *     tags:
 *       - Players
 *     summary: Get individual player details
 *     description: |
 *       Retrieve detailed information for a specific NFL player by their player ID.
 *
 *       **Key Features:**
 *       - Basic player information (name, position, physical attributes)
 *       - NFL team and draft information
 *       - Current status and injury information
 *       - Cached results for performance (30 minutes)
 *
 *       **Future Enhancements:**
 *       This endpoint is planned to include additional detailed statistics such as:
 *       - Snaps per game by year
 *       - Redzone statistics by year
 *       - Injury history and statistics
 *       - Penalty statistics and yardage by year
 *       - Advanced charted statistics
 *       - Advanced rushing statistics (yardage by direction)
 *
 *       **Performance Notes:**
 *       - Results are cached for 30 minutes for improved response times
 *       - Cache key is based on player ID
 *     parameters:
 *       - name: pid
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[A-Z]{4}-[A-Z]{4}-[0-9]{4}-[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 *           example: "PATR-MAHO-2017-1995-09-17"
 *         description: |
 *           Player ID in the format: FFFF-LLLL-YYYY-YYYY-MM-DD
 *           - FFFF: First 4 characters of first name
 *           - LLLL: First 4 characters of last name
 *           - YYYY: Draft year
 *           - YYYY-MM-DD: Date of birth
 *     responses:
 *       200:
 *         description: Player details successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Player'
 *             examples:
 *               quarterback:
 *                 summary: NFL Quarterback example
 *                 value:
 *                   pid: "PATR-MAHO-2017-1995-09-17"
 *                   fname: "Patrick"
 *                   lname: "Mahomes"
 *                   pname: "P.Mahomes"
 *                   formatted: "patrick mahomes"
 *                   pos: "QB"
 *                   pos1: "QB"
 *                   pos2: null
 *                   height: 75
 *                   weight: 230
 *                   current_nfl_team: "KC"
 *                   jnum: 15
 *                   nfl_draft_year: 2017
 *                   round: 1
 *                   col: "Texas Tech"
 *                   status: "Active"
 *                   nfl_status: "ACTIVE"
 *                   injury_status: null
 *                   dob: "1995-09-17"
 *               running_back:
 *                 summary: NFL Running Back example
 *                 value:
 *                   pid: "CHRI-MCCA-2017-1996-06-07"
 *                   fname: "Christian"
 *                   lname: "McCaffrey"
 *                   pname: "C.McCaffrey"
 *                   formatted: "christian mccaffrey"
 *                   pos: "RB"
 *                   pos1: "RB"
 *                   pos2: null
 *                   height: 71
 *                   weight: 205
 *                   current_nfl_team: "SF"
 *                   jnum: 23
 *                   nfl_draft_year: 2017
 *                   round: 1
 *                   col: "Stanford"
 *                   status: "Active"
 *                   nfl_status: "ACTIVE"
 *                   injury_status: null
 *                   dob: "1996-06-07"
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       404:
 *         description: Player not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Player not found"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:pid', async (req, res) => {
  const { db, logger, cache } = req.app.locals
  try {
    const { pid } = req.params

    const cache_key = `/player/${pid}`
    const cached_player_row = cache.get(cache_key)
    if (cached_player_row) {
      return res.send(cached_player_row)
    }

    const player_rows = await db('player').where({ pid }).limit(1)
    const player_row = player_rows[0]

    // snaps per game by year

    // redzone stats by year

    // injury stats

    // penalties and yardage by year

    // advanced
    // - charted stats

    // advanced rushing
    // - yardage by direction

    cache.set(cache_key, player_row, 1800) // 30 mins
    res.send(player_row)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /players/{pid}/practices:
 *   get:
 *     tags:
 *       - Players
 *     summary: Get player practice reports
 *     description: |
 *       Retrieve practice participation data for a specific NFL player.
 *       This endpoint provides detailed information about a player's participation in team practices,
 *       which is valuable for injury management and availability assessment.
 *
 *       **Key Features:**
 *       - Complete practice participation history
 *       - Practice status indicators (full, limited, did not participate)
 *       - Injury-related practice limitations
 *       - Chronological practice data
 *
 *       **Use Cases:**
 *       - Injury status tracking
 *       - Weekly availability assessment
 *       - Historical participation patterns
 *       - Fantasy football decision support
 *
 *       **Data Sources:**
 *       - Official NFL injury reports
 *       - Team practice reports
 *       - Media reports and updates
 *     parameters:
 *       - name: pid
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[A-Z]{4}-[A-Z]{4}-[0-9]{4}-[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 *           example: "PATR-MAHO-2017-1995-09-17"
 *         description: |
 *           Player ID in the format: FFFF-LLLL-YYYY-YYYY-MM-DD
 *           - FFFF: First 4 characters of first name
 *           - LLLL: First 4 characters of last name
 *           - YYYY: Draft year
 *           - YYYY-MM-DD: Date of birth
 *     responses:
 *       200:
 *         description: Practice reports successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   pid:
 *                     type: string
 *                     description: Player ID
 *                     example: "PATR-MAHO-2017-1995-09-17"
 *                   date:
 *                     type: string
 *                     format: date
 *                     description: Practice date
 *                     example: "2024-01-15"
 *                   status:
 *                     type: string
 *                     enum: ["FULL", "LIMITED", "DNP", "OUT", "QUESTIONABLE", "DOUBTFUL"]
 *                     description: |
 *                       Practice participation status:
 *                       - FULL: Full participation
 *                       - LIMITED: Limited participation
 *                       - DNP: Did not participate
 *                       - OUT: Out (will not play)
 *                       - QUESTIONABLE: Questionable (game-time decision)
 *                       - DOUBTFUL: Doubtful (unlikely to play)
 *                     example: "FULL"
 *                   week:
 *                     type: integer
 *                     description: NFL week number
 *                     example: 18
 *                     minimum: 1
 *                     maximum: 18
 *                   year:
 *                     type: integer
 *                     description: Season year
 *                     example: 2024
 *                     minimum: 2020
 *                   seas_type:
 *                     $ref: '#/components/schemas/SeasonTypeEnum'
 *                   injury:
 *                     type: string
 *                     nullable: true
 *                     description: Injury description or body part
 *                     example: "Ankle"
 *                   source:
 *                     type: string
 *                     description: Source of the practice report
 *                     example: "NFL Injury Report"
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                     description: When the practice report was recorded
 *                     example: "2024-01-15T15:30:00Z"
 *                 required:
 *                   - pid
 *                   - date
 *                   - status
 *             examples:
 *               full_participation:
 *                 summary: Player with full practice participation
 *                 value:
 *                   - pid: "PATR-MAHO-2017-1995-09-17"
 *                     date: "2024-01-15"
 *                     status: "FULL"
 *                     week: 18
 *                     year: 2024
 *                     seas_type: "REG"
 *                     injury: null
 *                     source: "NFL Injury Report"
 *                     timestamp: "2024-01-15T15:30:00Z"
 *                   - pid: "PATR-MAHO-2017-1995-09-17"
 *                     date: "2024-01-16"
 *                     status: "FULL"
 *                     week: 18
 *                     year: 2024
 *                     seas_type: "REG"
 *                     injury: null
 *                     source: "NFL Injury Report"
 *                     timestamp: "2024-01-16T15:30:00Z"
 *               limited_participation:
 *                 summary: Player with limited practice participation due to injury
 *                 value:
 *                   - pid: "CHRI-MCCA-2017-1996-06-07"
 *                     date: "2024-01-15"
 *                     status: "LIMITED"
 *                     week: 18
 *                     year: 2024
 *                     seas_type: "REG"
 *                     injury: "Ankle"
 *                     source: "NFL Injury Report"
 *                     timestamp: "2024-01-15T15:30:00Z"
 *                   - pid: "CHRI-MCCA-2017-1996-06-07"
 *                     date: "2024-01-16"
 *                     status: "DNP"
 *                     week: 18
 *                     year: 2024
 *                     seas_type: "REG"
 *                     injury: "Ankle"
 *                     source: "NFL Injury Report"
 *                     timestamp: "2024-01-16T15:30:00Z"
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       404:
 *         description: Player not found or no practice data available
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "No practice data found for player"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:pid/practices/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { pid } = req.params
    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    const data = await db('practice').where({ pid })
    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /players/{pid}/gamelogs:
 *   get:
 *     tags:
 *       - Players
 *     summary: Get player game logs
 *     description: |
 *       Retrieve detailed game-by-game statistics for a specific NFL player.
 *       This endpoint provides comprehensive game performance data with optional position-specific statistics.
 *
 *       **Key Features:**
 *       - Complete game-by-game statistics
 *       - Fantasy points and position rankings
 *       - League-specific scoring context
 *       - Optional position-specific stats (rushing, passing, receiving)
 *       - Points added above baseline calculations
 *       - NFL game context information
 *
 *       **Scoring Context:**
 *       - Fantasy points calculated based on league scoring format
 *       - Position rankings for weekly performance
 *       - Points added above baseline (value over replacement)
 *
 *       **Statistical Categories:**
 *       - **Base**: All players get basic stats (snaps, targets, etc.)
 *       - **Rushing**: Rush attempts, yards, touchdowns, fumbles
 *       - **Passing**: Completions, attempts, yards, touchdowns, interceptions
 *       - **Receiving**: Receptions, targets, yards, touchdowns
 *
 *       **Use Cases:**
 *       - Fantasy football analysis
 *       - Player performance trends
 *       - Weekly game planning
 *       - Historical performance research
 *     parameters:
 *       - name: pid
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[A-Z]{4}-[A-Z]{4}-[0-9]{4}-[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 *           example: "PATR-MAHO-2017-1995-09-17"
 *         description: |
 *           Player ID in the format: FFFF-LLLL-YYYY-YYYY-MM-DD
 *           - FFFF: First 4 characters of first name
 *           - LLLL: First 4 characters of last name
 *           - YYYY: Draft year
 *           - YYYY-MM-DD: Date of birth
 *       - name: leagueId
 *         in: query
 *         schema:
 *           type: integer
 *           default: 0
 *           minimum: 0
 *         description: |
 *           Fantasy League ID for scoring format context. Different leagues may have different scoring systems.
 *           Use 0 for default scoring format.
 *         example: 1
 *       - name: rushing
 *         in: query
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include detailed rushing statistics (attempts, yards, touchdowns, fumbles)
 *         example: true
 *       - name: passing
 *         in: query
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include detailed passing statistics (completions, attempts, yards, touchdowns, interceptions)
 *         example: true
 *       - name: receiving
 *         in: query
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include detailed receiving statistics (receptions, targets, yards, touchdowns)
 *         example: true
 *     responses:
 *       200:
 *         description: Player game logs successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PlayerGameLog'
 *             examples:
 *               quarterback_basic:
 *                 summary: QB game log without position-specific stats
 *                 value:
 *                   - pid: "PATR-MAHO-2017-1995-09-17"
 *                     esbid: "2024011401"
 *                     points: 24.5
 *                     pos_rnk: 3
 *                     points_added: 8.2
 *                     day: "Sunday"
 *                     date: "2024-01-14"
 *                     week: 18
 *                     seas_type: "REG"
 *                     timestamp: "2024-01-14T18:00:00Z"
 *                     year: 2024
 *                     snaps: 65
 *               quarterback_detailed:
 *                 summary: QB game log with passing and rushing stats
 *                 value:
 *                   - pid: "PATR-MAHO-2017-1995-09-17"
 *                     esbid: "2024011401"
 *                     points: 24.5
 *                     pos_rnk: 3
 *                     points_added: 8.2
 *                     day: "Sunday"
 *                     date: "2024-01-14"
 *                     week: 18
 *                     seas_type: "REG"
 *                     timestamp: "2024-01-14T18:00:00Z"
 *                     year: 2024
 *                     snaps: 65
 *                     pa: 35
 *                     pc: 25
 *                     py: 295
 *                     tdp: 2
 *                     ints: 0
 *                     ra: 8
 *                     ry: 45
 *                     tdr: 1
 *                     fumbles_lost: 0
 *               running_back:
 *                 summary: RB game log with rushing and receiving stats
 *                 value:
 *                   - pid: "CHRI-MCCA-2017-1996-06-07"
 *                     esbid: "2024011401"
 *                     points: 18.7
 *                     pos_rnk: 5
 *                     points_added: 6.1
 *                     day: "Sunday"
 *                     date: "2024-01-14"
 *                     week: 18
 *                     seas_type: "REG"
 *                     timestamp: "2024-01-14T18:00:00Z"
 *                     year: 2024
 *                     snaps: 58
 *                     ra: 22
 *                     ry: 112
 *                     tdr: 1
 *                     fumbles_lost: 0
 *                     rec: 5
 *                     recy: 43
 *                     tdrec: 0
 *                     trg: 7
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       404:
 *         description: Player not found or no game logs available
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "No game logs found for player"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:pid/gamelogs/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { pid } = req.params
    const league_id = Number(req.query.leagueId || 0) || 0
    const include_rushing = req.query.rushing === 'true'
    const include_passing = req.query.passing === 'true'
    const include_receiving = req.query.receiving === 'true'

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    const query = db('player_gamelogs')
      .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
      .where('player_gamelogs.pid', pid)

    const league = await getLeague({ lid: league_id })

    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    query
      .leftJoin('scoring_format_player_gamelogs', function () {
        this.on(
          'scoring_format_player_gamelogs.pid',
          '=',
          'player_gamelogs.pid'
        ).andOn(
          'scoring_format_player_gamelogs.esbid',
          '=',
          'player_gamelogs.esbid'
        )
      })
      .leftJoin('league_format_player_gamelogs', function () {
        this.on(
          'league_format_player_gamelogs.pid',
          '=',
          'player_gamelogs.pid'
        ).andOn(
          'league_format_player_gamelogs.esbid',
          '=',
          'player_gamelogs.esbid'
        )
      })
      .select(
        'scoring_format_player_gamelogs.points',
        'scoring_format_player_gamelogs.pos_rnk',
        'league_format_player_gamelogs.points_added'
      )
      .where(function () {
        this.where(
          'scoring_format_player_gamelogs.scoring_format_hash',
          league.scoring_format_hash
        ).orWhereNull('scoring_format_player_gamelogs.scoring_format_hash')
      })
      .where(function () {
        this.where(
          'league_format_player_gamelogs.league_format_hash',
          league.league_format_hash
        ).orWhereNull('league_format_player_gamelogs.league_format_hash')
      })

    if (include_rushing) {
      query
        .leftJoin('player_rushing_gamelogs', function () {
          this.on(
            'player_rushing_gamelogs.pid',
            '=',
            'player_gamelogs.pid'
          ).andOn('player_rushing_gamelogs.esbid', '=', 'player_gamelogs.esbid')
        })
        .select('player_rushing_gamelogs.*')
    }

    if (include_passing) {
      query
        .leftJoin('player_passing_gamelogs', function () {
          this.on(
            'player_passing_gamelogs.pid',
            '=',
            'player_gamelogs.pid'
          ).andOn('player_passing_gamelogs.esbid', '=', 'player_gamelogs.esbid')
        })
        .select('player_passing_gamelogs.*')
    }

    if (include_receiving) {
      query
        .leftJoin('player_receiving_gamelogs', function () {
          this.on(
            'player_receiving_gamelogs.pid',
            '=',
            'player_gamelogs.pid'
          ).andOn(
            'player_receiving_gamelogs.esbid',
            '=',
            'player_gamelogs.esbid'
          )
        })
        .select('player_receiving_gamelogs.*')
    }

    // Add select for player_gamelogs and nfl_games last to override any left joins
    query.select(
      'player_gamelogs.*',
      'nfl_games.day',
      'nfl_games.date',
      'nfl_games.week',
      'nfl_games.seas_type',
      'nfl_games.timestamp'
    )

    const data = await query
    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /players/{pid}/markets:
 *   get:
 *     tags:
 *       - Players
 *       - Markets
 *     summary: Get player betting markets
 *     description: |
 *       Retrieve betting markets and props for a specific NFL player across multiple sportsbooks.
 *       This endpoint provides comprehensive betting market data including odds, lines, and statistical analysis.
 *
 *       **Key Features:**
 *       - Multi-sportsbook coverage (DraftKings, FanDuel, BetMGM, etc.)
 *       - Real-time odds and line movements
 *       - Statistical analysis and hit rates
 *       - Historical performance data
 *       - Market settlement information
 *       - Edge calculations and value indicators
 *
 *       **Market Types:**
 *       - **Game Props**: Single game performance (passing yards, rushing yards, etc.)
 *       - **Season Props**: Season-long totals and achievements
 *       - **Playoff Props**: Playoff-specific markets
 *       - **Award Props**: MVP, OPOY, and other awards
 *
 *       **Statistical Analysis:**
 *       - Hit rates for different time periods (current season, last 5 games, etc.)
 *       - Edge calculations based on historical performance
 *       - Value indicators for betting decisions
 *
 *       **Use Cases:**
 *       - Sports betting analysis
 *       - Market research and comparison
 *       - Historical performance tracking
 *       - Value betting identification
 *
 *       **Data Freshness:**
 *       - Markets are updated in real-time
 *       - Historical data available for analysis
 *       - Settled markets include results
 *     parameters:
 *       - name: pid
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[A-Z]{4}-[A-Z]{4}-[0-9]{4}-[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 *           example: "PATR-MAHO-2017-1995-09-17"
 *         description: |
 *           Player ID in the format: FFFF-LLLL-YYYY-YYYY-MM-DD
 *           - FFFF: First 4 characters of first name
 *           - LLLL: First 4 characters of last name
 *           - YYYY: Draft year
 *           - YYYY-MM-DD: Date of birth
 *     responses:
 *       200:
 *         description: Player betting markets successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/BettingMarket'
 *                   - type: object
 *                     properties:
 *                       source_market_id:
 *                         type: string
 *                         description: Unique market identifier from sportsbook
 *                         example: "mk_12345"
 *                       source_event_id:
 *                         type: string
 *                         description: Event identifier from sportsbook
 *                         example: "ev_67890"
 *                       source_event_name:
 *                         type: string
 *                         description: Event name from sportsbook
 *                         example: "Kansas City Chiefs @ Buffalo Bills"
 *                       market_settled:
 *                         type: boolean
 *                         description: Whether the market has been settled
 *                         example: false
 *                       metric_result_value:
 *                         type: number
 *                         nullable: true
 *                         description: Actual result value (if market is settled)
 *                         example: 267.5
 *                       time_type:
 *                         $ref: '#/components/schemas/TimeTypeEnum'
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                         description: When the market data was last updated
 *                         example: "2024-01-14T15:30:00Z"
 *                       year:
 *                         type: integer
 *                         description: Season year
 *                         example: 2024
 *                         minimum: 2020
 *                       week:
 *                         type: integer
 *                         description: NFL week number
 *                         example: 18
 *                         minimum: 1
 *                         maximum: 18
 *                       event_date:
 *                         type: string
 *                         format: date
 *                         description: Game date
 *                         example: "2024-01-14"
 *                       event_time_est:
 *                         type: string
 *                         description: Game time in Eastern Time
 *                         example: "1:00 PM"
 *                       home_team:
 *                         type: string
 *                         maxLength: 3
 *                         description: Home team abbreviation
 *                         example: "BUF"
 *                       away_team:
 *                         type: string
 *                         maxLength: 3
 *                         description: Away team abbreviation
 *                         example: "KC"
 *                       selections:
 *                         type: array
 *                         items:
 *                           allOf:
 *                             - $ref: '#/components/schemas/BettingMarketSelection'
 *                             - type: object
 *                               properties:
 *                                 source_selection_id:
 *                                   type: string
 *                                   description: Unique selection identifier from sportsbook
 *                                   example: "sel_11111"
 *                                 selection_result:
 *                                   type: string
 *                                   nullable: true
 *                                   enum: ["WIN", "LOSE", "PUSH", null]
 *                                   description: Selection result (if market is settled)
 *                                   example: "WIN"
 *                                 timestamp:
 *                                   type: string
 *                                   format: date-time
 *                                   description: When the selection odds were last updated
 *                                   example: "2024-01-14T15:30:00Z"
 *                                 time_type:
 *                                   $ref: '#/components/schemas/TimeTypeEnum'
 *                                 # Extended hit rate and edge statistics
 *                                 last_five_hit_rate_hard:
 *                                   type: number
 *                                   nullable: true
 *                                   description: Hit rate over last 5 games
 *                                   example: 0.600
 *                                 last_five_edge_hard:
 *                                   type: number
 *                                   nullable: true
 *                                   description: Edge over last 5 games
 *                                   example: 0.025
 *                                 last_ten_hit_rate_hard:
 *                                   type: number
 *                                   nullable: true
 *                                   description: Hit rate over last 10 games
 *                                   example: 0.700
 *                                 last_ten_edge_hard:
 *                                   type: number
 *                                   nullable: true
 *                                   description: Edge over last 10 games
 *                                   example: 0.035
 *                                 last_season_hit_rate_hard:
 *                                   type: number
 *                                   nullable: true
 *                                   description: Hit rate for previous season
 *                                   example: 0.625
 *                                 last_season_edge_hard:
 *                                   type: number
 *                                   nullable: true
 *                                   description: Edge for previous season
 *                                   example: 0.030
 *                                 overall_hit_rate_hard:
 *                                   type: number
 *                                   nullable: true
 *                                   description: Overall historical hit rate
 *                                   example: 0.640
 *                                 overall_edge_hard:
 *                                   type: number
 *                                   nullable: true
 *                                   description: Overall historical edge
 *                                   example: 0.032
 *                         description: Available betting selections for this market
 *                 required:
 *                   - market_type
 *                   - source_id
 *                   - source_market_name
 *                   - selections
 *             examples:
 *               passing_yards_market:
 *                 summary: QB passing yards market with multiple sportsbooks
 *                 value:
 *                   - market_type: "GAME_PASSING_YARDS"
 *                     source_id: "DRAFTKINGS"
 *                     source_market_id: "mk_12345"
 *                     source_market_name: "Passing Props - Pass Yards O/U - Patrick Mahomes Passing Yards O/U"
 *                     esbid: "2024011401"
 *                     source_event_id: "ev_67890"
 *                     source_event_name: "Kansas City Chiefs @ Buffalo Bills"
 *                     open: true
 *                     live: false
 *                     market_settled: false
 *                     metric_result_value: null
 *                     time_type: "CLOSE"
 *                     timestamp: "2024-01-14T15:30:00Z"
 *                     year: 2024
 *                     week: 18
 *                     event_date: "2024-01-14"
 *                     event_time_est: "1:00 PM"
 *                     home_team: "BUF"
 *                     away_team: "KC"
 *                     selections:
 *                       - source_selection_id: "sel_11111"
 *                         selection_name: "Over"
 *                         selection_type: "OVER"
 *                         selection_metric_line: 267.5
 *                         odds_decimal: 1.909
 *                         odds_american: -110
 *                         current_season_hit_rate_hard: 0.652
 *                         current_season_edge_hard: 0.045
 *                         result: null
 *                         timestamp: "2024-01-14T15:30:00Z"
 *                         time_type: "CLOSE"
 *                       - source_selection_id: "sel_22222"
 *                         selection_name: "Under"
 *                         selection_type: "UNDER"
 *                         selection_metric_line: 267.5
 *                         odds_decimal: 1.909
 *                         odds_american: -110
 *                         current_season_hit_rate_hard: 0.348
 *                         current_season_edge_hard: -0.045
 *                         result: null
 *                         timestamp: "2024-01-14T15:30:00Z"
 *                         time_type: "CLOSE"
 *               settled_market:
 *                 summary: Settled rushing yards market with results
 *                 value:
 *                   - market_type: "GAME_RUSHING_YARDS"
 *                     source_id: "FANDUEL"
 *                     source_market_id: "mk_54321"
 *                     source_market_name: "Rushing Props - Christian McCaffrey Rushing Yards O/U"
 *                     esbid: "2024010701"
 *                     source_event_id: "ev_98765"
 *                     source_event_name: "San Francisco 49ers @ Green Bay Packers"
 *                     open: false
 *                     live: false
 *                     market_settled: true
 *                     metric_result_value: 98.0
 *                     time_type: "CLOSE"
 *                     timestamp: "2024-01-07T16:30:00Z"
 *                     year: 2024
 *                     week: 18
 *                     event_date: "2024-01-07"
 *                     event_time_est: "4:30 PM"
 *                     home_team: "GB"
 *                     away_team: "SF"
 *                     selections:
 *                       - source_selection_id: "sel_33333"
 *                         selection_name: "Over"
 *                         selection_type: "OVER"
 *                         selection_metric_line: 89.5
 *                         odds_decimal: 1.870
 *                         odds_american: -115
 *                         current_season_hit_rate_hard: 0.714
 *                         current_season_edge_hard: 0.055
 *                         result: "WIN"
 *                         timestamp: "2024-01-07T16:30:00Z"
 *                         time_type: "CLOSE"
 *                       - source_selection_id: "sel_44444"
 *                         selection_name: "Under"
 *                         selection_type: "UNDER"
 *                         selection_metric_line: 89.5
 *                         odds_decimal: 1.952
 *                         odds_american: -105
 *                         current_season_hit_rate_hard: 0.286
 *                         current_season_edge_hard: -0.055
 *                         result: "LOSE"
 *                         timestamp: "2024-01-07T16:30:00Z"
 *                         time_type: "CLOSE"
 *       404:
 *         description: Player not found or no betting markets available
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "No betting markets found for player"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:pid/markets/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { pid } = req.params

    // Query to get markets and selections for the player
    const markets_and_selections = await db('prop_markets_index')
      .select(
        'prop_markets_index.*',
        'prop_market_selections_index.source_selection_id',
        'prop_market_selections_index.selection_name',
        'prop_market_selections_index.selection_metric_line',
        'prop_market_selections_index.selection_type',
        'prop_market_selections_index.selection_result',
        'prop_market_selections_index.odds_decimal',
        'prop_market_selections_index.odds_american',
        'prop_market_selections_index.timestamp as selection_timestamp',
        'prop_market_selections_index.time_type as selection_time_type',
        'prop_market_selections_index.current_season_hit_rate_hard',
        'prop_market_selections_index.current_season_edge_hard',
        'prop_market_selections_index.last_five_hit_rate_hard',
        'prop_market_selections_index.last_five_edge_hard',
        'prop_market_selections_index.last_ten_hit_rate_hard',
        'prop_market_selections_index.last_ten_edge_hard',
        'prop_market_selections_index.last_season_hit_rate_hard',
        'prop_market_selections_index.last_season_edge_hard',
        'prop_market_selections_index.overall_hit_rate_hard',
        'prop_market_selections_index.overall_edge_hard',
        'nfl_games.h',
        'nfl_games.v',
        'nfl_games.week',
        'nfl_games.date',
        'nfl_games.time_est'
      )
      .join('prop_market_selections_index', function () {
        this.on(
          'prop_markets_index.source_id',
          '=',
          'prop_market_selections_index.source_id'
        ).andOn(
          'prop_markets_index.source_market_id',
          '=',
          'prop_market_selections_index.source_market_id'
        )
      })
      .leftJoin('nfl_games', 'prop_markets_index.esbid', 'nfl_games.esbid')
      .where('prop_market_selections_index.selection_pid', pid)
      .orderBy('prop_markets_index.timestamp', 'desc')

    // Group selections by market
    const grouped_markets = markets_and_selections.reduce((acc, row) => {
      const market_key = `${row.source_id}_${row.source_market_id}`
      if (!acc[market_key]) {
        acc[market_key] = {
          market_type: row.market_type,
          source_id: row.source_id,
          source_market_id: row.source_market_id,
          source_market_name: row.source_market_name,
          esbid: row.esbid,
          source_event_id: row.source_event_id,
          source_event_name: row.source_event_name,
          open: row.open,
          live: row.live,
          market_settled: row.market_settled,
          metric_result_value: row.metric_result_value,
          time_type: row.time_type,
          timestamp: row.timestamp,
          year: row.year,
          week: row.week,
          event_date: row.date,
          event_time_est: row.time_est,
          home_team: row.h,
          away_team: row.v,
          selections: []
        }
      }

      acc[market_key].selections.push({
        source_selection_id: row.source_selection_id,
        selection_name: row.selection_name,
        selection_metric_line: row.selection_metric_line,
        selection_type: row.selection_type,
        selection_result: row.selection_result,
        odds_decimal: row.odds_decimal,
        odds_american: row.odds_american,
        timestamp: row.selection_timestamp,
        time_type: row.selection_time_type,
        current_season_hit_rate_hard: row.current_season_hit_rate_hard,
        current_season_edge_hard: row.current_season_edge_hard,
        last_five_hit_rate_hard: row.last_five_hit_rate_hard,
        last_five_edge_hard: row.last_five_edge_hard,
        last_ten_hit_rate_hard: row.last_ten_hit_rate_hard,
        last_ten_edge_hard: row.last_ten_edge_hard,
        last_season_hit_rate_hard: row.last_season_hit_rate_hard,
        last_season_edge_hard: row.last_season_edge_hard,
        overall_hit_rate_hard: row.overall_hit_rate_hard,
        overall_edge_hard: row.overall_edge_hard
      })

      return acc
    }, {})

    const result = Object.values(grouped_markets)
    res.send(result)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
