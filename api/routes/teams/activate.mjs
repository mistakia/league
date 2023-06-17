import express from 'express'

import { constants } from '#libs-shared'
import {
  submitReserve,
  submitActivate,
  processRelease,
  verifyUserTeam
} from '#libs-server'

const router = express.Router({ mergeParams: true })

router.post('/?', async (req, res) => {
  const { logger, broadcast } = req.app.locals
  try {
    const { teamId } = req.params
    const { activate_pid, leagueId, release_pid, reserve_pid, slot } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (constants.season.week > constants.season.finalWeek) {
      return res.status(400).send({ error: 'player locked' })
    }

    if (!activate_pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
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

    // process release
    if (release_pid) {
      let releaseData
      try {
        releaseData = await processRelease({
          release_pid,
          tid,
          lid: leagueId,
          userid: req.auth.userId,
          activate_pid,
          create_notification: true
        })
      } catch (error) {
        return res.status(400).send({ error: error.message })
      }

      for (const item of releaseData) {
        broadcast(leagueId, {
          type: 'ROSTER_TRANSACTION',
          payload: { data: item }
        })
      }

      // return activate transaction data
      res.send(releaseData[1])
    } else if (reserve_pid) {
      let reserveData
      try {
        reserveData = await submitReserve({
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

      for (const item of reserveData) {
        broadcast(leagueId, {
          type: 'ROSTER_TRANSACTION',
          payload: { data: item }
        })
      }

      // return activate transaction data
      res.send(reserveData[1])
    } else {
      let data
      try {
        data = await submitActivate({
          tid,
          activate_pid,
          leagueId,
          userId: req.auth.userId
        })
      } catch (error) {
        return res.status(400).send({ error: error.message })
      }

      broadcast(leagueId, {
        type: 'ROSTER_TRANSACTION',
        payload: { data }
      })

      res.send(data)
    }
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

export default router
