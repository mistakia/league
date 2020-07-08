const express = require('express')
const router = express.Router()
const JSONStream = require('JSONStream')

const { constants } = require('../../common')

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const years = req.query.years
      ? (Array.isArray(req.query.years) ? req.query.years : [req.query.years])
      : [constants.year]

    const weeks = req.query.weeks
      ? (Array.isArray(req.query.weeks) ? req.query.weeks : [req.query.weeks])
      : []

    const days = req.query.days
      ? (Array.isArray(req.query.days) ? req.query.days : [req.query.days])
      : []

    const quarters = req.query.quarters
      ? (Array.isArray(req.query.quarters) ? req.query.quarters : [req.query.quarters])
      : []

    const downs = req.query.downs
      ? (Array.isArray(req.query.downs) ? req.query.downs : [req.query.downs])
      : []

    // TODO filter by yfog range
    // TODO filter by ytg range
    // TODO filter by first drive
    // TODO filter by temperature
    // TODO filter by humidity
    // TODO filter by wind speed
    // TODO filter by day of week
    // TODO filter by spread
    // TODO filter by O/U

    // TODO - enable multiple years
    if (years.length > 1) {
      return res.status(400).send({ error: 'too many years listed' })
    }

    const playerIds = await db('player').select('player').whereNot({ cteam: 'INA' })

    let pbpQuery = db('pbp')
      .select(
        'pbp.fuml', 'pbp.fum', 'pbp.off', 'pbp.type', 'pbp.bc', 'pbp.yds', 'pbp.fd',
        'pbp.succ', 'pbp.psr', 'pbp.trg', 'pbp.ints', 'pbp.comp', 'pbp.pts', 'pbp.sk1',
        'pbp.dwn', 'pbp.qtr',
        'chart.dot', 'chart.tay', 'chart.qbp', 'chart.qbhi', 'chart.qbhu', 'chart.high',
        'chart.intw', 'chart.drp', 'chart.cnb', 'chart.mbt', 'chart.yac', 'chart.yaco', 'game.wk',
        'game.day'
      )
      .join('game', 'pbp.gid', 'game.gid')
      .leftJoin('chart', 'pbp.pid', 'chart.pid')
      .whereNot('pbp.type', 'NOPL')
      .where(function () {
        this.whereNot({ 'pbp.act1': 'A' })
        this.orWhereNot({ 'pbp.act2': 'A' })
        this.orWhereNot({ 'pbp.act3': 'A' })
      })

    if (req.query.basic) {
      pbpQuery = pbpQuery.where(function () {
        this.whereIn('pbp.bc', playerIds)
          .orWhereIn('pbp.psr', playerIds)
          .orWhereIn('pbp.trg', playerIds)
      })
    }

    if (years.length) {
      pbpQuery = pbpQuery.whereIn('game.seas', years)
    }

    if (weeks.length) {
      pbpQuery = pbpQuery.whereIn('game.wk', weeks)
    }

    if (days.length) {
      pbpQuery = pbpQuery.whereIn('game.day', days)
    }

    if (quarters.length) {
      pbpQuery = pbpQuery.whereIn('pbp.qtr', quarters)
    }

    if (downs.length) {
      pbpQuery = pbpQuery.whereIn('pbp.dwn', downs)
    }

    const stream = pbpQuery.stream()
    res.set('Content-Type', 'application/json')
    stream.pipe(JSONStream.stringify()).pipe(res)
    req.on('close', stream.end.bind(stream))
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
