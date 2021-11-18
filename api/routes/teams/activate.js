const express = require('express')
const router = express.Router({ mergeParams: true })

const { constants } = require('../../../common')
const {
  submitReserve,
  submitActivate,
  processRelease,
  verifyUserTeam
} = require('../../../utils')

router.post('/?', async (req, res) => {
  const { logger, broadcast } = req.app.locals
  try {
    const { teamId } = req.params
    const { player, leagueId, release, reserve, slot } = req.body

    if (constants.season.week > constants.season.finalWeek) {
      return res.status(400).send({ error: 'player locked' })
    }

    if (!player) {
      return res.status(400).send({ error: 'missing player' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
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

    // process release
    if (release) {
      let releaseData
      try {
        releaseData = await processRelease({
          player: release,
          tid,
          lid: leagueId,
          userid: req.user.userId,
          activate: player
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
    } else if (reserve) {
      let reserveData
      try {
        reserveData = await submitReserve({
          slot,
          tid,
          player: reserve,
          leagueId,
          userId: req.user.userId,
          activate: player
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
          player,
          leagueId,
          userId: req.user.userId
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

module.exports = router
