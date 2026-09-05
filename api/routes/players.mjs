import express from 'express'
import cron from 'node-cron'

import cache from '#api/cache.mjs'
import {
  getPlayers,
  getRestrictedFreeAgencyBids,
  getLeague,
  redis_cache
} from '#libs-server'
import attach_format_gamelog_columns from '#libs-server/attach-format-gamelog-columns.mjs'
import {
  get_player_content_feed_items,
  NFL_CONTENT_TAG_URIS
} from '#libs-server/content-feed-client.mjs'

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
 *                     example: "PATR-MAHO-005785"
 *                   - type: array
 *                     items:
 *                       type: string
 *                     description: Array of player IDs
 *                     example: ["PATR-MAHO-005785", "JOSH-ALLE-000098"]
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
 *                       bid_amount:
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
 *                         example: ["JORD-LOVE-001990"]
 *             examples:
 *               search_results:
 *                 summary: Search results for "Mahomes"
 *                 value:
 *                   - pid: "PATR-MAHO-005785"
 *                     first_name: "Patrick"
 *                     last_name: "Mahomes"
 *                     short_name: "P.Mahomes"
 *                     formatted_name: "patrick mahomes"
 *                     primary_position: "QB"
 *                     current_nfl_team: "KC"
 *                     height_inches: 75
 *                     weight_pounds: 230
 *                     jersey_number: 15
 *                     nfl_draft_year: 2017
 *                     draft_round: 1
 *                     college: "Texas Tech"
 *                     roster_status: "ACTIVE"
 *                     game_designation: null
 *                     bid_amount: 200
 *                     restricted_free_agency_conditional_releases: []
 *               specific_player:
 *                 summary: Specific player by ID
 *                 value:
 *                   - pid: "JOSH-ALLE-000098"
 *                     first_name: "Josh"
 *                     last_name: "Allen"
 *                     short_name: "J.Allen"
 *                     formatted_name: "josh allen"
 *                     primary_position: "QB"
 *                     current_nfl_team: "BUF"
 *                     height_inches: 77
 *                     weight_pounds: 237
 *                     jersey_number: 17
 *                     nfl_draft_year: 2018
 *                     draft_round: 1
 *                     college: "Wyoming"
 *                     roster_status: "ACTIVE"
 *                     game_designation: null
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
        const bid_map = new Map(bids.map((b) => [b.pid, b.bid_amount]))
        const releases_map = new Map(
          bids.map((b) => [
            b.pid,
            b.restricted_free_agency_conditional_releases || []
          ])
        )
        players = players.map((p) => ({
          ...p,
          bid_amount: bid_map.get(p.pid),
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
 *           $ref: '#/components/schemas/PlayerId'
 *         description: |
 *           Player ID in the format: FFFF-LLLL-NNNNNN
 *           - FFFF: Up to the first 4 letters of the first name (a frozen snapshot, never recomputed)
 *           - LLLL: Up to the first 4 letters of the last name (likewise)
 *           - NNNNNN: Immutable zero-padded serial -- this is the identity
 *
 *           A team defense (DST) is identified by its bare nfl team abbreviation, e.g. `NE`.
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
 *                   pid: "PATR-MAHO-005785"
 *                   first_name: "Patrick"
 *                   last_name: "Mahomes"
 *                   short_name: "P.Mahomes"
 *                   formatted_name: "patrick mahomes"
 *                   primary_position: "QB"
 *                   secondary_position: "QB"
 *                   tertiary_position: null
 *                   height_inches: 75
 *                   weight_pounds: 230
 *                   current_nfl_team: "KC"
 *                   jersey_number: 15
 *                   nfl_draft_year: 2017
 *                   draft_round: 1
 *                   college: "Texas Tech"
 *                   roster_status: "ACTIVE"
 *                   game_designation: null
 *                   date_of_birth: "1995-09-17"
 *               running_back:
 *                 summary: NFL Running Back example
 *                 value:
 *                   pid: "CHRI-MCCA-005372"
 *                   first_name: "Christian"
 *                   last_name: "McCaffrey"
 *                   short_name: "C.McCaffrey"
 *                   formatted_name: "christian mccaffrey"
 *                   primary_position: "RB"
 *                   secondary_position: "RB"
 *                   tertiary_position: null
 *                   height_inches: 71
 *                   weight_pounds: 205
 *                   current_nfl_team: "SF"
 *                   jersey_number: 23
 *                   nfl_draft_year: 2017
 *                   draft_round: 1
 *                   college: "Stanford"
 *                   roster_status: "ACTIVE"
 *                   game_designation: null
 *                   date_of_birth: "1996-06-07"
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
 *           $ref: '#/components/schemas/PlayerId'
 *         description: |
 *           Player ID in the format: FFFF-LLLL-NNNNNN
 *           - FFFF: Up to the first 4 letters of the first name (a frozen snapshot, never recomputed)
 *           - LLLL: Up to the first 4 letters of the last name (likewise)
 *           - NNNNNN: Immutable zero-padded serial -- this is the identity
 *
 *           A team defense (DST) is identified by its bare nfl team abbreviation, e.g. `NE`.
 *     responses:
 *       200:
 *         description: Practice reports successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PracticeReport'
 *             examples:
 *               limited_participation:
 *                 summary: Player limited in practice, questionable for the game
 *                 value:
 *                   - pid: "ROBB-OUZT-003883"
 *                     week: 23
 *                     season_year: 2025
 *                     season_type: "PRO"
 *                     nfl_week_id: "2025_PRO_WEEK_23"
 *                     injury_type: "Neck"
 *                     monday_practice_status: null
 *                     tuesday_practice_status: null
 *                     wednesday_practice_status: "LP"
 *                     thursday_practice_status: "LP"
 *                     friday_practice_status: "LP"
 *                     saturday_practice_status: null
 *                     sunday_practice_status: null
 *                     practice_status: null
 *                     roster_status: "INACTIVE"
 *                     game_designation: "QUESTIONABLE"
 *                     source_status: "Inactive"
 *                     source: "rotowire"
 *               full_participation:
 *                 summary: Player practicing fully, no designation
 *                 value:
 *                   - pid: "ERIC-SAUB-008033"
 *                     week: 23
 *                     season_year: 2025
 *                     season_type: "PRO"
 *                     nfl_week_id: "2025_PRO_WEEK_23"
 *                     injury_type: ""
 *                     monday_practice_status: null
 *                     tuesday_practice_status: null
 *                     wednesday_practice_status: "FP"
 *                     thursday_practice_status: "FP"
 *                     friday_practice_status: "FP"
 *                     saturday_practice_status: null
 *                     sunday_practice_status: null
 *                     practice_status: null
 *                     roster_status: null
 *                     game_designation: null
 *                     source_status: ""
 *                     source: "rotowire"
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
 *           $ref: '#/components/schemas/PlayerId'
 *         description: |
 *           Player ID in the format: FFFF-LLLL-NNNNNN
 *           - FFFF: Up to the first 4 letters of the first name (a frozen snapshot, never recomputed)
 *           - LLLL: Up to the first 4 letters of the last name (likewise)
 *           - NNNNNN: Immutable zero-padded serial -- this is the identity
 *
 *           A team defense (DST) is identified by its bare nfl team abbreviation, e.g. `NE`.
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
 *                   - pid: "PATR-MAHO-005785"
 *                     esbid: "2024011401"
 *                     points: 24.5
 *                     position_rank: 3
 *                     points_added_earned: 8.2
 *                     points_added_net: 6.8
 *                     day: "Sunday"
 *                     date: "2024-01-14"
 *                     week: 18
 *                     season_type: "REG"
 *                     timestamp: "2024-01-14T18:00:00Z"
 *                     season_year: 2024
 *                     snaps: 65
 *               quarterback_detailed:
 *                 summary: QB game log with passing and rushing stats
 *                 value:
 *                   - pid: "PATR-MAHO-005785"
 *                     esbid: "2024011401"
 *                     points: 24.5
 *                     position_rank: 3
 *                     points_added_earned: 8.2
 *                     points_added_net: 6.8
 *                     day: "Sunday"
 *                     date: "2024-01-14"
 *                     week: 18
 *                     season_type: "REG"
 *                     timestamp: "2024-01-14T18:00:00Z"
 *                     season_year: 2024
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
 *                   - pid: "CHRI-MCCA-005372"
 *                     esbid: "2024011401"
 *                     points: 18.7
 *                     position_rank: 5
 *                     points_added_earned: 6.1
 *                     points_added_net: 4.4
 *                     day: "Sunday"
 *                     date: "2024-01-14"
 *                     week: 18
 *                     season_type: "REG"
 *                     timestamp: "2024-01-14T18:00:00Z"
 *                     season_year: 2024
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

    attach_format_gamelog_columns({ query, league })

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
      'nfl_games.season_type',
      'nfl_games.kickoff_at'
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
 *           $ref: '#/components/schemas/PlayerId'
 *         description: |
 *           Player ID in the format: FFFF-LLLL-NNNNNN
 *           - FFFF: Up to the first 4 letters of the first name (a frozen snapshot, never recomputed)
 *           - LLLL: Up to the first 4 letters of the last name (likewise)
 *           - NNNNNN: Immutable zero-padded serial -- this is the identity
 *
 *           A team defense (DST) is identified by its bare nfl team abbreviation, e.g. `NE`.
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
 *                       is_market_settled:
 *                         type: boolean
 *                         description: >-
 *                           Whether the market has been settled, read from the market's
 *                           CLOSE observation when it has one. A market is returned once,
 *                           with its OPEN and CLOSE selections together, so time_type is a
 *                           property of each selection rather than of the market.
 *                         example: false
 *                       metric_result_value:
 *                         type: number
 *                         nullable: true
 *                         description: Actual result value (if market is settled)
 *                         example: 267.5
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
 *                                   enum: ["OPEN", "WON", "LOST", "PUSH", "CANCELLED", "CASHED_OUT", null]
 *                                   description: Selection result (if market is settled)
 *                                   example: "WON"
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
 *                     esbid: 2024011401
 *                     source_event_id: "ev_67890"
 *                     source_event_name: "Kansas City Chiefs @ Buffalo Bills"
 *                     is_open: true
 *                     is_live: false
 *                     is_market_settled: false
 *                     metric_result_value: null
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
 *                     esbid: 2024010701
 *                     source_event_id: "ev_98765"
 *                     source_event_name: "San Francisco 49ers @ Green Bay Packers"
 *                     is_open: false
 *                     is_live: false
 *                     is_market_settled: true
 *                     metric_result_value: 98.0
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
 *                         result: "WON"
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
 *                         result: "LOST"
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
router.get('/:pid/seasonlogs/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { pid } = req.params
    const league_id = Number(req.query.leagueId || 0) || 0

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    const league = await getLeague({ lid: league_id })

    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    const query = db('player_seasonlogs')
      .where('player_seasonlogs.pid', pid)
      .where('player_seasonlogs.season_type', 'REG')
      .leftJoin('scoring_format_player_seasonlogs', function () {
        this.on(
          'scoring_format_player_seasonlogs.pid',
          '=',
          'player_seasonlogs.pid'
        )
          .andOn(
            'scoring_format_player_seasonlogs.season_year',
            '=',
            'player_seasonlogs.season_year'
          )
          .andOn(
            'scoring_format_player_seasonlogs.scoring_format_id',
            '=',
            db.raw('?', [league.scoring_format_id])
          )
      })
      .leftJoin('league_format_player_seasonlogs', function () {
        this.on(
          'league_format_player_seasonlogs.pid',
          '=',
          'player_seasonlogs.pid'
        )
          .andOn(
            'league_format_player_seasonlogs.season_year',
            '=',
            'player_seasonlogs.season_year'
          )
          .andOn(
            'league_format_player_seasonlogs.league_format_id',
            '=',
            db.raw('?', [league.league_format_id])
          )
      })
      .select(
        'player_seasonlogs.*',
        'scoring_format_player_seasonlogs.points',
        'scoring_format_player_seasonlogs.points_per_game',
        'scoring_format_player_seasonlogs.games_played',
        'scoring_format_player_seasonlogs.points_rank',
        'scoring_format_player_seasonlogs.points_position_rank',
        'scoring_format_player_seasonlogs.points_per_game_rank',
        'scoring_format_player_seasonlogs.points_per_game_position_rank',
        'league_format_player_seasonlogs.points_added_earned',
        'league_format_player_seasonlogs.points_added_earned_per_game',
        'league_format_player_seasonlogs.points_added_earned_rank',
        'league_format_player_seasonlogs.points_added_earned_position_rank',
        'league_format_player_seasonlogs.points_added_earned_per_game_rank',
        'league_format_player_seasonlogs.points_added_earned_per_game_position_rank',
        'league_format_player_seasonlogs.points_added_net',
        'league_format_player_seasonlogs.points_added_net_per_game',
        'league_format_player_seasonlogs.startable_games',
        'league_format_player_seasonlogs.earned_salary'
      )
      .orderBy('player_seasonlogs.season_year', 'desc')

    const data = await query
    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

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
        'prop_market_selections_index.observed_at as selection_timestamp',
        'prop_market_selections_index.time_type as selection_time_type',
        'prop_market_selections_index.metric_result_value as selection_metric_result_value',
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
        'nfl_games.home_nfl_team',
        'nfl_games.away_nfl_team',
        'nfl_games.week',
        'nfl_games.date',
        'nfl_games.time_eastern'
      )
      .join('prop_market_selections_index', function () {
        this.on(
          'prop_markets_index.source_id',
          '=',
          'prop_market_selections_index.source_id'
        )
          .andOn(
            'prop_markets_index.source_market_id',
            '=',
            'prop_market_selections_index.source_market_id'
          )
          .andOn(
            'prop_markets_index.time_type',
            '=',
            'prop_market_selections_index.time_type'
          )
      })
      .leftJoin('nfl_games', 'prop_markets_index.esbid', 'nfl_games.esbid')
      .where('prop_market_selections_index.selection_pid', pid)
      // CLOSE first, so the market-level fields below come from the market's
      // final observation rather than from whichever row observed_at ranked
      // first. OPEN and CLOSE disagree on is_market_settled for 55,541 market
      // keys, and OPEN is the stale one in 99.4% of them.
      .orderByRaw("prop_markets_index.time_type = 'CLOSE' desc")
      .orderBy('prop_markets_index.observed_at', 'desc')

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
          is_open: row.is_open,
          is_live: row.is_live,
          is_market_settled: row.is_market_settled,
          timestamp: row.observed_at,
          year: row.season_year,
          week: row.week,
          event_date: row.date,
          event_time_est: row.time_eastern,
          home_team: row.home_nfl_team,
          away_team: row.away_nfl_team,
          selections: []
        }
      }

      acc[market_key].selections.push({
        source_selection_id: row.source_selection_id,
        selection_name: row.selection_name,
        selection_metric_line: row.selection_metric_line,
        selection_type: row.selection_type,
        selection_result: row.selection_result,
        metric_result_value: row.selection_metric_result_value,
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

// How many items reach the page. The upstream page is fetched larger than this
// because the source-type and title filters below both drop rows, and
// `source_type` is not part of the upstream filter vocabulary yet.
const CONTENT_FEED_RENDER_LIMIT = 10
const CONTENT_FEED_FETCH_LIMIT = 50

// base serves this route from ONE 60/min anonymous bucket shared by league's
// whole server, so the cache is a correctness control and not a speed tweak.
// The TTL is explicit at the write: `redis_cache.set` without one stores a
// value that never expires, which is how a months-old payload once went on
// being served as fresh.
const CONTENT_FEED_CACHE_TTL_SECONDS = 600

/**
 * @swagger
 * /players/{pid}/content:
 *   get:
 *     tags:
 *       - Players
 *     summary: Recent linked content for a player
 *     description: |
 *       Headlines that mention this player, proxied from the Base content feed and
 *       cached. Link-out metadata only — title, link, source domain and date. No
 *       article body is served, and nothing is stored by this service.
 *
 *       Returns an empty list when the integration is unconfigured or the upstream
 *       is unavailable. This surface is supplementary and its absence is a normal
 *       state, so it never fails the request.
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Recent content items mentioning the player
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title:
 *                         type: string
 *                       url:
 *                         type: string
 *                       domain:
 *                         type: string
 *                         nullable: true
 *                       published_at:
 *                         type: string
 *                         nullable: true
 */
router.get('/:pid/content/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { pid } = req.params
    const cache_key = `/players/${pid}/content`

    const cached_value = await redis_cache.get(cache_key)
    if (cached_value) {
      return res.send(cached_value)
    }

    const { items } = await get_player_content_feed_items({
      pid,
      tag_uris: NFL_CONTENT_TAG_URIS,
      limit: CONTENT_FEED_FETCH_LIMIT
    })

    const payload = {
      // Twitter items carry no title at all under the upstream's public
      // projection -- it withholds `summary` deliberately, because on Reddit
      // that column is byte-identical to the whole post body. So a non-Reddit
      // item has nothing renderable, and both filters below are load-bearing:
      // the first states the policy, the second states what can be drawn.
      items: items
        .filter((item) => item.source_type === 'reddit')
        .filter((item) => Boolean(item.title))
        .slice(0, CONTENT_FEED_RENDER_LIMIT)
        // `author` is deliberately dropped: it is the poster's Reddit username,
        // and nothing on the page renders it.
        .map(({ title, url, domain, published_at }) => ({
          title,
          url,
          domain,
          published_at
        }))
    }

    await redis_cache.set(cache_key, payload, CONTENT_FEED_CACHE_TTL_SECONDS)

    res.send(payload)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
