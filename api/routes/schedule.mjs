import express from 'express'
import dayjs from 'dayjs'

import { constants } from '#libs-shared'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     NFLGame:
 *       type: object
 *       properties:
 *         year:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2030
 *           description: Season year
 *           example: 2024
 *         week:
 *           type: integer
 *           minimum: 1
 *           maximum: 18
 *           description: Week number (regular season weeks 1-18)
 *           example: 1
 *         date:
 *           type: string
 *           format: date
 *           description: Game date in YYYY-MM-DD format
 *           example: "2024-09-08"
 *         time_est:
 *           type: string
 *           description: Game time in EST (24-hour format HH:MM)
 *           example: "13:00"
 *         v:
 *           type: string
 *           enum: ['ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LA', 'LAC', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS']
 *           description: Visiting team abbreviation (NFL team code)
 *           example: "ARI"
 *         h:
 *           type: string
 *           enum: ['ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LA', 'LAC', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS']
 *           description: Home team abbreviation (NFL team code)
 *           example: "BUF"
 *       required:
 *         - year
 *         - week
 *         - date
 *         - time_est
 *         - v
 *         - h
 *     NFLTeamSchedule:
 *       type: object
 *       properties:
 *         bye:
 *           type: integer
 *           nullable: true
 *           minimum: 1
 *           maximum: 18
 *           description: Bye week number for the team (null if no bye week found)
 *           example: 11
 *         games:
 *           type: array
 *           description: Array of all games for this team in the current season
 *           items:
 *             $ref: '#/components/schemas/NFLGame'
 *           example:
 *             - year: 2024
 *               week: 1
 *               date: "2024-09-08"
 *               time_est: "13:00"
 *               v: "ARI"
 *               h: "BUF"
 *             - year: 2024
 *               week: 2
 *               date: "2024-09-15"
 *               time_est: "16:25"
 *               v: "LAR"
 *               h: "ARI"
 *       required:
 *         - bye
 *         - games
 *     NFLScheduleResponse:
 *       type: object
 *       description: NFL schedule data organized by team abbreviation
 *       additionalProperties:
 *         $ref: '#/components/schemas/NFLTeamSchedule'
 *       example:
 *         ARI:
 *           bye: 11
 *           games:
 *             - year: 2024
 *               week: 1
 *               date: "2024-09-08"
 *               time_est: "13:00"
 *               v: "ARI"
 *               h: "BUF"
 *         KC:
 *           bye: 6
 *           games:
 *             - year: 2024
 *               week: 1
 *               date: "2024-09-05"
 *               time_est: "20:20"
 *               v: "BAL"
 *               h: "KC"
 *
 * /schedule:
 *   get:
 *     tags:
 *       - Schedule
 *     summary: Get current season NFL schedule
 *     description: |
 *       Retrieve the complete NFL regular season schedule organized by team.
 *       This endpoint returns all games for each NFL team in the current season,
 *       including bye week information. The response is cached for 24 hours.
 *
 *       **Key Features:**
 *       - Returns all regular season games (weeks 1-18)
 *       - Includes bye week calculation for each team
 *       - Data is organized by NFL team abbreviation
 *       - Each game includes visiting and home team information
 *       - Includes game date and time in EST
 *
 *       **Cache Information:**
 *       - Response is cached for 24 hours
 *       - Cache headers are set for public caching
 *       - Expires header set to 1 day from request time
 *     operationId: getNFLSchedule
 *     responses:
 *       200:
 *         description: Current season NFL schedule successfully retrieved
 *         headers:
 *           Cache-Control:
 *             description: Cache control header for public caching
 *             schema:
 *               type: string
 *               example: "public, max-age=86400"
 *           Expires:
 *             description: Expiration date for cached response
 *             schema:
 *               type: string
 *               format: date-time
 *               example: "Thu, 18 Jul 2025 12:00:00 GMT"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NFLScheduleResponse'
 *             examples:
 *               full_schedule:
 *                 summary: Sample NFL schedule for multiple teams
 *                 description: Example showing schedule data for Arizona Cardinals and Kansas City Chiefs
 *                 value:
 *                   ARI:
 *                     bye: 11
 *                     games:
 *                       - year: 2024
 *                         week: 1
 *                         date: "2024-09-08"
 *                         time_est: "13:00"
 *                         v: "ARI"
 *                         h: "BUF"
 *                       - year: 2024
 *                         week: 2
 *                         date: "2024-09-15"
 *                         time_est: "16:25"
 *                         v: "LAR"
 *                         h: "ARI"
 *                   KC:
 *                     bye: 6
 *                     games:
 *                       - year: 2024
 *                         week: 1
 *                         date: "2024-09-05"
 *                         time_est: "20:20"
 *                         v: "BAL"
 *                         h: "KC"
 *                       - year: 2024
 *                         week: 2
 *                         date: "2024-09-12"
 *                         time_est: "17:00"
 *                         v: "KC"
 *                         h: "CIN"
 *               bye_week_example:
 *                 summary: Team with bye week
 *                 description: Example showing how bye weeks are represented
 *                 value:
 *                   TB:
 *                     bye: 11
 *                     games:
 *                       - year: 2024
 *                         week: 1
 *                         date: "2024-09-08"
 *                         time_est: "13:00"
 *                         v: "TB"
 *                         h: "WAS"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    // one day
    res.set('Expires', dayjs().add('1', 'day').toDate().toUTCString())
    res.set('Cache-Control', 'public, max-age=86400') // one-day
    res.set('Pragma', null)
    res.set('Surrogate-Control', null)

    const teams = {}
    const games = await db('nfl_games')
      .select('year', 'week', 'date', 'time_est', 'v', 'h')
      .where('year', constants.season.year)
      .where('seas_type', 'REG')
      .orderBy('week', 'asc')

    for (const team of constants.nflTeams) {
      teams[team] = {
        bye: null,
        games: []
      }
    }

    const weeks = {}
    for (const game of games) {
      weeks[game.week] = true
      teams[game.v].games.push(game)
      teams[game.h].games.push(game)
    }

    const week_keys = Object.keys(weeks).map((x) => Number(x))

    for (const team of constants.nflTeams) {
      const team_weeks = teams[team].games.map((m) => m.week)
      const team_weeks_set = new Set(team_weeks)
      const result = week_keys.filter((x) => !team_weeks_set.has(x))
      teams[team].bye = result[0]
    }

    res.send(teams)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
