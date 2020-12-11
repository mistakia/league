const express = require('express')
const router = express.Router()

const { constants } = require('../../common')

router.get('/teams', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const years = []
    let startYear = constants.season.year
    while (years.length < 6) {
      years.push(startYear)
      startYear--
    }

    const teamSelect = constants.teamStats.map(s => `SUM(team.${s}) as ${s}`).join(', ')
    const data = await db('team')
      .leftJoin('game', 'team.gid', 'game.gid')
      .select('game.seas', 'team.tname')
      .select(db.raw('CONCAT(team.tname, "_", game.seas) AS Group1'))
      .select(db.raw(teamSelect))
      .groupBy('Group1')
      .whereIn('game.seas', years)

    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/gamelogs/teams', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const data = await db('team')
      .leftJoin('game', 'team.gid', 'game.gid')
      .select('game.seas', 'game.wk', 'team.tname as tm')
      .select(db.raw(constants.teamStats.map(s => `team.${s}`).join(', ')))
      .where('game.seas', constants.season.year)

    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/gamelogs/players', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const data = await db('gamelogs').where('year', constants.season.year)
    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
