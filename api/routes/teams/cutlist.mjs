import express from 'express'

import { Roster } from '#common'
import { getRoster, verifyUserTeam } from '#utils'

const router = express.Router({ mergeParams: true })

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
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

    const leagues = await db('leagues').where({ uid: leagueId })
    if (!leagues.length) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const league = leagues[0]
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })

    // make sure all players are on roster
    for (const pid of pids) {
      if (!roster.has(pid)) {
        return res.status(400).send({ error: 'invalid player' })
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
      await db('league_cutlist').insert(result).onConflict().merge()
    }

    await db('league_cutlist').del().whereNotIn('pid', pids).where('tid', tid)
    res.send(pids)
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

export default router
