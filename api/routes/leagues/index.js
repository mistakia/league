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
      'tdr', 'rbrec', 'wrrec', 'terec', 'rec', 'recy', 'twoptc', 'tdrec', 'fuml', 'name', 'nteams'
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
      'tdr', 'rbrec', 'wrrec', 'terec', 'rec', 'recy', 'twoptc', 'tdrec', 'fuml', 'nteams'
    ]
    const positives = [
      'sqb', 'srb', 'swr', 'ste', 'sk', 'sdst', 'srbwr', 'srbwrte',
      'sqbrbwrte', 'swrte', 'bench', 'ps', 'ir', 'mqb', 'mrb', 'mwr', 'mte',
      'mdst', 'mk', 'faab', 'cap'
    ]
    const floats = [
      'pa', 'pc', 'py', 'ra', 'ry', 'rbrec', 'wrrec', 'terec', 'rec', 'recy'
    ]

    if (ints.indexOf(field) > 0) {
      if (isNaN(value)) {
        return res.status(400).send({ error: 'invalid value' })
      }

      if (floats.indexOf(field) > 0) {
        value = parseFloat(value)
      } else {
        value = parseInt(value, 10)
      }

      if (positives.indexOf(field) > 0 && value < 0) {
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

    const teamIds = teams.map(t => t.uid)

    const usersTeams = await db('users_teams')
      .where({ userid: req.user.userId })
      .whereIn('tid', teamIds)

    for (const team of teams) {
      team.picks = picks.filter(p => p.tid === team.uid)
    }

    for (const usersTeam of usersTeams) {
      const { tid, teamtext, teamvoice, leaguetext } = usersTeam
      for (const [index, team] of teams.entries()) {
        if (team.uid === tid) {
          teams[index] = { teamtext, teamvoice, leaguetext, ...team }
          break
        }
      }
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

    const players = await db('rosters_players')
      .whereIn('rid', rosters.map(r => r.uid))

    rosters.forEach(r => { r.players = players.filter(p => p.rid === r.uid) })

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
