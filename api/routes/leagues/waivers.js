const express = require('express')
const moment = require('moment')
const router = express.Router({ mergeParams: true })

const { constants, Roster } = require('../../../common')
const { getRoster } = require('../../../utils')

router.post('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { player, drop, leagueId, bid, type, teamId } = req.body

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

    const tid = parseInt(teamId, 10)

    // verify teamId, leagueId belongs to user
    const userTeams = await db('users_teams')
      .join('teams', 'users_teams.tid', 'teams.uid')
      .where('userid', req.user.userId)
    const team = userTeams.find(p => p.tid === tid)
    if (!team) {
      return res.status(400).send({ error: 'invalid teamId' })
    }

    if (team.lid !== leagueId) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // TODO - get last two transactions
    const players = await db('player').where('player', player)
    if (!players.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const playerRow = players[0]

    const transactions = await db('transactions')
      .where('player', player)
      .where({ lid: leagueId })
      .orderBy('timestamp', 'desc')

    if (!constants.waiverWindow && !constants.poachWaiverWindow && !transactions.length) {
      return res.status(400).send({ error: 'player is not on waivers' })
    }

    // make sure player is on waviers
    if (type === constants.waivers.ADD) {
      if (!constants.waiverWindow && transactions.length) {
        // player has been dropped
        if (transactions[0].type === constants.transactions.ROSTER_DROP) {
          return res.status(400).send({ error: 'player is not on waivers' })
        }

        // transaction should have been within the last 24 hours
        if (moment().isAfter(moment(transactions[0].timestamp, 'X').add('24', 'hours'))) {
          return res.status(400).send({ error: 'player is no longer on waivers' })
        }
      } else if (!constants.waiverWindow && !transactions.length) {
        return res.status(400).send({ error: 'player is not on waivers' })
      }
      // TODO detect cycled players - they are not on waivers
    } else if (type === constants.waivers.POACH) {
      if (!constants.poachWaiverWindow && transactions.length) { // TODO DEPRECATE
        // player has been deactivated
        if (transactions[0].type !== constants.transactions.ROSTER_DEACTIVATE &&
          transactions[0].type !== constants.transactions.PRACTICE_ADD &&
          transactions[0].type !== constants.transactions.DRAFT) {
          return res.status(400).send({ error: 'player is not on waivers' })
        }

        // transaction should have been within the last 24 hours
        if (moment().isAfter(moment(transactions[0].timestamp, 'X').add('24', 'hours'))) {
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
      } else if (!constants.poachWaiverWindow && !transactions.length) {
        return res.status(400).send({ error: 'player is not on waivers' })
      }

      const claims = await db('waivers')
        .where({ player, lid: leagueId, tid })
        .whereNull('processed')
        .whereNull('cancelled')

      if (claims.length) {
        return res.status(400).send({ error: 'duplicate waiver claim' })
      }
    }

    // verify team has space for player on active roster
    const leagues = await db('leagues').where({ uid: leagueId })
    if (!leagues.length) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const league = leagues[0]
    const rosterRow = await getRoster({
      tid,
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
      tid,
      userid: req.user.userId,
      lid: leagueId,
      player,
      drop,
      submitted: Math.round(Date.now() / 1000),
      bid,
      type
    }
    const ids = await db('waivers').insert(data)
    data.uid = ids[0]
    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.put('/:waiverId', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { waiverId } = req.params
    const { field, teamId, leagueId } = req.body
    let { value } = req.body

    const fields = ['bid', 'po', 'drop']
    const ints = ['bid', 'po']
    if (!field) {
      return res.status(400).send({ error: 'missing field' })
    }

    if (typeof value === 'undefined') {
      return res.status(400).send({ error: 'missing value' })
    }

    if (fields.indexOf(field) < 0) {
      return res.status(400).send({ error: 'invalid field' })
    }

    if (ints.indexOf(field) >= 0) {
      if (isNaN(value) || value < 0 || value % 1 !== 0) {
        return res.status(400).send({ error: 'invalid value' })
      }

      value = parseInt(value, 10)
    }

    // verify teamId, leagueId belongs to user
    const tid = parseInt(teamId, 10)
    const userTeams = await db('users_teams')
      .join('teams', 'users_teams.tid', 'teams.uid')
      .where('userid', req.user.userId)
    const team = userTeams.find(p => p.tid === tid)
    if (!team) {
      return res.status(400).send({ error: 'invalid teamId' })
    }

    if (team.lid !== leagueId) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // verify waiverId belongs to teamId
    const waivers = await db('waivers').where({
      uid: waiverId,
      tid,
      lid: leagueId
    })

    if (!waivers.length) {
      return res.status(400).send({ error: 'invalid waiverId' })
    }
    const waiver = waivers[0]

    // if bid - make sure it is below available faab
    if (field === 'bid' && value > team.faab) {
      return res.status(400).send({ error: 'bid exceeds avaialble faab' })
    }

    // if drop - make sure it is a suitable drop player
    if (field === 'drop') {
      const players = await db('player').where('player', waiver.player)
      if (!players.length) {
        return res.status(400).send({ error: 'invalid player' })
      }
      const playerRow = players[0]

      // verify team has space for player on active roster
      const leagues = await db('leagues').where({ uid: leagueId })
      if (!leagues.length) {
        return res.status(400).send({ error: 'invalid leagueId' })
      }
      const league = leagues[0]
      const rosterRow = await getRoster({
        tid,
        week: constants.week,
        year: constants.year
      })
      const roster = new Roster({ roster: rosterRow, league })
      roster.removePlayer(value)
      const hasSlot = roster.hasOpenBenchSlot(playerRow.pos1)
      if (!hasSlot) {
        return res.status(400).send({ error: 'can not add player to roster, invalid roster' })
      }
    }

    await db('waivers').update({ [field]: value }).where({ uid: waiverId })
    res.send({ value })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.post('/:waiverId/cancel', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    if (isNaN(req.params.waiverId)) {
      return res.status(400).send({ error: 'invalid waiverId' })
    }

    const waiverId = parseInt(req.params.waiverId, 10)
    const { teamId, leagueId } = req.body

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId param' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId param' })
    }

    // verify teamId, leagueId belongs to user
    const tid = parseInt(teamId, 10)
    const userTeams = await db('users_teams')
      .join('teams', 'users_teams.tid', 'teams.uid')
      .where('userid', req.user.userId)
    const team = userTeams.find(p => p.tid === tid)
    if (!team) {
      return res.status(400).send({ error: 'invalid teamId' })
    }

    if (team.lid !== leagueId) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // verify waiverId belongs to teamId
    const waivers = await db('waivers')
      .where({
        uid: waiverId,
        tid,
        lid: leagueId
      })
      .whereNull('processed')
      .whereNull('cancelled')

    if (!waivers.length) {
      return res.status(400).send({ error: 'invalid waiverId' })
    }

    const cancelled = Math.round(Date.now() / 1000)
    await db('waivers')
      .update('cancelled', cancelled)
      .where('uid', waiverId)

    res.send({
      uid: waiverId,
      tid,
      lid: leagueId,
      cancelled
    })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
