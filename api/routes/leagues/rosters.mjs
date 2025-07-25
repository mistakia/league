import express from 'express'

import { constants, Roster } from '#libs-shared'
import {
  getLeague,
  getRoster,
  get_laegue_rosters_from_database
} from '#libs-server'

const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * components:
 *   schemas:
 *     RosterPlayer:
 *       type: object
 *       description: Player on a team roster
 *       properties:
 *         rid:
 *           type: integer
 *           description: Roster ID
 *           example: 1234
 *         pid:
 *           type: string
 *           description: Player ID
 *           example: "4017"
 *         pos:
 *           type: string
 *           description: Player position
 *           example: "RB"
 *         slot:
 *           type: integer
 *           description: Roster slot type (constants.slots)
 *           example: 20
 *         extensions:
 *           type: integer
 *           description: Number of contract extensions
 *           example: 0
 *         tid:
 *           type: integer
 *           description: Team ID
 *           example: 13
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
 *           description: Week number
 *           example: 8
 *
 *     AddPlayerRequest:
 *       type: object
 *       required:
 *         - pid
 *         - teamId
 *         - leagueId
 *       properties:
 *         pid:
 *           type: string
 *           description: Player ID to add
 *           example: "4017"
 *         teamId:
 *           type: integer
 *           description: Team ID to add player to
 *           example: 13
 *         leagueId:
 *           type: integer
 *           description: League ID
 *           example: 2
 *         value:
 *           type: integer
 *           minimum: 0
 *           description: Player salary/value (default 0)
 *           example: 15
 *
 *     UpdatePlayerValueRequest:
 *       type: object
 *       required:
 *         - pid
 *         - teamId
 *         - leagueId
 *         - value
 *       properties:
 *         pid:
 *           type: string
 *           description: Player ID to update
 *           example: "4017"
 *         teamId:
 *           type: integer
 *           description: Team ID
 *           example: 13
 *         leagueId:
 *           type: integer
 *           description: League ID
 *           example: 2
 *         value:
 *           type: integer
 *           minimum: 0
 *           description: New player salary/value
 *           example: 18
 *
 *     RemovePlayerRequest:
 *       type: object
 *       required:
 *         - pid
 *         - teamId
 *         - leagueId
 *       properties:
 *         pid:
 *           type: string
 *           description: Player ID to remove
 *           example: "4017"
 *         teamId:
 *           type: integer
 *           description: Team ID to remove player from
 *           example: 13
 *         leagueId:
 *           type: integer
 *           description: League ID
 *           example: 2
 *
 *     AddPlayerResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/RosterPlayer'
 *         - type: object
 *           properties:
 *             transaction:
 *               $ref: '#/components/schemas/Transaction'
 *
 *     RemovePlayerResponse:
 *       type: object
 *       properties:
 *         roster:
 *           type: integer
 *           description: Number of roster records deleted
 *           example: 1
 *         transaction:
 *           type: integer
 *           description: Number of transaction records deleted
 *           example: 1
 */

