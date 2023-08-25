import express from 'express'

import {
  getRoster,
  verifyUserTeam,
  isPlayerLocked,
  getLeague
} from '#libs-server'
import { constants, Roster } from '#libs-shared'

const router = express.Router({ mergeParams: true })

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const week = req.query.week || constants.season.week
    const year = req.query.year || constants.season.year

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    const tid = parseInt(teamId, 10)

    const teams = await db('users_teams').where({ userid: req.auth.userId })
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

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    // verify teamId
    try {
      await verifyUserTeam({ userId: req.auth.userId, teamId })
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

      if (!item.pid) {
        return res.status(400).send({ error: 'missing pid' })
      }
    }

    const pids = players.map((p) => p.pid)
    const player_rows = await db('player').whereIn('pid', pids)

    if (player_rows.length !== pids.length) {
      return res.status(400).send({ error: 'invalid player' })
    }

    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const tid = parseInt(teamId, 10)

    const rosterRow = await getRoster({ tid, week, year })
    const roster = new Roster({ roster: rosterRow, league })

    for (const item of players) {
      // verify player is on roster
      const isActive = Boolean(roster.active.find((p) => p.pid === item.pid))
      if (!isActive) {
        return res.status(400).send({ error: 'invalid player' })
      }

      roster.removePlayer(item.pid)
    }

    for (const item of players) {
      const player_row = player_rows.find((p) => p.pid === item.pid)
      // verify player is eligible for slot
      if (item.slot !== constants.slots.BENCH) {
        const isEligible = roster.isEligibleForSlot({
          slot: item.slot,
          pos: player_row.pos
        })
        if (!isEligible) {
          return res.status(400).send({ error: 'invalid slot' })
        }

        // if during first six weeks, verify player was not Reserve to start the year
        if (week <= 6) {
          const offseasonRosterRow = await getRoster({ tid, week: 0, year })
          const roster = new Roster({ roster: offseasonRosterRow, league })
          const reserve_pids = roster.reserve.map((p) => p.pid)
          if (reserve_pids.includes(item.pid)) {
            return res.status(400).send({
              error: 'player ineligible to start during first six weeks'
            })
          }
        }
      }

      // verify player is not locked
      const isLocked = await isPlayerLocked(item.pid)
      if (isLocked) {
        return res
          .status(400)
          .send({ error: 'player is locked, game has started' })
      }

      roster.addPlayer({
        slot: item.slot,
        pid: item.pid,
        pos: player_row.pos
      })
    }

    const data = []
    for (const { slot, pid } of players) {
      const updateid = await db('rosters_players')
        .update({ slot })
        .where({ week, year, tid, pid })

      data.push({
        slot,
        pid,
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

export default router
