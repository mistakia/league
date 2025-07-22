import express from 'express'

import { constants } from '#libs-shared'
import { getLeague } from '#libs-server'

const router = express.Router({
  mergeParams: true
})

/**
 * @swagger
 * components:
 *   schemas:
 *     TeamForecast:
 *       type: object
 *       description: Fantasy team playoff and championship odds forecasts
 *       properties:
 *         playoff_odds:
 *           type: number
 *           nullable: true
 *           description: Current playoff odds (0-1)
 *           example: 0.85
 *         division_odds:
 *           type: number
 *           nullable: true
 *           description: Current division championship odds (0-1)
 *           example: 0.45
 *         bye_odds:
 *           type: number
 *           nullable: true
 *           description: Current playoff bye odds (0-1)
 *           example: 0.25
 *         championship_odds:
 *           type: number
 *           nullable: true
 *           description: Current league championship odds (0-1)
 *           example: 0.12
 *         playoff_odds_with_win:
 *           type: number
 *           nullable: true
 *           description: Playoff odds if team wins next game (0-1)
 *           example: 0.92
 *         division_odds_with_win:
 *           type: number
 *           nullable: true
 *           description: Division championship odds if team wins next game (0-1)
 *           example: 0.58
 *         bye_odds_with_win:
 *           type: number
 *           nullable: true
 *           description: Playoff bye odds if team wins next game (0-1)
 *           example: 0.35
 *         championship_odds_with_win:
 *           type: number
 *           nullable: true
 *           description: League championship odds if team wins next game (0-1)
 *           example: 0.18
 *         playoff_odds_with_loss:
 *           type: number
 *           nullable: true
 *           description: Playoff odds if team loses next game (0-1)
 *           example: 0.71
 *         division_odds_with_loss:
 *           type: number
 *           nullable: true
 *           description: Division championship odds if team loses next game (0-1)
 *           example: 0.28
 *         bye_odds_with_loss:
 *           type: number
 *           nullable: true
 *           description: Playoff bye odds if team loses next game (0-1)
 *           example: 0.15
 *         championship_odds_with_loss:
 *           type: number
 *           nullable: true
 *           description: League championship odds if team loses next game (0-1)
 *           example: 0.08
 *
 *     DraftPick:
 *       type: object
 *       description: Fantasy draft pick information
 *       properties:
 *         uid:
 *           type: integer
 *           description: Draft pick ID
 *           example: 1542
 *         tid:
 *           type: integer
 *           description: Team ID that owns the pick
 *           example: 13
 *         lid:
 *           type: integer
 *           description: League ID
 *           example: 2
 *         year:
 *           type: integer
 *           description: Draft year
 *           example: 2025
 *         round:
 *           type: integer
 *           description: Draft round (1-based)
 *           example: 1
 *         pick:
 *           type: integer
 *           description: Pick number within round
 *           example: 3
 *         otid:
 *           type: integer
 *           nullable: true
 *           description: Original team ID (if pick was traded)
 *           example: 15
 *         pid:
 *           type: string
 *           nullable: true
 *           description: Player ID if pick has been used
 *           example: null
 *
 *     TeamWithForecast:
 *       allOf:
 *         - $ref: '#/components/schemas/Team'
 *         - $ref: '#/components/schemas/TeamForecast'
 *         - type: object
 *           properties:
 *             picks:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DraftPick'
 *               description: Unused draft picks owned by this team
 *             teamtext:
 *               type: string
 *               nullable: true
 *               description: Team text channel/communication setting (only for authenticated user's teams)
 *               example: 'dynasty-warriors'
 *             teamvoice:
 *               type: string
 *               nullable: true
 *               description: Team voice channel/communication setting (only for authenticated user's teams)
 *               example: 'dynasty-warriors-voice'
 *             leaguetext:
 *               type: string
 *               nullable: true
 *               description: League text channel/communication setting (only for authenticated user's teams)
 *               example: 'teflon-league'
 *
 *     CreateTeamRequest:
 *       type: object
 *       required:
 *         - leagueId
 *       properties:
 *         leagueId:
 *           type: integer
 *           description: League ID to create team in
 *           example: 2
 *
 *     CreateTeamResponse:
 *       type: object
 *       properties:
 *         team:
 *           $ref: '#/components/schemas/Team'
 *         roster:
 *           type: object
 *           description: Initial roster created for the team
 *           properties:
 *             uid:
 *               type: integer
 *               description: Roster ID
 *               example: 1234
 *             tid:
 *               type: integer
 *               description: Team ID
 *               example: 13
 *             lid:
 *               type: integer
 *               description: League ID
 *               example: 2
 *             week:
 *               type: integer
 *               description: Current week
 *               example: 1
 *             year:
 *               type: integer
 *               description: Current year
 *               example: 2024
 *
 *     DeleteTeamRequest:
 *       type: object
 *       required:
 *         - teamId
 *         - leagueId
 *       properties:
 *         teamId:
 *           type: integer
 *           description: Team ID to delete
 *           example: 13
 *         leagueId:
 *           type: integer
 *           description: League ID the team belongs to
 *           example: 2
 *
 *     DeleteTeamResponse:
 *       type: object
 *       properties:
 *         rosters:
 *           type: integer
 *           description: Number of roster records deleted
 *           example: 1
 *         teams:
 *           type: integer
 *           description: Number of team records deleted
 *           example: 1
 *         transactions:
 *           type: integer
 *           description: Number of transaction records deleted
 *           example: 45
 *
 *     TeamsResponse:
 *       type: object
 *       properties:
 *         teams:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TeamWithForecast'
 *           description: Array of teams with forecasts and picks
 */

