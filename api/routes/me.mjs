import express from 'express'
import bcrypt from 'bcrypt'

import { constants } from '#common'

const router = express.Router()

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
      .leftJoin('seasons', function () {
        this.on('leagues.uid', '=', 'seasons.lid')
        this.on(
          db.raw(
            `seasons.year = ${constants.season.year} or seasons.year is null`
          )
        )
      })
      .whereIn('leagues.uid', leagueIds)

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
    const poachIds = poaches.map((p) => p.uid)
    const poachReleases = await db('poach_releases').whereIn(
      'poachid',
      poachIds
    )
    for (const poach of poaches) {
      poach.release = poachReleases
        .filter((p) => p.poachid === poach.uid)
        .map((p) => p.player)
    }

    const waivers = await db('waivers')
      .whereIn('tid', teamIds)
      .whereNull('processed')
      .whereNull('cancelled')
    const waiverIds = waivers.map((p) => p.uid)
    const waiverReleases = await db('waiver_releases').whereIn(
      'waiverid',
      waiverIds
    )
    for (const waiver of waivers) {
      waiver.release = waiverReleases
        .filter((p) => p.waiverid === waiver.uid)
        .map((p) => p.player)
    }

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

    await db('users')
      .update({ [type]: value })
      .where({ id: userId })

    res.send({ value })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
