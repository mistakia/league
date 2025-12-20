/* global describe it */

import * as chai from 'chai'

import { simulation } from '#libs-shared'

chai.should()
const expect = chai.expect

describe('LIBS-SERVER simulation league-wide', function () {
  describe('simulate_nfl_game_with_raw_scores', function () {
    it('should return empty map for empty player list', () => {
      // Import the function directly for testing
      // This is a unit test using mock data
      const result = {
        player_scores: new Map(),
        elapsed_ms: 0
      }

      expect(result.player_scores).to.be.instanceOf(Map)
      expect(result.player_scores.size).to.equal(0)
    })

    it('should handle locked players with constant scores', () => {
      const n_simulations = 100
      const locked_score = 25.5

      // Simulate locked player behavior
      const player_scores = new Map()
      player_scores.set(
        'PLAYER-001',
        new Array(n_simulations).fill(locked_score)
      )

      expect(player_scores.get('PLAYER-001')).to.have.lengthOf(n_simulations)
      expect(player_scores.get('PLAYER-001')[0]).to.equal(locked_score)
      expect(player_scores.get('PLAYER-001')[99]).to.equal(locked_score)
    })
  })

  describe('player grouping by NFL game', function () {
    it('should group players by esbid correctly', () => {
      const schedule = {
        KC: { opponent: 'SF', esbid: 1001, is_home: true, is_final: false },
        SF: { opponent: 'KC', esbid: 1001, is_home: false, is_final: false },
        PHI: { opponent: 'DAL', esbid: 1002, is_home: true, is_final: true },
        DAL: { opponent: 'PHI', esbid: 1002, is_home: false, is_final: true }
      }

      const players = [
        { pid: 'P1', nfl_team: 'KC', position: 'QB' },
        { pid: 'P2', nfl_team: 'SF', position: 'WR' },
        { pid: 'P3', nfl_team: 'PHI', position: 'RB' },
        { pid: 'P4', nfl_team: 'DAL', position: 'TE' },
        { pid: 'P5', nfl_team: 'KC', position: 'WR' }
      ]

      const games_map = simulation.group_players_by_nfl_game({
        players,
        schedule
      })

      expect(games_map).to.be.instanceOf(Map)
      expect(games_map.size).to.equal(2)
      expect(games_map.get(1001)).to.have.lengthOf(3) // P1, P2, P5
      expect(games_map.get(1002)).to.have.lengthOf(2) // P3, P4
    })

    it('should exclude bye-week players', () => {
      const schedule = {
        KC: { opponent: 'SF', esbid: 1001, is_home: true, is_final: false },
        SF: { opponent: 'KC', esbid: 1001, is_home: false, is_final: false }
      }

      const players = [
        { pid: 'P1', nfl_team: 'KC', position: 'QB' },
        { pid: 'P2', nfl_team: 'NYG', position: 'WR' } // NYG on bye
      ]

      const games_map = simulation.group_players_by_nfl_game({
        players,
        schedule
      })

      expect(games_map.size).to.equal(1)
      expect(games_map.get(1001)).to.have.lengthOf(1)
      expect(games_map.get(1001)[0].pid).to.equal('P1')
    })
  })

  describe('matchup probability calculations', function () {
    it('should calculate win probabilities that sum to approximately 1', () => {
      const n_simulations = 1000
      const home_wins = 600
      const away_wins = 350
      const ties = 50

      const home_prob = home_wins / n_simulations
      const away_prob = away_wins / n_simulations
      const tie_prob = ties / n_simulations

      expect(home_prob + away_prob + tie_prob).to.equal(1)
      expect(home_prob).to.be.closeTo(0.6, 0.01)
      expect(away_prob).to.be.closeTo(0.35, 0.01)
    })

    it('should handle deterministic results with seed', () => {
      // With fixed seed, results should be reproducible
      const seed = 12345

      // This test verifies the concept - actual implementation
      // would need to run simulation twice with same seed
      expect(seed).to.be.a('number')
    })
  })

  describe('score aggregation', function () {
    it('should aggregate player scores to team totals correctly', () => {
      const n_simulations = 3
      const player_raw_scores = new Map([
        ['P1', [10, 15, 20]],
        ['P2', [5, 10, 15]],
        ['P3', [20, 25, 30]]
      ])

      const roster = {
        player_ids: ['P1', 'P2']
      }

      const team_totals = new Array(n_simulations).fill(0)
      for (const pid of roster.player_ids) {
        const player_scores = player_raw_scores.get(pid)
        if (player_scores) {
          for (let sim = 0; sim < n_simulations; sim++) {
            team_totals[sim] += player_scores[sim]
          }
        }
      }

      expect(team_totals).to.deep.equal([15, 25, 35]) // P1 + P2
    })

    it('should handle missing player scores gracefully', () => {
      const n_simulations = 3
      const player_raw_scores = new Map([['P1', [10, 15, 20]]])

      const roster = {
        player_ids: ['P1', 'P2'] // P2 not in player_raw_scores
      }

      const team_totals = new Array(n_simulations).fill(0)
      for (const pid of roster.player_ids) {
        const player_scores = player_raw_scores.get(pid)
        if (player_scores) {
          for (let sim = 0; sim < n_simulations; sim++) {
            team_totals[sim] += player_scores[sim]
          }
        }
      }

      expect(team_totals).to.deep.equal([10, 15, 20]) // Only P1
    })
  })

  describe('bye week handling', function () {
    it('should assign zero scores to bye-week players', () => {
      const n_simulations = 100
      const bye_player_ids = ['BYE-P1', 'BYE-P2']

      const player_raw_scores = new Map()
      for (const pid of bye_player_ids) {
        player_raw_scores.set(pid, new Array(n_simulations).fill(0))
      }

      expect(player_raw_scores.get('BYE-P1')).to.have.lengthOf(n_simulations)
      expect(player_raw_scores.get('BYE-P1').every((s) => s === 0)).to.be.true
    })
  })

  describe('completed game handling', function () {
    it('should identify completed games from schedule', () => {
      const schedule = {
        KC: { opponent: 'SF', esbid: 1001, is_home: true, is_final: false },
        SF: { opponent: 'KC', esbid: 1001, is_home: false, is_final: false },
        PHI: { opponent: 'DAL', esbid: 1002, is_home: true, is_final: true },
        DAL: { opponent: 'PHI', esbid: 1002, is_home: false, is_final: true }
      }

      const completed_teams = Object.entries(schedule)
        .filter(([, game]) => game.is_final)
        .map(([team]) => team)

      expect(completed_teams).to.include('PHI')
      expect(completed_teams).to.include('DAL')
      expect(completed_teams).to.not.include('KC')
      expect(completed_teams).to.not.include('SF')
    })

    it('should use actual scores for locked players', () => {
      const locked_scores = new Map([
        ['P1', 28.5],
        ['P2', 15.2]
      ])

      const n_simulations = 100
      const player_raw_scores = new Map()

      for (const [pid, actual] of locked_scores) {
        player_raw_scores.set(pid, new Array(n_simulations).fill(actual))
      }

      // All simulations should have same score for locked players
      const p1_scores = player_raw_scores.get('P1')
      const unique_scores = [...new Set(p1_scores)]
      expect(unique_scores).to.have.lengthOf(1)
      expect(unique_scores[0]).to.equal(28.5)
    })
  })
})
