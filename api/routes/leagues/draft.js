const express = require('express')
const router = express.Router({ mergeParams: true })

const { constants } = require('../../../common')

router.get('/?', async (req, res) => {
  try {
    const { db } = req.app.locals
    const { leagueId } = req.params
    const year = req.query.year || constants.year

    const picks = await db('draft').where({ lid: leagueId, year })
    res.send({ picks })
  } catch (err) {
    res.status(500).send({ error: err.toString() })
  }
})

module.exports = router
