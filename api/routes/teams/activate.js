const express = require('express')
const API = require('groupme').Stateless
const router = express.Router({ mergeParams: true })

const { constants, Roster } = require('../../../common')
const { getRoster, sendNotifications, verifyUserTeam } = require('../../../utils')

router.post('/?', async (req, res) => {
  const { db, logger, broadcast } = req.app.locals
  try {
    const { teamId } = req.params
    const { player, leagueId } = req.body

    // verify teamId
    try {
      await verifyUserTeam({ userId: req.user.userId, teamId })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    const tid = parseInt(teamId, 10)
    const leagues = await db('leagues').where({ uid: leagueId })
    if (!leagues.length) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const league = leagues[0]
    const rosterRow = await getRoster({ tid, week: constants.week, year: constants.year })
    const roster = new Roster({ roster: rosterRow, league })

    // make sure player is on team
    if (!roster.has(player)) {
      return res.status(400).send({ error: 'invalid player' })
    }

    // make sure player is on practice squad
    if (!roster.practice.find(p => p.player === player)) {
      return res.status(400).send({ error: 'player is not on practice squad' })
    }

    const players = await db('player')
      .join('transactions', 'player.player', 'transactions.player')
      .where('player.player', player)
      .where({
        lid: leagueId,
        tid
      })
      .orderBy('transactions.timestamp', 'desc')
    const playerRow = players[0]

    // make sure team has space on active roster
    if (!roster.hasOpenBenchSlot(playerRow.pos1)) {
      return res.status(400).send({ error: 'no available space on active roster' })
    }

    await db('rosters_players')
      .update({ slot: constants.slots.BENCH })
      .where({
        rid: rosterRow.uid,
        player
      })

    const transaction = {
      userid: req.user.userId,
      tid,
      lid: leagueId,
      player,
      type: constants.transactions.ROSTER_ACTIVATE,
      value: playerRow.value,
      year: constants.year,
      timestamp: Math.round(Date.now() / 1000)
    }
    await db('transactions').insert(transaction)

    res.send({ player, slot: constants.slots.BENCH, transaction })
    broadcast(leagueId, {
      type: 'ROSTER_ACTIVATION',
      payload: {
        ...transaction,
        slot: constants.slots.BENCH
      }
    })

    const teams = await db('teams').where({ uid: tid })
    const team = teams[0]

    const message = `${team.name} (${team.abbrv}) has activated ${playerRow.fname} ${playerRow.lname} (${playerRow.pos1}).`

    await sendNotifications({
      leagueId: league.uid,
      league: true,
      message
    })

    if (league.groupme_token && league.groupme_id) {
      API.Bots.post(league.groupme_token, league.groupme_id, message, {}, (err) => logger(err))
    }
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

module.exports = router
