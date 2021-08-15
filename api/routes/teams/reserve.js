const express = require('express')
const router = express.Router({ mergeParams: true })
const API = require('groupme').Stateless

const {
  constants,
  Roster,
  isReserveEligible,
  isReserveCovEligible
} = require('../../../common')
const {
  getRoster,
  sendNotifications,
  verifyUserTeam,
  isPlayerLocked
} = require('../../../utils')

router.post('/?', async (req, res) => {
  const { db, logger, broadcast } = req.app.locals
  try {
    const { teamId } = req.params
    const { player, leagueId, slot } = req.body

    if (constants.season.week > constants.season.finalWeek) {
      return res.status(400).send({ error: 'player locked' })
    }

    if (!player) {
      return res.status(400).send({ error: 'missing player' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    if (!slot) {
      return res.status(400).send({ error: 'missing slot' })
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

    const slots = [constants.slots.IR, constants.slots.COV]
    if (!slots.includes(slot)) {
      return res.status(400).send({ error: 'invalid slot' })
    }

    // make sure player is on active roster
    const leagues = await db('leagues').where({ uid: leagueId })
    if (!leagues.length) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const league = leagues[0]
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })
    const rosterPlayer = roster.get(player)
    if (!rosterPlayer) {
      return res.status(400).send({ error: 'invalid player' })
    }

    if (rosterPlayer.slot === slot) {
      return res.status(400).send({ error: 'player already on reserve' })
    }

    // make sure player is not protected
    if (rosterPlayer.slot === constants.slots.PSP) {
      return res
        .status(400)
        .send({ error: 'protected players are not reserve eligible' })
    }

    // make sure player is reserve eligible
    const players = await db('player').where('player', player)
    const playerRow = players[0]

    if (slot === constants.slots.COV) {
      if (!isReserveCovEligible(playerRow)) {
        return res
          .status(400)
          .send({ error: 'player not eligible for Reserve/COV' })
      }
    } else {
      if (!isReserveEligible(playerRow)) {
        return res
          .status(400)
          .send({ error: 'player not eligible for Reserve' })
      }

      if (!roster.hasOpenInjuredReserveSlot()) {
        return res.status(400).send({ error: 'exceeds roster limits' })
      }
    }

    // make sure player was on previous week roster
    const prevRosterRow = await getRoster({
      tid,
      week: Math.max(constants.season.week - 1, 0),
      year: constants.season.year
    })
    const prevRoster = new Roster({ roster: prevRosterRow, league })
    if (!prevRoster.has(player)) {
      return res
        .status(400)
        .send({ error: 'not eligible, not rostered long enough' })
    }

    // verify player is not locked and is a starter
    const isLocked = await isPlayerLocked(player)
    const isStarter = !!roster.starters.find((p) => p.player === player)
    if (isLocked && isStarter) {
      return res.status(400).send({ error: 'not eligible, locked starter' })
    }

    const type =
      slot === constants.slots.IR
        ? constants.transactions.RESERVE_IR
        : constants.transactions.RESERVE_COV
    await db('rosters_players').update({ slot }).where({
      rid: rosterRow.uid,
      player
    })

    const transactions = await db('transactions')
      .orderBy('transactions.timestamp', 'desc')
      .orderBy('transactions.uid', 'desc')
      .where({
        player,
        lid: leagueId,
        tid
      })
      .limit(1)
    const { value } = transactions[0]

    const transaction = {
      userid: req.user.userId,
      tid,
      lid: leagueId,
      player,
      type,
      value,
      year: constants.season.year,
      timestamp: Math.round(Date.now() / 1000)
    }
    await db('transactions').insert(transaction)

    const data = {
      transaction,
      slot,
      player,
      rid: roster.uid,
      tid,
      pos: playerRow.pos
    }
    res.send(data)
    broadcast(leagueId, {
      type: 'ROSTER_TRANSACTION',
      payload: { data }
    })

    const teams = await db('teams').where({ uid: tid })
    const team = teams[0]

    const message = `${team.name} (${team.abbrv}) has placed ${playerRow.fname} ${playerRow.lname} (${playerRow.pos}) on ${constants.transactionsDetail[type]}.`

    await sendNotifications({
      leagueId: league.uid,
      league: true,
      message
    })

    if (league.groupme_token && league.groupme_id) {
      API.Bots.post(
        league.groupme_token,
        league.groupme_id,
        message,
        {},
        (err) => logger(err)
      )
    }
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

module.exports = router
