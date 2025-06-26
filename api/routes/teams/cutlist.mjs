import express from 'express'

import { Roster, constants } from '#libs-shared'
import { getRoster, verifyUserTeam, getLeague } from '#libs-server'

const router = express.Router({ mergeParams: true })

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    // verify teamId belongs to userId
    try {
      await verifyUserTeam({
        userId: req.auth.userId,
        teamId
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    const cutlist = await db('league_cutlist')
      .select('pid')
      .where('tid', teamId)
      .orderBy('order', 'asc')

    res.send(cutlist.map((p) => p.pid))
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

router.post('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const { leagueId } = req.body
    let { pids } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!pids) {
      return res.status(400).send({ error: 'missing pids' })
    }

    if (!Array.isArray(pids)) {
      pids = [pids]
    }

    // verify teamId
    try {
      await verifyUserTeam({
        userId: req.auth.userId,
        teamId,
        leagueId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    const tid = parseInt(teamId, 10)

    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })

    // make sure all players are on roster
    for (const pid of pids) {
      if (!roster.has(pid)) {
        return res.status(400).send({ error: 'invalid player' })
      }

      const rosterPlayer = roster.get(pid)
      if (rosterPlayer.tag === constants.tags.RESTRICTED_FREE_AGENCY) {
        return res
          .status(400)
          .send({ error: 'restricted free agents are ineligible' })
      }
    }

    // TODO - remove any duplicates

    // save
    const result = []
    for (const [index, pid] of pids.entries()) {
      result.push({
        tid,
        pid,
        order: index
      })
    }

    if (result.length) {
      await db('league_cutlist')
        .insert(result)
        .onConflict(['tid', 'pid'])
        .merge()
    }

    await db('league_cutlist').del().whereNotIn('pid', pids).where('tid', tid)
    res.send(pids)
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

export default router
