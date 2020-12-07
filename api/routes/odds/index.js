const express = require('express')
const router = express.Router()
const JSONStream = require('JSONStream')

const { constants } = require('../../../common')

router.get('/props', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const sub = db('props')
      .select(db.raw('max(timestamp) AS maxtime, sourceid AS sid'))
      .groupBy('sid')
      .where({ wk: constants.season.week, year: constants.season.year })

    const stream = db
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
      .stream()
    req.on('close', stream.end.bind(stream))
    res.set('Content-Type', 'application/json')
    stream.pipe(JSONStream.stringify()).pipe(res)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
