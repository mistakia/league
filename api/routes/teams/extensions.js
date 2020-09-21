const express = require('express')
const router = express.Router({ mergeParams: true })

router.post('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const { player, type, leagueId } = req.body

    if (!player) {
      return res.status(400).send({ error: 'missing player' })
    }

    if (!type) {
      return res.status(400).send({ error: 'missing type' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    if (!Object.values(constants.extension).includes(type)) {
      return res.status(400).send({ error: 'invalid type' })
    }

    // verify teamId
    try {
      await verifyUserTeam({ userId: req.user.userId, teamId, leagueId, requireLeague: true })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    const playerRows = await db('player')
      .where('player', player).limit(1)
    const playerRow = playerRows[0]

    if (!playerRow) {
      return res.status(400).send({ error: 'invalid player' })
    }

    const extensions = await db('extensions').where('year', constants.season.year)
    const transactions = await db('transactions')
      .where('player', player)
      .where('lid', leagueId)
      .orderBy('timestamp', 'desc')

    // TODO

  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
