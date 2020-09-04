const express = require('express')
const router = express.Router()

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const sub = db('jobs')
      .select(db.raw('max(uid) as maxuid'))
      .groupBy('type')

    const jobs = await db.select('*')
      .from(db.raw('(' + sub.toString() + ') AS X'))
      .join('jobs', 'X.maxuid', 'jobs.uid')

    return res.send(jobs)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
