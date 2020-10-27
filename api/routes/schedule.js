const express = require('express')
const moment = require('moment')
const router = express.Router()

const { constants } = require('../../common')

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    // one day
    res.set('Expires', moment().add('1', 'day').toDate().toUTCString())
    res.set('Cache-Control', 'public, max-age=86400') // one-day
    res.set('Pragma', null)
    res.set('Surrogate-Control', null)

    const teams = {}
    const games = await db('schedule')
      .where('seas', constants.season.year)
      .orderBy('wk', 'asc')

    for (const team of constants.nflTeams) {
      teams[team] = {
        bye: null,
        games: []
      }
    }

    for (const game of games) {
      teams[game.v].games.push(game)
      teams[game.h].games.push(game)
    }

    for (const team of constants.nflTeams) {
      const weeks = teams[team].games.map(m => m.wk)
      const teamWeeks = new Set(weeks)
      const result = constants.byeWeeks.filter(x => !teamWeeks.has(x))
      teams[team].bye = result[0]
    }

    res.send(teams)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
