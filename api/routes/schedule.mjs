import express from 'express'
import dayjs from 'dayjs'

import { constants } from '#common'

const router = express.Router()

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    // one day
    res.set('Expires', dayjs().add('1', 'day').toDate().toUTCString())
    res.set('Cache-Control', 'public, max-age=86400') // one-day
    res.set('Pragma', null)
    res.set('Surrogate-Control', null)

    const teams = {}
    const games = await db('nfl_games')
      .select('year', 'week', 'date', 'time_est', 'v', 'h')
      .where('year', constants.season.year)
      .where('seas_type', 'REG')
      .orderBy('week', 'asc')

    for (const team of constants.nflTeams) {
      teams[team] = {
        bye: null,
        games: []
      }
    }

    const weeks = {}
    for (const game of games) {
      weeks[game.week] = true
      teams[game.v].games.push(game)
      teams[game.h].games.push(game)
    }

    const week_keys = Object.keys(weeks).map((x) => Number(x))

    for (const team of constants.nflTeams) {
      const team_weeks = teams[team].games.map((m) => m.week)
      const team_weeks_set = new Set(team_weeks)
      const result = week_keys.filter((x) => !team_weeks_set.has(x))
      teams[team].bye = result[0]
    }

    res.send(teams)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
