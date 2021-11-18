const express = require('express')
const router = express.Router({ mergeParams: true })

const { constants } = require('../../../common')
const { verifyUserTeam, submitReserve } = require('../../../utils')

router.post('/?', async (req, res) => {
  const { logger, broadcast } = req.app.locals
  try {
    const { teamId } = req.params
    const { player, leagueId, slot, activate } = req.body

    if (constants.season.week > constants.season.finalWeek) {
      return res.status(400).send({ error: 'player locked' })
    }

    if (!player) {
      return res.status(400).send({ error: 'missing player' })
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
        userId: req.user.userId,
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
        player,
        leagueId,
        userId: req.user.userId,
        activate
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

module.exports = router
