const express = require('express')
const router = express.Router()

const { constants } = require('../../common')

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const week = parseInt(req.query.week || constants.season.week, 10)

    if (isNaN(week)) {
      return res.status(400).send({ error: 'invalid week' })
    }

    if (!constants.fantasyWeeks.includes(week)) {
      return res.status(400).send({ error: 'invalid week' })
    }

    const plays = await db('nflPlay').where({ week: constants.season.week })
    const playIds = plays.map(p => p.playId)
    const playStats = await db('nflPlayStat').whereIn('playId', playIds)
    const playSnaps = await db('nflSnap').whereIn('playId', playIds)

    for (const play of plays) {
      play.playStats = playStats.filter(p => p.playId === play.playId)
      play.playSnaps = playSnaps.filter(p => p.playId === play.playId)
    }

    res.send(plays)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
