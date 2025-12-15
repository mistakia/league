/* global describe it */

import * as chai from 'chai'

import { simulate_championship_round } from '#libs-shared'

chai.should()
const expect = chai.expect

describe('LIBS-SHARED simulate_championship_round', function () {
  const create_mock_rosters = (teams) => {
    const rosters = {}
    for (const team of teams) {
      rosters[team.tid] = {
        tid: team.tid,
        lineups: {
          16: { baseline_total: team.projected_points_16 || 100 },
          17: { baseline_total: team.projected_points_17 || 100 }
        }
      }
    }
    return rosters
  }

  describe('week 16 simulation', function () {
    it('should return championship odds for all 4 teams', () => {
      const championship_teams = [
        { tid: 1 },
        { tid: 2 },
        { tid: 3 },
        { tid: 4 }
      ]
      const rosters = create_mock_rosters(championship_teams)

      const result = simulate_championship_round({
        championship_teams,
        rosters,
        week: 16
      })

      expect(result).to.have.all.keys('1', '2', '3', '4')
      for (const tid in result) {
        expect(result[tid]).to.have.property('championship_odds')
        expect(result[tid].championship_odds).to.be.at.least(0)
        expect(result[tid].championship_odds).to.be.at.most(1)
      }
    })

    it('should have odds that sum to approximately 1.0', () => {
      const championship_teams = [
        { tid: 1 },
        { tid: 2 },
        { tid: 3 },
        { tid: 4 }
      ]
      const rosters = create_mock_rosters(championship_teams)

      const result = simulate_championship_round({
        championship_teams,
        rosters,
        week: 16
      })

      const total_odds = Object.values(result).reduce(
        (sum, team) => sum + team.championship_odds,
        0
      )
      expect(total_odds).to.be.closeTo(1.0, 0.01)
    })

    it('should favor teams with higher projected points', () => {
      const championship_teams = [
        { tid: 1, projected_points_16: 150, projected_points_17: 150 },
        { tid: 2, projected_points_16: 100, projected_points_17: 100 },
        { tid: 3, projected_points_16: 100, projected_points_17: 100 },
        { tid: 4, projected_points_16: 100, projected_points_17: 100 }
      ]

      const rosters = {}
      for (const team of championship_teams) {
        rosters[team.tid] = {
          tid: team.tid,
          lineups: {
            16: { baseline_total: team.projected_points_16 },
            17: { baseline_total: team.projected_points_17 }
          }
        }
      }

      const result = simulate_championship_round({
        championship_teams,
        rosters,
        week: 16
      })

      // Team 1 should have the highest odds
      expect(result[1].championship_odds).to.be.greaterThan(
        result[2].championship_odds
      )
      expect(result[1].championship_odds).to.be.greaterThan(
        result[3].championship_odds
      )
      expect(result[1].championship_odds).to.be.greaterThan(
        result[4].championship_odds
      )
    })
  })

  describe('week 17 simulation', function () {
    it('should use actual week 16 points when provided', () => {
      const championship_teams = [
        { tid: 1, projected_points_17: 100 },
        { tid: 2, projected_points_17: 100 },
        { tid: 3, projected_points_17: 100 },
        { tid: 4, projected_points_17: 100 }
      ]

      const rosters = {}
      for (const team of championship_teams) {
        rosters[team.tid] = {
          tid: team.tid,
          lineups: {
            16: { baseline_total: 100 }, // Should be ignored
            17: { baseline_total: team.projected_points_17 }
          }
        }
      }

      // Give team 1 a huge lead from week 16
      const week_16_points = {
        1: 200,
        2: 100,
        3: 100,
        4: 100
      }

      const result = simulate_championship_round({
        championship_teams,
        rosters,
        week: 17,
        week_16_points
      })

      // Team 1 should have significantly higher odds due to week 16 lead
      expect(result[1].championship_odds).to.be.greaterThan(0.5)
    })

    it('should have odds that sum to approximately 1.0 with actual week 16 points', () => {
      const championship_teams = [
        { tid: 1 },
        { tid: 2 },
        { tid: 3 },
        { tid: 4 }
      ]
      const rosters = create_mock_rosters(championship_teams)

      const week_16_points = {
        1: 110,
        2: 105,
        3: 100,
        4: 95
      }

      const result = simulate_championship_round({
        championship_teams,
        rosters,
        week: 17,
        week_16_points
      })

      const total_odds = Object.values(result).reduce(
        (sum, team) => sum + team.championship_odds,
        0
      )
      expect(total_odds).to.be.closeTo(1.0, 0.01)
    })
  })

  describe('edge cases', function () {
    it('should handle equal projections', () => {
      const championship_teams = [
        { tid: 1 },
        { tid: 2 },
        { tid: 3 },
        { tid: 4 }
      ]
      const rosters = create_mock_rosters(championship_teams)

      const result = simulate_championship_round({
        championship_teams,
        rosters,
        week: 16
      })

      // All teams should have similar odds (within variance)
      for (const tid in result) {
        expect(result[tid].championship_odds).to.be.closeTo(0.25, 0.1)
      }
    })
  })
})
