const express = require('express')
const router = express.Router({ mergeParams: true })
const { constants } = require('../../../common')
const { getSchedule } = require('../../../utils')

router.post('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params

    const results = await db('leagues').where({ uid: leagueId })
    const league = results[0]
    if (league.commishid !== req.user.userId) {
      return res.status(401).send({ error: 'user is not commish' })
    }

    await db('matchups').del().where({ lid: leagueId, year: constants.season.year })
    const teams = await db('teams').where({ lid: leagueId })
    const schedule = getSchedule(teams)
    const inserts = []
    for (const [index, value] of schedule.entries()) {
      for (const matchup of value) {
        inserts.push({
          hid: matchup.home.uid,
          aid: matchup.away.uid,
          lid: league.uid,
          week: index + 1,
          year: constants.season.year
        })
      }
    }
    await db('matchups').insert(inserts)
    res.send(inserts)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const { year = constants.season.year } = req.query

    const matchups = await db('matchups')
      .where({ lid: leagueId, year })
      .orderBy('week', 'asc')

    const playoffs = await db('playoffs').where({ lid: leagueId, year })

    res.send({ matchups, playoffs })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

module.exports = router
