import dayjs from 'dayjs'
import express from 'express'

import report from './report.mjs'

import {
  constants,
  Roster,
  getDraftDates,
  isSantuaryPeriod,
  getFreeAgentPeriod
} from '#libs-shared'
import {
  getRoster,
  getLeague,
  isPlayerRostered,
  isPlayerOnWaivers,
  verifyUserTeam,
  verifyReserveStatus
} from '#libs-server'

const router = express.Router({ mergeParams: true })

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const type = parseInt(req.query.type, 10)

    if (!type) {
      return res.status(400).send({ error: 'missing type' })
    }

    const types = Object.values(constants.waivers)
    if (!types.includes(type)) {
      return res.status(400).send({ error: 'invalid type' })
    }

    const waivers = await db('waivers')
      .select('uid', 'processed')
      .where('lid', leagueId)
      .where('type', type)
      .whereNotNull('processed')
      .groupBy('processed')
      .orderBy('processed', 'desc')
    const waiverIds = waivers.map((p) => p.uid)
    const waiverReleases = await db('waiver_releases').whereIn(
      'waiverid',
      waiverIds
    )
    for (const waiver of waivers) {
      waiver.release = waiverReleases.filter((p) => p.waiverid === waiver.uid)
    }

    res.send(waivers)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.post('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { pid, leagueId, type, teamId } = req.body
    let { release } = req.body
    let bid = parseInt(req.body.bid || 0, 10)

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!Array.isArray(release)) {
      release = release ? [release] : []
    }

    if (constants.season.week > constants.season.finalWeek) {
      return res.status(400).send({ error: 'player is locked' })
    }

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    if (typeof type === 'undefined' || type === null) {
      return res.status(400).send({ error: 'missing type' })
    }

    if (!Object.values(constants.waivers).includes(type)) {
      return res.status(400).send({ error: 'invalid type' })
    }

    if (
      typeof bid !== 'undefined' &&
      (isNaN(bid) || bid < 0 || bid % 1 !== 0)
    ) {
      return res.status(400).send({ error: 'invalid bid' })
    }

    const tid = parseInt(teamId, 10)

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

    const pids = [pid]
    if (release.length) {
      release.forEach((release_pid) => pids.push(release_pid))
    }
    const player_rows = await db('player').whereIn('pid', pids)
    if (player_rows.length !== pids.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const player_row = player_rows[0]

    if (type === constants.waivers.FREE_AGENCY_PRACTICE) {
      // set bid to zero for practice squad waivers
      bid = 0

      // TODO - verify player was not previously on team active roster
    }

    const transactions = await db('transactions')
      .where('pid', pid)
      .where({ lid: leagueId })
      .orderBy('timestamp', 'desc')
      .orderBy('uid', 'desc')

    if (
      constants.season.isRegularSeason &&
      !constants.season.isWaiverPeriod &&
      !transactions.length
    ) {
      return res.status(400).send({ error: 'player is not on waivers' })
    }

    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    const faPeriod = getFreeAgentPeriod(league.free_agency_live_auction_start)

    // check free agency waivers
    if (
      type === constants.waivers.FREE_AGENCY ||
      type === constants.waivers.FREE_AGENCY_PRACTICE
    ) {
      // make sure player is not rostered
      const isRostered = await isPlayerRostered({ pid, leagueId })
      if (isRostered) {
        return res.status(400).send({ error: 'player rostered' })
      }

      if (constants.season.isRegularSeason) {
        // if regular season and not during waiver period, check if player is on release waivers
        if (!constants.season.isWaiverPeriod) {
          const isOnWaivers = await isPlayerOnWaivers({ pid, leagueId })
          if (!isOnWaivers) {
            return res.status(400).send({ error: 'player is not on waivers' })
          }
        }

        // otherwise, it's a waiver period and all players are on waivers
      } else {
        // Offseason

        // reject active roster waivers before start of free agenct period
        if (
          type === constants.waivers.FREE_AGENCY &&
          (!league.free_agency_live_auction_start ||
            dayjs().isBefore(faPeriod.start))
        ) {
          return res
            .status(400)
            .send({ error: 'active roster waivers not open' })
        }

        if (type === constants.waivers.FREE_AGENCY_PRACTICE) {
          const picks = await db('draft')
            .where({
              year: constants.season.year,
              lid: leagueId
            })
            .orderBy('pick', 'asc')
          const lastPick = picks[picks.length - 1]
          const draftDates = getDraftDates({
            start: league.draft_start,
            type: league.draft_type,
            min: league.draft_hour_min,
            max: league.draft_hour_max,
            picks: lastPick?.pick, // TODO — should be total number of picks in case some picks are missing due to decommissoned teams
            last_selection_timestamp: lastPick
              ? lastPick.selection_timestamp
              : null
          })

          // if player is a rookie
          if (player_row.start === constants.season.year) {
            // reject practice waivers before day after draft
            if (!league.draft_start || dayjs().isBefore(draftDates.draftEnd)) {
              return res.status(400).send({
                error: 'practice squad waivers are not open for rookies'
              })
            }

            // if after rookie draft waivers cleared and before free agency period, check if player is on release waivers
            if (
              league.draft_start &&
              dayjs().isAfter(draftDates.waiverEnd) &&
              (!league.free_agency_live_auction_start ||
                dayjs().isBefore(faPeriod.start))
            ) {
              const isOnWaivers = await isPlayerOnWaivers({ pid, leagueId })
              if (!isOnWaivers) {
                return res
                  .status(400)
                  .send({ error: 'player is not on waivers' })
              }
            }
          } else {
            // reject practice waivers for veterans before fa period
            if (
              !league.free_agency_live_auction_start ||
              dayjs().isBefore(faPeriod.start)
            ) {
              return res.status(400).send({
                error: 'practice squad waivers are not open for non-rookies'
              })
            }
          }
        }
      }

      // check for duplicate claims
      const claimsQuery = db('waivers')
        .where({ pid, lid: leagueId, tid, type })
        .whereNull('processed')
        .whereNull('cancelled')

      if (bid) {
        claimsQuery.where('bid', bid)
      }

      const claims = await claimsQuery

      if (claims.length) {
        // compare releases
        for (const claim of claims) {
          const release_rows = await db('waiver_releases').where(
            'waiverid',
            claim.uid
          )
          const existing_release_pids = release_rows.map((r) => r.pid)
          if (
            existing_release_pids.sort().join(',') === release.sort().join(',')
          ) {
            return res.status(400).send({ error: 'duplicate waiver claim' })
          }
        }
      }
    } else if (type === constants.waivers.POACH) {
      // player can not be on waivers if he has no transactions
      if (!transactions.length) {
        return res.status(400).send({ error: 'player is not on waivers' })
      }

      // player has been deactivated
      if (
        transactions[0].type !== constants.transactions.ROSTER_DEACTIVATE &&
        transactions[0].type !== constants.transactions.PRACTICE_ADD &&
        transactions[0].type !== constants.transactions.DRAFT
      ) {
        return res.status(400).send({ error: 'player is not on waivers' })
      }

      // verify it is not Regular Season or Free Agency Sanctuary Period
      if (isSantuaryPeriod(league)) {
        return res.status(400).send({ error: 'Santuary Period' })
      }

      // transaction should have been within the last 48 hours
      if (
        dayjs().isAfter(
          dayjs.unix(transactions[0].timestamp).add('48', 'hours')
        ) ||
        dayjs().isBefore(
          dayjs.unix(transactions[0].timestamp).add('24', 'hours')
        )
      ) {
        return res.status(400).send({ error: 'player is not on waivers' })
      }

      // verify player is on practice squad
      const slots = await db('rosters_players')
        .where({
          lid: leagueId,
          week: constants.season.week,
          year: constants.season.year,
          pid
        })
        .where(function () {
          this.where({
            slot: constants.slots.PS
          }).orWhere({
            slot: constants.slots.PSD
          })
        })
      if (!slots.length) {
        return res.status(400).send({
          error: 'player is not in an unprotected practice squad slot'
        })
      }

      // check for duplicate waiver
      const claims = await db('waivers')
        .where({ pid, lid: leagueId, tid })
        .whereNull('processed')
        .whereNull('cancelled')

      if (claims.length) {
        return res.status(400).send({ error: 'duplicate waiver claim' })
      }
    }

    // verify team has space for player on active roster
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })
    if (release.length) {
      for (const release_pid of release) {
        if (!roster.has(release_pid)) {
          return res.status(400).send({ error: 'invalid release' })
        }

        const releasePlayer = roster.get(release_pid)
        if (
          releasePlayer.slot === constants.slots.PSP ||
          releasePlayer.slot === constants.slots.PSDP
        ) {
          return res.status(400).send({ error: 'invalid release' })
        }
        roster.removePlayer(release_pid)
      }
    }
    const hasSlot =
      type === constants.waivers.FREE_AGENCY_PRACTICE
        ? roster.hasOpenPracticeSquadSlot()
        : roster.hasOpenBenchSlot(player_row.pos)
    if (!hasSlot) {
      return res.status(400).send({ error: 'exceeds roster limits' })
    }

    // check team reserve status
    try {
      await verifyReserveStatus({ teamId, leagueId })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    const data = {
      tid,
      userid: req.auth.userId,
      lid: leagueId,
      pid,
      po: 9999,
      submitted: Math.round(Date.now() / 1000),
      bid,
      type
    }
    const ids = await db('waivers').insert(data)
    data.uid = ids[0]
    if (release.length) {
      const releaseInserts = release.map((pid) => ({
        waiverid: ids[0],
        pid
      }))
      await db('waiver_releases').insert(releaseInserts)
    }

    data.release = release

    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.put('/order', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { waivers, teamId, leagueId } = req.body

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId param' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId param' })
    }

    if (!waivers || !Array.isArray(waivers)) {
      return res.status(400).send({ error: 'missing waivers array' })
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

    const result = []
    for (const [index, waiverId] of waivers.entries()) {
      await db('waivers').update('po', index).where({
        uid: waiverId,
        tid,
        lid: leagueId
      })
      result.push(waiverId)
    }
    res.send(result)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.put('/:waiverId', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { waiverId } = req.params
    const { teamId, leagueId } = req.body
    let { release } = req.body
    const bid = parseInt(req.body.bid || 0, 10)

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!Array.isArray(release)) {
      release = release ? [release] : []
    }

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    if (
      typeof bid !== 'undefined' &&
      (isNaN(bid) || bid < 0 || bid % 1 !== 0)
    ) {
      return res.status(400).send({ error: 'invalid bid' })
    }

    // verify teamId, leagueId belongs to user
    let team
    try {
      team = await verifyUserTeam({
        userId: req.auth.userId,
        leagueId,
        teamId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    const tid = parseInt(teamId, 10)

    // verify waiverId belongs to teamId
    const waivers = await db('waivers')
      .where({
        uid: waiverId,
        tid,
        lid: leagueId
      })
      .whereNull('processed')
      .whereNull('cancelled')

    if (!waivers.length) {
      return res.status(400).send({ error: 'invalid waiverId' })
    }
    const waiver = waivers[0]

    // if bid - make sure it is below available faab
    if (bid > team.faab) {
      return res.status(400).send({ error: 'bid exceeds available faab' })
    }

    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const player_rows = await db('player').where('pid', waiver.pid).limit(1)
    if (!player_rows.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const player_row = player_rows[0]

    // verify team has space for player on active roster
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })
    if (release.length) {
      for (const release_pid of release) {
        if (!roster.has(release_pid)) {
          return res.status(400).send({ error: 'invalid release' })
        }
        roster.removePlayer(release_pid)
      }
    }
    const hasSlot =
      waiver.type === constants.waivers.FREE_AGENCY_PRACTICE
        ? roster.hasOpenPracticeSquadSlot()
        : roster.hasOpenBenchSlot(player_row.pos)
    if (!hasSlot) {
      return res.status(400).send({ error: 'exceeds roster limits' })
    }

    await db('waivers').update({ bid }).where({ uid: waiverId })
    if (release.length) {
      const releaseInserts = release.map((pid) => ({
        waiverid: waiverId,
        pid
      }))
      await db('waiver_releases').insert(releaseInserts).onConflict().merge()
    }
    await db('waiver_releases')
      .del()
      .where('waiverid', waiverId)
      .whereNotIn('pid', release)

    res.send({ bid, release, uid: waiverId })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.post('/:waiverId/cancel', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (isNaN(req.params.waiverId)) {
      return res.status(400).send({ error: 'invalid waiverId' })
    }

    const waiverId = parseInt(req.params.waiverId, 10)
    const { teamId, leagueId } = req.body

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

    // verify waiverId belongs to teamId
    const waivers = await db('waivers')
      .where({
        uid: waiverId,
        tid,
        lid: leagueId
      })
      .whereNull('processed')
      .whereNull('cancelled')

    if (!waivers.length) {
      return res.status(400).send({ error: 'invalid waiverId' })
    }

    const cancelled = Math.round(Date.now() / 1000)
    await db('waivers').update('cancelled', cancelled).where('uid', waiverId)

    res.send({
      uid: waiverId,
      tid,
      lid: leagueId,
      cancelled
    })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.use('/report', report)

export default router
