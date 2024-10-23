import express from 'express'

import { constants } from '#libs-shared'
import { getLeague } from '#libs-server'

const router = express.Router({
  mergeParams: true
})

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const { year: requested_year } = req.query

    let year = constants.season.year
    if (requested_year) {
      const parsed_year = Number(requested_year)
      if (
        isNaN(parsed_year) ||
        parsed_year > constants.season.year ||
        parsed_year < 1990
      ) {
        return res.status(400).send({ error: 'Invalid year parameter' })
      }
      year = parsed_year
    }

    const teams = await db('teams').where({
      lid: leagueId,
      year
    })
    const picks = await db('draft').where({ lid: leagueId }).whereNull('pid')

    const sub_query = db('league_team_forecast')
      .select(db.raw('max(timestamp) AS maxtime, tid AS teamid'))
      .groupBy('teamid')
      .where('year', year)
      .as('sub_query')
    const forecasts = await db
      .select(
        'playoff_odds',
        'bye_odds',
        'division_odds',
        'championship_odds',
        'playoff_odds_with_win',
        'division_odds_with_win',
        'bye_odds_with_win',
        'championship_odds_with_win',
        'playoff_odds_with_loss',
        'division_odds_with_loss',
        'bye_odds_with_loss',
        'championship_odds_with_loss',
        'tid'
      )
      .from(sub_query)
      .innerJoin('league_team_forecast', function () {
        this.on(function () {
          this.on('teamid', '=', 'tid')
          this.andOn('timestamp', '=', 'maxtime')
        })
      })

    const teamIds = teams.map((t) => t.uid)

    for (const team of teams) {
      const forecast = forecasts.find((f) => f.tid === team.uid) || {}
      team.picks = picks.filter((p) => p.tid === team.uid)
      team.playoff_odds = forecast.playoff_odds
      team.division_odds = forecast.division_odds
      team.bye_odds = forecast.bye_odds
      team.championship_odds = forecast.championship_odds
    }

    if (req.auth && req.auth.userId) {
      const usersTeams = await db('users_teams')
        .where({ userid: req.auth.userId, year: constants.season.year })
        .whereIn('tid', teamIds)

      for (const usersTeam of usersTeams) {
        const { tid, teamtext, teamvoice, leaguetext } = usersTeam
        for (const [index, team] of teams.entries()) {
          if (team.uid === tid) {
            teams[index] = { teamtext, teamvoice, leaguetext, ...team }
            break
          }
        }
      }
    }

    res.send({ teams })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

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
    const teams = await db('teams').where({
      lid: leagueId,
      year: constants.season.year
    })
    if (teams.length >= league.num_teams) {
      return res.status(400).send({ error: 'league is full' })
    }

    const count = teams.length + 1
    const team = {
      year: constants.season.year,
      name: `Team${count}`,
      abbrv: `TM${count}`,
      waiver_order: count,
      draft_order: count,
      cap: league.cap,
      faab: league.faab,
      lid: leagueId
    }

    const rows = await db('teams').insert(team).returning('uid')
    team.uid = rows[0].uid

    const roster = {
      tid: team.uid,
      lid: league.uid,
      week: constants.season.week,
      year: constants.season.year
    }

    const rosterRows = await db('rosters').insert(roster).returning('uid')
    roster.uid = rosterRows[0].uid
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
      .select('teams.*')
      .join('users_teams', function () {
        this.on('teams.uid', '=', 'users_teams.tid')
        this.andOn('teams.year', '=', 'users_teams.year')
      })
      .where({
        lid: leagueId,
        tid: teamId,
        userid: req.auth.userId
      })
      .where('teams.year', constants.season.year)
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
        year: constants.season.year,
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
