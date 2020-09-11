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

    let includePlayerIds = []
    if (req.user) {
      const leagues = await db('leagues')
        .select('leagues.uid')
        .join('teams', 'leagues.uid', 'teams.lid')
        .join('users_teams', 'teams.uid', 'users_teams.tid')
        .where('users_teams.userid', req.user.userId)

      const leagueIds = leagues.map(l => l.uid)

      const playerSlots = await db('rosters_players')
        .join('rosters', 'rosters_players.rid', 'rosters.uid')
        .whereIn('rosters.lid', leagueIds)
        .where('rosters.week', constants.season.week)
        .where('rosters.year', constants.season.year)

      includePlayerIds = playerSlots.map(s => s.player)
    }

    const query = db('player')
      .select(db.raw('player.*, min(players.status) as status, min(players.injury_status) as injuryStatus, min(players.injury_body_part) as injuryBodyPart'))
      .leftJoin('players', 'player.player', 'players.player')
      .whereIn('pos1', constants.positions)
      .groupBy('player.player')
    if (options.active && !options.inactive) {
      query.whereNot({ cteam: 'INA' })
    } else if (options.inactive) {
      query.where({ cteam: 'INA' })
    }

    if (includePlayerIds.length) {
      query.orWhereIn('player.player', includePlayerIds)
    }

    const players = await query
    const playerIds = players.map(p => p.player)
    players.forEach(p => { p.projections = [] })

    const sub = db('projections')
      .select(db.raw('max(timestamp) AS maxtime, CONCAT(player, "_", sourceid, "_", week) AS Group1'))
      .groupBy('Group1')
      .whereIn('player', playerIds)
      .where('year', constants.season.year)
      .whereNull('userid')

    const projections = await db
      .select('*')
      .from(db.raw('(' + sub.toString() + ') AS X'))
      .join(
        'projections',
        function () {
          this.on(function () {
            this.on(db.raw('CONCAT(player, "_", sourceid, "_", week) = X.Group1'))
            this.andOn('timestamp', '=', 'maxtime')
          })
        }
      )

    let userProjections = []
    if (req.user) {
      userProjections = await db('projections')
        .select('*')
        .whereIn('player', playerIds)
        .where({
          year: constants.season.year,
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

    // snaps per game by year

    // redzone stats by year

    // injury stats

    // penalties and yardage by year

    // advanced
    // - charted stats

    // advanced rushing
    // - yardage by direction
    res.send({ games })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
