const express = require('express')
const router = express.Router()

const { getChartedPlayByPlayQuery, getPlayByPlayQuery } = require('../../utils')
const { constants } = require('../../common')

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const query = getPlayByPlayQuery(db)
    const data = await query.where('nflPlay.seas', constants.season.year)
    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/stats', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const data = await db('nflPlayStat')
      .select('nflPlayStat.*', 'nflPlay.wk')
      .leftJoin('nflPlay', function () {
        this.on('nflPlayStat.esbid', '=', 'nflPlay.esbid').andOn(
          'nflPlayStat.playId',
          '=',
          'nflPlay.playId'
        )
      })
      .where('nflPlay.seas', constants.season.year)
      .where('nflPlayStat.valid', 1)
    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/charted', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const years = req.query.years
      ? Array.isArray(req.query.years)
        ? req.query.years
        : [req.query.years]
      : [
          constants.season.week
            ? constants.season.year
            : constants.season.year - 1
        ]

    const weeks = req.query.weeks
      ? Array.isArray(req.query.weeks)
        ? req.query.weeks
        : [req.query.weeks]
      : []

    const days = req.query.days
      ? Array.isArray(req.query.days)
        ? req.query.days
        : [req.query.days]
      : []

    const quarters = req.query.quarters
      ? Array.isArray(req.query.quarters)
        ? req.query.quarters
        : [req.query.quarters]
      : []

    const downs = req.query.downs
      ? Array.isArray(req.query.downs)
        ? req.query.downs
        : [req.query.downs]
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
      pbpQuery = pbpQuery.whereIn('nfl_games.seas', years)
    }

    if (weeks.length) {
      pbpQuery = pbpQuery.whereIn('nfl_games.wk', weeks)
    }

    if (days.length) {
      pbpQuery = pbpQuery.whereIn('nfl_games.day', days)
    }

    if (quarters.length) {
      pbpQuery = pbpQuery.whereIn('nflPlay.qtr', quarters)
    }

    if (downs.length) {
      pbpQuery = pbpQuery.whereIn('nflPlay.dwn', downs)
    }

    const data = await pbpQuery
    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
