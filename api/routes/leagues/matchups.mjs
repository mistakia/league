import express from 'express'

import { current_season } from '#constants'
import { getLeague, generateSchedule } from '#libs-server'

const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * components:
 *   schemas:
 *     Matchup:
 *       type: object
 *       description: Fantasy league matchup between two teams
 *       properties:
 *         uid:
 *           type: integer
 *           description: Matchup ID
 *           example: 1234
 *         lid:
 *           type: integer
 *           description: League ID
 *           example: 2
 *         year:
 *           type: integer
 *           description: Season year
 *           example: 2024
 *         week:
 *           type: integer
 *           description: NFL week number
 *           example: 8
 *         hid:
 *           type: integer
 *           description: Home team ID
 *           example: 13
 *         aid:
 *           type: integer
 *           description: Away team ID
 *           example: 14
 *         week_type:
 *           type: string
 *           description: Type of week (REG, POST)
 *           example: "REG"
 *
 *     PlayoffMatchup:
 *       type: object
 *       description: Fantasy league playoff matchup
 *       properties:
 *         uid:
 *           type: integer
 *           description: Playoff matchup ID
 *           example: 5678
 *         lid:
 *           type: integer
 *           description: League ID
 *           example: 2
 *         year:
 *           type: integer
 *           description: Season year
 *           example: 2024
 *         week:
 *           type: integer
 *           description: Playoff week number
 *           example: 15
 *         round:
 *           type: integer
 *           description: Playoff round (1=Wild Card, 2=Divisional, 3=Championship)
 *           example: 1
 *         seed1:
 *           type: integer
 *           description: Higher seed team ID
 *           example: 13
 *         seed2:
 *           type: integer
 *           description: Lower seed team ID
 *           example: 16
 *         winner:
 *           type: integer
 *           nullable: true
 *           description: Winning team ID (null if not completed)
 *           example: null
 *
 *     MatchupsResponse:
 *       type: object
 *       properties:
 *         matchups:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Matchup'
 *           description: Regular season matchups
 *         playoffs:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PlayoffMatchup'
 *           description: Playoff matchups
 *
 *     GenerateScheduleResponse:
 *       type: object
 *       description: Generated schedule data
 *       properties:
 *         matchups:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Matchup'
 *           description: Generated regular season matchups
 *         message:
 *           type: string
 *           description: Success message
 *           example: "Schedule generated successfully"
 */

