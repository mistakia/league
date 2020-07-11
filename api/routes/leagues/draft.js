const express = require('express')
const moment = require('moment')
const router = express.Router({ mergeParams: true })

const { constants, Roster, getEligibleSlots } = require('../../../common')

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const year = req.query.year || constants.year

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
    const leagueId = parseInt(req.params.leagueId, 10)
    const { teamId, playerId, pickId } = req.body

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId param' })
    }

    if (!playerId) {
      return res.status(400).send({ error: 'missing playerId param' })
    }

    // make sure draft has started
    const leagues = await db('leagues').where({ uid: leagueId })
    const league = leagues[0]
    const draftStart = moment(league.ddate, 'X')
    if (moment().isBefore(draftStart)) {
      return res.status(400).send({ error: 'draft has not started' })
    }

    // make sure team's clock has started
    const picks = await db('draft').where({ uid: pickId }).whereNull('player')
    const pick = picks[0]
    if (!pick) {
      return res.status(400).send({ error: 'invalid pickId' })
    }
    if (pick.tid !== teamId) {
      return res.status(400).send({ error: 'invalid teamId' })
    }
    const clockStart = moment(draftStart).add((pick.pick - 1), 'days')
    if (moment().isBefore(clockStart)) {
      return res.status(400).send({ error: 'pick clock has not started' })
    }

    // make sure player is a rookie
    const players = await db('player').where({ player: playerId })
    const player = players[0]
    if (!player || player.start !== constants.year) {
      return res.status(400).send({ error: 'invalid player' })
    }

    // make sure player is available/undrafted
    const slotNumbers = Object.values(constants.slots)
    const rosters = await db('rosters')
      .where({ lid: leagueId, year: constants.year, week: 0 })
      .andWhere(function () {
        slotNumbers.forEach(s => this.orWhere(`s${s}`, playerId))
      })
    if (rosters.length) {
      return res.status(400).send({ error: 'unavailable player' })
    }

    // make sure team has an open slot
    const rows = await db('rosters').where({ tid: teamId, year: constants.year, week: 0 })
    const roster = new Roster(rows[0])
    const psSlots = getEligibleSlots({ league, ps: true })
    const openPsSlots = roster.getOpenSlots(psSlots)
    let slot = null
    if (openPsSlots.length) {
      slot = openPsSlots[0]
    } else {
      const eligibleSlots = getEligibleSlots({ league, bench: true, pos: player.pos1 })
      const openSlots = roster.getOpenSlots(eligibleSlots)
      if (openSlots.length) {
        slot = openSlots[0]
      }
    }

    if (!slot) {
      return res.status(400).send({ error: 'unavailable roster spot' })
    }

    const value = (league.nteams - pick.pick + 1) > 0
      ? (league.nteams - pick.pick + 1)
      : 1

    const update = {}
    update[`s${constants.slots[slot]}`] = playerId
    const updateRosters = db('rosters')
      .where({ tid: teamId, year: constants.year, week: 0 })
      .update(update)

    const insertTransaction = db('transactions')
      .insert({
        userid: req.user.userId,
        tid: teamId,
        lid: leagueId,
        player: playerId,
        type: constants.transactions.DRAFT,
        year: constants.year,
        timestamp: Math.round(Date.now() / 1000),
        value
      })

    const updateDraft = db('draft')
      .where({ uid: pickId })
      .update({ player: playerId })

    await updateRosters
    await Promise.all([
      insertTransaction,
      updateDraft
    ])

    const data = { uid: pickId, player: playerId, lid: leagueId }
    broadcast(leagueId, {
      type: 'DRAFTED_PLAYER',
      payload: { data }
    })
    res.send(data)
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

module.exports = router
