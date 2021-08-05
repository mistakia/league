const express = require('express')
const router = express.Router({ mergeParams: true })

const { Roster } = require('../../../common')
const { getRoster, verifyUserTeam } = require('../../../utils')

router.post('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const { leagueId } = req.body
    let { players } = req.body

    if (!players) {
      return res.status(400).send({ error: 'missing players' })
    }

    if (!Array.isArray(players)) {
      players = [players]
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

    const leagues = await db('leagues').where({ uid: leagueId })
    if (!leagues.length) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const league = leagues[0]
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })

    // make sure all players are on roster
    for (const player of players) {
      if (!roster.has(player)) {
        return res.status(400).send({ error: 'invalid player' })
      }
    }

    // save
    const result = []
    for (const [index, player] of players.entries()) {
      result.push({
        tid,
        player,
        order: index
      })
    }

    await db('cutlist').insert(result).onConflict().merge()
    await db('cutlist').del().whereNotIn('player', players).where('tid', tid)
    res.send(players)
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

module.exports = router
