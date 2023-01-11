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

    // TODO update, join nfl_games table
    const data = await db('props_index').where({
      week: constants.season.week,
      year: constants.season.year
    })

    cache.set(cacheKey, data, 300) // 5 mins

    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
