const express = require('express')
const router = express.Router()
const JSONStream = require('JSONStream')

const {
  getChartedPlayByPlayQuery,
  getPlayByPlayQuery
} = require('../../utils')
const { constants, uniqBy } = require('../../common')

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const years = req.query.years
      ? (Array.isArray(req.query.years) ? req.query.years : [req.query.years])
      : [constants.season.week ? constants.season.year : (constants.season.year - 1)]
    // TODO - enable multiple years
    if (years.length > 1) {
      return res.status(400).send({ error: 'too many years listed' })
    }

    const query = getPlayByPlayQuery(db)
    const plays = await query.whereIn('nflPlay.season', years)
    const esbids = Array.from(uniqBy(plays, 'esbid')).map(p => p.esbid)
    const playStats = await db('nflPlayStat').whereIn('esbid', esbids)

    for (const play of plays) {
      play.playStats = playStats.filter(p => p.playId === play.playId && p.esbid === play.esbid)
    }

    res.send(plays)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/charted', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const years = req.query.years
      ? (Array.isArray(req.query.years) ? req.query.years : [req.query.years])
      : [constants.season.week ? constants.season.year : (constants.season.year - 1)]

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

    const { playerId } = req.query

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

    let pbpQuery = getChartedPlayByPlayQuery(db)

    if (playerId) {
      const players = await db('player').where('player', playerId).limit(1)
      const player = players[0]
      pbpQuery = pbpQuery.where('pbp.off', player.cteam)
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
