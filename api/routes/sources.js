const express = require('express')
const router = express.Router()

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const sources = await db('sources')
    res.send(sources)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
