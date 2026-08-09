/* global describe before after it */

import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'
import dayjs from 'dayjs'

import server from '#api'
import knex from '#db'
import { calculateStandings } from '#libs-shared'
import { getLeague } from '#libs-server'
import { current_season } from '#constants'
import season_dates from '#libs-shared/season-dates.mjs'

import league_fixture from '#db/fixtures/league.mjs'
import { user1 } from './fixtures/token.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect
chai.should()
chai.use(chai_http)

// Amendment XL, Article XVI Section 3(b): where the LEAGUE has no Divisions,
// two of the four WILDCARD ROUND berths go to the highest Head-to-Head records
// among the Teams remaining after the byes, and only the last two go to Total
// Points For. `seasons.head_to_head_berth_count` is how that is configured.
//
// The unit tests in playoff-format.spec.mjs exercise get_playoff_seeding on
// plain objects. What is covered here is the three seams around it: the column
// travelling from a `seasons` row through getLeague into calculateStandings and
// out as regular_season_finish (which is the value process-matchups persists),
// the API validation that rejects an unusable count, and the database CHECK
// that refuses one regardless of which writer produced it.

// calculateStandings processes weeks 1..finalWeek, where finalWeek is
// max(current_season.week - 1, 0) and current_season.week counts full weeks
// elapsed since regular_season_start. 22 days in is week 3, so finalWeek is 2 --
// the minimum that lets head-to-head record and points for disagree. At one
// week every team is 1-0 or 0-1 and the record ladder collapses onto the points
// ladder through its own tiebreakers, which would make the record step
// indistinguishable from the at-large step no matter what it did.
const into_week_3_unix = season_dates.regular_season_start + 22 * 24 * 60 * 60

// Ten teams, matching the no-Divisions structure Article V Section 13(a)
// prescribes at ten Teams. `division: null` is what the 2026 implementation set
// on every team, and it is what makes the division-winner guarantee select
// nobody -- the hole the record step exists to fill.
const tids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

// One weekly score per team, held constant across both weeks so the All Play
// ladder and the points-for ladder are simply this ordering. Records are then
// set independently by who is scheduled against whom.
//
// Teams 1 and 2 are the seventh and eighth scorers in the league and go 2-0 by
// playing the two worst; teams 5 through 8 all outscore them and go 1-1 or
// worse. That gap is the whole point of the fixture: on record 1 and 2 are the
// best of the field below the byes, and on points for they are nowhere near it.
const weekly_score_by_tid = {
  10: 200,
  9: 190,
  8: 180,
  7: 170,
  6: 160,
  5: 150,
  1: 100,
  2: 90,
  3: 50,
  4: 40
}

// Week 1 sends 10 past 9, and week 2 sends 9 past 8 and 7 past 5, which is what
// keeps 8, 7 and 6 at 1-1 rather than letting a high scorer also lead on record.
const matchups = [
  { week: 1, home_team_id: 10, away_team_id: 9 },
  { week: 1, home_team_id: 8, away_team_id: 7 },
  { week: 1, home_team_id: 6, away_team_id: 5 },
  { week: 1, home_team_id: 1, away_team_id: 3 },
  { week: 1, home_team_id: 2, away_team_id: 4 },
  { week: 2, home_team_id: 9, away_team_id: 8 },
  { week: 2, home_team_id: 10, away_team_id: 6 },
  { week: 2, home_team_id: 7, away_team_id: 5 },
  { week: 2, home_team_id: 1, away_team_id: 4 },
  { week: 2, home_team_id: 2, away_team_id: 3 }
]

// optimizeStandingsLineup post-filters its result on
// /^[A-Z]{4}-[A-Z]{4}-[0-9]{6}$/i, so a pid that does not match that shape is
// dropped from the optimal lineup. Nothing here asserts on the optimizer, but a
// well-formed pid keeps its output meaningful rather than empty.
const letters = (n) =>
  String.fromCharCode(
    ...Array.from({ length: 4 }, (unused, k) => 65 + ((n + k) % 26))
  )
const pid_for_tid = (tid) =>
  `${letters(tid)}-${letters(tid + 5)}-${String(tid).padStart(2, '0')}0190`

// One rushing back per team carrying the team's whole score. The yardage is
// derived from the league's own configured rate rather than hardcoded, because
// the league object under test comes out of the database and its scoring format
// is not this spec's to assume.
const build_standings_inputs = (league) => {
  const weeks = [1, 2]
  const roster_by_tid = Object.fromEntries(
    tids.map((tid) => [tid, [{ pid: pid_for_tid(tid), pos: 'RB' }]])
  )

  const starters = {}
  const active = {}
  for (const week of weeks) {
    starters[week] = Object.fromEntries(
      tids.map((tid) => [
        tid,
        roster_by_tid[tid].map((player) => ({ ...player, slot: 1 }))
      ])
    )
    active[week] = Object.fromEntries(
      tids.map((tid) => [tid, roster_by_tid[tid]])
    )
  }

  const gamelogs = weeks.flatMap((week) =>
    tids.map((tid) => ({
      pid: pid_for_tid(tid),
      week,
      passing_yards: 0,
      passing_touchdowns: 0,
      passing_interceptions: 0,
      rushing_yards: weekly_score_by_tid[tid] / league.rushing_yards,
      rushing_touchdowns: 0,
      receptions: 0,
      receiving_yards: 0,
      receiving_touchdowns: 0
    }))
  )

  return {
    starters,
    active,
    gamelogs,
    teams: tids.map((uid) => ({ uid, division: null }))
  }
}

