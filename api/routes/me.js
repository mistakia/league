const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const users = await db('users').where({ id: req.user.userId })
    const user = users[0]
    delete user.password

    const teams = await db('teams')
      .select('teams.*')
      .select('users_teams.teamtext', 'users_teams.teamvoice', 'users_teams.leaguetext')
      .where({ userid: req.user.userId })
      .join('users_teams', 'users_teams.tid', 'teams.uid')

    const leagueIds = teams.map(t => t.lid)
    const leagues = await db('leagues').whereIn('uid', leagueIds)
    const sources = await db('sources')
      .leftJoin('users_sources', 'users_sources.sourceid', 'sources.uid')
      .where(function () {
        this.whereNull('userId').orWhere({ userid: req.user.userId })
      })

    res.send({
      user,
      teams,
      leagues,
      sources
    })

    await db('users').where({ id: req.user.userId }).update({ lastvisit: new Date() })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.put('/baselines', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { userId } = req.user
    const baselines = {
      qbb: req.body.QB,
      rbb: req.body.RB,
      wrb: req.body.WR,
      teb: req.body.TE
    }

    for (const b in baselines) {
      if (!baselines[b]) {
        return res.status(400).send({ error: `missing ${b} baseline param` })
      }
    }

    await db('users')
      .update(baselines)
      .where({ id: userId })

    res.send(req.body)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.put('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { userId } = req.user
    let { value } = req.body
    const { type } = req.body

    if (!type) {
      return res.status(400).send({ error: 'missing type param' })
    }

    const validTypes = ['email', 'password', 'vbaseline', 'vorpw', 'volsw', 'watchlist', 'text', 'voice']
    if (!validTypes.includes(type)) {
      return res.status(400).send({ error: 'invalid type param' })
    }

    if (typeof value === 'undefined' || value === null) {
      return res.status(400).send({ error: 'missing value param' })
    }

    if (type === 'password') {
      const salt = await bcrypt.genSalt(10)
      value = await bcrypt.hash(value, salt)
    }

    if (type === 'vorpw' || type === 'volsw') {
      if (isNaN(value)) {
        return res.status(400).send({ error: 'invalid value param' })
      }

      value = parseFloat(value)

      if (value === 1) {
        value = null
      }
    }

    await db('users')
      .update({ [type]: value })
      .where({ id: userId })

    res.send({ value })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
