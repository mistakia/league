import express from 'express'

import { constants } from '#common'
import { getLeague, generateSchedule } from '#utils'

const router = express.Router({ mergeParams: true })

router.post('/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { leagueId } = req.params

    const league = await getLeague({ lid: leagueId })
    if (league.commishid !== req.auth.userId) {
      return res.status(401).send({ error: 'user is not commish' })
    }

    const data = await generateSchedule({ leagueId })
    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const { year = constants.season.year } = req.query

    const matchups = await db('matchups')
      .where({ lid: leagueId, year })
      .orderBy('week', 'asc')

    const playoffs = await db('playoffs').where({ lid: leagueId, year })

    res.send({ matchups, playoffs })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

export default router
