const express = require('express')
const router = express.Router()

router.get('/?', async (req, res) => {
  try {
    const { db } = req.app.locals

    const defaultOptions = {
      active: true,
      inactive: false
    }

    const options = Object.assign({}, defaultOptions, req.query)

    if (!options.active && !options.inactive) {
      return res.status(400).send({ error: 'params active & inactive can not both be false' })
    }

    const query = db('player')
    if (options.active && !options.inactive) {
      query.whereNot({ cteam: 'INA' })
    } else if (options.inactive) {
      query.where({ cteam: 'INA' })
    }

    const players = await query
    res.send(players)
  } catch (error) {
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/:playerId', async (req, res) => {
  // TODO return player information
})

module.exports = router
