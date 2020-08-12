const express = require('express')
const router = express.Router({ mergeParams: true })

// const { constants } = require('../../../common')
const { verifyUserTeam } = require('../../../utils')

router.post('/?', async (req, res) => {
  const { db, logger, broadcast } = req.app.locals
  try {
    const { player, teamId } = req.body

    if (!player) {
      return res.status(400).send({ error: 'missing player param' })
    }

    // verify teamId
    let team
    try {
      team = await verifyUserTeam({ userId: req.user.userId, teamId })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }
    const tid = parseInt(teamId, 10)

    // verify player id
    const playerRows = await db('player').where('player', player).limit(1)
    if (playerRows.length) {
      return res.status(400).send({ error: 'invalid player id' })
    }
    const playerRow = playerRows[0]

    // verify player is on current roster
    const leagues = await db('leagues').where({ uid: leagueId }).limit(1)
    if (!leagues.length) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const league = leagues[0]
    const rosterRow = await getRoster({
      tid,
      week: constants.week,
      year: constants.year
    })
    const roster = new Roster({ roster: rosterRow, league })
    if (!roster.has(player)) {
      return res.status(400).send({ error: 'player not on roster' })
    }

    // verify player is not locked and is a starter
    const isLocked = await isPlayerLocked(player)
    const isStarter = !!roster.starters.find(p => p.player === player)
    if (isLocked && isStarter) {
      return res.status(400).send({ error: 'starter is locked' })
    }

    // update roster

    // create transaction

    // send notifications

  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

module.exports = router
