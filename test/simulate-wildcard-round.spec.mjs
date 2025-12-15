/* global describe it */

import * as chai from 'chai'

import { simulate_wildcard_round } from '#libs-shared'

chai.should()
const expect = chai.expect

describe('LIBS-SHARED simulate_wildcard_round', function () {
  const create_mock_rosters = (teams) => {
    const rosters = {}
    for (const team of teams) {
      rosters[team.tid] = {
        tid: team.tid,
        lineups: {
          15: { baseline_total: team.projected_points_15 || 100 },
          16: { baseline_total: team.projected_points_16 || 100 },
          17: { baseline_total: team.projected_points_17 || 100 }
        }
      }
    }
    return rosters
  }

  it('should return championship odds for all 6 playoff teams', () => {
    const playoff_teams = [
      { tid: 1, regular_season_finish: 1 },
      { tid: 2, regular_season_finish: 2 },
      { tid: 3, regular_season_finish: 3 },
      { tid: 4, regular_season_finish: 4 },
      { tid: 5, regular_season_finish: 5 },
      { tid: 6, regular_season_finish: 6 }
    ]
    const rosters = create_mock_rosters(playoff_teams)

    const result = simulate_wildcard_round({ playoff_teams, rosters })

    expect(result).to.have.all.keys('1', '2', '3', '4', '5', '6')
    for (const tid in result) {
      expect(result[tid]).to.have.property('championship_odds')
      expect(result[tid].championship_odds).to.be.at.least(0)
      expect(result[tid].championship_odds).to.be.at.most(1)
    }
  })

  it('should have odds that sum to approximately 1.0', () => {
    const playoff_teams = [
      { tid: 1, regular_season_finish: 1 },
      { tid: 2, regular_season_finish: 2 },
      { tid: 3, regular_season_finish: 3 },
      { tid: 4, regular_season_finish: 4 },
      { tid: 5, regular_season_finish: 5 },
      { tid: 6, regular_season_finish: 6 }
    ]
    const rosters = create_mock_rosters(playoff_teams)

    const result = simulate_wildcard_round({ playoff_teams, rosters })

    const total_odds = Object.values(result).reduce(
      (sum, team) => sum + team.championship_odds,
      0
    )
    expect(total_odds).to.be.closeTo(1.0, 0.01)
  })

  it('should give individual bye teams higher odds than individual wildcard teams with equal projections', () => {
    // With equal projections, individual bye teams should have higher odds
    // because they skip the wildcard round elimination
    const playoff_teams = [
      {
        tid: 1,
        regular_season_finish: 1,
        projected_points_15: 100,
        projected_points_16: 100,
        projected_points_17: 100
      },
      {
        tid: 2,
        regular_season_finish: 2,
        projected_points_15: 100,
        projected_points_16: 100,
        projected_points_17: 100
      },
      {
        tid: 3,
        regular_season_finish: 3,
        projected_points_15: 100,
        projected_points_16: 100,
        projected_points_17: 100
      },
      {
        tid: 4,
        regular_season_finish: 4,
        projected_points_15: 100,
        projected_points_16: 100,
        projected_points_17: 100
      },
      {
        tid: 5,
        regular_season_finish: 5,
        projected_points_15: 100,
        projected_points_16: 100,
        projected_points_17: 100
      },
      {
        tid: 6,
        regular_season_finish: 6,
        projected_points_15: 100,
        projected_points_16: 100,
        projected_points_17: 100
      }
    ]

    const rosters = {}
    for (const team of playoff_teams) {
      rosters[team.tid] = {
        tid: team.tid,
        lineups: {
          15: { baseline_total: team.projected_points_15 },
          16: { baseline_total: team.projected_points_16 },
          17: { baseline_total: team.projected_points_17 }
        }
      }
    }

    const result = simulate_wildcard_round({ playoff_teams, rosters })

    // Each bye team should have ~25% odds (guaranteed to championship, 1/4 chance to win)
    // Each wildcard team should have ~12.5% odds (50% to make championship, 25% to win if they do)
    const avg_bye_odds =
      (result[1].championship_odds + result[2].championship_odds) / 2
    const avg_wildcard_odds =
      (result[3].championship_odds +
        result[4].championship_odds +
        result[5].championship_odds +
        result[6].championship_odds) /
      4

    // Individual bye teams should have higher odds than individual wildcard teams
    expect(avg_bye_odds).to.be.greaterThan(avg_wildcard_odds)
  })

  it('should favor teams with higher projected points', () => {
    const playoff_teams = [
      { tid: 1, regular_season_finish: 1 },
      { tid: 2, regular_season_finish: 2 },
      { tid: 3, regular_season_finish: 3 },
      { tid: 4, regular_season_finish: 4 },
      { tid: 5, regular_season_finish: 5 },
      { tid: 6, regular_season_finish: 6 }
    ]

    // Give team 1 a significant advantage
    const rosters = {}
    for (const team of playoff_teams) {
      rosters[team.tid] = {
        tid: team.tid,
        lineups: {
          15: { baseline_total: team.tid === 1 ? 150 : 100 },
          16: { baseline_total: team.tid === 1 ? 150 : 100 },
          17: { baseline_total: team.tid === 1 ? 150 : 100 }
        }
      }
    }

    const result = simulate_wildcard_round({ playoff_teams, rosters })

    // Team 1 should have the highest odds
    expect(result[1].championship_odds).to.be.greaterThan(
      result[2].championship_odds
    )
    expect(result[1].championship_odds).to.be.greaterThan(
      result[3].championship_odds
    )
  })
})
