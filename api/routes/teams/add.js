const express = require('express')
const router = express.Router({ mergeParams: true })

const { constants } = require('../../../common')
const { submitAcquisition } = require('../../../utils')

router.post('/?', async (req, res) => {
  const { db, logger, broadcast } = req.app.locals
  try {
    const { player, drop, leagueId, teamId } = req.body

    if (!player) {
      return res.status(400).send({ error: 'missing player param' })
    }

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId param' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId param' })
    }

    const tid = parseInt(teamId, 10)

    // verify team belongs to user
    const userTeams = await db('users_teams')
      .join('teams', 'users_teams.tid', 'teams.uid')
      .where('userid', req.user.userId)
    const team = userTeams.find(p => p.tid === tid)
    if (!team) {
      return res.status(400).send({ error: 'invalid teamId' })
    }

    if (team.lid !== leagueId) {
      return res.status(400).send({ error: 'invalid leagueId' })
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
