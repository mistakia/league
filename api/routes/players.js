const express = require('express')
const router = express.Router()

import { constants } from '../../common'

router.get('/?', async (req, res) => {
  try {
    const { db, logger } = req.app.locals

    const defaultOptions = {
      active: true,
      inactive: false
    }

    const options = Object.assign({}, defaultOptions, req.query)

    if (!options.active && !options.inactive) {
      return res.status(400).send({ error: 'params active & inactive can not both be false' })
    }

    const query = db('player').whereIn('pos1', constants.positions)
    if (options.active && !options.inactive) {
      query.whereNot({ cteam: 'INA' })
    } else if (options.inactive) {
      query.where({ cteam: 'INA' })
    }

    const players = await query
    const playerIds = players.map(p => p.player)
    players.forEach(p => { p.projections = [] })

    const projections = await db('projections')
      .groupBy('player', 'sourceid', 'timestamp', 'week')
      .groupBy('player', 'week', 'userid')
      .orderBy('timestamp', 'desc')
      .whereIn('player', playerIds)
      .where('year', constants.year)
      .andWhere(function () {
        this.whereNull('userid').orWhere('userid', req.user.userId)
      })

    logger(`loaded ${projections.length} projections`)
    const addProjection = (projection) => {
      const index = players.findIndex(p => p.player === projection.player)
      players[index].projections.push(projection)
    }
    projections.forEach(addProjection)
    res.send(players)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/:playerId', async (req, res) => {
  // TODO return player information
})

module.exports = router
