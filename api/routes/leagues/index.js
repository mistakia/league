const express = require('express')
const router = express.Router()

const { constants } = require('../../../common')
const transactions = require('./transactions')
const draft = require('./draft')
const games = require('./games')
const settings = require('./settings')
const trades = require('./trades')
const schedule = require('./schedule')
const waivers = require('./waivers')
const poaches = require('./poaches')
const sync = require('./sync')
const teams = require('./teams')
const rosters = require('./rosters')

router.put('/:leagueId', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const { field } = req.body
    let { value } = req.body

    // verify leagueId
    const lid = parseInt(leagueId, 10)
    const leagues = await db('leagues').where({ uid: lid }).limit(1)
    if (!leagues.length) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // verify user is commish
    const league = leagues[0]
    if (league.commishid !== req.user.userId) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    const fields = [
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
      'name',
      'nteams',
      'minBid',
      'prtd',
      'krtd'
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
      'nteams',
      'minBid',
      'prtd',
      'krtd'
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
      'minBid',
      'prtd',
      'krtd'
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

    await db('leagues')
      .update({ [field]: value })
      .where({ uid: lid })
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
    const picks = await db('draft').where({ lid: leagueId }).whereNull('player')

    const teamIds = teams.map((t) => t.uid)

    const usersTeams = await db('users_teams')
      .where({ userid: req.user.userId })
      .whereIn('tid', teamIds)

    for (const team of teams) {
      team.picks = picks.filter((p) => p.tid === team.uid)
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
      .where({ lid: leagueId, year: constants.season.year })
      .orderBy('week', 'desc')

    const players = await db('rosters_players')
      .select(
        'rosters_players.*',
        'transactions.type',
        'transactions.value',
        'transactions.timestamp',
        'transactions.year'
      )
      .join('rosters', 'rosters_players.rid', '=', 'rosters.uid')
      .leftJoin('transactions', function () {
        this.on(
          'transactions.uid',
          '=',
          db.raw(
            '(select max(uid) from transactions where transactions.tid = rosters.tid and transactions.player = rosters_players.player)'
          )
        )
      })
      .whereIn(
        'rid',
        rosters.map((r) => r.uid)
      )

    rosters.forEach((r) => {
      r.players = players.filter((p) => p.rid === r.uid)
    })

    const query1 = await db('teams')
      .select('teams.*')
      .join('users_teams', 'teams.uid', 'users_teams.userid')
      .where('users_teams.userid', req.user.userId)
      .where('teams.lid', leagueId)

    if (query1.length) {
      const tid = query1[0].uid
      const bids = await db('transition_bids')
        .where('tid', tid)
        .where('year', constants.season.year)
        .whereNull('cancelled')
        .whereNull('processed')

      if (bids.length) {
        const teamRoster = rosters.find((r) => r.tid === tid)
        for (const bid of bids) {
          const player = teamRoster.players.find((p) => p.player === bid.player)
          player.bid = bid.bid
        }
      }
    }

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
router.use('/:leagueId/waivers', waivers)
router.use('/:leagueId/poaches', poaches)
router.use('/:leagueId/sync', sync)
router.use('/:leagueId/teams', teams)
router.use('/:leagueId/rosters', rosters)

module.exports = router
