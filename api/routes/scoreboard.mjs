import express from 'express'

import { constants, uniqBy } from '#common'
import { get_live_plays_query } from '#utils'

const router = express.Router()

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

    const query = get_live_plays_query(db)
    const plays = await query
      .where('nfl_plays_current_week.week', week)
      .where('nfl_plays_current_week.seas_type', 'REG')
    const esbids = Array.from(uniqBy(plays, 'esbid')).map((p) => p.esbid)
    const play_stats = await db('nfl_play_stats_current_week').whereIn(
      'esbid',
      esbids
    )
    const playSnaps = await db('nfl_snaps_current_week').whereIn(
      'esbid',
      esbids
    )

    for (const play of plays) {
      play.play_stats = play_stats.filter(
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

export default router
