import express from 'express'

import { constants } from '#common'
import cache from '#api/cache.mjs'

const router = express.Router()

router.get('/props', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const cacheKey = '/odds'

    const odds = cache.get(cacheKey)
    if (odds) {
      return res.send(odds)
    }

    const sub = db('props')
      .select(db.raw('max(timestamp) AS maxtime, sourceid AS sid'))
      .groupBy('sid')
      .where({ week: constants.season.week, year: constants.season.year })

    const data = await db
      .select('*')
      .from(db.raw('(' + sub.toString() + ') AS X'))
      .innerJoin('props', function () {
        this.on(function () {
          this.on('sourceid', '=', 'sid')
          this.andOn('timestamp', '=', 'maxtime')
        })
      })
      .where({ week: constants.season.week, year: constants.season.year })

    cache.set(cacheKey, data, 300) // 5 mins

    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