/**
 * @swagger
 * /leagues/{leagueId}/rosters:
 *   get:
 *     summary: Get fantasy league rosters
 *     description: |
 *       Retrieves all team rosters for a fantasy league, including complete player
 *       information, roster slots, and salary details.
 *
 *       **Key Features:**
 *       - Returns all team rosters with complete player details
 *       - Includes salary cap and roster space information
 *       - Shows starting lineups and bench players
 *       - Optionally filtered by season year
 *
 *       **Fantasy Football Context:**
 *       - Each team has a roster of players across different positions
 *       - Players are assigned to specific slots (starter, bench, practice squad, etc.)
 *       - Salary cap management tracks team spending
 *       - Roster limits enforce league competitive balance
 *
 *       **Roster Information:**
 *       - **Active Roster**: Starting lineup and bench players
 *       - **Practice Squad**: Developmental players
 *       - **Injured Reserve**: Injured players with roster relief
 *       - **Salary Cap**: Team spending against league cap
 *       - **Extensions**: Contract extension tracking
 *
 *       **Authentication Benefits:**
 *       - Authenticated users see additional details for their teams
 *       - May include private roster information or management options
 *       - Enhanced data for team owners
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
 *         description: |
 *           Season year to retrieve rosters for.
 *           Defaults to current season if not specified.
 *         example: 2024
 *     responses:
 *       200:
 *         description: League rosters retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: Roster data organized by teams and players
 *             examples:
 *               league_rosters:
 *                 summary: Complete league roster data
 *                 value:
 *                   teams:
 *                     - uid: 13
 *                       name: "Dynasty Warriors"
 *                       cap: 200
 *                       players:
 *                         - rid: 1234
 *                           pid: "4017"
 *                           pos: "RB"
 *                           slot: 0
 *                           extensions: 0
 *                           tid: 13
 *                           lid: 2
 *                           year: 2024
 *                           week: 8
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const { year } = req.query
    const rosters = await get_laegue_rosters_from_database({
      lid: leagueId,
      userId: req.auth ? req.auth.userId : null,
      year
    })
    res.send(rosters)
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/rosters:
 *   post:
 *     summary: Add player to roster (Commissioner only)
 *     description: |
 *       Adds a player to a team's roster. This is a commissioner-only function
 *       for manual roster management and league administration.
 *
 *       **Key Features:**
 *       - Commissioner-only roster management
 *       - Validates roster space and salary cap
 *       - Creates transaction record
 *       - Adds player to bench slot
 *       - Enforces league roster limits
 *
 *       **Fantasy Football Context:**
 *       - Used for manual roster adjustments
 *       - Emergency roster fixes by commissioner
 *       - Adding players outside normal waiver/free agent process
 *       - Administrative roster management
 *
 *       **Validation Rules:**
 *       - **Commissioner Access**: Only league commissioner can add players
 *       - **Roster Space**: Team must have available roster spots
 *       - **Salary Cap**: Team must have sufficient cap space
 *       - **Player Validity**: Player must exist and be valid
 *       - **Value Limits**: Salary value must be non-negative integer
 *
 *       **Automatic Actions:**
 *       - Creates ROSTER_ADD transaction record
 *       - Adds player to team's bench slot
 *       - Updates team salary cap usage
 *       - Records timestamp and user for audit trail
 *
 *       **Roster Management:**
 *       - Players added to bench by default
 *       - Salary value configurable (default 0)
 *       - Respects league roster size limits
 *       - Enforces salary cap constraints
 *     tags:
 *       - Fantasy Leagues
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddPlayerRequest'
 *           examples:
 *             add_player:
 *               summary: Add player with salary
 *               value:
 *                 pid: "4017"
 *                 teamId: 13
 *                 leagueId: 2
 *                 value: 15
 *             add_free_player:
 *               summary: Add player with no salary
 *               value:
 *                 pid: "3892"
 *                 teamId: 13
 *                 leagueId: 2
 *                 value: 0
 *     responses:
 *       200:
 *         description: Player added to roster successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AddPlayerResponse'
 *             examples:
 *               player_added:
 *                 summary: Successfully added player
 *                 value:
 *                   rid: 1234
 *                   pid: "4017"
 *                   pos: "RB"
 *                   slot: 20
 *                   extensions: 0
 *                   tid: 13
 *                   lid: 2
 *                   year: 2024
 *                   week: 8
 *                   transaction:
 *                     uid: 12345
 *                     tid: 13
 *                     lid: 2
 *                     pid: "4017"
 *                     type: 1
 *                     userid: 5
 *                     value: 15
 *                     week: 8
 *                     year: 2024
 *                     timestamp: 1698765432
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missing_pid:
 *                 summary: Missing player ID
 *                 value:
 *                   error: missing pid
 *               missing_team_id:
 *                 summary: Missing team ID
 *                 value:
 *                   error: missing teamId
 *               missing_league_id:
 *                 summary: Missing league ID
 *                 value:
 *                   error: missing leagueId
 *               invalid_player:
 *                 summary: Invalid player
 *                 value:
 *                   error: invalid player
 *               invalid_league:
 *                 summary: Invalid league ID or not commissioner
 *                 value:
 *                   error: invalid leagueId
 *               invalid_value:
 *                 summary: Invalid salary value
 *                 value:
 *                   error: invalid value
 *               roster_full:
 *                 summary: Team roster is full
 *                 value:
 *                   error: exceeds roster limits
 *               cap_exceeded:
 *                 summary: Salary cap exceeded
 *                 value:
 *                   error: exceeds cap space
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { pid, teamId, leagueId } = req.body
    const value = req.body.value || 0

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    // verify player
    const player_rows = await db('player').where({ pid })
    const player_row = player_rows[0]
    if (!player_row) {
      return res.status(400).send({ error: 'invalid player' })
    }

    // verify leagueId
    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // verify user is commish
    if (league.commishid !== req.auth.userId) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // verify value
    if (
      typeof value !== 'undefined' &&
      (isNaN(value) || value < 0 || value % 1 !== 0)
    ) {
      return res.status(400).send({ error: 'invalid value' })
    }

    const rosterRow = await getRoster({ tid: teamId })
    const roster = new Roster({ roster: rosterRow, league })
    if (!roster.availableSpace) {
      return res.status(400).send({ error: 'exceeds roster limits' })
    }

    const val = parseInt(value, 10)
    if (roster.availableCap < val) {
      return res.status(400).send({ error: 'exceeds cap space' })
    }

    // create transactions
    const transaction = {
      userid: req.auth.userId,
      tid: teamId,
      lid: leagueId,
      pid,
      type: constants.transactions.ROSTER_ADD,
      value: val,
      week: constants.season.week,
      year: constants.season.year,
      timestamp: Math.round(Date.now() / 1000)
    }
    await db('transactions').insert(transaction)

    // add player to roster
    const rosterInsert = {
      rid: roster.uid,
      pid,
      pos: player_row.pos,
      slot: constants.slots.BENCH,
      extensions: 0,
      tid: teamId,
      lid: leagueId,
      year: constants.season.year,
      week: constants.season.week
    }
    await db('rosters_players').insert(rosterInsert)

    res.send({
      ...rosterInsert,
      transaction
    })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/rosters:
 *   put:
 *     summary: Update player salary value (Commissioner only)
 *     description: |
 *       Updates a player's salary value on a team's roster. This is a commissioner-only
 *       function for adjusting player contracts and salary cap management.
 *
 *       **Key Features:**
 *       - Commissioner-only salary management
 *       - Updates player transaction value
 *       - Validates salary cap constraints
 *       - Maintains transaction history
 *
 *       **Fantasy Football Context:**
 *       - Used for contract adjustments
 *       - Salary cap corrections by commissioner
 *       - Player value updates for trades or extensions
 *       - Administrative contract management
 *
 *       **Validation Rules:**
 *       - **Commissioner Access**: Only league commissioner can update values
 *       - **Salary Cap**: Updated value must fit within team's cap space
 *       - **Player Validity**: Player must exist and be on team roster
 *       - **Value Limits**: Salary value must be non-negative integer
 *
 *       **Automatic Actions:**
 *       - Updates all transaction records for the player on the team
 *       - Recalculates team salary cap usage
 *       - Maintains audit trail of value changes
 *
 *       **Cap Management:**
 *       - Temporarily removes player from cap calculation
 *       - Validates new value against available cap space
 *       - Updates all relevant transaction records
 *       - Ensures cap compliance after update
 *     tags:
 *       - Fantasy Leagues
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePlayerValueRequest'
 *           examples:
 *             update_salary:
 *               summary: Update player salary
 *               value:
 *                 pid: "4017"
 *                 teamId: 13
 *                 leagueId: 2
 *                 value: 18
 *             reduce_salary:
 *               summary: Reduce player salary
 *               value:
 *                 pid: "3892"
 *                 teamId: 13
 *                 leagueId: 2
 *                 value: 5
 *     responses:
 *       200:
 *         description: Player salary updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 value:
 *                   type: integer
 *                   description: Updated salary value
 *                   example: 18
 *             examples:
 *               value_updated:
 *                 summary: Successfully updated salary
 *                 value:
 *                   value: 18
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missing_value:
 *                 summary: Missing value parameter
 *                 value:
 *                   error: missing value
 *               missing_pid:
 *                 summary: Missing player ID
 *                 value:
 *                   error: missing pid
 *               missing_team_id:
 *                 summary: Missing team ID
 *                 value:
 *                   error: missing teamId
 *               missing_league_id:
 *                 summary: Missing league ID
 *                 value:
 *                   error: missing leagueId
 *               invalid_player:
 *                 summary: Invalid player
 *                 value:
 *                   error: invalid player
 *               invalid_league:
 *                 summary: Invalid league ID or not commissioner
 *                 value:
 *                   error: invalid leagueId
 *               invalid_value:
 *                 summary: Invalid salary value
 *                 value:
 *                   error: invalid value
 *               cap_exceeded:
 *                 summary: Salary cap exceeded
 *                 value:
 *                   error: exceeds cap space
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { pid, teamId, leagueId, value } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (typeof value === 'undefined') {
      return res.status(400).send({ error: 'missing value' })
    }

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    // verify player
    const player_rows = await db('player').where({ pid })
    const player_row = player_rows[0]
    if (!player_row) {
      return res.status(400).send({ error: 'invalid player' })
    }

    // verify leagueId
    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // verify user is commish
    if (league.commishid !== req.auth.userId) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // verify value
    if (
      typeof value !== 'undefined' &&
      (isNaN(value) || value < 0 || value % 1 !== 0)
    ) {
      return res.status(400).send({ error: 'invalid value' })
    }

    // verify team cap
    const rosterRow = await getRoster({ tid: teamId })
    const roster = new Roster({ roster: rosterRow, league })
    roster.removePlayer(pid)
    const val = parseInt(value, 10)
    if (roster.availableCap < val) {
      return res.status(400).send({ error: 'exceeds cap space' })
    }

    // update player value
    await db('transactions')
      .where({
        pid,
        tid: teamId,
        lid: leagueId
      })
      .update({
        value: val
      })

    res.send({ value: val })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/rosters:
 *   delete:
 *     summary: Remove player from roster (Commissioner only)
 *     description: |
 *       Removes a player from a team's roster and deletes all associated transaction
 *       records. This is a commissioner-only function for manual roster management.
 *
 *       **Key Features:**
 *       - Commissioner-only roster management
 *       - Complete removal of player and transaction history
 *       - Frees up roster space and salary cap
 *       - Permanent deletion of records
 *
 *       **Fantasy Football Context:**
 *       - Used for administrative roster corrections
 *       - Emergency player removal by commissioner
 *       - Fixing roster errors or league management issues
 *       - Complete cleanup of player records
 *
 *       **Validation Rules:**
 *       - **Commissioner Access**: Only league commissioner can remove players
 *       - **Player Validity**: Player must exist and be on team roster
 *       - **Roster Presence**: Player must be on the specified team's current roster
 *
 *       **Automatic Actions:**
 *       - Deletes all transaction records for player on team
 *       - Removes player from current roster
 *       - Frees up roster spot and salary cap space
 *       - Returns count of deleted records
 *
 *       **⚠️ Warning:**
 *       - This action is permanent and irreversible
 *       - All transaction history for the player on this team will be lost
 *       - Use with caution as it affects league record keeping
 *
 *       **Record Cleanup:**
 *       - Removes player from active roster
 *       - Deletes all associated transactions
 *       - Updates team salary cap calculations
 *       - Clears roster slot for new player
 *     tags:
 *       - Fantasy Leagues
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RemovePlayerRequest'
 *           examples:
 *             remove_player:
 *               summary: Remove player from roster
 *               value:
 *                 pid: "4017"
 *                 teamId: 13
 *                 leagueId: 2
 *     responses:
 *       200:
 *         description: Player removed from roster successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RemovePlayerResponse'
 *             examples:
 *               player_removed:
 *                 summary: Successfully removed player
 *                 value:
 *                   roster: 1
 *                   transaction: 3
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missing_pid:
 *                 summary: Missing player ID
 *                 value:
 *                   error: missing pid
 *               missing_team_id:
 *                 summary: Missing team ID
 *                 value:
 *                   error: missing teamId
 *               missing_league_id:
 *                 summary: Missing league ID
 *                 value:
 *                   error: missing leagueId
 *               invalid_player:
 *                 summary: Invalid player
 *                 value:
 *                   error: invalid player
 *               invalid_league:
 *                 summary: Invalid league ID or not commissioner
 *                 value:
 *                   error: invalid leagueId
 *               player_not_on_roster:
 *                 summary: Player not on team roster
 *                 value:
 *                   error: player not on roster
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    // verify user is commish
    const { pid, teamId, leagueId } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    // verify player
    const player_rows = await db('player').where({ pid })
    const player_row = player_rows[0]
    if (!player_row) {
      return res.status(400).send({ error: 'invalid player' })
    }

    // verify leagueId
    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // verify user is commish
    if (league.commishid !== req.auth.userId) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    const rosters = await db('rosters').where({
      tid: teamId,
      lid: leagueId,
      week: constants.season.week,
      year: constants.season.year
    })
    const roster = rosters[0]
    if (!roster) {
      return res.status(400).send({ error: 'player not on roster' })
    }

    const transaction = await db('transactions')
      .where({
        pid,
        tid: teamId,
        lid: leagueId
      })
      .del()

    const rosterRes = await db('rosters_players')
      .where({
        rid: roster.uid,
        pid
      })
      .del()

    res.send({ roster: rosterRes, transaction })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
