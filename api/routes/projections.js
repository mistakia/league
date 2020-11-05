import { constants } from '../../common'
const express = require('express')
const moment = require('moment')
const router = express.Router()

router.get('/?', async (req, res) => {
  const { db, logger, cache } = req.app.locals
  try {
    // 12 hours
    res.set('Expires', moment().add('12', 'hour').toDate().toUTCString())
    res.set('Cache-Control', 'public, max-age=43200')
    res.set('Pragma', null)
    res.set('Surrogate-Control', null)

    const players = await db('player')
      .whereIn('pos', constants.positions)
      .whereNot({ cteam: 'INA' })
    const playerIds = players.map(p => p.player)

    let projections = cache.get('projections')
    if (!projections) {
      const sub = db('projections')
        .select(db.raw('max(timestamp) AS maxtime, sourceid AS sid'))
        .groupBy('sid')
        .where('year', constants.season.year)
        .whereNull('userid')

      projections = await db
        .select('*')
        .from(db.raw('(' + sub.toString() + ') AS X'))
        .innerJoin(
          'projections',
          function () {
            this.on(function () {
              this.on('sourceid', '=', 'sid')
              this.andOn('timestamp', '=', 'maxtime')
            })
          }
        )
        .whereIn('player', playerIds)
        .where('week', '>=', constants.season.week)
        .whereNull('userid')

      cache.set('projections', projections, 14400) // 4 hours
    }

    let userProjections = []
    if (req.user) {
      userProjections = await db('projections')
        .select('*')
        .whereIn('player', playerIds)
        .where({
          year: constants.season.year,
          userid: req.user.userId
        })
    }

    res.send(projections.concat(userProjections))
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.put('/:playerId/?', (err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).send({ error: 'invalid token' })
  }
  next()
}, async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    let { value } = req.body
    const { playerId } = req.params
    const { type, week } = req.body
    const { userId } = req.user

    if (!type) {
      return res.status(400).send({ error: 'missing type param' })
    }

    if (typeof week === 'undefined') {
      return res.status(400).send({ error: 'missing week param' })
    }

    // TODO - validate type

    // TODO - validate range

    if (!constants.stats.includes(type)) {
      return res.status(400).send({ error: 'invalid type' })
    }

    if (typeof value !== 'undefined') {
      value = parseInt(value, 10)

      if (isNaN(value) || value % 1 !== 0) {
        return res.status(400).send({ error: 'invalid value' })
      }
    }

    const rows = await db('projections').where({
      userid: userId,
      player: playerId,
      week,
      year: constants.season.year
    })

    if (rows.length) {
      await db('projections')
        .update({
          [type]: value,
          timestamp: new Date()
        })
        .where({
          userid: userId,
          player: playerId,
          week,
          year: constants.season.year
        })
    } else {
      await db('projections')
        .insert({
          [type]: value,
          timestamp: new Date(),
          userid: userId,
          player: playerId,
          week,
          year: constants.season.year
        })
    }

    res.send({ value })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.delete('/:playerId/?', (err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).send({ error: 'invalid token' })
  }
  next()
}, async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { userId } = req.user
    const { playerId } = req.params
    const { week } = req.body

    await db('projections').del().where({
      userid: userId,
      player: playerId,
      week,
      year: constants.season.year
    })

    res.send({ success: true, week, playerId })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
