import express from 'express'
import dayjs from 'dayjs'

import { constants, Roster, isDraftWindowOpen } from '#common'
import {
  getRoster,
  sendNotifications,
  verifyUserTeam,
  verifyReserveStatus,
  getLeague
} from '#utils'

const router = express.Router({ mergeParams: true })

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
    const { teamId, pid, pickId } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId' })
    }

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    if (!pickId) {
      return res.status(400).send({ error: 'missing pickId' })
    }

    try {
      await verifyUserTeam({
        userId: req.auth.userId,
        leagueId,
        teamId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }
    const lid = parseInt(leagueId, 10)

    // make sure draft has started
    const league = await getLeague({ lid })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    const draftStart = dayjs.unix(league.draft_start)
    if (constants.season.now.isBefore(draftStart)) {
      return res.status(400).send({ error: 'draft has not started' })
    }

    // check if previous pick has been made
    const picks = await db('draft').where({ uid: pickId }).whereNull('pid')
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
      pick.pick === 1 || Boolean(prevPick && prevPick.pid)

    // if previous selection is not made make, check if teams window has opened
    const isWindowOpen = isDraftWindowOpen({
      start: league.draft_start,
      pickNum: pick.pick,
      min: league.draft_hour_min,
      max: league.draft_hour_max,
      type: league.draft_type
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
    const player_rows = await db('player').where({ pid })
    const player_row = player_rows[0]
    if (!player_row || player_row.start !== constants.season.year) {
      return res.status(400).send({ error: 'invalid pid' })
    }

    // make sure player is available/undrafted
    const rosterPlayers = await db('rosters_players')
      .join('rosters', 'rosters_players.rid', 'rosters.uid')
      .where({ lid, year: constants.season.year, week: 0, pid })
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
    const value =
      league.num_teams - pick.pick + 1 > 0
        ? league.num_teams - pick.pick + 1
        : 1

    const insertRoster = db('rosters_players').insert({
      rid: roster.uid,
      pid,
      pos: player_row.pos,
      slot: constants.slots.PSD,
      extensions: 0
    })

    const insertTransaction = db('transactions').insert({
      userid: req.auth.userId,
      tid: teamId,
      lid,
      pid,
      type: constants.transactions.DRAFT,
      week: constants.season.week,
      year: constants.season.year,
      timestamp: Math.round(Date.now() / 1000),
      value
    })

    const updateDraft = db('draft').where({ uid: pickId }).update({ pid })

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

    const data = { uid: pickId, pid, lid, tid: teamId }
    broadcast(lid, {
      type: 'DRAFTED_PLAYER',
      payload: { data }
    })
    res.send(data)

    const teams = await db('teams').where({
      uid: teamId,
      year: constants.season.year
    })
    const team = teams[0]

    let message = `${team.name} has selected ${player_row.fname} ${player_row.lname} (${player_row.pos}) with `
    if (pick.pick === 1) {
      message += 'the first overall pick '
    } else {
      const pickNum = pick.pick % league.num_teams || league.num_teams
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

export default router
