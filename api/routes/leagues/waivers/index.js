const moment = require('moment-timezone')
const express = require('express')
const router = express.Router({ mergeParams: true })

const report = require('./report')

const { constants, Roster } = require('../../../../common')
const {
  getRoster,
  isPlayerRostered,
  isPlayerOnWaivers,
  verifyUserTeam,
  verifyReserveStatus
} = require('../../../../utils')

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
      .select('processed')
      .where('lid', leagueId)
      .where('type', type)
      .whereNotNull('processed')
      .groupBy('processed')
      .orderBy('processed', 'desc')

    res.send(waivers)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.post('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { player, drop, leagueId, type, teamId } = req.body
    let bid = parseInt(req.body.bid || 0, 10)

    if (constants.season.week > constants.season.finalWeek) {
      return res.status(400).send({ error: 'player is locked' })
    }

    if (!player) {
      return res.status(400).send({ error: 'missing player' })
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
        userId: req.user.userId,
        leagueId,
        teamId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    const playerIds = [player]
    if (drop) playerIds.push(drop)
    const players = await db('player').whereIn('player', playerIds)
    if (players.length !== playerIds.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const playerRow = players[0]

    // verify player is practice squad eligible if type is practice waiver
    // TODO - verify player was not previously on team practice squad
    if (type === constants.waivers.FREE_AGENCY_PRACTICE) {
      if (playerRow.start !== constants.season.year) {
        return res
          .status(400)
          .send({ error: 'player is not practice squad eligible' })
      }

      // set bid to zero for practice squad waivers
      bid = 0
    }

    const transactions = await db('transactions')
      .where('player', player)
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

    const leagues = await db('leagues').where({ uid: leagueId })
    if (!leagues.length) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const league = leagues[0]

    // check free agency waivers
    if (
      type === constants.waivers.FREE_AGENCY ||
      type === constants.waivers.FREE_AGENCY_PRACTICE
    ) {
      // make sure player is not rostered
      const isRostered = await isPlayerRostered({ player, leagueId })
      if (isRostered) {
        return res.status(400).send({ error: 'player rostered' })
      }

      if (constants.season.isRegularSeason) {
        // if regular season and not during waiver period, check if player is on release waivers
        if (!constants.season.isWaiverPeriod) {
          const isOnWaivers = await isPlayerOnWaivers({ player, leagueId })
          if (!isOnWaivers) {
            return res.status(400).send({ error: 'player is not on waivers' })
          }
        }

        // otherwise, it's a waiver period and all players are on waivers
      } else {
        // reject active roster waivers before day after auction
        const acutoff = moment
          .tz(league.adate, 'X', 'America/New_York')
          .add('1', 'day')
          .startOf('day')
        if (
          type === constants.waivers.FREE_AGENCY &&
          (!league.adate || moment().isBefore(acutoff))
        ) {
          return res
            .status(400)
            .send({ error: 'active roster waivers not open' })
        }

        // reject practice waivers before day after draft
        if (type === constants.waivers.FREE_AGENCY_PRACTICE) {
          const totalPicks = league.nteams * 3
          const dcutoff = moment
            .tz(league.ddate, 'X', 'America/New_York')
            .add(totalPicks, 'day')
            .startOf('day')

          if (!league.ddate || moment().isBefore(dcutoff)) {
            return res
              .status(400)
              .send({ error: 'practice squad waivers are not open' })
          }
          if (league.ddate && moment().isAfter(dcutoff.add('1', 'day'))) {
            // if after rookie draft waivers cleared, check if player is on release waivers
            const isOnWaivers = await isPlayerOnWaivers({ player, leagueId })
            if (!isOnWaivers) {
              return res.status(400).send({ error: 'player is not on waivers' })
            }
          }
        }
      }

      // check for duplicate claims
      const claimsQuery = db('waivers')
        .where({ player, lid: leagueId, tid, type })
        .whereNull('processed')
        .whereNull('cancelled')

      if (bid) {
        claimsQuery.where('bid', bid)
      }

      if (drop) {
        claimsQuery.where('drop', drop)
      } else {
        claimsQuery.whereNull('drop')
      }
      const claims = await claimsQuery

      if (claims.length) {
        return res.status(400).send({ error: 'duplicate waiver claim' })
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

      // transaction should have been within the last 24 hours
      if (
        moment().isAfter(
          moment(transactions[0].timestamp, 'X').add('24', 'hours')
        )
      ) {
        return res.status(400).send({ error: 'player is not on waivers' })
      }

      // verify player is on practice squad
      const slots = await db('rosters_players')
        .join('rosters', 'rosters_players.rid', 'rosters.uid')
        .where({
          lid: leagueId,
          week: constants.season.week,
          year: constants.season.year,
          player,
          slot: constants.slots.PS
        })
      if (!slots.length) {
        return res.status(400).send({
          error: 'player is not in an unprotected practice squad slot'
        })
      }

      // check for duplicate waiver
      const claims = await db('waivers')
        .where({ player, lid: leagueId, tid })
        .whereNull('processed')
        .whereNull('cancelled')

      if (claims.length) {
        return res.status(400).send({ error: 'duplicate waiver claim' })
      }
    }

    // verify team has space for player on active roster
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })
    if (drop) {
      if (!roster.has(drop)) {
        return res.status(400).send({ error: 'invalid drop' })
      }

      const dropPlayer = roster.get(drop)
      if (dropPlayer.slot === constants.slots.PSP) {
        return res.status(400).send({ error: 'invalid drop' })
      }
      roster.removePlayer(drop)
    }
    const hasSlot =
      type === constants.waivers.FREE_AGENCY_PRACTICE
        ? roster.hasOpenPracticeSquadSlot()
        : roster.hasOpenBenchSlot(playerRow.pos)
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
      userid: req.user.userId,
      lid: leagueId,
      player,
      drop,
      po: 9999,
      submitted: Math.round(Date.now() / 1000),
      bid,
      type
    }
    const ids = await db('waivers').insert(data)
    data.uid = ids[0]
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
        userId: req.user.userId,
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
    const { teamId, leagueId, drop } = req.body
    const bid = parseInt(req.body.bid || 0, 10)

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
        userId: req.user.userId,
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

    const leagues = await db('leagues').where({ uid: leagueId })
    if (!leagues.length) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const league = leagues[0]
    const players = await db('player').where('player', waiver.player).limit(1)
    if (!players.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const playerRow = players[0]

    // verify team has space for player on active roster
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })
    if (drop) {
      if (!roster.has(drop)) {
        return res.status(400).send({ error: 'invalid drop' })
      }
      roster.removePlayer(drop)
    }
    const hasSlot =
      waiver.type === constants.waivers.FREE_AGENCY_PRACTICE
        ? roster.hasOpenPracticeSquadSlot()
        : roster.hasOpenBenchSlot(playerRow.pos)
    if (!hasSlot) {
      return res.status(400).send({ error: 'exceeds roster limits' })
    }

    await db('waivers').update({ bid, drop }).where({ uid: waiverId })
    res.send({ bid, drop, uid: waiverId })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.post('/:waiverId/cancel', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
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
        userId: req.user.userId,
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

module.exports = router
