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
    const teamIds = teams.map((r) => r.tid)

    if (!teamIds.includes(tid)) {
      return res
        .status(401)
        .send({ error: 'you do not have access to this teamId' })
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
    const { players, leagueId } = req.body

    // verify teamId
    try {
      await verifyUserTeam({ userId: req.user.userId, teamId })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    if (week < constants.season.week || year < constants.season.year) {
      return res.status(400).send({ error: 'lineup locked' })
    }

    if (week > constants.season.finalWeek) {
      return res.status(400).send({ error: 'lineup locked' })
    }

    if (!players || !Array.isArray(players)) {
      return res.status(400).send({ error: 'missing players' })
    }

    for (const item of players) {
      if (typeof item.slot === 'undefined' || item.slot === null) {
        return res.status(400).send({ error: 'missing slot' })
      }

      if (!item.player) {
        return res.status(400).send({ error: 'missing player' })
      }
    }

    const playerIds = players.map((p) => p.player)
    const playerRows = await db('player').whereIn('player', playerIds)

    if (playerRows.length !== playerIds.length) {
      return res.status(400).send({ error: 'invalid player' })
    }

    const leagues = await db('leagues').where({ uid: leagueId })
    if (!leagues.length) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const league = leagues[0]
    const tid = parseInt(teamId, 10)

    const rosterRow = await getRoster({ tid, week, year })
    const roster = new Roster({ roster: rosterRow, league })

    for (const item of players) {
      // verify player is on roster
      const isActive = Boolean(
        roster.active.find((p) => p.player === item.player)
      )
      if (!isActive) {
        return res.status(400).send({ error: 'invalid player' })
      }

      roster.removePlayer(item.player)
    }

    for (const item of players) {
      const playerRow = playerRows.find((p) => p.player === item.player)
      // verify player is eligible for slot
      if (item.slot !== constants.slots.BENCH) {
        const isEligible = roster.isEligibleForSlot({
          slot: item.slot,
          player: item.player,
          pos: playerRow.pos
        })
        if (!isEligible) {
          return res.status(400).send({ error: 'invalid slot' })
        }

        // if during first six weeks, verify player was not Reserve to start the year
        if (week <= 6) {
          const offseasonRosterRow = await getRoster({ tid, week: 0, year })
          const roster = new Roster({ roster: offseasonRosterRow, league })
          const reservePlayerIds = roster.reserve.map((p) => p.player)
          if (reservePlayerIds.includes(item.player)) {
            return res.status(400).send({
              error: 'player ineligible to start during first six weeks'
            })
          }
        }
      }

      // verify player is not locked
      const isLocked = await isPlayerLocked(item.player)
      if (isLocked) {
        return res
          .status(400)
          .send({ error: 'player is locked, game has started' })
      }

      roster.addPlayer({
        slot: item.slot,
        player: item.player,
        pos: playerRow.pos
      })
    }

    const data = []
    for (const item of players) {
      const updateid = await db('rosters_players')
        .join('rosters', 'rosters_players.rid', 'rosters.uid')
        .update({ slot: item.slot })
        .where({ week, year, tid, player: item.player })

      data.push({
        slot: item.slot,
        player: item.player,
        week,
        year,
        tid
      })

      if (!updateid) {
        return res.status(400).send({ error: 'lineup update unsuccessful' })
      }
    }

    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
