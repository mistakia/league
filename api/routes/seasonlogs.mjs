import express from 'express'

import { current_season } from '#constants'

const router = express.Router()

/**
 * @swagger
 * /seasonlogs/teams:
 *   get:
 *     tags:
 *       - Stats
 *     summary: Get NFL team season logs
 *     description: Retrieve season-long statistical logs for NFL teams, with optional league-specific scoring and ranking information.
 *     parameters:
 *       - $ref: '#/components/parameters/year'
 *       - name: leagueId
 *         in: query
 *         schema:
 *           type: integer
 *         description: League ID to include league-specific points and rankings
 *         example: 2
 *     responses:
 *       200:
 *         description: NFL team season logs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/NFLTeamSeasonLog'
 *             examples:
 *               team_season_logs:
 *                 summary: Sample team season logs
 *                 value:
 *                   - season_year: 2024
 *                     nfl_team: "KC"
 *                     stat_key: "points_scored"
 *                     stat_value: 345
 *                     points: 12.5
 *                     rank: 3
 *                   - season_year: 2024
 *                     nfl_team: "KC"
 *                     stat_key: "points_allowed"
 *                     stat_value: 210
 *                     points: 8.2
 *                     rank: 7
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/teams', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const year = req.query.year || current_season.year
    const { leagueId } = req.query

    const query = db('nfl_team_seasonlogs')
      .select('nfl_team_seasonlogs.*')
      .where('nfl_team_seasonlogs.season_year', year)

    if (leagueId) {
      query
        .select(
          'league_nfl_team_seasonlogs.points',
          'league_nfl_team_seasonlogs.rank'
        )
        .join('league_nfl_team_seasonlogs', function () {
          this.on(
            'nfl_team_seasonlogs.season_year',
            'league_nfl_team_seasonlogs.season_year'
          )
          this.andOn(
            'nfl_team_seasonlogs.stat_key',
            'league_nfl_team_seasonlogs.stat_key'
          )
          this.andOn(
            'nfl_team_seasonlogs.nfl_team',
            'league_nfl_team_seasonlogs.nfl_team'
          )
        })
        .where('league_nfl_team_seasonlogs.lid', leagueId)
    }

    const data = await query

    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
