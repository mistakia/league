/* global describe it */

import * as chai from 'chai'

import { get_division_count, compare_playoff_seed } from '#libs-shared'
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

describe('division format', function () {
  describe('get_division_count', function () {
    it('derives one division for a 10-team league', function () {
      expect(get_division_count(10)).to.equal(1)
    })

    it('derives four divisions for a 12-team league', function () {
      expect(get_division_count(12)).to.equal(4)
    })

    it('derives divisions of three whenever the count divides by three', function () {
      expect(get_division_count(6)).to.equal(2)
      expect(get_division_count(9)).to.equal(3)
      expect(get_division_count(18)).to.equal(6)
    })

    it('falls back to a single division when three does not divide the count', function () {
      expect(get_division_count(8)).to.equal(1)
      expect(get_division_count(14)).to.equal(1)
      expect(get_division_count(2)).to.equal(1)
      expect(get_division_count(0)).to.equal(1)
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
