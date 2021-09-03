const express = require('express')
const dayjs = require('dayjs')
const router = express.Router({ mergeParams: true })

const { constants } = require('../../../common')

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params

    // TODO validate
    const { limit = 100, offset = 0, player } = req.query
    const types = req.query.types
      ? Array.isArray(req.query.types)
        ? req.query.types
        : [req.query.types]
      : []
    const teams = req.query.teams
      ? Array.isArray(req.query.teams)
        ? req.query.teams
        : [req.query.teams]
      : []

    let query = db('transactions')
      .where({ lid: leagueId })
      .orderBy('timestamp', 'desc')
      .orderBy('uid', 'desc')
      .limit(limit)
      .offset(offset)

    if (types.length) {
      query = query.whereIn('type', types)
    }

    if (teams.length) {
      query = query.whereIn('tid', teams)
    }

    if (player) {
      query = query.where('player', player)
    }

    const transactions = await query

    res.send(transactions)
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

router.get('/release', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const cutoff = dayjs().subtract('48', 'hours').unix()
    const types = [
      constants.transactions.ROSTER_ADD,
      constants.transactions.ROSTER_RELEASE,
      constants.transactions.PRACTICE_ADD
    ]
    const transactions = await db('transactions')
      .where({
        lid: leagueId
      })
      .whereIn('type', types)
      .where('timestamp', '>', cutoff)
      .orderBy('timestamp', 'desc')
      .orderBy('uid', 'desc')

    res.send(transactions)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
