const express = require('express')
const moment = require('moment')
const API = require('groupme').Stateless
const router = express.Router({ mergeParams: true })

const { constants, Roster } = require('../../../common')
const {
  getRoster,
  sendNotifications,
  verifyUserTeam,
  getTransactionsSinceAcquisition,
  getTransactionsSinceFreeAgent
} = require('../../../utils')

router.post('/?', async (req, res) => {
  const { db, logger, broadcast } = req.app.locals
  try {
    const { teamId } = req.params
    const { player, leagueId } = req.body

    if (!player) {
      return res.status(400).send({ error: 'missing player' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    // verify teamId
    try {
      await verifyUserTeam({ userId: req.user.userId, teamId, leagueId, requireLeague: true })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    const tid = parseInt(teamId, 10)

    const leagues = await db('leagues').where({ uid: leagueId })
    if (!leagues.length) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const league = leagues[0]
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })

    // make sure player is on roster
    if (!roster.has(player)) {
      return res.status(400).send({ error: 'invalid player' })
    }

    // make sure player is not on practice squad
    if (roster.practice.find(p => p.player === player)) {
      return res.status(400).send({ error: 'player is already on practice squad' })
    }

    const players = await db('player').where('player', player).limit(1)
    const playerRow = players[0]

    const transactions = await getTransactionsSinceAcquisition({
      lid: leagueId,
      tid,
      player
    })
    const lastTransaction = transactions.reduce((a, b) => a.timestamp > b.timestamp ? a : b)

    // make sure player is a rookie OR not on a team OR on a teams practice squad
    if (playerRow.start !== constants.season.year && playerRow.posd !== 'PS' && playerRow.cteam !== 'INA') {
      return res.status(400).send({ error: 'player is not practice squad eligible' })
    }

    // make sure player has not been on the active roster for more than 48 hours
    const cutoff = moment(lastTransaction.timestamp, 'X').add('48', 'hours')
    if (moment().isAfter(cutoff)) {
      return res.status(400).send({ error: 'player has exceeded 48 hours on active roster' })
    }

    // if on active roster, make sure player he has not been previously deactivated
    const isActive = !!roster.active.find(p => p.player === player)
    if (isActive && transactions.find(t => t.type === constants.transactions.ROSTER_DEACTIVATE || t.type === constants.transactions.PRACTICE_ADD)) {
      return res.status(400).send({ error: 'player can not be deactivated once activated' })
    }

    // make sure player has not been poached since the last time they were a free agent
    const transactionsSinceFA = await getTransactionsSinceFreeAgent({
      lid: leagueId,
      player
    })
    if (transactionsSinceFA.find(t => t.type === constants.transactions.POACHED)) {
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
      value: lastTransaction.value,
      year: constants.season.year,
      timestamp: Math.round(Date.now() / 1000)
    }
    await db('transactions').insert(transaction)

    const data = {
      player,
      tid,
      slot: constants.slots.PS,
      rid: roster.uid,
      pos: playerRow.pos,
      transaction
    }
    res.send(data)
    broadcast(leagueId, {
      type: 'ROSTER_TRANSACTION',
      payload: { data }
    })

    const teams = await db('teams').where({ uid: tid })
    const team = teams[0]

    const message = `${team.name} (${team.abbrv}) has placed ${playerRow.fname} ${playerRow.lname} (${playerRow.pos}) on the practice squad.`

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
