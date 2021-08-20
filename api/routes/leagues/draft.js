const express = require('express')
const dayjs = require('dayjs')
const router = express.Router({ mergeParams: true })

const { constants, Roster, isDraftWindowOpen } = require('../../../common')
const {
  getRoster,
  sendNotifications,
  verifyUserTeam,
  verifyReserveStatus,
  getLeague
} = require('../../../utils')

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const year = req.query.year || constants.season.year

    const picks = await db('draft').where({ lid: leagueId, year })
    res.send({ picks })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

router.post('/?', async (req, res) => {
  const { db, logger, broadcast } = req.app.locals
  try {
    const { leagueId } = req.params
    const { teamId, playerId, pickId } = req.body

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId' })
    }

    if (!playerId) {
      return res.status(400).send({ error: 'missing playerId' })
    }

    if (!pickId) {
      return res.status(400).send({ error: 'missing pickId' })
    }

    try {
      await verifyUserTeam({
        userId: req.user.userId,
        leagueId,
        teamId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }
    const lid = parseInt(leagueId, 10)

    // make sure draft has started
    const league = await getLeague(lid)
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    const draftStart = dayjs.unix(league.ddate)
    if (constants.season.now.isBefore(draftStart)) {
      return res.status(400).send({ error: 'draft has not started' })
    }

    // check if previous pick has been made
    const picks = await db('draft').where({ uid: pickId }).whereNull('player')
    const pick = picks[0]
    if (!pick) {
      return res.status(400).send({ error: 'invalid pickId' })
    }
    if (pick.tid !== teamId) {
      return res.status(400).send({ error: 'invalid pickId' })
    }

    const prevQuery = await db('draft').where({
      pick: pick.pick - 1,
      lid,
      year: constants.season.year
    })
    const prevPick = prevQuery[0]
    const isPreviousSelectionMade =
      pick.pick === 1 || Boolean(prevPick && prevPick.player)

    // if previous selection is not made make, check if teams window has opened
    const isWindowOpen = isDraftWindowOpen({
      start: league.ddate,
      pickNum: pick.pick
    })
    if (!isPreviousSelectionMade && !isWindowOpen) {
      return res.status(400).send({ error: 'draft pick not on the clock' })
    }

    // verify no reserve violations
    try {
      await verifyReserveStatus({ teamId, leagueId })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    // make sure player is a rookie
    const players = await db('player').where({ player: playerId })
    const player = players[0]
    if (!player || player.start !== constants.season.year) {
      return res.status(400).send({ error: 'invalid playerId' })
    }

    // make sure player is available/undrafted
    const rosterPlayers = await db('rosters_players')
      .join('rosters', 'rosters_players.rid', 'rosters.uid')
      .where({ lid, year: constants.season.year, week: 0, player: playerId })
    if (rosterPlayers.length) {
      return res.status(400).send({ error: 'player rostered' })
    }

    // make sure team has an open slot
    const rosterRow = await getRoster({
      tid: teamId,
      year: constants.season.year,
      week: 0
    })
    const roster = new Roster({ roster: rosterRow, league })
    const slot = roster.hasOpenPracticeSquadSlot()
      ? constants.slots.PS
      : roster.hasOpenBenchSlot(player.pos) && constants.slots.BENCH

    if (!slot) {
      return res.status(400).send({ error: 'unavailable roster spot' })
    }

    const value =
      league.nteams - pick.pick + 1 > 0 ? league.nteams - pick.pick + 1 : 1

    if (slot === constants.slots.BENCH && roster.availableCap < value) {
      return res.status(400).send({ error: 'exceeds salary cap' })
    }

    const insertRoster = db('rosters_players').insert({
      rid: roster.uid,
      player: playerId,
      pos: player.pos,
      slot
    })

    const insertTransaction = db('transactions').insert({
      userid: req.user.userId,
      tid: teamId,
      lid,
      player: playerId,
      type: constants.transactions.DRAFT,
      year: constants.season.year,
      timestamp: Math.round(Date.now() / 1000),
      value
    })

    const updateDraft = db('draft')
      .where({ uid: pickId })
      .update({ player: playerId })

    const trades = await db('trades')
      .innerJoin('trades_picks', 'trades.uid', 'trades_picks.tradeid')
      .where('trades_picks.pickid', pickId)
      .whereNull('trades.accepted')
      .whereNull('trades.cancelled')
      .whereNull('trades.rejected')
      .whereNull('trades.vetoed')

    if (trades.length) {
      // TODO - broadcast on WS
      // TODO - broadcast notifications
      const tradeids = trades.map((t) => t.uid)
      await db('trades')
        .whereIn('uid', tradeids)
        .update({ cancelled: Math.round(Date.now() / 1000) })
    }

    await Promise.all([insertRoster, insertTransaction, updateDraft])

    const data = { uid: pickId, player: playerId, lid, tid: teamId }
    broadcast(lid, {
      type: 'DRAFTED_PLAYER',
      payload: { data }
    })
    res.send(data)

    const teams = await db('teams').where({ uid: teamId })
    const team = teams[0]

    let message = `${team.name} has selected ${player.fname} ${player.lname} (${player.pos}) with `
    if (pick.pick === 1) {
      message += 'the first overall pick '
    } else {
      const pickNum = pick.pick % league.nteams || league.nteams
      message += `pick #${pick.pick} (${pick.round}.${('0' + pickNum).slice(
        -2
      )}) `
    }
    message += `in the ${constants.season.year} draft`

    await sendNotifications({
      league,
      notifyLeague: true,
      message
    })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

module.exports = router
