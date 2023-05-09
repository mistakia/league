import express from 'express'

import { constants } from '#common'
import { getLeague } from '#utils'

const router = express.Router()

router.post('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // make sure user is commish
    if (league.commishid !== req.auth.userId) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // make sure league has space for another team
    const teams = await db('teams').where({ lid: leagueId })
    if (teams.length >= league.num_teams) {
      return res.status(400).send({ error: 'league is full' })
    }

    const count = teams.length + 1
    const team = {
      name: `Team${count}`,
      abbrv: `TM${count}`,
      wo: count,
      do: count,
      cap: league.cap,
      faab: league.faab,
      lid: leagueId
    }

    const rows = await db('teams').insert(team)
    team.uid = rows[0]

    const roster = {
      tid: team.uid,
      lid: league.uid,
      week: constants.season.week,
      year: constants.season.year
    }

    const rosterRows = await db('rosters').insert(roster)
    roster.uid = rosterRows[0]
    res.send({ roster, team })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.delete('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId, leagueId } = req.body
    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // make sure user is commish
    if (league.commishid !== req.auth.userId) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // make sure it's not user team
    const teamRows = await db('teams')
      .join('users_teams', 'teams.uid', 'users_teams.tid')
      .where({
        lid: leagueId,
        tid: teamId,
        userid: req.auth.userId
      })
    if (teamRows.length) {
      return res.status(400).send({ error: 'can not remove user team' })
    }

    const rosters = await db('rosters')
      .where({
        tid: teamId,
        lid: leagueId
      })
      .del()

    const teams = await db('teams')
      .where({
        uid: teamId,
        lid: leagueId
      })
      .del()

    const transactions = await db('transactions')
      .where({
        tid: teamId,
        lid: leagueId
      })
      .del()

    res.send({ rosters, teams, transactions })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
