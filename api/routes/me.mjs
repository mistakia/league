import express from 'express'
import bcrypt from 'bcrypt'

import { constants, groupBy } from '#libs-shared'
import { validators } from '#libs-server'

const router = express.Router()

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    if (!req.auth || !req.auth.userId) {
      return res.status(401).send({ error: 'missing auth token' })
    }

    const users = await db('users').where({ id: req.auth.userId })
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
      .where({
        'users_teams.userid': req.auth.userId,
        'users_teams.year': constants.season.year
      })
      .join('users_teams', function () {
        this.on('users_teams.tid', '=', 'teams.uid')
        this.andOn('users_teams.year', '=', 'teams.year')
      })

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
      .leftJoin(
        'league_formats',
        'seasons.league_format_hash',
        'league_formats.league_format_hash'
      )
      .leftJoin(
        'league_scoring_formats',
        'seasons.scoring_format_hash',
        'league_scoring_formats.scoring_format_hash'
      )
      .whereIn('leagues.uid', leagueIds)

    const seasons = await db('seasons').whereIn('lid', leagueIds)

    // Fetch divisions for all leagues
    const divisions = await db('league_divisions')
      .whereIn('lid', leagueIds)
      .andWhere('year', constants.season.year)

    const seasonsByLeagueId = groupBy(seasons, 'lid')
    const divisionsByLeagueId = groupBy(divisions, 'lid')

    for (const lid in seasonsByLeagueId) {
      const league = leagues.find((l) => l.uid === parseInt(lid, 10))
      league.years = seasonsByLeagueId[lid].map((s) => s.year)

      // Add divisions to the league
      const leagueDivisions = divisionsByLeagueId[lid] || []
      leagueDivisions.forEach((div) => {
        league[`division_${div.division_id}_name`] = div.division_name
      })
    }

    const sources = await db('sources')
    const userSources = await db('users_sources').where(
      'userid',
      req.auth.userId
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
        .map((p) => p.pid)
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
        .map((p) => p.pid)
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
      .where({ id: req.auth.userId })
      .update({ lastvisit: new Date() })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.put('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { userId } = req.auth
    let { value } = req.body
    const { type } = req.body

    if (!type) {
      return res.status(400).send({ error: 'missing type param' })
    }

    const valid_types = [
      'email',
      'password',
      'watchlist',
      'user_text_notifications',
      'user_voice_notifications',
      'username'
    ]
    if (!valid_types.includes(type)) {
      return res.status(400).send({ error: 'invalid type param' })
    }

    if (typeof value === 'undefined' || value === null) {
      return res.status(400).send({ error: 'missing value param' })
    }

    if (type === 'password') {
      const salt = await bcrypt.genSalt(10)
      value = await bcrypt.hash(value, salt)
    }

    if (type === 'username') {
      const result = validators.username_validator({ username: value })
      if (result !== true) {
        return res.status(400).send({ error: result[0].message })
      }

      const existing_user = await db('users').where({ username: value }).first()
      if (existing_user) {
        return res.status(400).send({ error: 'username already taken' })
      }
    }

    if (type === 'email') {
      const result = validators.email_validator({ email: value })
      if (result !== true) {
        return res.status(400).send({ error: result[0].message })
      }

      const existing_user = await db('users').where({ email: value }).first()
      if (existing_user) {
        return res.status(400).send({ error: 'email already taken' })
      }
    }

    await db('users')
      .update({ [type]: value })
      .where({ id: userId })

    res.send({ value })
  } catch (error) {
    logger(error)
    res.status(400).send({ error: error.toString() })
  }
})

export default router
