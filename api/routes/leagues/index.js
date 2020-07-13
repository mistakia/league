const express = require('express')
const router = express.Router()

const { constants } = require('../../../common')
const transactions = require('./transactions')
const draft = require('./draft')
const games = require('./games')
const settings = require('./settings')
const trades = require('./trades')
const schedule = require('./schedule')

router.put('/:leagueId', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const { field } = req.body
    let { value } = req.body

    const fields = [
      'sqb', 'srb', 'swr', 'ste', 'sk', 'sdst', 'srbwr', 'srbwrte',
      'sqbrbwrte', 'swrte', 'bench', 'ps', 'ir', 'mqb', 'mrb', 'mwr', 'mte',
      'mdst', 'mk', 'faab', 'cap', 'pa', 'pc', 'py', 'ints', 'tdp', 'ra', 'ry',
      'tdr', 'rec', 'recy', 'twoptc', 'tdrec', 'fuml', 'name', 'nteams'
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
      'sqb', 'srb', 'swr', 'ste', 'sk', 'sdst', 'srbwr', 'srbwrte',
      'sqbrbwrte', 'swrte', 'bench', 'ps', 'ir', 'mqb', 'mrb', 'mwr', 'mte',
      'mdst', 'mk', 'faab', 'cap', 'pa', 'pc', 'py', 'ints', 'tdp', 'ra', 'ry',
      'tdr', 'rec', 'recy', 'twoptc', 'tdrec', 'fuml', 'name', 'nteams'
    ]
    const positives = [
      'sqb', 'srb', 'swr', 'ste', 'sk', 'sdst', 'srbwr', 'srbwrte',
      'sqbrbwrte', 'swrte', 'bench', 'ps', 'ir', 'mqb', 'mrb', 'mwr', 'mte',
      'mdst', 'mk', 'faab', 'cap'
    ]
    const floats = [
      'pa', 'pc', 'py', 'ra', 'ry', 'rec', 'recy'
    ]

    if (ints.indexOf(value)) {
      if (isNaN(value)) {
        return res.status(400).send({ error: 'invalid value' })
      }

      if (floats.indexOf(field)) {
        value = parseFloat(value)
      } else {
        value = parseInt(value, 10)
      }

      if (positives.indexOf(field) && value < 0) {
        return res.status(400).send({ error: 'invalid value' })
      }
    }

    await db('leagues').update({ [field]: value }).where({ uid: leagueId })
    res.send({ value })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

router.get('/:leagueId/teams/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const teams = await db('teams').where({ lid: leagueId })
    const picks = await db('draft')
      .where({ lid: leagueId })
      .whereNull('player')

    for (const team of teams) {
      team.picks = picks.filter(p => p.tid === team.uid)
    }

    res.send({ teams })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

router.get('/:leagueId/rosters/?', async (req, res) => {
  const { logger, db } = req.app.locals
  try {
    const { leagueId } = req.params
    const rosters = await db('rosters')
      .select('*')
      .where({ lid: leagueId, year: constants.year })
      .distinct('tid', 'year')
      .orderBy('week', 'desc')

    res.send(rosters)
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

router.use('/:leagueId/transactions', transactions)
router.use('/:leagueId/games', games)
router.use('/:leagueId/draft', draft)
router.use('/:leagueId/settings', settings)
router.use('/:leagueId/trades', trades)
router.use('/:leagueId/schedule', schedule)

module.exports = router