/**
 * @swagger
 * /leagues/{leagueId}/matchups:
 *   post:
 *     summary: Generate league schedule (Commissioner only)
 *     description: |
 *       Generates a complete schedule for the fantasy league including regular season
 *       matchups and playoff structure. This is a commissioner-only function used
 *       to create or regenerate the league's game schedule.
 *
 *       **Key Features:**
 *       - Commissioner-only schedule generation
 *       - Creates balanced regular season schedule
 *       - Sets up playoff bracket structure
 *       - Handles league-specific settings and formats
 *       - Overwrites existing schedule if present
 *
 *       **Fantasy Football Context:**
 *       - Typically done before season starts or when adding teams
 *       - Creates head-to-head matchups for each week
 *       - Ensures fair scheduling across all teams
 *       - Sets up playoff seeding and bracket format
 *
 *       **Schedule Generation:**
 *       - **Regular Season**: Creates balanced H2H matchups
 *       - **Playoff Structure**: Sets up elimination bracket
 *       - **Bye Weeks**: Handles odd number of teams
 *       - **Divisional Play**: Respects division settings if configured
 *
 *       **Commissioner Requirements:**
 *       - Must be authenticated as league commissioner
 *       - Full authority over league schedule management
 *       - Responsibility for fair and balanced scheduling
 *
 *       **⚠️ Warning:**
 *       - This will overwrite any existing schedule
 *       - Should be used carefully during active seasons
 *       - May affect ongoing playoff calculations
 *
 *       **Automatic Features:**
 *       - Balances home/away games for each team
 *       - Avoids repeat matchups when possible
 *       - Creates appropriate playoff bracket size
 *       - Handles league format requirements
 *     tags:
 *       - Fantasy Leagues
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Schedule generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GenerateScheduleResponse'
 *             examples:
 *               schedule_generated:
 *                 summary: Successfully generated schedule
 *                 value:
 *                   matchups:
 *                     - uid: 1234
 *                       lid: 2
 *                       year: 2024
 *                       week: 1
 *                       hid: 13
 *                       aid: 14
 *                       week_type: "REG"
 *                     - uid: 1235
 *                       lid: 2
 *                       year: 2024
 *                       week: 1
 *                       hid: 15
 *                       aid: 16
 *                       week_type: "REG"
 *                   message: "Schedule generated successfully"
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
 *                   error: user is not commish
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { leagueId } = req.params

    const league = await getLeague({ lid: leagueId })
    if (league.commishid !== req.auth.userId) {
      return res.status(401).send({ error: 'user is not commish' })
    }

    const data = await generateSchedule({ leagueId })
    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/matchups:
 *   get:
 *     summary: Get fantasy league schedule and matchups
 *     description: |
 *       Retrieves the complete schedule for a fantasy league including regular season
 *       matchups and playoff bracket information.
 *
 *       **Key Features:**
 *       - Returns complete season schedule
 *       - Includes both regular season and playoff matchups
 *       - Ordered chronologically by week
 *       - Supports historical season data
 *
 *       **Fantasy Football Context:**
 *       - Shows all head-to-head matchups for the season
 *       - Includes playoff bracket and seeding
 *       - Helps teams plan for upcoming games
 *       - Provides historical schedule reference
 *
 *       **Schedule Information:**
 *       - **Regular Season**: Weekly H2H matchups between teams
 *       - **Playoffs**: Elimination bracket with seeding
 *       - **Week Types**: Regular (REG) vs Playoff (POST) games
 *       - **Home/Away**: Team designations for each matchup
 *
 *       **Playoff Structure:**
 *       - **Rounds**: Wild Card, Divisional, Championship
 *       - **Seeding**: Higher vs lower seeds
 *       - **Winners**: Track playoff advancement
 *       - **Bracket**: Complete elimination structure
 *
 *       **Use Cases:**
 *       - Planning weekly lineups and strategy
 *       - Viewing remaining schedule strength
 *       - Checking playoff scenarios and seeding
 *       - Historical season analysis
 *
 *       **Year Parameter:**
 *       - Defaults to current season if not specified
 *       - Can retrieve historical schedules
 *       - Useful for comparing season formats
 *     tags:
 *       - Fantasy Leagues
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *       - name: year
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2030
 *           default: 2024
 *         description: |
 *           Season year to retrieve schedule for.
 *           Defaults to current season if not specified.
 *         example: 2024
 *     responses:
 *       200:
 *         description: League schedule retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MatchupsResponse'
 *             examples:
 *               season_schedule:
 *                 summary: Complete season schedule with playoffs
 *                 value:
 *                   matchups:
 *                     - uid: 1234
 *                       lid: 2
 *                       year: 2024
 *                       week: 1
 *                       hid: 13
 *                       aid: 14
 *                       week_type: "REG"
 *                     - uid: 1235
 *                       lid: 2
 *                       year: 2024
 *                       week: 2
 *                       hid: 15
 *                       aid: 16
 *                       week_type: "REG"
 *                   playoffs:
 *                     - uid: 5678
 *                       lid: 2
 *                       year: 2024
 *                       week: 15
 *                       round: 1
 *                       seed1: 13
 *                       seed2: 16
 *                       winner: null
 *                     - uid: 5679
 *                       lid: 2
 *                       year: 2024
 *                       week: 15
 *                       round: 1
 *                       seed1: 14
 *                       seed2: 15
 *                       winner: null
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const { year = current_season.year } = req.query

    const matchups = await db('matchups')
      .where({ lid: leagueId, year })
      .orderBy('week', 'asc')

    const playoffs = await db('playoffs').where({ lid: leagueId, year })

    res.send({ matchups, playoffs })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

export default router
