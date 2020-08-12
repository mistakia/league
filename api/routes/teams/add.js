const express = require('express')
const router = express.Router({ mergeParams: true })

const { constants } = require('../../../common')
const { submitAcquisition, verifyUserTeam } = require('../../../utils')

router.post('/?', async (req, res) => {
  const { db, logger, broadcast } = req.app.locals
  try {
    const { player, drop, leagueId, teamId } = req.body

    if (!constants.regularSeason) {
      return res.stauts(400).send({ error: 'free agency has not started' })
    }

    // verify teamId
    try {
      await verifyUserTeam({ userId: req.user.userId, teamId, leagueId, requireLeague: true })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }
    const tid = parseInt(teamId, 10)

    if (!player) {
      return res.status(400).send({ error: 'missing player param' })
    }

    // verify player drop ids
    const playerIds = [player]
    if (drop) playerIds.push(drop)
    const playerRows = await db('player').whereIn('player', playerIds)
    if (playerRows.length !== playerIds.length) {
      return res.status(400).send({ error: 'invalid player/drop ids' })
    }

    // verify not in waiver period
    if (constants.waiverWindow) {
      return res.status(400).send({ error: 'player is on waivers' })
    }

    // TODO - verify player does not have outstanding unprocessed waiver claim


    // verify drop player

    // verify roster space

    // update roster

    let transactions = []
    try {
      transactions = await submitAcquisition({
        leagueId,
        drop,
        player,
        teamId: tid,
        userId: req.user.userId
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
