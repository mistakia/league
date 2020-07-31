const express = require('express')
const moment = require('moment')
const router = express.Router()
const API = require('groupme').Stateless

const { constants, Roster } = require('../../../common')
const { getRoster, sendNotifications } = require('../../../utils')

router.post('/?', async (req, res) => {
  const { db, logger, broadcast } = req.app.locals
  try {
    const { player, drop, leagueId } = req.body
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

    // verify player and drop ids
    const playerIds = [player]
    if (drop) playerIds.push(drop)
    const playerRows = await db('player').whereIn('player', playerIds)
    if (playerRows.length !== playerIds.length) {
      return res.status(400).send({ error: 'invalid players' })
    }
    const poachPlayer = playerRows.find(p => p.player === player)

    // verify poaching teamId using userId
    const userTeams = await db('users_teams')
      .join('teams', 'users_teams.tid', 'teams.uid')
      .where('userid', req.user.userId)
    const team = userTeams.find(p => p.tid === teamId)
    if (!team) {
      return res.status(400).send({ error: 'invalid teamId' })
    }

    // verify leagueId
    const leagues = await db('leagues').where({ uid: leagueId })
    if (!leagues.length) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // verify player is on a practice squad
    const league = leagues[0]
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

    // verify player is not on waivers - TODO DEPRECATE
    if (constants.poachWaiverWindow) {
      return res.status(400).send({ error: 'player is on waivers' })
    }
    const transactions = await db('transactions')
      .where({
        player,
        lid: leagueId
      })
      .orderBy('timestamp', 'desc')
      .limit(1)
    const tran = transactions[0]
    if ((tran.type === constants.transactions.ROSTER_DEACTIVATE ||
      tran.type === constants.transactions.DRAFT ||
      tran.type === constants.transactions.PRACTICE_ADD) &&
      moment().isBefore(moment(tran.timestamp, 'X').add('24', 'hours'))
    ) {
      return res.status(400).send({ error: 'player is on waivers' })
    }

    // verify no existing poaches exist
    const poaches = await db('poaches')
      .where({ player })
      .whereNull('processed')
      .whereNull('expired')
    if (poaches.length) {
      return res.status(400).send({ error: 'player has existing poaching claim' })
    }

    // verify poaching team roster has bench space
    const rosterRow = await getRoster({
      db,
      tid: teamId,
      week: constants.week,
      year: constants.year
    })
    const roster = new Roster({ roster: rosterRow, league })
    if (drop) roster.removePlayer(drop)
    const hasSlot = roster.hasOpenBenchSlot(poachPlayer.pos1)
    if (!hasSlot) {
      return res.status(400).send({ error: 'can not add player to roster, invalid roster' })
    }

    const data = {
      tid: teamId,
      lid: leagueId,
      player,
      drop,
      submitted: Math.round(Date.now() / 1000)
    }
    await db('poaches').insert(data)

    res.send(data)
    broadcast(leagueId, {
      type: 'POACH_SUBMITTED',
      payload: { data }
    })

    const message = `${team.name} has submitted a poaching claim for ${poachPlayer.fnam} ${poachPlayer.lname} (${poachPlayer.pos1})`
    sendNotifications({
      leagueId: league.uid,
      teamIds: [],
      voice: true,
      league: true,
      message
    })

    if (league.groupme_token && league.groupme_id) {
      API.Bots.post(league.groupme_token, league.groupme_id, message, {}, (err) => logger(err))
    }
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
