const express = require('express')
const moment = require('moment')
const API = require('groupme').Stateless
const router = express.Router({ mergeParams: true })

const { constants, Roster } = require('../../../common')
const { getRoster, sendNotifications } = require('../../../utils')

router.post('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const { player, leagueId } = req.body

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

    // make sure player is on active roster
    if (!roster.active.find(p => p.player === player)) {
      return res.status(400).send({ error: 'player is not on active roster' })
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

    // make sure player is a rookie
    if (playerRow.start !== constants.year) {
      return res.status(400).send({ error: 'player is not a rookie' })
    }

    // make sure player has not been on the active roster for more than 48 hours
    const cutoff = moment(playerRow.timestamp, 'X').add('48', 'hours')
    if (moment().isAfter(cutoff)) {
      return res.status(400).send({ error: 'player has exceeded 48 hours on active roster' })
    }

    // make sure player has not been activated recently
    if (playerRow.type === constants.transactions.ROSTER_ACTIVATE) {
      return res.status(400).send({ error: 'player can not be deactivated once activated' })
    }

    // make sure player has not been poached
    if (playerRow.type === constants.transactions.POACHED) {
      return res.status(400).send({ error: 'player can not be deactivated once poached' })
    }

    // make sure team has space on practice squad
    if (!roster.hasOpenPracticeSquadSlot()) {
      return res.status(400).send({ error: 'no available space on practice squad' })
    }

    await db('rosters_players')
      .update({ slot: constants.slots.PS })
      .where({
        rid: rosterRow.uid,
        player
      })

    const transaction = {
      userid: req.user.userId,
      tid,
      lid: leagueId,
      player,
      type: constants.transactions.ROSTER_DEACTIVATE,
      value: playerRow.value,
      year: constants.year,
      timestamp: Math.round(Date.now() / 1000)
    }
    await db('transactions').insert(transaction)

    res.send({ player, slot: constants.slots.PS, transaction })

    const teams = await db('teams').where({ uid: tid })
    const team = teams[0]

    const message = `${team.name} (${team.abbrv}) has placed ${playerRow.fname} ${playerRow.lname} (${playerRow.pos1}) on the practice squad.`

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
