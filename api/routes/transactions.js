const express = require('express')
const router = express.Router()
const { constants, getEligibleSlots, formatRoster } = require('../../common')

router.get('/?', async (req, res) => {
  // TODO return list of league transactions
})

router.post('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    let { slot, type, tid, player, drop, pos, lid, bid } = req.app.query

    if (!tid) {
      return res.status(400).send({ error: 'missing tid param' })
    }

    if (!player) {
      return res.status(400).send({ error: 'missing player param' })
    }

    const transactions = await db('transactions')
      .where({ tid, player })
      .limit(2)
      .orderBy('timestamp', 'desc')

    let value = transactions[0].value
    let dropValue

    const insert = async () => {
      const inserts = [{
          userid: req.user.userId,
          tid,
          player,
          type,
          value,
          year: constants.year,
          timestamp: new Date()
      }]

      if (drop) {
        inserts.unshift({
          userid: req.user.userId,
          tid,
          value: dropValue,
          player: drop,
          type: constants.transactions.ROSTER_DROP,
          year: constants.year,
          timestamp: new Date()
        })
      }

      const rows = await db('transactions').insert(inserts)
      res.send({ transactions: rows })
    }

    const rosters = await db('rosters').where({ tid }).orderBy('last_updated', 'desc')
    if (rosters.length) {
      return res.status(500).send({ error: 'unable to locate a roster' })
    }
    const roster = formatRoster(roster[0])
    const isRostered = () => Array.from(roster.values()).includes(player)

    // make sure player is rostered
    if (type === constants.transactions.ROSTER_DROP) {
      if (!isRostered()) {
        return res.status(400).send({ error: `cannot drop unrostered player: ${player}` })
      }

      return insert()
    }

    // select a slot if none is provided
    if (!slot) {
      const eligbleSlots = getEligbleSlots({ pos, bench: true, ir: true, ps: true })
      slot = eligibleSlots[0]
      if (!slot) {
        return res.status(400).send({ error: 'no eligible slots' })
      }
    } else if (drop && drop !== roster[`s${slot}`]) { // validate drop
      return res.status(400).send({ error: `${drop} does not match player in slot ${slot}` })
    } else if (roster[`s${slot}`]) { // validate slot
      return res.status(400).send({ error: `${slot} is occupied and no drop param was sent` })
    }

    if (drop) {
      const prev = db('transactions')
        .where({
          player: drop,
          tid
        })
        .orderBy('timestamp', 'desc')
        .limit(1)

      if (!prev.length) {
        return res.status(400).send({ error: 'could not find transaction for drop player' })
      }

      dropValue = prev[0].value
    }

    if (type === constants.transactions.ROSTER_ACTIVATE) {
      const psSlots = getEligibleSlots({ ps: true })
      const slots = Array.from(roster.keys())
      const psPlayers = slots.filter(s => psSlots.includes(s)).map(s => roster.get(s))
      if (!psPlayers.includes(player)) {
        return res.status(400).send({ error: `${player} is not on practice squad` })
      }

      return insert()
    }

    if (type === constants.transactions.ROSTER_DEACTIVATE) {
      if (!isRostered()) {
        return res.status(400).send({ error: 'can not deactivate unrostered player' })
      }

      const transaction = transactions[0]

      if (!transaction) {
        return res.status(400).send({ error: 'could not find eligible transaction' })
      }

      // rostered within the last 48 hours
      const cutoff = moment().subtract(48, 'hours')
      if (moment(transaction.timestamp).isBefore(cutoff)) {
        return res.status(400).send({ error: 'player is not eligible, missed cutoff' })
      }

      // was not previously on this teams active roster
      // TODO - handle poach / waiver / trade
      if (transactions[1].tid !== tid) {
        return res.status(400).send({ error: 'player is not eligible, was previously on active roster' })
      }

      return insert()
    }

    if (type === constants.transactions.ROSTER_ADD) {
      if (!transactions.length) {
        return insert()
      }

      if (transactions[0].type !== constants.transactions.ROSTER_DROP) {
        return res.status(400).send({ error: 'player is not available' })
      }

      // TODO - check for waiver periods

      const cutoff = moment().hour() > 6
        ? moment('6', 'H').subtract(24, 'hours')
        : moment('6', 'H').subtract(48, 'hours')
      if (moment(transactions[0].timestamp).isAfter(cutoff)) {
        return res.status(400).send({ error: 'player is on waivers' })
      }

      return insert()
    }

    if (type === constants.transactions.POACH_CLAIM) {
      if (!lid) {
        return res.status(400).send({ error: 'missing lid param' })
      }

      //TODO
      const psSlots = getEligibleSlots({ ir: true })
      const onPS = await db('rosters')
        .where({ lid })
        .whereNot({ tid })
        .andWhere(function () {
          psSlots.forEach((k) => this.orWhere(`s${k}`, player))
        })
        .orderBy('week', 'desc')

      if (!onPS.length) {
        return res.status(400).send({ error: 'player not on a practice squad' })
      }

      return insert()
    }

    if (type === constants.transactions.WAIVER_CLAIM) {
      if (transactions[0].type !== constants.transactions.ROSTER_DROP) {
        return res.status(400).send({ error: 'player is not available' })
      }

      // TODO - check for waiver periods
      value = bid
      return insert()
    }

  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

module.exports = router
