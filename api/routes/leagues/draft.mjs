import express from 'express'
import dayjs from 'dayjs'

import {
  constants,
  Roster,
  isDraftWindowOpen,
  getDraftDates,
  get_last_consecutive_pick
} from '#libs-shared'
import {
  getRoster,
  sendNotifications,
  verifyUserTeam,
  verifyReserveStatus,
  getLeague
} from '#libs-server'

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

    // make sure draft has not ended
    const last_pick = await db('draft')
      .where({
        year: constants.season.year,
        lid: leagueId
      })
      .orderBy('pick', 'desc')
      .first()

    const draftDates = getDraftDates({
      start: league.draft_start,
      type: league.draft_type,
      min: league.draft_hour_min,
      max: league.draft_hour_max,
      picks: last_pick?.pick, // TODO — should be total number of picks in case some picks are missing due to decommissoned teams
      last_selection_timestamp: last_pick ? last_pick.selection_timestamp : null
    })

    if (constants.season.now.isAfter(draftDates.draftEnd)) {
      return res.status(400).send({ error: 'draft has ended' })
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

    // previous pick might not be pick - 1 if it belonged to a commissioned team
    const prev_pick = await db('draft')
      .where({
        lid,
        year: constants.season.year
      })
      .where('pick', '<', pick.pick)
      .orderBy('pick', 'desc')
      .first()
    const isPreviousSelectionMade =
      pick.pick === 1 || Boolean(prev_pick && prev_pick.pid)

    // locate the last consecutive pick going back to the first pick
    const draft_picks = await db('draft')
      .where({ lid, year: constants.season.year })
      .orderBy('pick', 'asc')
    const last_consective_pick = get_last_consecutive_pick(draft_picks)

    // if previous selection is not made make, check if teams window has opened
    const isWindowOpen = isDraftWindowOpen({
      last_consective_pick,
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
    if (!player_row || player_row.nfl_draft_year !== constants.season.year) {
      return res.status(400).send({ error: 'invalid pid' })
    }

    // make sure player is available/undrafted
    const rosterPlayers = await db('rosters_players').where({
      lid,
      year: constants.season.year,
      week: 0,
      pid
    })
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

    await db('rosters_players').insert({
      rid: roster.uid,
      pid,
      pos: player_row.pos,
      slot: constants.slots.PSD,
      extensions: 0,
      tid: teamId,
      lid,
      year: constants.season.year,
      week: 0
    })

    await db('transactions').insert({
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

    await db('draft')
      .where({ uid: pickId })
      .update({
        pid,
        selection_timestamp: Math.round(Date.now() / 1000)
      })

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
      message += `pick #${pick.pick} (${pick.pick_str}) `
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
