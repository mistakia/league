import { constants } from '../../common'
const express = require('express')
const router = express.Router()

router.put('/:playerId/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    let { value } = req.body
    const { playerId } = req.params
    const { type, week } = req.body
    const { userId } = req.user

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

    const rows = await db('projections').where({
      userid: userId,
      player: playerId,
      week,
      year: constants.season.year
    })

    if (rows.length) {
      await db('projections')
        .update({
          [type]: value,
          timestamp: new Date()
        })
        .where({
          userid: userId,
          player: playerId,
          week,
          year: constants.season.year
        })
    } else {
      await db('projections')
        .insert({
          [type]: value,
          timestamp: new Date(),
          userid: userId,
          player: playerId,
          week,
          year: constants.season.year
        })
    }

    res.send({ value })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.delete('/:playerId/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { userId } = req.user
    const { playerId } = req.params
    const { week } = req.body

    await db('projections').del().where({
      userid: userId,
      player: playerId,
      week,
      year: constants.season.year
    })

    res.send({ success: true })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
