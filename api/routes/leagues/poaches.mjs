import dayjs from 'dayjs'
import express from 'express'

import {
  submitPoach,
  verifyReserveStatus,
  verifyUserTeam,
  getRoster,
  getLeague
} from '#utils'
import { constants, Roster, getFreeAgentPeriod } from '#common'

const router = express.Router()

router.post('/?', async (req, res) => {
  const { db, logger, broadcast } = req.app.locals
  try {
    const { pid, release, leagueId } = req.body
    const teamId = parseInt(req.body.teamId, 10)

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
      .join('teams', 'users_teams.tid', 'teams.uid')
      .where('userid', req.auth.userId)
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
    if (!constants.season.isRegularSeason && league.adate) {
      const faPeriod = getFreeAgentPeriod(league.adate)
      if (constants.season.now.isBetween(faPeriod.start, faPeriod.end)) {
        return res.status(400).send({ error: 'Player on Sanctuary Period' })
      }
    }

    // verify player is not on waivers
    if (
      (tran.type === constants.transactions.ROSTER_DEACTIVATE ||
        tran.type === constants.transactions.DRAFT ||
        tran.type === constants.transactions.PRACTICE_ADD) &&
      dayjs().isBefore(dayjs.unix(tran.timestamp).add('48', 'hours'))
    ) {
      return res.status(400).send({ error: 'Player is on waivers' })
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

    const tid = parseInt(teamId, 10)
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
    const hasSlot = roster.hasOpenBenchSlot(poach_player_row.pos)
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
      await db('poach_releases').insert(releaseInserts).onConflict().merge()
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

export default router
