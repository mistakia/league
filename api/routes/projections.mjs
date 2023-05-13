import express from 'express'

import { constants } from '#common'
import { getProjections } from '#utils'

const router = express.Router()

router.get('/?', async (req, res) => {
  const { db, logger, cache } = req.app.locals
  try {
    // 12 hours
    /* res.set('Expires', dayjs().add('12', 'hour').toDate().toUTCString())
     * res.set('Cache-Control', 'public, max-age=43200')
     * res.set('Pragma', null)
     * res.set('Surrogate-Control', null)
     */
    let projections = cache.get('projections')
    if (!projections) {
      projections = await db('projections_index')
        .where('sourceid', constants.sources.AVERAGE)
        .where('year', constants.season.year)
        .where('week', '>=', constants.season.week)
      cache.set('projections', projections, 14400) // 4 hours
    }

    let userProjections = []
    if (req.auth) {
      userProjections = await db('projections_index')
        .select('projections.*')
        .join('player', 'projections.pid', 'player.pid')
        .whereIn('player.pos', constants.positions)
        .whereNot('player.cteam', 'INA')
        .where({
          year: constants.season.year,
          userid: req.auth.userId
        })
    }

    res.send(projections.concat(userProjections))
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/:pid/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { pid } = req.params
    const projections = await getProjections({ pids: [pid] })
    res.send(projections)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.put(
  '/:pid/?',
  (err, req, res, next) => {
    if (err.name === 'UnauthorizedError') {
      return res.status(401).send({ error: 'invalid token' })
    }
    next()
  },
  async (req, res) => {
    const { db, logger } = req.app.locals
    try {
      let { value } = req.body
      const { pid } = req.params
      const { type, week } = req.body
      const { userId } = req.auth

      // TODO validate pid

      if (!type) {
        return res.status(400).send({ error: 'missing type param' })
      }

      if (typeof week === 'undefined') {
        return res.status(400).send({ error: 'missing week param' })
      }

      // TODO - validate type

      // TODO - validate range

      if (!constants.stats.includes(type)) {
        return res.status(400).send({ error: 'invalid type' })
      }

      if (typeof value !== 'undefined') {
        value = parseInt(value, 10)

        if (isNaN(value) || value % 1 !== 0) {
          return res.status(400).send({ error: 'invalid value' })
        }
      }

      const existing_projection = await db('projections_index')
        .where({
          userid: userId,
          pid,
          week,
          year: constants.season.year
        })
        .first()

      if (existing_projection) {
        await db('projections_index')
          .update({
            [type]: value
          })
          .where({
            userid: userId,
            pid,
            week,
            year: constants.season.year
          })

        await db('projections').insert({
          ...existing_projection,
          [type]: value,
          timestamp: new Date()
        })
      } else {
        const insert = {
          [type]: value,
          userid: userId,
          pid,
          week,
          year: constants.season.year
        }
        await db('projections_index').insert(insert)

        await db('projections').insert({
          ...insert,
          timestamp: new Date()
        })
      }

      res.send({ value })
    } catch (error) {
      logger(error)
      res.status(500).send({ error: error.toString() })
    }
  }
)

router.delete(
  '/:pid/?',
  (err, req, res, next) => {
    if (err.name === 'UnauthorizedError') {
      return res.status(401).send({ error: 'invalid token' })
    }
    next()
  },
  async (req, res) => {
    const { db, logger } = req.app.locals
    try {
      const { userId } = req.auth
      const { pid } = req.params
      const { week } = req.body

      // TODO validate pid

      await db('projections_index').del().where({
        userid: userId,
        pid,
        week,
        year: constants.season.year
      })

      res.send({ success: true, week, pid })
    } catch (error) {
      logger(error)
      res.status(500).send({ error: error.toString() })
    }
  }
)

export default router
