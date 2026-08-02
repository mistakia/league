/* global describe it */

import * as chai from 'chai'

import { get_playoff_seeding, compare_playoff_seed } from '#libs-shared'
import { current_season } from '#constants'
import generate_fantasy_league_schedule from '#libs-server/generate-fantasy-league-schedule.mjs'

const expect = chai.expect

const make_teams = (num_teams, num_divisions) =>
  Array.from({ length: num_teams }, (unused, i) => ({
    uid: i + 1,
    div: (i % num_divisions) + 1
  }))

const opponent_counts = (schedule, uid) => {
  const counts = {}
  for (const week of schedule) {
    for (const { home, away } of week) {
      if (home.uid === uid) counts[away.uid] = (counts[away.uid] || 0) + 1
      if (away.uid === uid) counts[home.uid] = (counts[home.uid] || 0) + 1
    }
  }
  return counts
}

describe('playoff format and division schedule', function () {
  describe('get_playoff_seeding', function () {
    const team = (tid, div, overrides) => ({
      tid,
      div,
      wins: 0,
      losses: 0,
      ties: 0,
      all_play_wins: 0,
      points_for: 0,
      ...overrides
    })

    // Three teams per division across four divisions, with tid ascending in
    // strength so the expected seed order is simply 1..12.
    const twelve = Array.from({ length: 12 }, (unused, i) =>
      team(i + 1, (i % 4) + 1, { wins: 12 - i, losses: i })
    )

    it('honors the configured field size and bye count', function () {
      const result = get_playoff_seeding({
        teams: twelve,
        playoff_team_count: 6,
        bye_count: 2
      })

      expect(result.playoff_tids).to.eql([1, 2, 3, 4, 5, 6])
      expect(result.bye_tids).to.eql([1, 2])
      expect(result.wildcard_tids).to.eql([3, 4, 5, 6])
      expect(result.seeded_tids.length).to.equal(12)
    })

    it('supports a different field size and bye count', function () {
      const result = get_playoff_seeding({
        teams: twelve,
        playoff_team_count: 4,
        bye_count: 0
      })

      expect(result.playoff_tids).to.eql([1, 2, 3, 4])
      expect(result.bye_tids).to.eql([])
      expect(result.wildcard_tids).to.eql([1, 2, 3, 4])
    })

    it('ignores divisions when has_division_winner_berths is false', function () {
      const result = get_playoff_seeding({
        teams: twelve,
        playoff_team_count: 6,
        bye_count: 2,
        has_division_winner_berths: false
      })

      expect(result.playoff_tids).to.eql([1, 2, 3, 4, 5, 6])
    })

    it('lifts division winners into the field when configured to', function () {
      const result = get_playoff_seeding({
        teams: twelve,
        playoff_team_count: 6,
        bye_count: 2,
        has_division_winner_berths: true
      })

      // Divisions are (tid % 4): winners are the best of each, tids 1-4.
      // Seeds 5 and 6 then go to the next best overall, tids 5 and 6.
      expect(result.playoff_tids).to.eql([1, 2, 3, 4, 5, 6])
    })

    it('guarantees a losing division winner a berth when configured to', function () {
      const teams = [
        team(1, 1, { wins: 12, losses: 2 }),
        team(2, 1, { wins: 11, losses: 3 }),
        team(3, 1, { wins: 10, losses: 4 }),
        team(4, 2, { wins: 4, losses: 10 }),
        team(5, 2, { wins: 3, losses: 11 }),
        team(6, 2, { wins: 2, losses: 12 })
      ]

      const without = get_playoff_seeding({
        teams,
        playoff_team_count: 2,
        bye_count: 0
      })
      expect(without.playoff_tids).to.eql([1, 2])

      const with_guarantee = get_playoff_seeding({
        teams,
        playoff_team_count: 2,
        bye_count: 0,
        has_division_winner_berths: true
      })
      // tid 4 has a losing record but wins division 2.
      expect(with_guarantee.playoff_tids).to.eql([1, 4])
    })

    it('rejects a missing or nonsensical playoff configuration', function () {
      expect(() =>
        get_playoff_seeding({ teams: twelve, bye_count: 2 })
      ).to.throw(/playoff_team_count/)

      expect(() =>
        get_playoff_seeding({
          teams: twelve,
          playoff_team_count: 6,
          bye_count: 7
        })
      ).to.throw(/bye_count/)
    })
  })

  describe('compare_playoff_seed', function () {
    const team = (overrides) => ({
      wins: 0,
      losses: 0,
      ties: 0,
      all_play_wins: 0,
      points_for: 0,
      ...overrides
    })

    it('orders on head-to-head record first', function () {
      const better = team({ wins: 9, losses: 5, all_play_wins: 40 })
      const worse = team({ wins: 8, losses: 6, all_play_wins: 90 })
      expect(compare_playoff_seed(better, worse)).to.be.below(0)
    })

    it('breaks a record tie on all-play wins before points for', function () {
      const a = team({ wins: 8, losses: 6, all_play_wins: 70, points_for: 100 })
      const b = team({ wins: 8, losses: 6, all_play_wins: 60, points_for: 900 })
      expect(compare_playoff_seed(a, b)).to.be.below(0)
    })

    it('breaks a full record and all-play tie on points for', function () {
      const a = team({ wins: 8, losses: 6, all_play_wins: 70, points_for: 900 })
      const b = team({ wins: 8, losses: 6, all_play_wins: 70, points_for: 100 })
      expect(compare_playoff_seed(a, b)).to.be.below(0)
    })

    it('does not consult division standing', function () {
      const a = { ...team({ wins: 5, losses: 9 }), div: 1, division_finish: 1 }
      const b = { ...team({ wins: 9, losses: 5 }), div: 2, division_finish: 3 }
      expect(compare_playoff_seed(a, b)).to.be.above(0)
    })
  })

  describe('generate_fantasy_league_schedule', function () {
    const num_weeks = current_season.regularSeasonFinalWeek

    it('builds a full schedule for a 10-team single division', function () {
      const teams = make_teams(10, 1)
      const schedule = generate_fantasy_league_schedule(teams, 1234)

      expect(schedule.length).to.equal(num_weeks)
      for (const week of schedule) {
        expect(week.length).to.equal(5)
      }
    })

    it('has every 10-team single-division team play all nine opponents', function () {
      const teams = make_teams(10, 1)
      const schedule = generate_fantasy_league_schedule(teams, 1234)

      for (const { uid } of teams) {
        const counts = opponent_counts(schedule, uid)
        expect(Object.keys(counts).length).to.equal(9)
        expect(Object.values(counts).reduce((a, b) => a + b, 0)).to.equal(
          num_weeks
        )
        for (const count of Object.values(counts)) {
          expect(count).to.be.within(1, 2)
        }
      }
    })

    it('builds a full schedule for 12 teams across four divisions', function () {
      const teams = make_teams(12, 4)
      const schedule = generate_fantasy_league_schedule(teams, 1234)

      expect(schedule.length).to.equal(num_weeks)
      for (const week of schedule) {
        expect(week.length).to.equal(6)
      }
    })

    it('has each 4-division team play its divisional opponents twice', function () {
      const teams = make_teams(12, 4)
      const schedule = generate_fantasy_league_schedule(teams, 1234)

      for (const team of teams) {
        const counts = opponent_counts(schedule, team.uid)
        const division_opponents = teams.filter(
          (t) => t.div === team.div && t.uid !== team.uid
        )
        for (const opponent of division_opponents) {
          expect(counts[opponent.uid]).to.equal(2)
        }
      }
    })

    it('throws rather than returning an empty schedule for an unsupported count', function () {
      const teams = make_teams(9, 3)
      expect(() => generate_fantasy_league_schedule(teams, 1234)).to.throw(
        /Unsupported number of divisions/
      )
    })
  })
})