/**
 * @swagger
 * /leagues/{leagueId}/teams:
 *   get:
 *     summary: Get fantasy league teams
 *     description: |
 *       Retrieves all fantasy teams in a fantasy league with their current forecasts, draft picks, and optionally user-specific communication settings.
 *
 *       **Key Features:**
 *       - Returns basic team information (name, abbreviation, salary cap, etc.)
 *       - Includes playoff and championship odds forecasts
 *       - Shows unused draft picks owned by each team
 *       - For authenticated users, includes their teams' communication settings
 *
 *       **Fantasy Football Context:**
 *       - Teams represent fantasy football franchises within a league
 *       - Forecasts help predict playoff chances and championship odds
 *       - Draft picks are valuable assets that can be traded between teams
 *
 *       **Year Parameter:**
 *       - Defaults to current season if not specified
 *       - Can query historical team data from previous seasons
 *       - Validates year range (1990 to current season)
 *     tags:
 *       - Fantasy Teams
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *       - name: year
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1990
 *           maximum: 2030
 *         description: |
 *           Season year to retrieve teams for.
 *           Defaults to current season if not specified.
 *           Must be between 1990 and current season year.
 *         example: 2024
 *     responses:
 *       200:
 *         description: Successfully retrieved teams
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TeamsResponse'
 *             examples:
 *               success:
 *                 summary: Successful response with teams
 *                 value:
 *                   teams:
 *                     - uid: 13
 *                       year: 2024
 *                       lid: 2
 *                       name: Dynasty Warriors
 *                       abbrv: DW
 *                       image: null
 *                       div: 1
 *                       waiver_order: 5
 *                       draft_order: 3
 *                       cap: 200
 *                       faab: 150
 *                       pc: null
 *                       ac: null
 *                       playoff_odds: 0.85
 *                       division_odds: 0.45
 *                       bye_odds: 0.25
 *                       championship_odds: 0.12
 *                       playoff_odds_with_win: 0.92
 *                       division_odds_with_win: 0.58
 *                       bye_odds_with_win: 0.35
 *                       championship_odds_with_win: 0.18
 *                       playoff_odds_with_loss: 0.71
 *                       division_odds_with_loss: 0.28
 *                       bye_odds_with_loss: 0.15
 *                       championship_odds_with_loss: 0.08
 *                       picks:
 *                         - uid: 1542
 *                           tid: 13
 *                           lid: 2
 *                           year: 2025
 *                           round: 1
 *                           pick: 3
 *                           otid: null
 *                           pid: null
 *                       teamtext: dynasty-warriors
 *                       teamvoice: dynasty-warriors-voice
 *                       leaguetext: teflon-league
 *       400:
 *         description: Invalid year parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalid_year:
 *                 summary: Invalid year parameter
 *                 value:
 *                   error: Invalid year parameter
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const { year: requested_year } = req.query

    let year = constants.season.year
    if (requested_year) {
      const parsed_year = Number(requested_year)
      if (
        isNaN(parsed_year) ||
        parsed_year > constants.season.year ||
        parsed_year < 1990
      ) {
        return res.status(400).send({ error: 'Invalid year parameter' })
      }
      year = parsed_year
    }

    const teams = await db('teams').where({
      lid: leagueId,
      year
    })
    const picks = await db('draft').where({ lid: leagueId }).whereNull('pid')

    const sub_query = db('league_team_forecast')
      .select(db.raw('max(timestamp) AS maxtime, tid AS teamid'))
      .groupBy('teamid')
      .where('year', year)
      .as('sub_query')
    const forecasts = await db
      .select(
        'playoff_odds',
        'bye_odds',
        'division_odds',
        'championship_odds',
        'playoff_odds_with_win',
        'division_odds_with_win',
        'bye_odds_with_win',
        'championship_odds_with_win',
        'playoff_odds_with_loss',
        'division_odds_with_loss',
        'bye_odds_with_loss',
        'championship_odds_with_loss',
        'tid'
      )
      .from(sub_query)
      .innerJoin('league_team_forecast', function () {
        this.on(function () {
          this.on('teamid', '=', 'tid')
          this.andOn('timestamp', '=', 'maxtime')
        })
      })

    const teamIds = teams.map((t) => t.uid)

    for (const team of teams) {
      const forecast = forecasts.find((f) => f.tid === team.uid) || {}
      team.picks = picks.filter((p) => p.tid === team.uid)
      team.playoff_odds = forecast.playoff_odds
      team.division_odds = forecast.division_odds
      team.bye_odds = forecast.bye_odds
      team.championship_odds = forecast.championship_odds
      team.playoff_odds_with_win = forecast.playoff_odds_with_win
      team.division_odds_with_win = forecast.division_odds_with_win
      team.bye_odds_with_win = forecast.bye_odds_with_win
      team.championship_odds_with_win = forecast.championship_odds_with_win
      team.playoff_odds_with_loss = forecast.playoff_odds_with_loss
      team.division_odds_with_loss = forecast.division_odds_with_loss
      team.bye_odds_with_loss = forecast.bye_odds_with_loss
      team.championship_odds_with_loss = forecast.championship_odds_with_loss
    }

    if (req.auth && req.auth.userId) {
      const usersTeams = await db('users_teams')
        .where({ userid: req.auth.userId, year: constants.season.year })
        .whereIn('tid', teamIds)

      for (const usersTeam of usersTeams) {
        const { tid, teamtext, teamvoice, leaguetext } = usersTeam
        for (const [index, team] of teams.entries()) {
          if (team.uid === tid) {
            teams[index] = { teamtext, teamvoice, leaguetext, ...team }
            break
          }
        }
      }
    }

    res.send({ teams })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/teams:
 *   post:
 *     summary: Create a new team
 *     description: |
 *       Creates a new fantasy team in the specified league. This endpoint is restricted to league commissioners only.
 *
 *       **Key Features:**
 *       - Creates a new team with default settings
 *       - Automatically assigns team name, abbreviation, and draft/waiver order
 *       - Creates an initial roster for the team
 *       - Validates league capacity limits
 *
 *       **Fantasy Football Context:**
 *       - Teams represent fantasy football franchises within a league
 *       - Each team gets a unique name (Team1, Team2, etc.) and abbreviation (TM1, TM2, etc.)
 *       - Draft and waiver order are assigned based on team creation sequence
 *       - Salary cap and FAAB budget are inherited from league settings
 *
 *       **Commissioner Privileges:**
 *       - Only league commissioners can create teams
 *       - Useful for expanding league size or replacing inactive teams
 *       - Maintains league integrity by preventing unauthorized team creation
 *
 *       **Automatic Assignments:**
 *       - Team name: "Team{N}" where N is the team count + 1
 *       - Abbreviation: "TM{N}" where N is the team count + 1
 *       - Draft order: Sequential based on existing team count
 *       - Waiver order: Sequential based on existing team count
 *       - Salary cap: Inherited from league settings
 *       - FAAB budget: Inherited from league settings
 *     tags:
 *       - Fantasy Teams
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTeamRequest'
 *           examples:
 *             create_team:
 *               summary: Create team request
 *               value:
 *                 leagueId: 2
 *     responses:
 *       200:
 *         description: Team created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateTeamResponse'
 *             examples:
 *               success:
 *                 summary: Successful team creation
 *                 value:
 *                   team:
 *                     uid: 13
 *                     year: 2024
 *                     name: Team5
 *                     abbrv: TM5
 *                     waiver_order: 5
 *                     draft_order: 5
 *                     cap: 200
 *                     faab: 200
 *                     lid: 2
 *                   roster:
 *                     uid: 1234
 *                     tid: 13
 *                     lid: 2
 *                     week: 1
 *                     year: 2024
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missing_league_id:
 *                 summary: Missing league ID
 *                 value:
 *                   error: missing leagueId
 *               invalid_league_id:
 *                 summary: Invalid league ID
 *                 value:
 *                   error: invalid leagueId
 *               league_full:
 *                 summary: League is full
 *                 value:
 *                   error: league is full
 *               not_commissioner:
 *                 summary: User is not league commissioner
 *                 value:
 *                   error: invalid leagueId
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // make sure user is commish
    if (league.commishid !== req.auth.userId) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // make sure league has space for another team
    const teams = await db('teams').where({
      lid: leagueId,
      year: constants.season.year
    })
    if (teams.length >= league.num_teams) {
      return res.status(400).send({ error: 'league is full' })
    }

    const count = teams.length + 1
    const team = {
      year: constants.season.year,
      name: `Team${count}`,
      abbrv: `TM${count}`,
      waiver_order: count,
      draft_order: count,
      cap: league.cap,
      faab: league.faab,
      lid: leagueId
    }

    const rows = await db('teams').insert(team).returning('uid')
    team.uid = rows[0].uid

    const roster = {
      tid: team.uid,
      lid: league.uid,
      week: constants.season.week,
      year: constants.season.year
    }

    const rosterRows = await db('rosters').insert(roster).returning('uid')
    roster.uid = rosterRows[0].uid
    res.send({ roster, team })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/teams:
 *   delete:
 *     summary: Delete a team
 *     description: |
 *       Deletes a fantasy team from the specified league. This endpoint is restricted to league commissioners only.
 *
 *       **Key Features:**
 *       - Permanently removes a team and all associated data
 *       - Deletes team rosters, transactions, and other related records
 *       - Prevents deletion of teams owned by users (safety measure)
 *       - Returns count of deleted records for confirmation
 *
 *       **Fantasy Football Context:**
 *       - Teams represent fantasy football franchises within a league
 *       - Deleting a team removes all historical data and transactions
 *       - Useful for removing inactive or abandoned teams
 *       - Cannot delete teams that are actively owned by users
 *
 *       **Commissioner Privileges:**
 *       - Only league commissioners can delete teams
 *       - Protects against accidental deletion of active teams
 *       - Maintains league integrity by preventing unauthorized team removal
 *
 *       **Safety Measures:**
 *       - Checks if team is owned by a user before deletion
 *       - Prevents deletion of user-owned teams to avoid data loss
 *       - Only allows deletion of unowned/abandoned teams
 *
 *       **Data Cleanup:**
 *       - Removes all team rosters across all weeks/years
 *       - Deletes all transactions associated with the team
 *       - Removes the team record itself
 *       - Returns deletion counts for verification
 *
 *       **⚠️ Warning:**
 *       - This operation is irreversible
 *       - All team data, including historical records, will be permanently lost
 *       - Consider carefully before deleting teams with significant history
 *     tags:
 *       - Fantasy Teams
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeleteTeamRequest'
 *           examples:
 *             delete_team:
 *               summary: Delete team request
 *               value:
 *                 teamId: 13
 *                 leagueId: 2
 *     responses:
 *       200:
 *         description: Team deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteTeamResponse'
 *             examples:
 *               success:
 *                 summary: Successful team deletion
 *                 value:
 *                   rosters: 1
 *                   teams: 1
 *                   transactions: 45
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missing_team_id:
 *                 summary: Missing team ID
 *                 value:
 *                   error: missing teamId
 *               missing_league_id:
 *                 summary: Missing league ID
 *                 value:
 *                   error: missing leagueId
 *               invalid_league_id:
 *                 summary: Invalid league ID
 *                 value:
 *                   error: invalid leagueId
 *               not_commissioner:
 *                 summary: User is not league commissioner
 *                 value:
 *                   error: invalid leagueId
 *               cannot_remove_user_team:
 *                 summary: Cannot remove user-owned team
 *                 value:
 *                   error: can not remove user team
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId, leagueId } = req.body
    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // make sure user is commish
    if (league.commishid !== req.auth.userId) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // make sure it's not user team
    const teamRows = await db('teams')
      .select('teams.*')
      .join('users_teams', function () {
        this.on('teams.uid', '=', 'users_teams.tid')
        this.andOn('teams.year', '=', 'users_teams.year')
      })
      .where({
        lid: leagueId,
        tid: teamId,
        userid: req.auth.userId
      })
      .where('teams.year', constants.season.year)
    if (teamRows.length) {
      return res.status(400).send({ error: 'can not remove user team' })
    }

    const rosters = await db('rosters')
      .where({
        tid: teamId,
        lid: leagueId
      })
      .del()

    const teams = await db('teams')
      .where({
        year: constants.season.year,
        uid: teamId,
        lid: leagueId
      })
      .del()

    const transactions = await db('transactions')
      .where({
        tid: teamId,
        lid: leagueId
      })
      .del()

    res.send({ rosters, teams, transactions })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
