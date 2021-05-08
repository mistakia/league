const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')

const { constants } = require('../../common')

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const users = await db('users').where({ id: req.user.userId })
    const user = users[0]
    if (!user) {
      return res.status(400).send({ error: 'user does not exist' })
    }
    delete user.password

    const teams = await db('teams')
      .select('teams.*')
      .select(
        'users_teams.teamtext',
        'users_teams.teamvoice',
        'users_teams.leaguetext'
      )
      .where({ userid: req.user.userId })
      .join('users_teams', 'users_teams.tid', 'teams.uid')

    const leagueIds = teams.map((t) => t.lid)
    const teamIds = teams.map((t) => t.uid)
    const leagues = await db('leagues')
      .leftJoin('seasons', 'seasons.lid', 'leagues.uid')
      .whereIn('leagues.uid', leagueIds)
      .where('seasons.year', constants.season.year)

    const sources = await db('sources')
    const userSources = await db('users_sources').where(
      'userid',
      req.user.userId
    )
    for (const source of sources) {
      const userSource = userSources.find((s) => s.sourceid === source.uid)
      source.weight = userSource ? userSource.weight : 1
    }

    const poaches = await db('poaches')
      .whereIn('lid', leagueIds)
      .whereNull('processed')

    const waivers = await db('waivers')
      .whereIn('tid', teamIds)
      .whereNull('processed')
      .whereNull('cancelled')

    res.send({
      user,
      teams,
      leagues,
      poaches,
      waivers,
      sources
    })

    await db('users')
      .where({ id: req.user.userId })
      .update({ lastvisit: new Date() })
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

    await db('users').update(baselines).where({ id: userId })

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

    const validTypes = [
      'email',
      'password',
      'vbaseline',
      'vorpw',
      'volsw',
      'watchlist',
      'text',
      'voice'
    ]
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
