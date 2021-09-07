const dayjs = require('dayjs')
const express = require('express')
const router = express.Router()

const { submitPoach, verifyReserveStatus } = require('../../../utils')
const { constants } = require('../../../common')

router.post('/?', async (req, res) => {
  const { db, logger, broadcast } = req.app.locals
  try {
    const { player, release, leagueId } = req.body
    const teamId = parseInt(req.body.teamId, 10)

    if (constants.season.week > constants.season.finalWeek) {
      return res.status(400).send({ error: 'player is locked' })
    }

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
    const team = userTeams.find((p) => p.tid === teamId)
    if (!team) {
      return res.status(400).send({ error: 'invalid teamId' })
    }

    const transactions = await db('transactions')
      .where({
        player,
        lid: leagueId
      })
      .orderBy('timestamp', 'desc')
      .orderBy('uid', 'desc')
      .limit(1)
    const tran = transactions[0]

    // verify player is not in sanctuary period
    if (
      (tran.type === constants.transactions.ROSTER_DEACTIVATE ||
        tran.type === constants.transactions.DRAFT ||
        tran.type === constants.transactions.PRACTICE_ADD) &&
      dayjs().isBefore(dayjs.unix(tran.timestamp).add('24', 'hours'))
    ) {
      return res.status(400).send({ error: 'Player on Sanctuary Period' })
    }

    // verify player is not on waivers
    if (
      (tran.type === constants.transactions.ROSTER_DEACTIVATE ||
        tran.type === constants.transactions.DRAFT ||
        tran.type === constants.transactions.PRACTICE_ADD) &&
      dayjs().isBefore(dayjs.unix(tran.timestamp).add('48', 'hours'))
    ) {
      return res.status(400).send({ error: 'Player is on waivers' })
    }

    // check team reserve status
    try {
      await verifyReserveStatus({ teamId, leagueId })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    let data
    try {
      data = await submitPoach({
        leagueId,
        release,
        player,
        teamId,
        team,
        userId: req.user.userId
      })
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
