const express = require('express')
const router = express.Router()

const { constants, Roster } = require('../../../common')
const { getRoster } = require('../../../utils')

router.put('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { player, drop, leagueId } = req.body
    const teamId = parseInt(req.body, 10)

    if (!player) {
      return res.status(400).send({ error: 'missing player param' })
    }

    if (!drop) {
      return res.status(400).send({ error: 'missing drop param' })
    }

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId param' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId param' })
    }

    const playerIds = [player]
    if (drop) playerIds.push(drop)
    const playerRows = await db('player').whereIn('player', playerIds)
    if (playerRows.length !== playerIds.length) {
      return res.status(400).send({ error: 'invalid player ids' })
    }

    const playerTeams = await db('users_teams').where('userid', req.user.userId)
    const teamIds = playerTeams.map(p => p.tid)
    if (!teamIds.includes(teamId)) {
      return res.status(400).send({ error: 'invalid teamId' })
    }

    const leagues = await db('leagues').where({ uid: leagueId })
    if (!leagues.length) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

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
      return res.status(400).send({ error: 'invalid player' })
    }

    const poaches = await db('poaches')
      .where({ player })
      .whereNull('processed')
      .whereNull('expired')

    if (poaches.length) {
      return res.status(400).send({ error: 'player has existing poaching claim' })
    }

    const rosterRow = await getRoster({
      db,
      tid: teamId,
      week: constants.week,
      year: constants.year
    })
    const roster = new Roster({ roster: rosterRow, league })
    if (drop) roster.removePlayer(drop)

    const hasSlot = roster.hasOpenBenchSlot(playerRows[0].pos1)
    if (!hasSlot) {
      return res.status(400).send({ error: 'can not add player to roster, invalid roster' })
    }

    const data = {
      tid: teamId,
      player,
      drop,
      submitted: Math.round(Date.now() / 1000)
    }

    await db('poaches').insert(data)
    // TODO send out notifications

    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
