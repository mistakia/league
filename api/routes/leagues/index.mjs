import express from 'express'

import { getLeague, validators } from '#libs-server'
import {
  generate_league_format_hash,
  generate_scoring_format_hash
} from '#libs-shared'
import { current_season } from '#constants'
import {
  league_fields,
  league_format_fields,
  league_scoring_format_fields,
  season_fields,
  league_settings_fields,
  integer_fields,
  positive_integer_fields,
  float_fields
} from './league-settings.mjs'
import transactions from './transactions.mjs'
import draft from './draft.mjs'
import games from './games.mjs'
import settings from './settings.mjs'
import trades from './trades.mjs'
import waivers from './waivers/index.mjs'
import poaches from './poaches.mjs'
import sync from './sync.mjs'
import teams from './teams.mjs'
import rosters from './rosters.mjs'
import baselines from './baselines.mjs'
import teamStats from './team-stats.mjs'
import players from './players.mjs'
import matchups from './matchups.mjs'
import draft_pick_value from './draft-pick-value.mjs'
import team_daily_values from './team-daily-values.mjs'
import careerlogs from './careerlogs.mjs'

const router = express.Router()

/**
 * @swagger
 * /leagues/{leagueId}:
 *   put:
 *     tags:
 *       - Fantasy Leagues
 *     summary: Update fantasy league settings
 *     description: |
 *       Update fantasy league configuration settings. Only the fantasy league commissioner can update settings.
 *       Supports updating various fantasy league attributes including roster configuration, scoring settings,
 *       and external platform integrations.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               field:
 *                 $ref: '#/components/schemas/LeagueSettingsEnum'
 *               value:
 *                 oneOf:
 *                   - type: string
 *                   - type: number
 *                 description: |
 *                   New value for the field. Type depends on the field:
 *                   - String fields: name
 *                   - Integer fields: Most roster/scoring settings
 *                   - Float fields: Some scoring settings (pa, pc, py, ra, ry, rbrec, wrrec, terec, rec, recy)
 *                 example: "My Fantasy League"
 *             required:
 *               - field
 *               - value
 *           examples:
 *             updateLeagueName:
 *               summary: Update fantasy league name
 *               value:
 *                 field: name
 *                 value: "My Fantasy League"
 *             updateRosterSize:
 *               summary: Update starting QB slots
 *               value:
 *                 field: sqb
 *                 value: 1
 *             updateScoringSettings:
 *               summary: Update passing yards scoring
 *               value:
 *                 field: py
 *                 value: 0.04
 *     responses:
 *       200:
 *         description: Setting updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 value:
 *                   oneOf:
 *                     - type: string
 *                     - type: number
 *                   description: Updated value
 *             examples:
 *               stringValue:
 *                 summary: String field updated
 *                 value:
 *                   value: "My Fantasy League"
 *               numericValue:
 *                 summary: Numeric field updated
 *                 value:
 *                   value: 1
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *         description: Bad request - invalid field, value, or permissions
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *         description: Authentication required
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *         description: Internal server error
 */
