const express = require('express')
const router = express.Router({ mergeParams: true })

const { getRoster, verifyUserTeam, isPlayerLocked } = require('../../../utils')
const { constants, Roster } = require('../../../common')

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const week = req.query.week || constants.season.week
    const year = req.query.year || constants.season.year

    const tid = parseInt(teamId, 10)

    const teams = await db('users_teams').where({ userid: req.user.userId })
    const teamIds = teams.map(r => r.tid)

    if (!teamIds.includes(tid)) {
      return res.status(401).send({ error: 'you do not have access to this teamId' })
    }

    const roster = await getRoster({ tid, week, year })
    res.send(roster)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.put('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const week = req.body.week || constants.season.week
    const year = req.body.year || constants.season.year
    const { slot, player, leagueId } = req.body

    // verify teamId
    try {
      await verifyUserTeam({ userId: req.user.userId, teamId })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    if (typeof slot === 'undefined' || slot === null) {
      return res.status(400).send({ error: 'missing slot' })
    }

    if (!player) {
      return res.status(400).send({ error: 'missing player' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    if (week < constants.season.week || year < constants.season.year) {
      return res.status(400).send({ error: 'lineup locked' })
    }

    const players = await db('player')
      .where({ player })

    if (!players.length) {
      return res.status(400).send({ error: 'invalid player' })
    }

    const playerRow = players[0]

    const leagues = await db('leagues').where({ uid: leagueId })
    if (!leagues.length) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const league = leagues[0]
    const tid = parseInt(teamId, 10)

    const rosterRow = await getRoster({ tid, week, year })
    const roster = new Roster({ roster: rosterRow, league })

    // verify player is on roster
    const isActive = !!roster.active.find(p => p.player === player)
    if (!isActive) {
      return res.status(400).send({ error: 'invalid player' })
    }

    // verify player is eligible for slot
    const isEligible = roster.isEligibleForSlot({ slot, player, pos: playerRow.pos1 })
    if (!isEligible) {
      return res.status(400).send({ error: 'invalid slot' })
    }

    // verify player is not locked
    const isLocked = await isPlayerLocked(player)
    if (isLocked) {
      return res.status(400).send({ error: 'player is locked, game has started' })
    }

    const updateid = await db('rosters_players')
      .join('rosters', 'rosters_players.rid', 'rosters.uid')
      .update({ slot })
      .where({ week, year, tid, player })

    if (!updateid) {
      return res.status(400).send({ error: 'lineup update unsuccessful' })
    }

    res.send({ slot, player, week, year, tid })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
