import express from 'express'

import {
  getLeague,
  validators,
  find_or_create_scoring_format,
  find_or_create_league_format
} from '#libs-server'
import {
  BYE_CANDIDATE_POOLS,
  BYE_SELECTION_METHODS,
  AT_LARGE_SELECTION_METHODS
} from '#libs-shared/get-playoff-seeding.mjs'
import {
  require_auth,
  validate_and_get_league,
  require_commissioner,
  require_league_not_paused,
  handle_error
} from './middleware.mjs'
import { get_open_league_pause } from '#libs-server/league-pause.mjs'
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
import trade_review from './trade-review.mjs'
import waivers from './waivers/index.mjs'
import restricted_free_agency from './restricted-free-agency.mjs'
import auction_elections from './auction-elections.mjs'
import auction_blocks from './auction-blocks.mjs'
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

// The pause guard, above every mutating route in this router INCLUDING the PUT
// below -- which sits above the sub-router mounts and would otherwise slip past
// it. The '/:leagueId' path is load-bearing: a bare router.use(handler) yields
// req.params === {} and the guard would silently pass everything.
router.use('/:leagueId', require_league_not_paused)

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
 *                 field: starter_slots_quarterback
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

    // Each playoff-format text column carries a CHECK naming its allowed
    // values, so an unknown value is a 500 from Postgres unless it is caught
    // here.
    if (
      field === 'bye_candidate_pool' &&
      !BYE_CANDIDATE_POOLS.includes(value)
    ) {
      return res.status(400).send({
        error: `bye_candidate_pool must be one of ${BYE_CANDIDATE_POOLS.join(', ')}`
      })
    }

    if (
      field === 'bye_selection_method' &&
      !BYE_SELECTION_METHODS.includes(value)
    ) {
      return res.status(400).send({
        error: `bye_selection_method must be one of ${BYE_SELECTION_METHODS.join(', ')}`
      })
    }

    if (
      field === 'at_large_selection_method' &&
      !AT_LARGE_SELECTION_METHODS.includes(value)
    ) {
      return res.status(400).send({
        error: `at_large_selection_method must be one of ${AT_LARGE_SELECTION_METHODS.join(', ')}`
      })
    }

    // The field size and the bye count constrain each other, and the relation
    // is enforced by the seasons_bye_count_within_playoff_field CHECK, so an
    // invalid pair would otherwise reach Postgres as a 500. playoff_team_count
    // is checked for a positive value here too: zero satisfies the CHECK but
    // throws in get_playoff_seeding on the next standings run.
    if (
      field === 'playoff_team_count' ||
      field === 'bye_count' ||
      field === 'head_to_head_berth_count'
    ) {
      // get_playoff_seeding requires an integer on all three of these and
      // throws otherwise, and that throw runs inside mapStateToProps -- so a
      // fractional value accepted here blanks the standings page and the league
      // home dashboard rather than failing the write that caused it. The
      // integer_fields guard above only rejects a value isNaN says is not a
      // number, which 2.5 passes, so this is a separate check rather than a
      // restatement of one.
      if (!Number.isInteger(value)) {
        return res
          .status(400)
          .send({ error: `${field} must be a whole number` })
      }

      const playoff_team_count =
        field === 'playoff_team_count' ? value : league.playoff_team_count
      const bye_count = field === 'bye_count' ? value : league.bye_count
      const head_to_head_berth_count =
        field === 'head_to_head_berth_count'
          ? value
          : league.head_to_head_berth_count

      if (playoff_team_count < 1) {
        return res
          .status(400)
          .send({ error: 'playoff_team_count must be at least 1' })
      }

      if (bye_count > playoff_team_count) {
        return res
          .status(400)
          .send({ error: 'bye_count must not exceed playoff_team_count' })
      }

      // The wildcard round pairs off the non-bye teams, so an odd remainder is
      // an unrepresentable bracket. Rejecting it here is what keeps the derived
      // championship_team_count in simulate-playoff-forecast honest -- left
      // unchecked it silently truncates and the simulation fails later with a
      // count mismatch that names neither field.
      if ((playoff_team_count - bye_count) % 2 !== 0) {
        return res.status(400).send({
          error:
            'playoff_team_count minus bye_count must be even so the wildcard round can pair off'
        })
      }

      // Record berths come out of the places below the byes, so lowering the
      // field size can invalidate a count that was fine when it was set. Both
      // directions are checked here because get_playoff_seeding throws on the
      // pair and a throw in the standings run is a blanked page.
      if (head_to_head_berth_count < 0) {
        return res
          .status(400)
          .send({ error: 'head_to_head_berth_count must not be negative' })
      }

      if (head_to_head_berth_count > playoff_team_count - bye_count) {
        return res.status(400).send({
          error:
            'head_to_head_berth_count must not exceed playoff_team_count minus bye_count'
        })
      }
    }

    if (league_fields.includes(field)) {
      await db('leagues')
        .update({ [field]: value })
        .where({ league_id: lid })
    } else if (season_fields.includes(field)) {
      await db('seasons')
        .update({ [field]: value })
        .where({ lid, season_year: current_season.year })
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
        .where({ lid, season_year: current_season.year })

      // No cache rebuild here. The new id's projection slice is empty until it
      // is derived, and refresh-projection-cache-worker derives it -- it finds
      // the work by looking for an empty slice, so this route does not have to
      // announce anything. See libs-server/refresh-projection-caches.mjs.
    } else if (league_format_fields.includes(field)) {
      const league_config = { ...league, [field]: value }
      const league_format_id = await find_or_create_league_format(
        db,
        league_config
      )
      await db('seasons')
        .update({ league_format_id })
        .where({ lid, season_year: current_season.year })

      // Same as above: the worker derives the empty slice.
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
 *               commissioner_user_id: 5
 *               is_hosted: false
 *               number_teams: 14
 *               starter_slots_quarterback: 1
 *               starter_slots_running_back: 2
 *               starter_slots_wide_receiver: 3
 *               starter_slots_tight_end: 1
 *               starter_slots_running_back_wide_receiver_tight_end_flex: 1
 *               starter_slots_defense_special_teams: 1
 *               starter_slots_kicker: 1
 *               bench_slot_count: 6
 *               practice_squad_slot_count: 4
 *               reserve_short_term_limit: 3
 *               salary_cap: 200
 *               starting_free_agent_acquisition_budget: 200
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
    league.years = seasons.map((s) => s.season_year)
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
 *               commissioner_user_id: 5
 *               is_hosted: false
 *               number_teams: 14
 *               starter_slots_quarterback: 1
 *               starter_slots_running_back: 2
 *               starter_slots_wide_receiver: 3
 *               starter_slots_tight_end: 1
 *               starter_slots_running_back_wide_receiver_tight_end_flex: 1
 *               starter_slots_defense_special_teams: 1
 *               starter_slots_kicker: 1
 *               bench_slot_count: 6
 *               practice_squad_slot_count: 4
 *               reserve_short_term_limit: 3
 *               salary_cap: 200
 *               starting_free_agent_acquisition_budget: 200
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
router.use('/:leagueId/trade-review', trade_review)
router.use('/:leagueId/waivers', waivers)
router.use('/:leagueId/restricted-free-agency', restricted_free_agency)
router.use('/:leagueId/auction-elections', auction_elections)
router.use('/:leagueId/auction-blocks', auction_blocks)
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

/**
 * @swagger
 * /leagues/{leagueId}/pause:
 *   post:
 *     tags:
 *       - Fantasy Leagues
 *     summary: Pause a league
 *     description: |
 *       Open a league-wide pause. While a pause is open no transaction may be
 *       written and no processor runs for the league, by any actor through any
 *       transport. Only the league commissioner may pause.
 *
 *       At most one pause may be open per league; pausing an already-paused
 *       league returns the pause that is already open rather than opening a
 *       second one.
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
 *             required:
 *               - pause_reason
 *             properties:
 *               pause_reason:
 *                 type: string
 *                 description: Why the league is being paused
 *     responses:
 *       200:
 *         description: The open pause
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LeaguePause'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/:leagueId/pause', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    if (!require_auth(req, res)) return

    const { leagueId } = req.params
    const { pause_reason } = req.body

    if (!pause_reason || !String(pause_reason).trim()) {
      return res.status(400).send({ error: 'missing pause_reason' })
    }

    const league = await validate_and_get_league(leagueId, res)
    if (!league) return

    if (!require_commissioner(league, req.auth.userId, res, 'pause the league'))
      return

    // Pausing an already-paused league is a no-op that returns the open pause,
    // not a 409. The commissioner's intent ("this league should be paused") is
    // already satisfied, and the partial unique index would reject the insert
    // anyway -- surfacing that as an error would make a double-click look like
    // a failure.
    const existing_pause = await get_open_league_pause({
      league_id: league.league_id,
      db
    })
    if (existing_pause) return res.send(existing_pause)

    const [pause] = await db('league_pauses')
      .insert({
        league_id: league.league_id,
        paused_at: new Date(),
        pause_reason: String(pause_reason).trim(),
        paused_by_user_id: req.auth.userId
      })
      .returning('*')

    return res.send(pause)
  } catch (error) {
    handle_error(error, logger, res)
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/pause:
 *   delete:
 *     tags:
 *       - Fantasy Leagues
 *     summary: Resume a paused league
 *     description: |
 *       Close the league's open pause. The interval row is retained as the
 *       ledger the rookie draft clock credits from, so resuming is an update
 *       rather than a delete. Only the league commissioner may resume.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     responses:
 *       200:
 *         description: The closed pause
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LeaguePause'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/:leagueId/pause', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    if (!require_auth(req, res)) return

    const { leagueId } = req.params

    const league = await validate_and_get_league(leagueId, res)
    if (!league) return

    if (
      !require_commissioner(league, req.auth.userId, res, 'resume the league')
    )
      return

    const open_pause = await get_open_league_pause({
      league_id: league.league_id,
      db
    })
    if (!open_pause) {
      return res.status(400).send({ error: 'league is not paused' })
    }

    const [pause] = await db('league_pauses')
      .where({ pause_id: open_pause.pause_id })
      .update({ resumed_at: new Date() })
      .returning('*')

    return res.send(pause)
  } catch (error) {
    handle_error(error, logger, res)
  }
})

export default router
