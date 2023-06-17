import express from 'express'

import { constants } from '#libs-shared'
import {
  submitAcquisition,
  verifyUserTeam,
  verifyReserveStatus
} from '#libs-server'

const router = express.Router({ mergeParams: true })

router.post('/?', async (req, res) => {
  const { db, logger, broadcast } = req.app.locals
  try {
    const { pid, leagueId, teamId, slot } = req.body
    let { release } = req.body
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
        userId: req.auth.userId,
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
    const waivers = await db('waivers')
      .where({ pid, lid: leagueId })
      .whereNull('cancelled')
      .whereNull('processed')

    if (waivers.length) {
      return res.status(400).send({ error: 'player has pending waiver claim' })
    }

    // verify not in waiver period during the regular season
    if (constants.season.isRegularSeason && constants.season.isWaiverPeriod) {
      return res.status(400).send({ error: 'player is on waivers' })
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
        release,
        pid,
        teamId: tid,
        userId: req.auth.userId,
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

export default router
