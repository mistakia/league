import express from 'express'

import { constants, isSlotActive, Roster, getFreeAgentPeriod } from '#common'
import {
  verifyUserTeam,
  sendNotifications,
  processRelease,
  getLeague,
  getRoster
} from '#utils'

const router = express.Router({ mergeParams: true })

router.post('/?', async (req, res) => {
  const { db, logger, broadcast } = req.app.locals
  try {
    const { pid, teamId, leagueId } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (constants.season.week > constants.season.finalWeek) {
      return res.status(400).send({ error: 'player locked' })
    }

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    // verify teamId
    let team
    try {
      team = await verifyUserTeam({
        userId: req.auth.userId,
        teamId,
        leagueId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }
    const tid = parseInt(teamId, 10)
    const lid = parseInt(leagueId, 10)

    // verify player id
    const player_rows = await db('player').where({ pid }).limit(1)
    if (!player_rows.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const player_row = player_rows[0]

    // if active roster, verify not during FA Auction Period
    const league = await getLeague({ lid: leagueId })
    if (league.adate) {
      const rosterRow = await getRoster({ tid })
      const roster = new Roster({ roster: rosterRow, league })
      if (!roster.has(pid)) {
        return res.status(400).send({
          error: 'player not on roster'
        })
      }

      const rosterPlayer = roster.get(pid)
      const isOnActiveRoster = isSlotActive(rosterPlayer.slot)

      const faPeriod = getFreeAgentPeriod(league.adate)
      if (
        constants.season.now.isAfter(faPeriod.start) &&
        constants.season.now.isBefore(faPeriod.end) &&
        isOnActiveRoster
      ) {
        return res.status(400).send({
          error: 'Unable to release player from active roster during FA period'
        })
      }
    }

    let result
    try {
      result = await processRelease({
        release_pid: pid,
        tid,
        lid,
        userid: req.auth.userId
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    const data = result[0]
    res.send(data)
    broadcast(lid, {
      type: 'ROSTER_TRANSACTION',
      payload: { data }
    })

    // send notification
    const message = `${team.name} (${team.abbrv}) has released ${player_row.fname} ${player_row.lname} (${player_row.pos}).`

    await sendNotifications({
      league,
      teamIds: [],
      voice: false,
      notifyLeague: true,
      message
    })
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

export default router
