import dayjs from 'dayjs'
import express from 'express'

import {
  submitPoach,
  verifyReserveStatus,
  verifyUserTeam,
  getRoster,
  getLeague,
  processPoach,
  sendNotifications
} from '#libs-server'
import { constants, Roster, get_free_agent_period } from '#libs-shared'

const router = express.Router()

router.post('/?', async (req, res) => {
  const { db, logger, broadcast } = req.app.locals
  try {
    const { pid, release, leagueId } = req.body
    const teamId = Number(req.body.teamId)

    if (constants.season.week > constants.season.finalWeek) {
      return res.status(400).send({ error: 'player is locked' })
    }

    if (!pid) {
      return res.status(400).send({ error: 'missing pid param' })
    }

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId param' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId param' })
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

    // verify poaching teamId using userId
    const userTeams = await db('users_teams')
      .join('teams', function () {
        this.on('users_teams.tid', '=', 'teams.uid')
        this.andOn('users_teams.year', '=', 'teams.year')
      })
      .where('userid', req.auth.userId)
      .where('teams.year', constants.season.year)
    const team = userTeams.find((p) => p.tid === teamId)
    if (!team) {
      return res.status(400).send({ error: 'invalid teamId' })
    }

    const transactions = await db('transactions')
      .where({
        pid,
        lid: leagueId
      })
      .orderBy('timestamp', 'desc')
      .orderBy('uid', 'desc')
      .limit(1)
    const tran = transactions[0]

    // verify player is not in sanctuary period
    if (
      (tran.type === constants.transactions.ROSTER_DEACTIVATE ||
        tran.type === constants.transactions.DRAFT ||
        tran.type === constants.transactions.PRACTICE_ADD) &&
      dayjs().isBefore(dayjs.unix(tran.timestamp).add('24', 'hours'))
    ) {
      return res.status(400).send({ error: 'Player on Sanctuary Period' })
    }

    const league = await getLeague({ lid: leagueId })
    if (
      !constants.season.isRegularSeason &&
      league.free_agency_live_auction_start
    ) {
      const faPeriod = get_free_agent_period(league)
      if (constants.season.now.isBetween(faPeriod.start, faPeriod.end)) {
        return res.status(400).send({ error: 'Player on Sanctuary Period' })
      }
    }

    // verify player is not in 24-hour sanctuary/waiver period
    if (
      (tran.type === constants.transactions.ROSTER_DEACTIVATE ||
        tran.type === constants.transactions.DRAFT ||
        tran.type === constants.transactions.PRACTICE_ADD) &&
      dayjs().isBefore(dayjs.unix(tran.timestamp).add('24', 'hours'))
    ) {
      return res
        .status(400)
        .send({ error: 'Player in 24-hour sanctuary/waiver period' })
    }

    // check team reserve status
    try {
      await verifyReserveStatus({ teamId, leagueId })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    let data
    try {
      data = await submitPoach({
        leagueId,
        release,
        pid,
        teamId,
        team,
        userId: req.auth.userId
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    res.send(data)
    broadcast(leagueId, {
      type: 'POACH_SUBMITTED',
      payload: { data }
    })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.put('/:poachId', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { poachId } = req.params
    const { teamId, leagueId } = req.body
    let { release } = req.body

    if (!Array.isArray(release)) {
      release = release ? [release] : []
    }

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    // verify teamId, leagueId belongs to user
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

    const tid = Number(teamId)
    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // verify poachId belongs to teamId
    const poaches = await db('poaches')
      .where({
        uid: poachId,
        tid,
        lid: leagueId
      })
      .whereNull('processed')

    if (!poaches.length) {
      return res.status(400).send({ error: 'invalid poachId' })
    }
    const poach = poaches[0]
    const player_rows = await db('player').where('pid', poach.pid)
    const poach_player_row = player_rows[0]

    // verify release players exists
    const players = await db('player').whereIn('pid', release)
    if (players.length !== release.length) {
      return res.status(400).send({ error: 'invalid release' })
    }

    // verify release player not use in different poach
    const otherPendingPoachReleases = await db('poaches')
      .select('poach_releases.pid')
      .join('poach_releases', 'poaches.uid', 'poach_releases.poachid')
      .whereNot('uid', poachId)
      .whereNull('processed')

    const otherPoachReleasePlayers = otherPendingPoachReleases.map((p) => p.pid)
    for (const releasePlayerId of release) {
      if (otherPoachReleasePlayers.includes(releasePlayerId)) {
        return res
          .status(400)
          .send({ error: 'release player used in another poach' })
      }
    }

    // verify team has space for poach player
    const rosterRow = await getRoster({ tid: teamId })
    const roster = new Roster({ roster: rosterRow, league })
    if (release.length) {
      for (const releasePlayerId of release) {
        if (!roster.has(releasePlayerId)) {
          return res
            .status(400)
            .send({ error: 'invalid release player, not on roster' })
        }
        roster.removePlayer(releasePlayerId)
      }
    }
    const hasSlot = roster.has_bench_space_for_position(poach_player_row.pos)
    if (!hasSlot) {
      return res
        .status(400)
        .send({ error: 'invalid release player, exceeds roster limits' })
    }

    // verify team has salary space during offseason
    const transactions = await db('transactions')
      .where({ pid: poach_player_row.pid, lid: leagueId })
      .orderBy('timestamp', 'desc')
      .orderBy('uid', 'desc')
      .limit(1)
    const tran = transactions[0]
    const playerPoachValue = tran.value + 2
    if (
      !constants.season.isRegularSeason &&
      roster.availableCap - playerPoachValue < 0
    ) {
      return res.status(400).send({ error: 'not enough available cap' })
    }

    // update releases
    if (release.length) {
      const releaseInserts = release.map((pid) => ({
        poachid: poachId,
        pid
      }))
      await db('poach_releases')
        .insert(releaseInserts)
        .onConflict(['poachid', 'pid'])
        .merge()
    }
    await db('poach_releases')
      .del()
      .where('poachid', poachId)
      .whereNotIn('pid', release)

    res.send({ ...poach, release })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.post('/:poachId/process', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { poachId } = req.params

    const poaching_claim = await db('poaches')
      .where({
        uid: poachId
      })
      .whereNull('processed')
      .first()

    if (!poaching_claim) {
      return res.status(400).send({ error: 'invalid poachId' })
    }

    const { lid, player_tid } = poaching_claim

    // verify poached player belongs to user controlled team
    try {
      await verifyUserTeam({
        userId: req.auth.userId,
        leagueId: lid,
        teamId: player_tid,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    let player_row
    let error
    try {
      const player_rows = await db('player')
        .where({ pid: poaching_claim.pid })
        .limit(1)
      player_row = player_rows[0]

      const release = await db('poach_releases')
        .select('pid')
        .where('poachid', poaching_claim.uid)

      await processPoach({
        release: release.map((r) => r.pid),
        ...poaching_claim
      })
      logger(
        `poaching claim awarded to teamId: (${poaching_claim.tid}) for ${poaching_claim.pid}`
      )
    } catch (err) {
      error = err
      logger(
        `poaching claim unsuccessful by teamId: (${poaching_claim.tid}) because ${error.message}`
      )
      const league = await getLeague({ lid: poaching_claim.lid })
      await sendNotifications({
        league,
        teamIds: [poaching_claim.tid],
        voice: false,
        notifyLeague: false,
        message: player_row
          ? `Your poaching claim for ${player_row.fname} ${player_row.lname} (${player_row.pos}) was unsuccessful`
          : 'Your poaching claim was unsuccessful.'
      })
    }

    const timestamp = Math.round(Date.now() / 1000)
    await db('poaches')
      .update('processed', timestamp)
      .update('reason', error ? error.message : null) // TODO - add error codes
      .update('succ', error ? 0 : 1)
      .where({
        pid: poaching_claim.pid,
        tid: poaching_claim.tid,
        lid: poaching_claim.lid
      })

    const processed_claim = await db('poaches')
      .where({
        uid: poachId
      })
      .first()

    res.send(processed_claim)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
