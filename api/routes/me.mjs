import express from 'express'
import bcrypt from 'bcrypt'

import { constants, groupBy } from '#libs-shared'
import { validators } from '#libs-server'

const router = express.Router()

/**
 * @swagger
 * /me:
 *   get:
 *     summary: Get current user profile
 *     description: Retrieves the complete profile for the authenticated user, including personal information, team memberships, leagues, pending waivers, poaches, and projection source preferences. This endpoint provides all the data needed to populate the user dashboard.
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   allOf:
 *                     - $ref: '#/components/schemas/User'
 *                     - type: object
 *                       properties:
 *                         lastvisit:
 *                           type: string
 *                           format: date-time
 *                           description: 'Last visit timestamp'
 *                         user_text_notifications:
 *                           type: boolean
 *                           description: 'User preference for text notifications'
 *                         user_voice_notifications:
 *                           type: boolean
 *                           description: 'User preference for voice notifications'
 *                         watchlist:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: 'List of player IDs on user watchlist'
 *                 teams:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Team'
 *                       - type: object
 *                         properties:
 *                           teamtext:
 *                             type: boolean
 *                             description: 'Team text notification preference'
 *                           teamvoice:
 *                             type: boolean
 *                             description: 'Team voice notification preference'
 *                           leaguetext:
 *                             type: boolean
 *                             description: 'League text notification preference'
 *                   description: 'Teams owned by the user in the current season'
 *                 leagues:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/League'
 *                       - type: object
 *                         properties:
 *                           years:
 *                             type: array
 *                             items:
 *                               type: integer
 *                             description: 'Years this league has been active'
 *                           division_1_name:
 *                             type: string
 *                             nullable: true
 *                             description: 'Name of division 1 (if applicable)'
 *                           division_2_name:
 *                             type: string
 *                             nullable: true
 *                             description: 'Name of division 2 (if applicable)'
 *                           division_3_name:
 *                             type: string
 *                             nullable: true
 *                             description: 'Name of division 3 (if applicable)'
 *                           division_4_name:
 *                             type: string
 *                             nullable: true
 *                             description: 'Name of division 4 (if applicable)'
 *                   description: 'Leagues the user participates in'
 *                 poaches:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       uid:
 *                         type: integer
 *                         description: 'Poach claim ID'
 *                       tid:
 *                         type: integer
 *                         description: 'Team ID making the poach'
 *                       lid:
 *                         type: integer
 *                         description: 'League ID'
 *                       pid:
 *                         type: string
 *                         description: 'Player ID being poached'
 *                       userid:
 *                         type: integer
 *                         description: 'User ID making the poach'
 *                       submitted:
 *                         type: integer
 *                         description: 'Unix timestamp when poach was submitted'
 *                       release:
 *                         type: array
 *                         items:
 *                           type: string
 *                         description: 'Array of player IDs to release'
 *                   description: 'Pending poach claims by user teams'
 *                 waivers:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/WaiverClaim'
 *                   description: 'Pending waiver claims by user teams'
 *                 sources:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/ProjectionSource'
 *                       - type: object
 *                         properties:
 *                           weight:
 *                             type: number
 *                             description: 'User-defined weight for this projection source'
 *                             default: 1
 *                   description: 'Available projection sources with user weights'
 *             examples:
 *               user_profile:
 *                 summary: Complete user profile
 *                 value:
 *                   user:
 *                     id: 123
 *                     username: 'fantasy_manager'
 *                     email: 'user@example.com'
 *                     lastvisit: '2024-01-15T10:30:00Z'
 *                     user_text_notifications: true
 *                     user_voice_notifications: false
 *                     watchlist: ['JALE-HURT-2020-1998-08-07', 'PATR-MAHO-2017-1995-09-17']
 *                   teams:
 *                     - uid: 13
 *                       name: 'Dynasty Warriors'
 *                       abbrv: 'DW'
 *                       lid: 2
 *                       year: 2024
 *                       teamtext: true
 *                       teamvoice: false
 *                       leaguetext: true
 *                   leagues:
 *                     - uid: 2
 *                       name: 'TEFLON LEAGUE'
 *                       num_teams: 14
 *                       years: [2020, 2021, 2022, 2023, 2024]
 *                       division_1_name: 'NFC North'
 *                       division_2_name: 'AFC South'
 *                   poaches: []
 *                   waivers: []
 *                   sources:
 *                     - uid: 16
 *                       name: '4for4'
 *                       weight: 1.2
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       400:
 *         description: User does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: 'user does not exist'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    if (!req.auth || !req.auth.userId) {
      return res.status(401).send({ error: 'missing auth token' })
    }

    const users = await db('users').where({ id: req.auth.userId })
    const user = users[0]
    if (!user) {
      return res.status(400).send({ error: 'user does not exist' })
    }
    delete user.password

    const teams = await db('teams')
      .select('teams.*')
      .select(
        'users_teams.teamtext',
        'users_teams.teamvoice',
        'users_teams.leaguetext'
      )
      .where({
        'users_teams.userid': req.auth.userId,
        'users_teams.year': constants.season.year
      })
      .join('users_teams', function () {
        this.on('users_teams.tid', '=', 'teams.uid')
        this.andOn('users_teams.year', '=', 'teams.year')
      })

    const leagueIds = teams.map((t) => t.lid)
    const teamIds = teams.map((t) => t.uid)
    const leagues = await db('leagues')
      .leftJoin('seasons', function () {
        this.on('leagues.uid', '=', 'seasons.lid')
        this.on(
          db.raw(
            `seasons.year = ${constants.season.year} or seasons.year is null`
          )
        )
      })
      .leftJoin(
        'league_formats',
        'seasons.league_format_hash',
        'league_formats.league_format_hash'
      )
      .leftJoin(
        'league_scoring_formats',
        'seasons.scoring_format_hash',
        'league_scoring_formats.scoring_format_hash'
      )
      .whereIn('leagues.uid', leagueIds)

    const seasons = await db('seasons').whereIn('lid', leagueIds)

    // Fetch divisions for all leagues
    const divisions = await db('league_divisions')
      .whereIn('lid', leagueIds)
      .andWhere('year', constants.season.year)

    const seasonsByLeagueId = groupBy(seasons, 'lid')
    const divisionsByLeagueId = groupBy(divisions, 'lid')

    for (const lid in seasonsByLeagueId) {
      const league = leagues.find((l) => l.uid === Number(lid))
      league.years = seasonsByLeagueId[lid].map((s) => s.year)

      // Add divisions to the league
      const leagueDivisions = divisionsByLeagueId[lid] || []
      leagueDivisions.forEach((div) => {
        league[`division_${div.division_id}_name`] = div.division_name
      })
    }

    const sources = await db('sources')
    const userSources = await db('users_sources').where(
      'userid',
      req.auth.userId
    )
    for (const source of sources) {
      const userSource = userSources.find((s) => s.sourceid === source.uid)
      source.weight = userSource ? userSource.weight : 1
    }

    const poaches = await db('poaches')
      .whereIn('lid', leagueIds)
      .whereNull('processed')
    const poachIds = poaches.map((p) => p.uid)
    const poachReleases = await db('poach_releases').whereIn(
      'poachid',
      poachIds
    )
    for (const poach of poaches) {
      poach.release = poachReleases
        .filter((p) => p.poachid === poach.uid)
        .map((p) => p.pid)
    }

    const waivers = await db('waivers')
      .whereIn('tid', teamIds)
      .whereNull('processed')
      .whereNull('cancelled')
    const waiverIds = waivers.map((p) => p.uid)
    const waiverReleases = await db('waiver_releases').whereIn(
      'waiverid',
      waiverIds
    )
    for (const waiver of waivers) {
      waiver.release = waiverReleases
        .filter((p) => p.waiverid === waiver.uid)
        .map((p) => p.pid)
    }

    res.send({
      user,
      teams,
      leagues,
      poaches,
      waivers,
      sources
    })

    await db('users')
      .where({ id: req.auth.userId })
      .update({ lastvisit: new Date() })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /me:
 *   put:
 *     summary: Update current user profile
 *     description: Updates specific fields of the authenticated user's profile. Supports updating email, password, username, watchlist, and notification preferences. Includes validation for email format, username requirements, and prevents duplicate usernames/emails.
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: ['email', 'password', 'watchlist', 'user_text_notifications', 'user_voice_notifications', 'username']
 *                 description: 'Type of field to update'
 *               value:
 *                 oneOf:
 *                   - type: string
 *                     description: 'New value for string fields (email, password, username)'
 *                   - type: boolean
 *                     description: 'New value for boolean fields (user_text_notifications, user_voice_notifications)'
 *                   - type: array
 *                     items:
 *                       type: string
 *                     description: 'New value for array fields (watchlist - array of player IDs)'
 *                 description: 'New value for the specified field'
 *             required:
 *               - type
 *               - value
 *           examples:
 *             update_email:
 *               summary: Update email address
 *               value:
 *                 type: 'email'
 *                 value: 'newemail@example.com'
 *             update_password:
 *               summary: Update password
 *               value:
 *                 type: 'password'
 *                 value: 'newSecurePassword123'
 *             update_username:
 *               summary: Update username
 *               value:
 *                 type: 'username'
 *                 value: 'new_username'
 *             update_watchlist:
 *               summary: Update player watchlist
 *               value:
 *                 type: 'watchlist'
 *                 value: ['JALE-HURT-2020-1998-08-07', 'PATR-MAHO-2017-1995-09-17', 'JOSH-ALLE-2018-1996-05-21']
 *             update_text_notifications:
 *               summary: Enable text notifications
 *               value:
 *                 type: 'user_text_notifications'
 *                 value: true
 *             update_voice_notifications:
 *               summary: Disable voice notifications
 *               value:
 *                 type: 'user_voice_notifications'
 *                 value: false
 *     responses:
 *       200:
 *         description: User profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 value:
 *                   oneOf:
 *                     - type: string
 *                       description: 'Updated value for string fields (email, username)'
 *                     - type: boolean
 *                       description: 'Updated value for boolean fields (notifications)'
 *                     - type: array
 *                       items:
 *                         type: string
 *                       description: 'Updated value for array fields (watchlist)'
 *                   description: 'The updated value that was set'
 *             examples:
 *               email_updated:
 *                 summary: Email successfully updated
 *                 value:
 *                   value: 'newemail@example.com'
 *               username_updated:
 *                 summary: Username successfully updated
 *                 value:
 *                   value: 'new_username'
 *               watchlist_updated:
 *                 summary: Watchlist successfully updated
 *                 value:
 *                   value: ['JALE-HURT-2020-1998-08-07', 'PATR-MAHO-2017-1995-09-17']
 *               notifications_updated:
 *                 summary: Notification preference updated
 *                 value:
 *                   value: true
 *       400:
 *         description: Bad request - validation error or missing parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missing_type:
 *                 summary: Missing type parameter
 *                 value:
 *                   error: 'missing type param'
 *               invalid_type:
 *                 summary: Invalid type parameter
 *                 value:
 *                   error: 'invalid type param'
 *               missing_value:
 *                 summary: Missing value parameter
 *                 value:
 *                   error: 'missing value param'
 *               invalid_username:
 *                 summary: Username validation failed
 *                 value:
 *                   error: 'Username must be between 3 and 20 characters and contain only letters, numbers, and underscores'
 *               username_taken:
 *                 summary: Username already exists
 *                 value:
 *                   error: 'username already taken'
 *               invalid_email:
 *                 summary: Email validation failed
 *                 value:
 *                   error: 'Invalid email format'
 *               email_taken:
 *                 summary: Email already exists
 *                 value:
 *                   error: 'email already taken'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { userId } = req.auth
    let { value } = req.body
    const { type } = req.body

    if (!type) {
      return res.status(400).send({ error: 'missing type param' })
    }

    const valid_types = [
      'email',
      'password',
      'watchlist',
      'user_text_notifications',
      'user_voice_notifications',
      'username'
    ]
    if (!valid_types.includes(type)) {
      return res.status(400).send({ error: 'invalid type param' })
    }

    if (typeof value === 'undefined' || value === null) {
      return res.status(400).send({ error: 'missing value param' })
    }

    if (type === 'password') {
      const salt = await bcrypt.genSalt(10)
      value = await bcrypt.hash(value, salt)
    }

    if (type === 'username') {
      const result = validators.username_validator({ username: value })
      if (result !== true) {
        return res.status(400).send({ error: result[0].message })
      }

      const existing_user = await db('users').where({ username: value }).first()
      if (existing_user) {
        return res.status(400).send({ error: 'username already taken' })
      }
    }

    if (type === 'email') {
      const result = validators.email_validator({ email: value })
      if (result !== true) {
        return res.status(400).send({ error: result[0].message })
      }

      const existing_user = await db('users').where({ email: value }).first()
      if (existing_user) {
        return res.status(400).send({ error: 'email already taken' })
      }
    }

    await db('users')
      .update({ [type]: value })
      .where({ id: userId })

    res.send({ value })
  } catch (error) {
    logger(error)
    res.status(400).send({ error: error.toString() })
  }
})

export default router
