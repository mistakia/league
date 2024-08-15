import express from 'express'

import { getLeague } from '#libs-server'
import {
  constants,
  generate_league_format_hash,
  generate_scoring_format_hash
} from '#libs-shared'
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
    const lid = parseInt(leagueId, 10)
    const league = await getLeague({ lid })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // verify user is commish
    if (league.commishid !== req.auth.userId) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    const league_fields = [
      'name',

      'espn_id',
      'sleeper_id',
      'mfl_id',
      'fleaflicker_id'
    ]

    const league_format_fields = [
      'num_teams',
      'sqb',
      'srb',
      'swr',
      'ste',
      'srbwr',
      'srbwrte',
      'sqbrbwrte',
      'swrte',
      'sdst',
      'sk',

      'bench',
      'ps',
      'ir',

      'cap',
      'min_bid'
    ]

    const league_scoring_format_fields = [
      'pa',
      'pc',
      'py',
      'ints',
      'tdp',
      'ra',
      'ry',
      'tdr',
      'rec',
      'rbrec',
      'wrrec',
      'terec',
      'recy',
      'twoptc',
      'tdrec',
      'fuml',
      'prtd',
      'krtd'
    ]

    const season_fields = ['mqb', 'mrb', 'mwr', 'mte', 'mdst', 'mk', 'faab']

    const fields = [
      ...league_fields,
      ...season_fields,
      ...league_format_fields,
      ...league_scoring_format_fields
    ]

    if (!field) {
      return res.status(400).send({ error: 'missing field' })
    }

    if (typeof value === 'undefined') {
      return res.status(400).send({ error: 'missing value' })
    }

    if (fields.indexOf(field) < 0) {
      return res.status(400).send({ error: 'invalid field' })
    }

    const ints = [
      'sqb',
      'srb',
      'swr',
      'ste',
      'sk',
      'sdst',
      'srbwr',
      'srbwrte',
      'sqbrbwrte',
      'swrte',
      'bench',
      'ps',
      'ir',
      'mqb',
      'mrb',
      'mwr',
      'mte',
      'mdst',
      'mk',
      'faab',
      'cap',
      'pa',
      'pc',
      'py',
      'ints',
      'tdp',
      'ra',
      'ry',
      'tdr',
      'rbrec',
      'wrrec',
      'terec',
      'rec',
      'recy',
      'twoptc',
      'tdrec',
      'fuml',
      'num_teams',
      'min_bid',
      'prtd',
      'krtd',

      'espn_id',
      'sleeper_id',
      'mfl_id',
      'fleaflicker_id'
    ]
    const positives = [
      'sqb',
      'srb',
      'swr',
      'ste',
      'sk',
      'sdst',
      'srbwr',
      'srbwrte',
      'sqbrbwrte',
      'swrte',
      'bench',
      'ps',
      'ir',
      'mqb',
      'mrb',
      'mwr',
      'mte',
      'mdst',
      'mk',
      'faab',
      'cap',
      'min_bid',
      'prtd',
      'krtd',

      'espn_id',
      'sleeper_id',
      'mfl_id',
      'fleaflicker_id'
    ]
    const floats = [
      'pa',
      'pc',
      'py',
      'ra',
      'ry',
      'rbrec',
      'wrrec',
      'terec',
      'rec',
      'recy'
    ]

    if (ints.indexOf(field) >= 0) {
      if (isNaN(value)) {
        return res.status(400).send({ error: 'invalid value' })
      }

      if (floats.indexOf(field) >= 0) {
        value = parseFloat(value)
      } else {
        value = parseInt(value, 10)
      }

      if (positives.indexOf(field) >= 0 && value < 0) {
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
        .where({ lid, year: constants.season.year })
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
        .where({ lid, year: constants.season.year })
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
        .where({ lid, year: constants.season.year })
    }

    // TODO create changelog

    res.send({ value })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

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
