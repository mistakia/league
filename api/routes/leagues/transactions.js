const express = require('express')
const router = express.Router({ mergeParams: true })

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params

    // TODO validate
    const { limit = 100, offset = 0 } = req.query
    const types = req.query.types
      ? (Array.isArray(req.query.types) ? req.query.types : [req.query.types])
      : []
    const teams = req.query.teams
      ? (Array.isArray(req.query.teams) ? req.query.teams : [req.query.teams])
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

    const transactions = await query

    res.send(transactions)
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

module.exports = router
