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

router.put('/:sourceid', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { weight } = req.body
    const { sourceid } = req.params

    if (!req.user || !req.user.userId) {
      return res.status(401).send({ error: 'invalid userId' })
    }

    if (typeof weight === 'undefined') {
      return res.status(400).send({ error: 'missing weight param' })
    }

    if (!sourceid) {
      return res.status(400).send({ error: 'missing sourceid param' })
    }

    const rows = await db('users_sources').where({ userid: req.user.userId, sourceid })
    if (rows.length) {
      await db('users_sources').update({ weight }).where({ userid: req.user.userId, sourceid })
    } else {
      await db('users_sources').insert({ userid: req.user.userId, sourceid, weight })
    }

    res.send({ weight, sourceid })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
