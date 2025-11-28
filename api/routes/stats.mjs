import express from 'express'

import { current_season, fantasy_positions } from '#constants'
import { getLeague } from '#libs-server'

const router = express.Router()

/**
 * @swagger
 * /stats/gamelogs/players:
 *   get:
 *     tags:
 *       - Stats
 *     summary: Get player game logs
 *     description: Retrieve game-by-game statistics for players with filtering options
 *     parameters:
 *       - name: leagueId
 *         in: query
 *         schema:
 *           type: integer
 *         description: League ID for scoring context
 *       - $ref: '#/components/parameters/year'
 *       - $ref: '#/components/parameters/week'
 *       - name: nfl_team
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by NFL team
 *         example: KC
 *       - name: opponent
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by opponent team
 *         example: BUF
 *       - name: position
 *         in: query
 *         schema:
 *           oneOf:
 *             - type: string
 *             - type: array
 *               items:
 *                 type: string
 *         description: Filter by position(s)
 *         example: QB
 *       - name: rushing
 *         in: query
 *         schema:
 *           type: boolean
 *         description: Include rushing statistics
 *       - name: passing
 *         in: query
 *         schema:
 *           type: boolean
 *         description: Include passing statistics
 *       - name: receiving
 *         in: query
 *         schema:
 *           type: boolean
 *         description: Include receiving statistics
 *     responses:
 *       200:
 *         description: Player game logs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PlayerGameLog'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/gamelogs/players', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.query
    const year = req.query.year || current_season.year
    const week = req.query.week ? Number(req.query.week) : null
    const nfl_team = req.query.nfl_team
    const opponent = req.query.opponent
    let position = req.query.position
    const include_rushing = req.query.rushing === 'true'
    const include_passing = req.query.passing === 'true'
    const include_receiving = req.query.receiving === 'true'

    if (!position) {
      position = fantasy_positions
    } else if (!Array.isArray(position)) {
      position = [position]
    }

    const query = db('player_gamelogs')
      .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
      .where('nfl_games.year', year)
      .where('nfl_games.seas_type', 'REG')
      .whereIn('player_gamelogs.pos', position)

    if (week) {
      query.where('nfl_games.week', week)
    }

    if (nfl_team) {
      query.where('player_gamelogs.tm', nfl_team)
    }

    if (opponent) {
      query.where('player_gamelogs.opp', opponent)
    }

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

    if (leagueId) {
      const league = await getLeague({ lid: leagueId })

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
    }

    // Add select for player_gamelogs and nfl_games last to override any left joins
    query.select(
      'player_gamelogs.*',
      'nfl_games.week',
      'nfl_games.day',
      'nfl_games.date',
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

export default router
