import express from 'express'

import { getLeague } from '#libs-server'

const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * components:
 *   schemas:
 *     DraftPickValue:
 *       type: object
 *       description: Draft pick value data based on league format
 *       properties:
 *         rank:
 *           type: integer
 *           description: Draft pick position/rank
 *           example: 12
 *         median_best_season_points_added_per_game:
 *           type: number
 *           format: float
 *           description: Median points added per game for the best season performance
 *           example: 8.5
 *         median_career_points_added_per_game:
 *           type: number
 *           format: float
 *           description: Median points added per game across career performance
 *           example: 6.2
 */

/**
 * @swagger
 * /api/leagues/{leagueId}/draft-pick-value:
 *   get:
 *     summary: Get draft pick values for league format
 *     description: |
 *       Retrieves draft pick value data based on the league's specific format.
 *       This data shows the expected fantasy points added per game for players
 *       selected at each draft position, helping evaluate draft pick trades.
 *
 *       **Key Features:**
 *       - Values specific to league's scoring and roster format
 *       - Historical performance data by draft position
 *       - Both best season and career averages
 *       - Useful for draft pick trade valuations
 *
 *       **Fantasy Football Context:**
 *       - Draft pick values vary significantly by league format
 *       - Different scoring systems affect player values
 *       - Roster requirements impact positional scarcity
 *       - Historical data helps predict future draft value
 *
 *       **Value Metrics:**
 *       - **Best Season**: Peak performance expectations
 *       - **Career Average**: Long-term value expectations
 *       - **Points Added**: Value above replacement level
 *       - **Per Game**: Normalized for playing time
 *
 *       **League Format Impact:**
 *       - Scoring system affects player valuations
 *       - Roster positions change positional scarcity
 *       - League size impacts available talent pool
 *       - Starting requirements drive demand curves
 *
 *       **Usage Examples:**
 *       - Evaluating draft pick trades
 *       - Setting draft strategy by position
 *       - Understanding positional value curves
 *       - Comparing current vs. future picks
 *     tags:
 *       - Leagues
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     responses:
 *       200:
 *         description: Draft pick values retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DraftPickValue'
 *             examples:
 *               draft_pick_values:
 *                 summary: Draft pick value data
 *                 value:
 *                   - rank: 1
 *                     median_best_season_points_added_per_game: 12.8
 *                     median_career_points_added_per_game: 9.4
 *                   - rank: 2
 *                     median_best_season_points_added_per_game: 11.2
 *                     median_career_points_added_per_game: 8.7
 *                   - rank: 12
 *                     median_best_season_points_added_per_game: 8.5
 *                     median_career_points_added_per_game: 6.2
 *       400:
 *         description: Invalid league ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalid_league:
 *                 summary: League not found
 *                 value:
 *                   error: "invalid leagueId"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

router.get('/?', async (req, res) => {
  const { logger, db } = req.app.locals
  try {
    const { leagueId } = req.params

    const league = await getLeague({ lid: leagueId })

    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    const data = await db('league_format_draft_pick_value')
      .select(
        'rank',
        'median_best_season_points_added_per_game',
        'median_career_points_added_per_game'
      )
      .where({ league_format_hash: league.league_format_hash })
    res.send(data)
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

export default router
