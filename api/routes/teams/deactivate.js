const express = require('express')
const dayjs = require('dayjs')
const router = express.Router({ mergeParams: true })

const { constants, Roster } = require('../../../common')
const {
  getRoster,
  getLeague,
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
      await verifyUserTeam({
        userId: req.user.userId,
        teamId,
        leagueId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    const tid = parseInt(teamId, 10)

    const league = await getLeague(leagueId)
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })

    // make sure player is on roster
    if (!roster.has(player)) {
      return res.status(400).send({ error: 'invalid player' })
    }

    // make sure player is not on practice squad
    if (roster.practice.find((p) => p.player === player)) {
      return res
        .status(400)
        .send({ error: 'player is already on practice squad' })
    }

    const players = await db('player').where('player', player).limit(1)
    const playerRow = players[0]

    const transactions = await getTransactionsSinceAcquisition({
      lid: leagueId,
      tid,
      player
    })
    const lastTransaction = transactions.reduce((a, b) =>
      a.timestamp > b.timestamp ? a : b
    )
    const isActive = Boolean(roster.active.find((p) => p.player === player))

    // make sure player has not been on the active roster for more than 48 hours
    const cutoff = dayjs.unix(lastTransaction.timestamp).add('48', 'hours')
    if (isActive && dayjs().isAfter(cutoff)) {
      return res
        .status(400)
        .send({ error: 'player has exceeded 48 hours on active roster' })
    }

    // make sure player he has not been previously activated
    if (
      transactions.find(
        (t) => t.type === constants.transactions.ROSTER_ACTIVATE
      )
    ) {
      return res.status(400).send({
        error: 'player can not be deactivated once previously activated'
      })
    }

    // make sure player has not been poached since the last time they were a free agent
    const transactionsSinceFA = await getTransactionsSinceFreeAgent({
      lid: leagueId,
      player
    })
    if (
      transactionsSinceFA.find((t) => t.type === constants.transactions.POACHED)
    ) {
      return res
        .status(400)
        .send({ error: 'player can not be deactivated once poached' })
    }

    // make sure team has space on practice squad
    if (!roster.hasOpenPracticeSquadSlot()) {
      return res
        .status(400)
        .send({ error: 'no available space on practice squad' })
    }

    await db('rosters_players').update({ slot: constants.slots.PS }).where({
      rid: rosterRow.uid,
      player
    })

    await db('league_cutlist').where({ player, tid }).del()

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
      league,
      notifyLeague: true,
      message
    })
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

module.exports = router
