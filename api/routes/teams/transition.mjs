import express from 'express'
import dayjs from 'dayjs'

import { constants, Roster } from '#libs-shared'
import {
  getRoster,
  getLeague,
  verifyUserTeam,
  verifyReserveStatus
} from '#libs-server'

const router = express.Router({ mergeParams: true })

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    // verify teamId belongs to userId
    try {
      await verifyUserTeam({
        userId: req.auth.userId,
        teamId
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    const transitionBids = await db('transition_bids')
      .where({
        tid: teamId,
        year: constants.season.year
      })
      .whereNull('processed')
      .whereNull('cancelled')

    res.send(transitionBids)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.post('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const { pid, leagueId, remove } = req.body
    const playerTid = Number(req.body.playerTid || 0)
    let { release } = req.body
    const bid = Number(req.body.bid || 0)

    if (!Array.isArray(release)) {
      release = release ? [release] : []
    }

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    if (typeof bid === 'undefined') {
      return res.status(400).send({ error: 'missing bid' })
    }

    if (!playerTid) {
      return res.status(400).send({ error: 'missing playerTid' })
    }

    if (pid === remove) {
      return res.status(400).send({ error: 'invalid remove' })
    }

    if (release.includes(pid)) {
      return res.status(400).send({ error: 'invalid release' })
    }

    if (
      typeof bid !== 'undefined' &&
      (isNaN(bid) || bid < 0 || bid % 1 !== 0)
    ) {
      return res.status(400).send({ error: 'invalid bid' })
    }

    const tid = Number(teamId)

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

    // get players info
    const pids = [pid]
    if (release.length) {
      release.forEach((pid) => pids.push(pid))
    }
    const player_rows = await db('player').whereIn('pid', pids)
    if (player_rows.length !== pids.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const player_row = player_rows[0]

    // get league info
    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // get roster
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })

    // check for reserve violations
    try {
      await verifyReserveStatus({ teamId, leagueId })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    // check if release players are on team
    if (release.length) {
      for (const release_pid of release) {
        if (!roster.has(release_pid)) {
          return res.status(400).send({ error: 'invalid release' })
        }
        roster.removePlayer(release_pid)
      }
    }

    if (remove && !roster.has(remove)) {
      return res.status(400).send({ error: 'invalid remove player' })
    }

    // if original bid, check if on team
    if (playerTid === tid) {
      if (!roster.has(pid)) {
        return res.status(400).send({ error: 'invalid player' })
      }

      // make sure restricted free agency period has not passed
      if (
        league.tran_end &&
        constants.season.now.isAfter(dayjs.unix(league.tran_end))
      ) {
        return res
          .status(400)
          .send({ error: 'restricted free agency deadline has passed' })
      }

      // update value to bid
      roster.updateValue(pid, bid)

      // make sure tag does not exceed limits
      if (remove) {
        roster.removeTag(remove)
      }
      const isEligible = roster.isEligibleForTag({
        tag: constants.tags.TRANSITION
      })
      if (!isEligible) {
        return res.status(400).send({ error: 'exceeds tag limit' })
      }

      // make sure bid is within $10 of market salary
      const market_salary = await db('league_format_player_projection_values')
        .select('market_salary')
        .where({
          pid,
          week: 0,
          year: constants.season.year,
          league_format_hash: league.league_format_hash
        })
        .first()

      // TODO setup mocks for tests
      // if (!market_salary) {
      //   return res.status(400).send({ error: 'market salary not found' })
      // }

      if (market_salary) {
        const salary_difference = bid - market_salary.market_salary
        if (salary_difference < -10) {
          return res.status(400).send({
            error: 'bid must not be more than $10 below market salary'
          })
        }
      }
    } else {
      // check if transition bid exists
      const transition_bid = await db('transition_bids')
        .where({
          pid,
          tid: playerTid,
          lid: leagueId,
          year: constants.season.year
        })
        .whereNull('processed')
        .whereNull('cancelled')
        .first()

      if (!transition_bid) {
        return res.status(400).send({ error: 'invalid player' })
      }
    }

    const cutlist = await db('league_cutlist').select('pid').where('tid', tid)

    for (const row of cutlist) {
      roster.removePlayer(row.pid)
    }

    // if competing bid, make sure there is roster space
    if (playerTid !== tid) {
      if (!roster.hasOpenBenchSlot(player_row.pos)) {
        return res.status(400).send({ error: 'exceeds roster limits' })
      }

      // add to roster
      roster.addPlayer({
        slot: constants.slots.BENCH,
        pid,
        pos: player_row.pos,
        value: bid
      })
    }

    // make sure there is enough cap space
    // TODO
    /* if (roster.availableCap < 0) {
     *   return res.status(400).send({ error: 'exceeds salary cap' })
     * }
     */

    if (playerTid === tid) {
      await db('rosters_players')
        .update({ tag: constants.tags.TRANSITION })
        .where({
          rid: rosterRow.uid,
          pid
        })

      await db('league_cutlist')
        .where({
          pid,
          tid
        })
        .del()

      if (remove) {
        await db('rosters_players').update({ tag: 1 }).where({
          rid: rosterRow.uid,
          pid: remove
        })

        await db('transition_bids')
          .where({
            pid: remove,
            tid,
            year: constants.season.year
          })
          .update({
            cancelled: Math.round(Date.now() / 1000)
          })
      }
    }

    // insert into transitionBids
    const data = {
      tid,
      userid: req.auth.userId,
      lid: leagueId,
      pid,
      submitted: Math.round(Date.now() / 1000),
      year: constants.season.year,
      bid,
      player_tid: playerTid
    }

    const query = await db('transition_bids').insert(data).returning('uid')
    const transition_id = query[0].uid
    data.uid = transition_id

    if (release.length) {
      const releaseInserts = release.map((pid) => ({
        transitionid: transition_id,
        pid
      }))
      await db('transition_releases').insert(releaseInserts)
    }

    data.release = release
    data.remove = remove

    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.delete('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const { pid, leagueId } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
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

    // get roster
    const rosterRow = await getRoster({ tid })

    // get league info
    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // make sure transition deadline has not passed
    if (
      league.tran_end &&
      constants.season.now.isAfter(dayjs.unix(league.tran_end))
    ) {
      return res
        .status(400)
        .send({ error: 'restricted free agency deadline has passed' })
    }

    // verify transition id exists
    const query1 = await db('transition_bids')
      .where({
        pid,
        tid,
        year: constants.season.year
      })
      .whereNull('cancelled')

    if (!query1.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const transitionBid = query1[0]

    // check if bid has already been processed
    if (transitionBid.processed) {
      return res.status(400).send({ error: 'bid has already been processed' })
    }

    const is_current_manager_bid =
      transitionBid.player_tid === transitionBid.tid
    if (is_current_manager_bid && transitionBid.announced) {
      return res
        .status(400)
        .send({ error: 'restricted free agent has already been announced' })
    }

    // cancel bid
    const cancelled = Math.round(Date.now() / 1000)
    await db('transition_bids')
      .update('cancelled', cancelled)
      .where('uid', transitionBid.uid)

    // TODO cancel any pending competing bids

    // update tag
    await db('rosters_players').update({ tag: constants.tags.REGULAR }).where({
      rid: rosterRow.uid,
      pid
    })

    res.send({ ...transitionBid, cancelled })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.put('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const { pid, leagueId } = req.body
    let { release } = req.body
    const bid = parseInt(req.body.bid || 0, 10)

    if (!Array.isArray(release)) {
      release = release ? [release] : []
    }

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    if (typeof bid === 'undefined') {
      return res.status(400).send({ error: 'missing bid' })
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

    // verify transition id exists
    const query1 = await db('transition_bids')
      .where({
        pid,
        tid,
        year: constants.season.year
      })
      .whereNull('cancelled')

    if (!query1.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const transitionBid = query1[0]

    // get players info
    const pids = [pid]
    if (release.length) {
      release.forEach((pid) => pids.push(pid))
    }
    const player_rows = await db('player').whereIn('pid', pids)
    if (player_rows.length !== pids.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const player_row = player_rows[0]

    // get league info
    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // get roster
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })

    // check if release players are on team
    if (release.length) {
      for (const release_pid of release) {
        if (!roster.has(release_pid)) {
          return res.status(400).send({ error: 'invalid release' })
        }
        roster.removePlayer(release_pid)
      }
    }

    const cutlist = await db('league_cutlist')
      .select('pid')
      .where('tid', teamId)

    // remove cutlist players
    for (const row of cutlist) {
      roster.removePlayer(row.pid)
    }

    if (transitionBid.processed) {
      return res.status(400).send({ error: 'bid has already been processed' })
    }

    // if competing bid, make sure there is roster space
    if (transitionBid.player_tid !== teamId) {
      if (!roster.hasOpenBenchSlot(player_row.pos)) {
        return res.status(400).send({ error: 'exceeds roster limits' })
      }

      // add to roster
      roster.addPlayer({
        slot: constants.slots.BENCH,
        pid,
        pos: player_row.pos,
        value: bid
      })
    } else {
      // update value to bid
      roster.updateValue(pid, bid)

      // check that the bid is within 10 dollars of the market salary
      const market_salary = await db('league_format_player_projection_values')
        .select('market_salary')
        .where({
          pid,
          week: 0,
          year: constants.season.year,
          league_format_hash: league.league_format_hash
        })
        .first()

      // TODO setup mocks for tests
      // if (!market_salary) {
      //   return res.status(400).send({ error: 'market salary not found' })
      // }

      if (market_salary) {
        const salary_difference = bid - market_salary.market_salary
        if (salary_difference < -10) {
          return res.status(400).send({
            error: 'bid must not be more than $10 below market salary'
          })
        }
      }
    }

    // make sure there is enough cap space
    // TODO
    /* if (!roster.availableCap) {
     *   return res.stauts(400).send({ error: 'exceeds cap space' })
     * }
     */
    if (transitionBid.player_tid === teamId) {
      await db('rosters_players')
        .update({ tag: constants.tags.TRANSITION })
        .where({
          rid: rosterRow.uid,
          pid
        })
    }

    // insert into transitionBids
    await db('transition_bids')
      .update({
        userid: req.auth.userId,
        bid
      })
      .where('uid', transitionBid.uid)

    if (release.length) {
      const releaseInserts = release.map((pid) => ({
        transitionid: transitionBid.uid,
        pid
      }))
      await db('transition_releases')
        .insert(releaseInserts)
        .onConflict(['transitionid', 'pid'])
        .merge()
    }

    await db('transition_releases')
      .del()
      .where('transitionid', transitionBid.uid)
      .whereNotIn('pid', release)

    res.send({
      ...transitionBid,
      bid,
      userid: req.auth.userId,
      release
    })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.post('/nominate/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const { pid, leagueId } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
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

    // Check if the transition bid exists and belongs to the original manager
    const transition_bid = await db('transition_bids')
      .where({
        pid,
        tid,
        player_tid: tid,
        year: constants.season.year
      })
      .whereNull('cancelled')
      .first()

    if (!transition_bid) {
      return res
        .status(400)
        .send({ error: 'invalid restricted free agent bid' })
    }

    if (transition_bid.processed) {
      return res.status(400).send({ error: 'bid has already been processed' })
    }

    if (transition_bid.announced) {
      return res.status(400).send({ error: 'bid has already been announced' })
    }

    // clear any other unannounced nominations for this team
    await db('transition_bids')
      .where({
        tid,
        player_tid: tid
      })
      .whereNull('announced')
      .whereNotNull('nominated')
      .whereNull('processed')
      .whereNull('cancelled')
      .update({ nominated: null })

    const nominated_timestamp = Math.round(Date.now() / 1000)

    // Update the transition bid to mark it as announced
    await db('transition_bids')
      .where('uid', transition_bid.uid)
      .update({ nominated: nominated_timestamp })

    res.send({ nominated: nominated_timestamp })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.delete('/nominate/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const { pid, leagueId } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
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

    // Check if the transition bid exists and belongs to the original manager
    const transition_bid = await db('transition_bids')
      .where({
        pid,
        tid,
        player_tid: tid,
        year: constants.season.year
      })
      .whereNull('cancelled')
      .first()

    if (!transition_bid) {
      return res
        .status(400)
        .send({ error: 'invalid restricted free agent bid' })
    }

    if (transition_bid.cancelled) {
      return res.status(400).send({ error: 'bid has already been cancelled' })
    }

    if (transition_bid.processed) {
      return res.status(400).send({ error: 'bid has already been processed' })
    }

    if (transition_bid.announced) {
      return res.status(400).send({ error: 'bid has already been announced' })
    }

    // Cancel the nomination
    await db('transition_bids')
      .where('uid', transition_bid.uid)
      .update({ nominated: null })

    res.send({
      message: 'Restricted free agent nomination successfully cancelled'
    })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
