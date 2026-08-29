import express from 'express'

import { current_season, external_data_sources } from '#constants'
import { get_player_projections, get_season_projections } from '#libs-server'
import { season_aggregate_key } from '#libs-shared/calculate-distributional-baselines.mjs'

const router = express.Router()

/**
 * @swagger
 * /projections:
 *   get:
 *     tags:
 *       - Projections
 *     summary: Get player projections
 *     description: |
 *       Retrieve current season average projections for all active players.
 *
 *       **Key Features:**
 *       - Returns system-wide average projections (source_id: 18)
 *       - Filters to current season and active players only
 *       - Cached for 4 hours for performance
 *
 *       **Data Sources:**
 *       - Fantasy Sharks, CBS, ESPN, NFL, PFF, 4For4, FantasyPros and others
 *       - System calculates average projections across all sources
 *     responses:
 *       200:
 *         description: List of player projections with system averages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Projection'
 *             examples:
 *               quarterback_projection:
 *                 summary: Quarterback season projection
 *                 value:
 *                   - pid: "PATR-MAHO-005785"
 *                     source_id: 18
 *                     week: "season"
 *                     season_year: 2024
 *                     pos: "QB"
 *                     passing_attempts: 525
 *                     passing_completions: 345
 *                     passing_yards: 4200
 *                     passing_interceptions: 8
 *                     passing_touchdowns: 32
 *                     rushing_attempts: 45
 *                     rushing_yards: 180
 *                     rushing_touchdowns: 4
 *                     pts: 285.6
 *               running_back_projection:
 *                 summary: Running back season projection
 *                 value:
 *                   - pid: "CHRI-MCCA-005372"
 *                     source_id: 18
 *                     week: "season"
 *                     season_year: 2024
 *                     pos: "RB"
 *                     rushing_attempts: 285
 *                     rushing_yards: 1350
 *                     rushing_touchdowns: 12
 *                     targets: 75
 *                     receptions: 58
 *                     receiving_yards: 425
 *                     receiving_touchdowns: 3
 *                     pts: 245.8
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/?', async (req, res) => {
  const { db, logger, cache } = req.app.locals
  try {
    // 12 hours
    /* res.set('Expires', dayjs().add('12', 'hour').toDate().toUTCString())
     * res.set('Cache-Control', 'public, max-age=43200')
     * res.set('Pragma', null)
     * res.set('Surrogate-Control', null)
     */
    let projections = cache.get('projections')
    const season_type = current_season.nfl_seas_type === 'POST' ? 'POST' : 'REG'
    if (!projections) {
      const weekly = await db('projections_index')
        .where('source_id', external_data_sources.AVERAGE)
        .where('season_year', current_season.year)
        .where('week', '>=', current_season.active_fantasy_week)
        .where('season_type', season_type)

      // The season row comes from its own table and carries no week. It is
      // appended under the named period key rather than a numeric one: the
      // payload's consumers read `season`, and the week floor above cannot
      // reach this query to amputate it.
      const season =
        season_type === 'REG'
          ? await db('season_projections_index')
              .where('source_id', external_data_sources.AVERAGE)
              .where('season_year', current_season.year)
          : []

      projections = [
        ...weekly,
        ...season.map((row) => ({ ...row, week: season_aggregate_key }))
      ]
      cache.set('projections', projections, 14400) // 4 hours
    }

    res.send(projections)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /projections/{pid}:
 *   get:
 *     tags:
 *       - Projections
 *     summary: Get projections for a specific player
 *     description: |
 *       Retrieve all available projections for a single player across all sources and time periods.
 *       This endpoint provides comprehensive projection data including:
 *
 *       **Projection Sources:**
 *       - Fantasy Sharks (1), CBS (2), ESPN (3), NFL (4), PFF (6)
 *       - 4For4 (16), FantasyPros (17), Average (18)
 *
 *       **Time Periods:**
 *       - Weekly projections (weeks 1-18)
 *       - The season-long total, under `week: "season"`
 *       - Regular season and playoff projections
 *
 *       **Data Includes:**
 *       - Historical projections from multiple seasons
 *       - Real-time updates during the season
 *     parameters:
 *       - name: pid
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Player ID in format FFFF-LLLL-NNNNNN (NNNNNN is an immutable serial; a team defense uses its bare nfl abbreviation, e.g. NE)
 *         example: "PATR-MAHO-005785"
 *     responses:
 *       200:
 *         description: All projections for the specified player
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Projection'
 *             example:
 *               - pid: "PATR-MAHO-005785"
 *                 source_id: 18
 *                 week: "season"
 *                 season_year: 2024
 *                 pos: "QB"
 *                 passing_attempts: 525
 *                 passing_completions: 345
 *                 passing_yards: 4200
 *                 passing_interceptions: 8
 *                 passing_touchdowns: 32
 *                 rushing_attempts: 45
 *                 rushing_yards: 180
 *                 rushing_touchdowns: 4
 *                 pts: 285.6
 *               - pid: "PATR-MAHO-005785"
 *                 source_id: 16
 *                 week: 1
 *                 season_year: 2024
 *                 season_type: "REG"
 *                 pos: "QB"
 *                 passing_attempts: 35
 *                 passing_completions: 23
 *                 passing_yards: 285
 *                 passing_interceptions: 0
 *                 passing_touchdowns: 2
 *                 rushing_attempts: 3
 *                 rushing_yards: 15
 *                 rushing_touchdowns: 0
 *                 pts: 20.5
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:pid/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { pid } = req.params
    const [weekly, season] = await Promise.all([
      get_player_projections({ pids: [pid], include_averages: true }),
      get_season_projections({ pids: [pid], include_averages: true })
    ])
    res.send([
      ...weekly,
      ...season.map((row) => ({ ...row, week: season_aggregate_key }))
    ])
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
