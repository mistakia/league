import express from 'express'
const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * /leagues/{leagueId}/baselines:
 *   get:
 *     summary: Get fantasy league baseline calculations
 *     description: |
 *       Retrieves baseline player calculations for a specific fantasy league. Baselines represent the fantasy points scored by replacement-level players at each position, used to calculate "points above replacement" (PAR) values.
 *
 *       This endpoint provides the foundational data for advanced fantasy football analytics, helping determine which players provide value above what's freely available on the waiver wire.
 *     tags:
 *       - Leagues
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     responses:
 *       200:
 *         description: League baseline calculations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/LeagueBaseline'
 *             example:
 *               - lid: 2
 *                 week: "1"
 *                 year: 2024
 *                 pid: "JACO-MYER-2020-1996-09-10"
 *                 type: "starter"
 *                 pos: "WR"
 *               - lid: 2
 *                 week: "1"
 *                 year: 2024
 *                 pid: "DEON-JACK-2021-1997-12-13"
 *                 type: "starter"
 *                 pos: "RB"
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *         examples:
 *           missing_league_id:
 *             summary: Missing league ID
 *             value:
 *               error: "missing league id"
 *           invalid_league_id:
 *             summary: Invalid league ID
 *             value:
 *               error: "invalid league id"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
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
