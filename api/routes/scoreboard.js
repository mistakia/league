const express = require('express')
const router = express.Router()

const { constants, uniqBy } = require('../../common')
const { getPlayByPlayQuery } = require('../../utils')

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

    const query = getPlayByPlayQuery(db)
    const plays = await query.where('nfl_plays.wk', week)
    const esbids = Array.from(uniqBy(plays, 'esbid')).map((p) => p.esbid)
    const playStats = await db('nfl_play_stats').whereIn('esbid', esbids)
    const playSnaps = await db('nflSnap').whereIn('esbid', esbids)

    for (const play of plays) {
      play.playStats = playStats.filter(
        (p) => p.playId === play.playId && p.esbid === play.esbid
      )
      play.playSnaps = playSnaps.filter(
        (p) => p.playId === play.playId && p.esbid === play.esbid
      )
    }

    res.send(plays)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
