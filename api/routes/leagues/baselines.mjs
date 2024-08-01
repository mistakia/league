import express from 'express'
const router = express.Router({ mergeParams: true })

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    if (!leagueId) {
      return res.status(400).send({ error: 'missing league id' })
    }

    const league_id = Number(leagueId)
    if (isNaN(league_id) || league_id <= 0) {
      return res.status(400).send({ error: 'invalid league id' })
    }

    const baselines = await db('league_baselines').where({ lid: leagueId })
    return res.send(baselines)
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

export default router
