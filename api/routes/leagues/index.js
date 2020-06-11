const express = require('express')
const router = express.Router()

const transactions = require('./transactions')
const draft = require('./draft')
const games = require('./games')
const settings = require('./settings')

router.get('/:leagueId/teams/?', async (req, res) => {
  try {
    const { db } = req.app.locals
    const { leagueId } = req.params
    const teams = await db('teams').where({ lid: leagueId })
    res.send({ teams })
  } catch (err) {
    res.status(500).send({ error: err.toString() })
  }
})


router.use('/:leagueId/transactions', transactions)
router.use('/:leagueId/games', games)
router.use('/:leagueId/draft', draft)
router.use('/:leagueId/settings', settings)

module.exports = router
