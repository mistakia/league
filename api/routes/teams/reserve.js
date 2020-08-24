const express = require('express')
const router = express.Router({ mergeParams: true })
const API = require('groupme').Stateless

const { constants, Roster } = require('../../../common')
const { getRoster, sendNotifications, verifyUserTeam } = require('../../../utils')

router.post('/?', async (req, res) => {
  const { db, logger, broadcast } = req.app.locals
  try {
    const { teamId } = req.params
    const { player, leagueId, slot } = req.body

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
      await verifyUserTeam({ userId: req.user.userId, teamId, leagueId, requireLeague: true })
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
    const rosterRow = await getRoster({
      tid,
      week: constants.season.week,
      year: constants.season.year
    })
    const roster = new Roster({ roster: rosterRow, league })
    const rosterPlayer = roster.get(player)
    if (!rosterPlayer) {
      return res.status(400).send({ error: 'invalid player' })
    }

    if (rosterPlayer.slot === slot) {
      return res.status(400).send({ error: 'player already on reserve' })
    }

    // make sure player is reserve eligible
    const players = await db('player')
      .select(db.raw('player.*, min(players.status) as status, min(players.injury_status) as injury_status, min(players.injury_body_part) as injury_body_part, transactions.value'))
      .leftJoin('players', 'player.player', 'players.player')
      .join('transactions', 'player.player', 'transactions.player')
      .orderBy('transactions.timestamp', 'desc')
      .orderBy('transactions.uid', 'desc')
      .groupBy('player.player')
      .where('player.player', player)
      .where({
        lid: leagueId,
        tid
      })

    const playerRow = players[0]

    if (!playerRow.status || playerRow.status === 'Active') {
      return res.status(400).send({ error: 'player not eligible for Reserve' })
    }

    if (slot === constants.slots.COV) {
      if (playerRow.status !== 'Reserve/COVID-19') {
        return res.status(400).send({ error: 'player not eligible for Reserve/COV' })
      }
    } else if (!roster.hasOpenInjuredReserveSlot()) {
      return res.status(400).send({ error: 'exceeds roster limits' })
    }

    // make sure player was on previous week roster
    const prevRosterRow = await getRoster({
      tid,
      week: Math.max(constants.season.week - 1, 0),
      year: constants.season.year
    })
    const prevRoster = new Roster({ roster: prevRosterRow, league })
    if (!prevRoster.has(player)) {
      return res.status(400).send({ error: 'not eligible, not rostered long enough' })
    }

    const type = slot === constants.slots.IR
      ? constants.transactions.RESERVE_IR
      : constants.transactions.RESERVE_COV
    await db('rosters_players')
      .update({ slot })
      .where({
        rid: rosterRow.uid,
        player
      })

    const transaction = {
      userid: req.user.userId,
      tid,
      lid: leagueId,
      player,
      type,
      value: playerRow.value,
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
      pos: playerRow.pos1
    }
    res.send(data)
    broadcast(leagueId, {
      type: 'ROSTER_UPDATE',
      payload: { data }
    })

    const teams = await db('teams').where({ uid: tid })
    const team = teams[0]

    const message = `${team.name} (${team.abbrv}) has placed ${playerRow.fname} ${playerRow.lname} (${playerRow.pos1}) on ${constants.transactionsDetail[type]}.`

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
