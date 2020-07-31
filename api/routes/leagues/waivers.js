const express = require('express')
const moment = require('moment')
const router = express.Router({ mergeParams: true })

const { constants, Roster } = require('../../../common')
const { getRoster } = require('../../../utils')

router.post('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { player, drop, leagueId, bid, type } = req.body
    const teamId = parseInt(req.body, 10)

    if (!player) {
      return res.status(400).send({ error: 'missing player param' })
    }

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId param' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId param' })
    }

    if (typeof type === 'undefined' || type === null) {
      return res.status(400).send({ error: 'missing type param' })
    }

    if (!Object.values(constants.waivers).includes(type)) {
      return res.status(400).send({ error: 'invalid type param' })
    }

    // verify teamId, leagueId belongs to user
    const userTeams = await db('users_teams')
      .join('teams', 'users_teams.tid', 'teams.uid')
      .where('userid', req.user.userId)
    const team = userTeams.find(p => p.tid === teamId)
    if (!team) {
      return res.status(400).send({ error: 'invalid teamId' })
    }

    if (team.lid !== leagueId) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // TODO - get last two transactions
    const players = await db('player')
      .join('transactions', 'player.player', 'transactions.player')
      .where('player.player', player)
      .where({ lid: leagueId, tid: teamId })
      .orderBy('timestamp', 'desc')

    if (!players.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const playerRow = players.find(p => p.player === player)

    // make sure player is on waviers
    if (type === constants.waivers.ADD && !constants.waiverWindow) {
      // player has been dropped
      if (playerRow.type === constants.transactions.ROSTER_DROP) {
        return res.status(400).send({ error: 'player is not on waivers' })
      }

      // transaction should have been within the last 24 hours
      if (moment().isAfter(moment(playerRow.timestamp, 'X').add('24', 'hours'))) {
        return res.status(400).send({ error: 'player is no longer on waivers' })
      }

      // TODO detect cycled players - they are not on waivers
    } else if (type === constants.waivers.POACH && !constants.poachWaiverWindow) { // TODO DEPRECATE
      // player has been deactivated
      if (playerRow.type !== constants.transactions.ROSTER_DEACTIVATE ||
        playerRow.type !== constants.transactions.PRACTICE_ADD ||
        playerRow.type !== constants.transactions.DRAFT) {
        return res.status(400).send({ error: 'player is not on waivers' })
      }

      // transaction should have been within the last 24 hours
      if (moment().isAfter(moment(playerRow.timestamp, 'X').add('24', 'hours'))) {
        return res.status(400).send({ error: 'player is no longer on waivers' })
      }

      // verify player is on practice squad
      const slots = await db('rosters_players')
        .join('rosters', 'rosters_players.rid', 'rosters.uid')
        .where({
          lid: leagueId,
          week: constants.week,
          year: constants.year,
          player,
          slot: constants.slots.PS
        })
      if (!slots.length) {
        return res.status(400).send({ error: 'player is not on practice squad' })
      }
    }

    // verify team has space for player on active roster
    const leagues = await db('leagues').where({ uid: leagueId })
    if (!leagues.length) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const league = leagues[0]
    const rosterRow = await getRoster({
      db,
      tid: teamId,
      week: constants.week,
      year: constants.year
    })
    const roster = new Roster({ roster: rosterRow, league })
    if (drop) roster.removePlayer(drop)
    const hasSlot = roster.hasOpenBenchSlot(playerRow.pos1)
    if (!hasSlot) {
      return res.status(400).send({ error: 'can not add player to roster, invalid roster' })
    }

    const data = {
      tid: teamId,
      lid: leagueId,
      player,
      drop,
      submitted: Math.round(Date.now() / 1000),
      bid,
      type
    }
    await db('waivers').insert(data)

    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
