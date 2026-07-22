import express from 'express'

import {
  getLeague,
  validators,
  report_job,
  report_error,
  find_or_create_scoring_format,
  find_or_create_league_format
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import process_projections_for_scoring_format from '#scripts/process-projections-for-scoring-format.mjs'
import process_projections_for_league_format from '#scripts/process-projections-for-league-format.mjs'
import {
  require_auth,
  validate_and_get_league,
  require_commissioner,
  handle_error
} from './middleware.mjs'
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
import teams from './teams.mjs'
import rosters from './rosters.mjs'
import baselines from './baselines.mjs'
import teamStats from './team-stats.mjs'
import players from './players.mjs'
import matchups from './matchups.mjs'
import draft_pick_value from './draft-pick-value.mjs'
import team_daily_values from './team-daily-values.mjs'
import careerlogs from './careerlogs.mjs'
import external from './external.mjs'

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
 *                   - Float fields: Some scoring settings (passing_attempts, passing_completions, passing_yards, rushing_attempts, rushing_yards, running_back_reception, wide_receiver_reception, tight_end_reception, receptions, receiving_yards)
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

    if (!require_auth(req, res)) return

    const league = await validate_and_get_league(leagueId, res)
    if (!league) return

    if (
      !require_commissioner(
        league,
        req.auth.userId,
        res,
        'update league settings'
      )
    ) {
      return
    }

    const lid = Number(leagueId)

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
      // Find-or-create inline. The DB unique index on the full scoring config
      // tuple is the dedup oracle; identity (id) is opaque. The DO UPDATE
      // returns the existing row's id on conflict -- DO NOTHING would not.
      const scoring_config = { ...league, [field]: value }
      const scoring_format_id = await find_or_create_scoring_format(
        db,
        scoring_config
      )
      await db('seasons')
        .update({ scoring_format_id })
        .where({ lid, year: current_season.year })

      try {
        await process_projections_for_scoring_format({
          year: current_season.year,
          scoring_format_id
        })
      } catch (err) {
        const job_reason = `cascade_failed_scoring lid=${lid} year=${current_season.year} id=${scoring_format_id}`
        await report_error({
          job_type: job_types.PROCESS_PROJECTIONS,
          error: err
        })
        await report_job({
          job_type: job_types.PROCESS_PROJECTIONS,
          job_success: false,
          job_reason
        })
      }
    } else if (league_format_fields.includes(field)) {
      const league_config = { ...league, [field]: value }
      const league_format_id = await find_or_create_league_format(
        db,
        league_config
      )
      await db('seasons')
        .update({ league_format_id })
        .where({ lid, year: current_season.year })

      try {
        await process_projections_for_league_format({
          year: current_season.year,
          league_format_id
        })
      } catch (err) {
        const job_reason = `cascade_failed_league lid=${lid} year=${current_season.year} id=${league_format_id}`
        await report_error({
          job_type: job_types.PROCESS_PROJECTIONS,
          error: err
        })
        await report_job({
          job_type: job_types.PROCESS_PROJECTIONS,
          job_success: false,
          job_reason
        })
      }
    }

    // TODO create changelog

    res.send({ value })
  } catch (err) {
    handle_error(err, logger, res)
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
    const league = await validate_and_get_league(leagueId, res)
    if (!league) return

    const seasons = await db('seasons').where('lid', leagueId)
    league.years = seasons.map((s) => s.year)
    res.send(league)
  } catch (err) {
    handle_error(err, logger, res)
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
 *               league_format_id: "b5310a7f7c47c20ce372e47e8a0a188b22b78b1d34e2ea18829d94b94ffdc342"
 *               scoring_format_id: "eb75c8fd2acb21fea5d8754f53e9aa2e5d7c40327d5853c58592f658235ba756"
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

    const league = await validate_and_get_league(leagueId, res)
    if (!league) return

    const year_check = validators.year_validator(Number(year))
    if (year_check !== true) {
      return res.status(400).send({ error: 'invalid year' })
    }

    const league_with_year = await getLeague({ lid: leagueId, year })
    if (!league_with_year) {
      return res.status(400).send({ error: 'league not found for this year' })
    }

    res.send(league_with_year)
  } catch (err) {
    handle_error(err, logger, res)
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
router.use('/:leagueId/teams', teams)
router.use('/:leagueId/rosters', rosters)
router.use('/:leagueId/baselines', baselines)
router.use('/:leagueId/team-stats', teamStats)
router.use('/:leagueId/team-daily-values', team_daily_values)
router.use('/:leagueId/players', players)
router.use('/:leagueId/matchups', matchups)
router.use('/:leagueId/careerlogs', careerlogs)
router.use('/:leagueId/external', external)

export default router