describe('SEASONS head_to_head_berth_count', function () {
  before(function () {
    MockDate.set(dayjs.unix(into_week_3_unix).toDate())
  })

  after(function () {
    MockDate.reset()
  })

  describe('calculate-standings from a seasons row', function () {
    before(async function () {
      this.timeout(60 * 1000)
      await knex.seed.run()
      await league_fixture(knex)

      // League 1's live 2026 configuration: byes on All Play, two record
      // berths, and the last two places on Total Points For.
      await knex('seasons')
        .update({
          playoff_team_count: 6,
          bye_count: 2,
          bye_selection_method: 'all_play',
          at_large_selection_method: 'points_for',
          has_division_winner_berths: false,
          head_to_head_berth_count: 2
        })
        .where({ lid: 1, season_year: current_season.year })
    })

    it('two record berths precede the two points-for berths', async function () {
      this.timeout(30 * 1000)

      const league = await getLeague({ lid: 1 })
      expect(league.head_to_head_berth_count).to.equal(2)

      const { starters, active, gamelogs, teams } =
        build_standings_inputs(league)

      const result = calculateStandings({
        starters,
        active,
        league,
        teams,
        gamelogs,
        matchups
      })

      // Byes to the two highest All Play win percentages, which here are the
      // two highest scorers.
      expect(result[10].stats.regular_season_finish).to.equal(1)
      expect(result[9].stats.regular_season_finish).to.equal(2)

      // The two record berths. Teams 1 and 2 are the only 2-0 teams below the
      // byes and the sixth and seventh scorers of the ten, so nothing but the
      // record step can seat them: at head_to_head_berth_count 0 the four
      // places below the byes all go on points for and both of these teams
      // miss the post-season entirely, finishing 7th and 8th.
      expect(result[1].stats.regular_season_finish).to.equal(3)
      expect(result[2].stats.regular_season_finish).to.equal(4)

      // The two at-large berths, to the highest Total Points For among what is
      // left -- not to teams 6 and 5, who would take them if the record step
      // had not already spent two places.
      expect(result[8].stats.regular_season_finish).to.equal(5)
      expect(result[7].stats.regular_season_finish).to.equal(6)

      // Missing the field, in standings-ladder order.
      expect(result[6].stats.regular_season_finish).to.equal(7)
      expect(result[5].stats.regular_season_finish).to.equal(8)
      expect(result[3].stats.regular_season_finish).to.equal(9)
      expect(result[4].stats.regular_season_finish).to.equal(10)
    })

    it('leaving the count at zero sends every place below the byes to points for', async function () {
      this.timeout(30 * 1000)

      await knex('seasons')
        .update({ head_to_head_berth_count: 0 })
        .where({ lid: 1, season_year: current_season.year })

      const league = await getLeague({ lid: 1 })
      expect(league.head_to_head_berth_count).to.equal(0)

      const { starters, active, gamelogs, teams } =
        build_standings_inputs(league)

      const result = calculateStandings({
        starters,
        active,
        league,
        teams,
        gamelogs,
        matchups
      })

      // The four highest scorers below the byes take every place, and the two
      // best records in the league below the byes miss.
      expect(result[8].stats.regular_season_finish).to.equal(3)
      expect(result[7].stats.regular_season_finish).to.equal(4)
      expect(result[6].stats.regular_season_finish).to.equal(5)
      expect(result[5].stats.regular_season_finish).to.equal(6)
      expect(result[1].stats.regular_season_finish).to.equal(7)
      expect(result[2].stats.regular_season_finish).to.equal(8)

      await knex('seasons')
        .update({ head_to_head_berth_count: 2 })
        .where({ lid: 1, season_year: current_season.year })
    })
  })

  describe('PUT /api/leagues/:leagueId validation', function () {
    before(async function () {
      this.timeout(60 * 1000)
      await knex.seed.run()
      await league_fixture(knex)
      await knex('seasons')
        .update({
          playoff_team_count: 6,
          bye_count: 2,
          head_to_head_berth_count: 0
        })
        .where({ lid: 1, season_year: current_season.year })
    })

    const put = (field, value) =>
      chai_request
        .execute(server)
        .put('/api/leagues/1')
        .set('Authorization', `Bearer ${user1}`)
        .send({ field, value })

    it('accepts a count that fits below the byes', async () => {
      const res = await put('head_to_head_berth_count', 2)

      res.should.have.status(200)
      res.body.value.should.equal(2)

      const league = await getLeague({ lid: 1 })
      expect(league.head_to_head_berth_count).to.equal(2)
    })

    it('rejects a negative count', async () => {
      const res = await put('head_to_head_berth_count', -1)

      res.should.have.status(400)
      expect(res.body.error).to.match(/head_to_head_berth_count/)
      expect(res.body.error).to.match(/negative/)

      // The rejection must also be a non-write. A 400 that had already updated
      // the row would leave the season in the state the check exists to refuse.
      const league = await getLeague({ lid: 1 })
      expect(league.head_to_head_berth_count).to.equal(2)
    })

    it('rejects a count exceeding playoff_team_count minus bye_count', async () => {
      const res = await put('head_to_head_berth_count', 5)

      res.should.have.status(400)
      expect(res.body.error).to.match(/head_to_head_berth_count/)
      expect(res.body.error).to.match(/exceed/)

      const league = await getLeague({ lid: 1 })
      expect(league.head_to_head_berth_count).to.equal(2)
    })

    // A value the route lets through unvalidated does not fail the request --
    // it reaches Postgres, and the smallint cast or the CHECK answers as a 500.
    // Worse for a fractional value, which casts cleanly and stores a count
    // get_playoff_seeding then throws on, inside mapStateToProps.
    it('rejects a non-numeric count', async () => {
      const res = await put('head_to_head_berth_count', 'x')

      res.should.have.status(400)
      expect(res.body.error).to.equal('invalid value')

      const league = await getLeague({ lid: 1 })
      expect(league.head_to_head_berth_count).to.equal(2)
    })

    it('rejects a fractional count', async () => {
      const res = await put('head_to_head_berth_count', 1.5)

      res.should.have.status(400)
      expect(res.body.error).to.match(/head_to_head_berth_count/)
      expect(res.body.error).to.match(/whole number/)

      const league = await getLeague({ lid: 1 })
      expect(league.head_to_head_berth_count).to.equal(2)
    })

    // The same guard covers the two columns the count is bounded against,
    // because get_playoff_seeding throws on a non-integer in all three.
    it('rejects a fractional bye_count', async () => {
      const res = await put('bye_count', 1.5)

      res.should.have.status(400)
      expect(res.body.error).to.match(/bye_count/)
      expect(res.body.error).to.match(/whole number/)

      const league = await getLeague({ lid: 1 })
      expect(league.bye_count).to.equal(2)
    })

    it('re-checks the stored count when playoff_team_count shrinks', async () => {
      // 2 record berths are fine in a 6-team field with 2 byes and unusable in
      // a 2-team field with 2 byes, so lowering the field size has to be
      // rejected on a column the request never names.
      const res = await put('playoff_team_count', 2)

      res.should.have.status(400)
      expect(res.body.error).to.match(/head_to_head_berth_count/)

      const league = await getLeague({ lid: 1 })
      expect(league.playoff_team_count).to.equal(6)
    })

    it('re-checks the stored count when bye_count grows', async () => {
      const res = await put('bye_count', 6)

      res.should.have.status(400)
      expect(res.body.error).to.match(/head_to_head_berth_count/)

      const league = await getLeague({ lid: 1 })
      expect(league.bye_count).to.equal(2)
    })
  })

  describe('seasons_head_to_head_berth_count_within_field', function () {
    before(async function () {
      this.timeout(60 * 1000)
      await knex.seed.run()
      await league_fixture(knex)
      await knex('seasons')
        .update({
          playoff_team_count: 6,
          bye_count: 2,
          head_to_head_berth_count: 0
        })
        .where({ lid: 1, season_year: current_season.year })
    })

    // The API is not the only writer -- adhoc SQL, the simulation fixtures and
    // any future importer reach this column directly, so the constraint is what
    // actually holds the invariant. get_playoff_seeding throws on a bad pair,
    // and a throw inside mapStateToProps blanks the standings page.
    it('refuses a count above the places below the byes', async () => {
      let error = null
      try {
        await knex('seasons')
          .update({ head_to_head_berth_count: 5 })
          .where({ lid: 1, season_year: current_season.year })
      } catch (err) {
        error = err
      }

      expect(error).to.not.equal(null)
      expect(error.message).to.match(
        /seasons_head_to_head_berth_count_within_field/
      )
    })

    it('refuses a negative count', async () => {
      let error = null
      try {
        await knex('seasons')
          .update({ head_to_head_berth_count: -1 })
          .where({ lid: 1, season_year: current_season.year })
      } catch (err) {
        error = err
      }

      expect(error).to.not.equal(null)
      expect(error.message).to.match(
        /seasons_head_to_head_berth_count_within_field/
      )
    })

    it('refuses a field size that strands an already-stored count', async () => {
      await knex('seasons')
        .update({ head_to_head_berth_count: 4 })
        .where({ lid: 1, season_year: current_season.year })

      let error = null
      try {
        await knex('seasons')
          .update({ bye_count: 4 })
          .where({ lid: 1, season_year: current_season.year })
      } catch (err) {
        error = err
      }

      expect(error).to.not.equal(null)
      expect(error.message).to.match(
        /seasons_head_to_head_berth_count_within_field/
      )
    })
  })
})
