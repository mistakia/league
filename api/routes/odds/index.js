const express = require('express')
const router = express.Router()

const { constants } = require('../../../common')

router.get('/props', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const sub = db('props')
      .select(db.raw('max(timestamp) AS maxtime, sourceid AS sid'))
      .groupBy('sid')
      .where({ wk: constants.season.week, year: constants.season.year })

    const data = await db
      .select('*')
      .from(db.raw('(' + sub.toString() + ') AS X'))
      .innerJoin(
        'props',
        function () {
          this.on(function () {
            this.on('sourceid', '=', 'sid')
            this.andOn('timestamp', '=', 'maxtime')
          })
        }
      )
      .where({ wk: constants.season.week, year: constants.season.year })
    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
