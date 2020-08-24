const moment = require('moment')
const express = require('express')
const router = express.Router()

const { submitPoach, verifyReserveStatus } = require('../../../utils')
const { constants } = require('../../../common')

router.post('/?', async (req, res) => {
  const { db, logger, broadcast } = req.app.locals
  try {
    const { player, drop, leagueId } = req.body
    const teamId = parseInt(req.body.teamId, 10)

    if (!player) {
      return res.status(400).send({ error: 'missing player param' })
    }

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId param' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId param' })
    }

    // verify poaching teamId using userId
    const userTeams = await db('users_teams')
      .join('teams', 'users_teams.tid', 'teams.uid')
      .where('userid', req.user.userId)
    const team = userTeams.find(p => p.tid === teamId)
    if (!team) {
      return res.status(400).send({ error: 'invalid teamId' })
    }

    // verify player is not on waivers
    const transactions = await db('transactions')
      .where({
        player,
        lid: leagueId
      })
      .orderBy('timestamp', 'desc')
      .orderBy('uid', 'desc')
      .limit(1)
    const tran = transactions[0]
    if ((tran.type === constants.transactions.ROSTER_DEACTIVATE ||
      tran.type === constants.transactions.DRAFT ||
      tran.type === constants.transactions.PRACTICE_ADD) &&
      moment().isBefore(moment(tran.timestamp, 'X').add('24', 'hours'))
    ) {
      return res.status(400).send({ error: 'player is on waivers' })
    }

    // check team reserve status
    try {
      await verifyReserveStatus({ teamId, leagueId })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    let data
    try {
      data = await submitPoach({ leagueId, drop, player, teamId, team, userId: req.user.userId })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    res.send(data)
    broadcast(leagueId, {
      type: 'POACH_SUBMITTED',
      payload: { data }
    })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