router.put('/:leagueId', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const { field } = req.body
    let { value } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    // verify leagueId
    const lid = Number(leagueId)
    const league = await getLeague({ lid })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // verify user is commish
    if (league.commishid !== req.auth.userId) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    if (!field) {
      return res.status(400).send({ error: 'missing field' })
    }

    if (typeof value === 'undefined') {
      return res.status(400).send({ error: 'missing value' })
    }

    if (league_settings_fields.indexOf(field) < 0) {
      return res.status(400).send({ error: 'invalid field' })
    }

    if (integer_fields.indexOf(field) >= 0) {
      if (isNaN(value)) {
        return res.status(400).send({ error: 'invalid value' })
      }

      if (float_fields.indexOf(field) >= 0) {
        value = parseFloat(value)
      } else {
        value = Number(value)
      }

      if (positive_integer_fields.indexOf(field) >= 0 && value < 0) {
        return res.status(400).send({ error: 'invalid value' })
      }
    }

    if (league_fields.includes(field)) {
      await db('leagues')
        .update({ [field]: value })
        .where({ uid: lid })
    } else if (season_fields.includes(field)) {
      await db('seasons')
        .update({ [field]: value })
        .where({ lid, year: current_season.year })
    } else if (league_scoring_format_fields.includes(field)) {
      const scoring_format = generate_scoring_format_hash({
        ...league,
        [field]: value
      })
      await db('league_scoring_formats')
        .insert(scoring_format)
        .onConflict('scoring_format_hash')
        .ignore()
      await db('seasons')
        .update({ scoring_format_hash: scoring_format.scoring_format_hash })
        .where({ lid, year: current_season.year })
    } else if (league_format_fields.includes(field)) {
      const league_format = generate_league_format_hash({
        ...league,
        [field]: value
      })
      await db('league_formats')
        .insert(league_format)
        .onConflict('league_format_hash')
        .ignore()
      await db('seasons')
        .update({ league_format_hash: league_format.league_format_hash })
        .where({ lid, year: current_season.year })
    }

    // TODO create changelog

    res.send({ value })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

/**
 * @swagger
 * /leagues/{leagueId}:
 *   get:
 *     tags:
 *       - Fantasy Leagues
 *     summary: Get fantasy league details
 *     description: |
 *       Retrieve detailed information about a specific fantasy league including
 *       league settings, roster configuration, scoring format, and available seasons.
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     responses:
 *       200:
 *         description: League details with available seasons
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/League'
 *                 - type: object
 *                   properties:
 *                     years:
 *                       type: array
 *                       items:
 *                         type: integer
 *                       description: Available seasons for this league
 *                       example: [2022, 2023, 2024]
 *             example:
 *               uid: 2
 *               name: "TEFLON LEAGUE"
 *               commishid: 5
 *               hosted: false
 *               num_teams: 14
 *               sqb: 1
 *               srb: 2
 *               swr: 3
 *               ste: 1
 *               srbwrte: 1
 *               sdst: 1
 *               sk: 1
 *               bench: 6
 *               ps: 4
 *               reserve_short_term_limit: 3
 *               cap: 200
 *               faab: 200
 *               years: [2022, 2023, 2024]
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *         description: Invalid league ID
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *         description: Internal server error
 */
router.get('/:leagueId/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    const seasons = await db('seasons').where('lid', leagueId)
    league.years = seasons.map((s) => s.year)
    res.send(league)
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/seasons/{year}:
 *   get:
 *     tags:
 *       - Fantasy Leagues
 *     summary: Get fantasy league season details
 *     description: |
 *       Retrieve fantasy league information for a specific season including fantasy league settings,
 *       roster configuration, and scoring format as configured for that year.
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *       - name: year
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2030
 *         description: Season year
 *         example: 2024
 *     responses:
 *       200:
 *         description: League season details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/League'
 *             example:
 *               uid: 2
 *               name: "TEFLON LEAGUE"
 *               commishid: 5
 *               hosted: false
 *               num_teams: 14
 *               sqb: 1
 *               srb: 2
 *               swr: 3
 *               ste: 1
 *               srbwrte: 1
 *               sdst: 1
 *               sk: 1
 *               bench: 6
 *               ps: 4
 *               reserve_short_term_limit: 3
 *               cap: 200
 *               faab: 200
 *               league_format_hash: "b5310a7f7c47c20ce372e47e8a0a188b22b78b1d34e2ea18829d94b94ffdc342"
 *               scoring_format_hash: "eb75c8fd2acb21fea5d8754f53e9aa2e5d7c40327d5853c58592f658235ba756"
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *         description: Invalid league ID or year
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *         description: Internal server error
 */
router.get('/:leagueId/seasons/:year', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { leagueId, year } = req.params

    const league_id_check = validators.league_id_validator(Number(leagueId))
    if (league_id_check !== true) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    const year_check = validators.year_validator(Number(year))
    if (year_check !== true) {
      return res.status(400).send({ error: 'invalid year' })
    }

    const league = await getLeague({ lid: leagueId, year })
    if (!league) {
      return res.status(400).send({ error: 'league not found' })
    }

    res.send(league)
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

router.use('/:leagueId/transactions', transactions)
router.use('/:leagueId/games', games)
router.use('/:leagueId/draft', draft)
router.use('/:leagueId/draft-pick-value', draft_pick_value)
router.use('/:leagueId/settings', settings)
router.use('/:leagueId/trades', trades)
router.use('/:leagueId/waivers', waivers)
router.use('/:leagueId/poaches', poaches)
router.use('/:leagueId/sync', sync)
router.use('/:leagueId/teams', teams)
router.use('/:leagueId/rosters', rosters)
router.use('/:leagueId/baselines', baselines)
router.use('/:leagueId/team-stats', teamStats)
router.use('/:leagueId/team-daily-values', team_daily_values)
router.use('/:leagueId/players', players)
router.use('/:leagueId/matchups', matchups)
router.use('/:leagueId/careerlogs', careerlogs)

export default router
