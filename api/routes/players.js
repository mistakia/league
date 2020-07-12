import { constants } from '../../common'
const express = require('express')
const router = express.Router()

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
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
      .select('*').select(db.raw('CONCAT(player, "_", sourceid, "_", week) AS Group1'))
      .groupBy('Group1')
      .orderBy('timestamp', 'desc')
      .whereIn('player', playerIds)
      .where('year', constants.year)
      .whereNull('userid')

    let userProjections = []
    if (req.user) {
      userProjections = await db('projections')
        .select('*')
        .whereIn('player', playerIds)
        .where({
          year: constants.year,
          userid: req.user.userId
        })
    }

    logger(`loaded ${projections.length} projections`)
    const addProjection = (projection) => {
      const index = players.findIndex(p => p.player === projection.player)
      players[index].projections.push(projection)
    }
    userProjections.forEach(addProjection)
    projections.forEach(addProjection)
    res.send(players)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/:playerId/stats', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { playerId } = req.params

    const games = await db('offense').where({ player: playerId })
    res.send({ games })

    // snaps per game by year

    // redzone stats by year

    // injury stats

    // penalties and yardage by year

    // advanced
    // - charted stats

    // advanced rushing
    // - yardage by direction
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
