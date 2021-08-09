const express = require('express')
const router = express.Router({ mergeParams: true })

const { constants, Roster } = require('../../../common')
const {
  getRoster,
  verifyUserTeam,
  verifyReserveStatus
} = require('../../../utils')

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params

    const transitionBids = await db('transition_bids')
      .where('tid', teamId)
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
    const { player, leagueId } = req.body
    const playerTid = parseInt(req.body.playerTid || 0, 10)
    let { release } = req.body
    const bid = parseInt(req.body.bid || 0, 10)

    if (!Array.isArray(release)) {
      release = release ? [release] : []
    }

    if (!player) {
      return res.status(400).send({ error: 'missing player' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    if (!bid) {
      return res.status(400).send({ error: 'missing bid' })
    }

    if (!playerTid) {
      return res.status(400).send({ error: 'missing playerTid' })
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
        userId: req.user.userId,
        leagueId,
        teamId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    // get players info
    const playerIds = [player]
    if (release.length) {
      release.forEach((player) => playerIds.push(player))
    }
    const players = await db('player').whereIn('player', playerIds)
    if (players.length !== playerIds.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const playerRow = players[0]

    // get league info
    const leagues = await db('leagues').where({ uid: leagueId })
    if (!leagues.length) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const league = leagues[0]

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
      for (const player of release) {
        if (!roster.has(player)) {
          return res.status(400).send({ error: 'invalid release' })
        }
        roster.removePlayer(player)
      }
    }

    // if original bid, check if on team
    if (playerTid === tid) {
      if (!roster.has(player)) {
        return res.status(400).send({ error: 'invalid player' })
      }

      // update value to bid
      roster.updateValue(player, bid)
    } else {
      // check if transition bid exists
      const transitionBids = await db('transition_bids')
        .where('player', player)
        .where('tid', playerTid)
        .where('lid', leagueId)
        .whereNull('processed')
        .whereNull('cancelled')

      if (!transitionBids.length) {
        return res.status(400).send({ error: 'invalid player' })
      }
    }

    const cutlist = await db('cutlist').select('player').where('tid', tid)

    for (const row of cutlist) {
      roster.removePlayer(row.player)
    }

    // if competing bid, make sure there is roster space
    if (playerTid !== tid) {
      if (!roster.hasOpenBenchSlot(playerRow.pos)) {
        return res.status(400).send({ error: 'exceeds roster limits' })
      }

      // add to roster
      roster.addPlayer({
        slot: constants.slots.BENCH,
        player,
        pos: playerRow.pos,
        value: bid
      })
    }

    // make sure there is enough cap space
    if (roster.availableCap < 0) {
      return res.status(400).send({ error: 'exceeds salary cap' })
    }

    if (playerTid === tid) {
      await db('rosters_players')
        .update({ tag: constants.tags.TRANSITION })
        .where({
          rid: rosterRow.uid,
          player
        })
    }

    // insert into transitionBids
    const data = {
      tid,
      userid: req.user.userId,
      lid: leagueId,
      player,
      submitted: Math.round(Date.now() / 1000),
      bid,
      player_tid: playerTid
    }

    const query = await db('transition_bids').insert(data)
    data.uid = query[0]

    if (release.length) {
      const releaseInserts = release.map((player) => ({
        transitionid: query[0],
        player
      }))
      await db('transition_releases').insert(releaseInserts)
    }

    data.release = release

    res.send(data)
  } catch (error) {
    console.log(error)
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.put('/:transitionId', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId, transitionId } = req.params
    const { player, leagueId } = req.body
    let { release } = req.body
    const bid = parseInt(req.body.bid || 0, 10)

    if (!Array.isArray(release)) {
      release = release ? [release] : []
    }

    if (!player) {
      return res.status(400).send({ error: 'missing player' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    if (!bid) {
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
        userId: req.user.userId,
        leagueId,
        teamId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    // verify transition id exists
    const query1 = await db('transition_bids')
      .where('uid', transitionId)
      .where('player', player)
      .where('tid', tid)

    if (!query1.length) {
      return res.status(400).send({ error: 'invalid transitionId' })
    }
    const transitionBid = query1[0]

    // get players info
    const playerIds = [player]
    if (release.length) {
      release.forEach((player) => playerIds.push(player))
    }
    const players = await db('player').whereIn('player', playerIds)
    if (players.length !== playerIds.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const playerRow = players[0]

    // get league info
    const leagues = await db('leagues').where({ uid: leagueId })
    if (!leagues.length) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const league = leagues[0]

    // get roster
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })

    // check if release players are on team
    if (release.length) {
      for (const player of release) {
        if (!roster.has(player)) {
          return res.status(400).send({ error: 'invalid release' })
        }
        roster.removePlayer(player)
      }
    }

    const cutlist = await db('cutlist').select('player').where('tid', teamId)

    // remove cutlist players
    for (const row of cutlist) {
      roster.removePlayer(row.player)
    }

    // if competing bid, make sure there is roster space
    if (transitionBid.player_tid !== teamId) {
      if (!roster.hasOpenBenchSlot(playerRow.pos)) {
        return res.status(400).send({ error: 'exceeds roster limits' })
      }

      // add to roster
      roster.addPlayer({
        slot: constants.slots.BENCH,
        player,
        pos: playerRow.pos,
        value: bid
      })
    } else {
      // update value to bid
      roster.updateValue(player, bid)
    }

    // make sure there is enough cap space
    if (!roster.availableCap) {
      return res.stauts(400).send({ error: 'exceeds cap space' })
    }

    if (transitionBid.player_tid === teamId) {
      // set roster tag
    }

    // insert into transitionBids
    await db('transition_bids')
      .update({
        userid: req.user.userId,
        bid
      })
      .where('uid', transitionId)

    if (release.length) {
      const releaseInserts = release.map((player) => ({
        transitionid: transitionId,
        player
      }))
      await db('transition_releases')
        .insert(releaseInserts)
        .onConflict()
        .merge()
    }

    await db('transition_releases')
      .del()
      .where('transitionid', transitionId)
      .whereNotIn('player', release)

    res.send({
      ...transitionBid,
      bid,
      userid: req.user.userId,
      release
    })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
