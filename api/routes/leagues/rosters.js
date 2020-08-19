const express = require('express')
const router = express.Router()

const { constants, Roster } = require('../../../common')
const { getLeague, getRoster } = require('../../../utils')

router.post('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { player, teamId, leagueId } = req.body
    const value = req.body.value || 0
    if (!player) {
      return res.status(400).send({ error: 'missing player' })
    }

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    // verify player
    const players = await db('player').where({ player })
    const playerRow = players[0]
    if (!playerRow) {
      return res.status(400).send({ error: 'invalid player' })
    }

    // verify leagueId
    const league = await getLeague(leagueId)
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // verify user is commish
    if (league.commishid !== req.user.userId) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // verify value
    if (typeof value !== 'undefined' && (isNaN(value) || value < 0 || value % 1 !== 0)) {
      return res.status(400).send({ error: 'invalid value' })
    }

    const rosterRow = await getRoster({
      tid: teamId,
      week: constants.season.week,
      year: constants.season.year
    })
    const roster = new Roster({ roster: rosterRow, league })
    if (!roster.availableSpace) {
      return res.status(400).send({ error: 'exceeds roster limits' })
    }

    const val = parseInt(value, 10)
    if (roster.availableCap < val) {
      return res.status(400).send({ error: 'exceeds cap space' })
    }

    // create transactions
    const transaction = {
      userid: req.user.userId,
      tid: teamId,
      lid: leagueId,
      player,
      type: constants.transactions.ROSTER_ADD,
      value: val,
      year: constants.season.year,
      timestamp: Math.round(Date.now() / 1000)
    }
    await db('transactions').insert(transaction)

    // add player to roster
    const rosterInsert = {
      rid: roster.uid,
      player,
      pos: playerRow.pos1,
      slot: constants.slots.BENCH
    }
    await db('rosters_players').insert(rosterInsert)

    res.send({
      ...rosterInsert,
      transaction
    })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.put('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { player, teamId, leagueId, value } = req.body

    if (typeof value === 'undefined') {
      return res.status(400).send({ error: 'missing value' })
    }

    if (!player) {
      return res.status(400).send({ error: 'missing player' })
    }

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    // verify player
    const players = await db('player').where({ player })
    const playerRow = players[0]
    if (!playerRow) {
      return res.status(400).send({ error: 'invalid player' })
    }

    // verify leagueId
    const league = await getLeague(leagueId)
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // verify user is commish
    if (league.commishid !== req.user.userId) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // verify value
    if (typeof value !== 'undefined' && (isNaN(value) || value < 0 || value % 1 !== 0)) {
      return res.status(400).send({ error: 'invalid value' })
    }

    // verify team cap
    const rosterRow = await getRoster({
      tid: teamId,
      week: constants.season.week,
      year: constants.season.year
    })
    const roster = new Roster({ roster: rosterRow, league })
    roster.removePlayer(player)
    const val = parseInt(value, 10)
    if (roster.availableCap < val) {
      return res.status(400).send({ error: 'exceeds cap space' })
    }

    // update player value
    await db('transactions').where({
      player,
      tid: teamId,
      lid: leagueId
    }).update({
      value: val
    })

    res.send({ value: val })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.delete('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    // verify user is commish
    const { player, teamId, leagueId } = req.body
    if (!player) {
      return res.status(400).send({ error: 'missing player' })
    }

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    // verify player
    const players = await db('player').where({ player })
    const playerRow = players[0]
    if (!playerRow) {
      return res.status(400).send({ error: 'invalid player' })
    }

    // verify leagueId
    const league = await getLeague(leagueId)
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // verify user is commish
    if (league.commishid !== req.user.userId) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    const rosters = await db('rosters').where({
      tid: teamId,
      lid: leagueId,
      week: constants.season.week,
      year: constants.season.year
    })
    const roster = rosters[0]
    if (!roster) {
      return res.status(400).send({ error: 'player not on roster' })
    }

    const transaction = await db('transactions').where({
      player,
      tid: teamId,
      lid: leagueId
    }).del()

    const rosterRes = await db('rosters_players').where({
      rid: roster.uid,
      player
    }).del()

    res.send({ roster: rosterRes, transaction })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
