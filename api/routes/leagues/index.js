const express = require('express')
const router = express.Router()

const { constants } = require('../../../common')
const transactions = require('./transactions')
const draft = require('./draft')
const games = require('./games')
const settings = require('./settings')

router.get('/:leagueId/teams/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const teams = await db('teams').where({ lid: leagueId })
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

router.get('/:leagueId/schedule/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const { year = constants.year, teamId } = req.query

    let query = db('matchups')
      .where({ lid: leagueId, year })
      .orderBy('week', 'asc')

    if (teamId) {
      query = query.where(function () {
        this.where('aid', teamId).orWhere('hid', teamId)
      })
    }

    const matchups = await query

    res.send(matchups)
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

router.use('/:leagueId/transactions', transactions)
router.use('/:leagueId/games', games)
router.use('/:leagueId/draft', draft)
router.use('/:leagueId/settings', settings)

module.exports = router
