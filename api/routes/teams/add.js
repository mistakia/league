const express = require('express')
const router = express.Router({ mergeParams: true })

const { constants } = require('../../../common')
const {
  submitAcquisition,
  verifyUserTeam,
  verifyReserveStatus
} = require('../../../utils')

router.post('/?', async (req, res) => {
  const { db, logger, broadcast } = req.app.locals
  try {
    const { player, drop, leagueId, teamId, slot } = req.body

    if (!player) {
      return res.status(400).send({ error: 'missing player' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    if (!slot) {
      return res.status(400).send({ error: 'missing slot' })
    }

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId' })
    }

    const validSlots = [constants.slots.BENCH, constants.slots.PS]

    if (!validSlots.includes(slot)) {
      return res.status(400).send({ error: 'invalid slot' })
    }

    // verify teamId
    try {
      await verifyUserTeam({
        userId: req.user.userId,
        teamId,
        leagueId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }
    const tid = parseInt(teamId, 10)

    if (constants.season.week > constants.season.finalWeek) {
      return res.status(400).send({ error: 'player is locked' })
    }

    // verify player does not have outstanding unprocessed waiver claim
    if (constants.season.isRegularSeason) {
      // verify not in waiver period
      if (constants.season.isWaiverPeriod) {
        return res.status(400).send({ error: 'player is on waivers' })
      }

      const waivers = await db('waivers')
        .where({ player, lid: leagueId })
        .whereNull('cancelled')
        .whereNull('processed')

      if (waivers.length) {
        return res
          .status(400)
          .send({ error: 'player has pending waiver claim' })
      }
    }

    try {
      await verifyReserveStatus({ teamId, leagueId })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    let transactions = []
    try {
      transactions = await submitAcquisition({
        leagueId,
        drop,
        player,
        teamId: tid,
        userId: req.user.userId,
        slot
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    res.send(transactions)
    broadcast(leagueId, {
      type: 'ROSTER_TRANSACTIONS',
      payload: {
        data: transactions
      }
    })
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

module.exports = router
