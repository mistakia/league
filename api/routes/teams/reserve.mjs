import express from 'express'

import { constants } from '#libs-shared'
import { verifyUserTeam, submitReserve } from '#libs-server'

const router = express.Router({ mergeParams: true })

router.post('/?', async (req, res) => {
  const { logger, broadcast } = req.app.locals
  try {
    const { teamId } = req.params
    const { reserve_pid, leagueId, slot, activate_pid } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (constants.season.week > constants.season.finalWeek) {
      return res.status(400).send({ error: 'player locked' })
    }

    if (!reserve_pid) {
      return res.status(400).send({ error: 'missing reserve_pid' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    if (!slot) {
      return res.status(400).send({ error: 'missing slot' })
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
    let data
    try {
      data = await submitReserve({
        slot,
        tid,
        reserve_pid,
        leagueId,
        userId: req.auth.userId,
        activate_pid
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    for (const item of data) {
      broadcast(leagueId, {
        type: 'ROSTER_TRANSACTION',
        payload: { data: item }
      })
    }

    res.send(data[0])
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

export default router
