import express from 'express'

import { constants } from '#libs-shared'
import { verifyUserTeam, getTransactionsSinceFreeAgent } from '#libs-server'

const router = express.Router({ mergeParams: true })

router.get('/reserve', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const { leagueId } = req.query

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
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

    const tid = teamId
    const lid = leagueId
    const { week, year } = constants.season

    const reserve_roster_rows = await db('rosters_players')
      .join('rosters', 'rosters.uid', 'rosters_players.rid')
      .where('rosters_players.slot', constants.slots.IR)
      .where({ tid, year, week })

    let data = []
    for (const { pid } of reserve_roster_rows) {
      const transactions = await getTransactionsSinceFreeAgent({
        lid,
        pid,
        tid
      })
      data = data.concat(transactions)
    }

    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
