/* global describe it */

import * as chai from 'chai'

import { simulation } from '#libs-shared'

chai.should()
const expect = chai.expect

describe('LIBS-SHARED simulation', function () {
  describe('fit_gamma_params', function () {
    it('should fit gamma parameters from mean and std', () => {
      const mean_points = 15.0
      const std_points = 7.5
      const params = simulation.fit_gamma_params({ mean_points, std_points })

      expect(params).to.have.property('alpha')
      expect(params).to.have.property('theta')
      expect(params.alpha).to.be.a('number')
      expect(params.theta).to.be.a('number')
      expect(params.alpha).to.be.greaterThan(0)
      expect(params.theta).to.be.greaterThan(0)

      // Verify mean matches: mean = alpha * theta
      const computed_mean = params.alpha * params.theta
      expect(computed_mean).to.be.closeTo(mean_points, 0.01)
    })

    it('should handle low variance', () => {
      const mean_points = 10.0
      const std_points = 1.0
      const params = simulation.fit_gamma_params({ mean_points, std_points })

      expect(params.alpha).to.be.a('number')
      expect(params.theta).to.be.a('number')
    })

    it('should handle high variance', () => {
      const mean_points = 10.0
      const std_points = 10.0
      const params = simulation.fit_gamma_params({ mean_points, std_points })

      expect(params.alpha).to.be.a('number')
      expect(params.theta).to.be.a('number')
    })
  })

  describe('fit_log_normal_params', function () {
    it('should fit log-normal parameters from mean and std', () => {
      const mean_points = 15.0
      const std_points = 7.5
      const params = simulation.fit_log_normal_params({
        mean_points,
        std_points
      })

      expect(params).to.have.property('mu')
      expect(params).to.have.property('sigma')
      expect(params.mu).to.be.a('number')
      expect(params.sigma).to.be.a('number')
      expect(params.sigma).to.be.greaterThan(0)
    })
  })

  describe('sample_from_distribution', function () {
    it('should sample from gamma distribution', () => {
      const gamma_params = simulation.fit_gamma_params({
        mean_points: 15,
        std_points: 7.5
      })
      const uniform_sample = 0.5

      const sample = simulation.sample_from_distribution({
        uniform_sample,
        distribution_type: simulation.DISTRIBUTION_TYPES.GAMMA,
        distribution_params: gamma_params
      })
      expect(sample).to.be.a('number')
      expect(sample).to.be.greaterThan(0)
    })

    it('should sample from log_normal distribution', () => {
      const ln_params = simulation.fit_log_normal_params({
        mean_points: 15,
        std_points: 7.5
      })
      const uniform_sample = 0.5

      const sample = simulation.sample_from_distribution({
        uniform_sample,
        distribution_type: simulation.DISTRIBUTION_TYPES.LOG_NORMAL,
        distribution_params: ln_params
      })
      expect(sample).to.be.a('number')
      expect(sample).to.be.greaterThan(0)
    })

    it('should sample from truncated_normal distribution', () => {
      const uniform_sample = 0.5

      const sample = simulation.sample_from_distribution({
        uniform_sample,
        distribution_type: simulation.DISTRIBUTION_TYPES.TRUNCATED_NORMAL,
        distribution_params: {}
      })
      expect(sample).to.be.a('number')
      expect(sample).to.be.at.least(0)
    })

    it('should return value for constant distribution', () => {
      const uniform_sample = 0.5

      const sample = simulation.sample_from_distribution({
        uniform_sample,
        distribution_type: simulation.DISTRIBUTION_TYPES.CONSTANT,
        distribution_params: { mean_points: 12.5 }
      })
      expect(sample).to.equal(12.5)
    })
  })

  describe('get_player_relationship', function () {
    // Schedule format: { [team_abbrev]: { opponent, esbid, is_home } }
    const schedule = {
      KC: { opponent: 'SF', esbid: 1001, is_home: true },
      SF: { opponent: 'KC', esbid: 1001, is_home: false },
      PHI: { opponent: 'DAL', esbid: 1002, is_home: true },
      DAL: { opponent: 'PHI', esbid: 1002, is_home: false }
      // NYG and LAR not in schedule = on bye
    }

    it('should identify same team players', () => {
      const player_a = { pid: 'p1', nfl_team: 'KC' }
      const player_b = { pid: 'p2', nfl_team: 'KC' }

      const result = simulation.get_player_relationship({
        player_a,
        player_b,
        schedule
      })
      expect(result).to.equal(simulation.RELATIONSHIP_TYPES.SAME_TEAM)
    })

    it('should identify cross-team same game players', () => {
      const player_a = { pid: 'p1', nfl_team: 'KC' }
      const player_b = { pid: 'p2', nfl_team: 'SF' }

      const result = simulation.get_player_relationship({
        player_a,
        player_b,
        schedule
      })
      expect(result).to.equal(
        simulation.RELATIONSHIP_TYPES.CROSS_TEAM_SAME_GAME
      )
    })

    it('should identify independent players', () => {
      const player_a = { pid: 'p1', nfl_team: 'KC' }
      const player_b = { pid: 'p2', nfl_team: 'PHI' }

      const result = simulation.get_player_relationship({
        player_a,
        player_b,
        schedule
      })
      expect(result).to.equal(simulation.RELATIONSHIP_TYPES.INDEPENDENT)
    })

    it('should return null for bye week players', () => {
      const player_a = { pid: 'p1', nfl_team: 'NYG' }
      const player_b = { pid: 'p2', nfl_team: 'KC' }

      const result = simulation.get_player_relationship({
        player_a,
        player_b,
        schedule
      })
      expect(result).to.equal(null)
    })
  })

  describe('is_positive_definite', function () {
    it('should return true for identity matrix', () => {
      const identity = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
      ]

      expect(simulation.is_positive_definite(identity)).to.equal(true)
    })

    it('should return false for non-positive definite matrix', () => {
      // A matrix that is not positive definite
      const non_pd = [
        [1, 2],
        [2, 1]
      ]

      expect(simulation.is_positive_definite(non_pd)).to.equal(false)
    })
  })

  describe('build_correlation_matrix', function () {
    it('should build correlation matrix for players', () => {
      const players = [
        {
          pid: 'player1',
          nfl_team: 'KC',
          position: 'QB',
          position_rank: 'QB1'
        },
        {
          pid: 'player2',
          nfl_team: 'KC',
          position: 'WR',
          position_rank: 'WR1'
        },
        { pid: 'player3', nfl_team: 'SF', position: 'QB', position_rank: 'QB1' }
      ]

      const schedule = {
        KC: { opponent: 'SF', esbid: 1001, is_home: true },
        SF: { opponent: 'KC', esbid: 1001, is_home: false }
      }

      const correlation_cache = new Map()
      const archetypes = new Map()

      const result = simulation.build_correlation_matrix({
        players,
        schedule,
        correlation_cache,
        archetypes
      })

      // Returns { matrix, ... }
      expect(result).to.have.property('matrix')
      const matrix = result.matrix

      expect(matrix).to.have.lengthOf(3)
      expect(matrix[0]).to.have.lengthOf(3)

      // Diagonal should be 1
      expect(matrix[0][0]).to.equal(1)
      expect(matrix[1][1]).to.equal(1)
      expect(matrix[2][2]).to.equal(1)

      // Should be symmetric
      expect(matrix[0][1]).to.equal(matrix[1][0])
      expect(matrix[0][2]).to.equal(matrix[2][0])
      expect(matrix[1][2]).to.equal(matrix[2][1])
    })
  })

  describe('normal_cdf', function () {
    it('should return 0.5 for z=0', () => {
      expect(simulation.normal_cdf(0)).to.be.closeTo(0.5, 0.001)
    })

    it('should return ~0.84 for z=1', () => {
      expect(simulation.normal_cdf(1)).to.be.closeTo(0.8413, 0.01)
    })

    it('should return ~0.16 for z=-1', () => {
      expect(simulation.normal_cdf(-1)).to.be.closeTo(0.1587, 0.01)
    })
  })

  describe('run_simulation', function () {
    it('should run simulation and return results', () => {
      const players = [
        {
          pid: 'p1',
          nfl_team: 'KC',
          position: 'QB',
          position_rank: 'QB1',
          team_id: 1
        },
        {
          pid: 'p2',
          nfl_team: 'KC',
          position: 'WR',
          position_rank: 'WR1',
          team_id: 1
        },
        {
          pid: 'p3',
          nfl_team: 'SF',
          position: 'QB',
          position_rank: 'QB1',
          team_id: 2
        },
        {
          pid: 'p4',
          nfl_team: 'SF',
          position: 'WR',
          position_rank: 'WR1',
          team_id: 2
        }
      ]

      const projections = new Map([
        ['p1', 20],
        ['p2', 15],
        ['p3', 18],
        ['p4', 14]
      ])

      const variance_cache = new Map([
        ['p1', { std_points: 8 }],
        ['p2', { std_points: 7.5 }],
        ['p3', { std_points: 7.2 }],
        ['p4', { std_points: 7 }]
      ])

      const correlation_cache = new Map()
      const archetypes = new Map()

      const schedule = {
        KC: { opponent: 'SF', esbid: 1001, is_home: true },
        SF: { opponent: 'KC', esbid: 1001, is_home: false }
      }

      const teams = [
        { team_id: 1, name: 'Team 1' },
        { team_id: 2, name: 'Team 2' }
      ]

      const results = simulation.run_simulation({
        players,
        projections,
        variance_cache,
        correlation_cache,
        archetypes,
        schedule,
        teams,
        n_simulations: 1000,
        seed: 42
      })

      expect(results).to.have.property('win_probabilities')
      expect(results).to.have.property('score_distributions')
      expect(results).to.have.property('n_simulations')
      expect(results).to.have.property('elapsed_ms')

      expect(results.n_simulations).to.equal(1000)
      expect(results.win_probabilities).to.be.instanceOf(Map)
      expect(results.score_distributions).to.be.instanceOf(Map)

      // Win probabilities should sum to 1
      let total_prob = 0
      for (const [, prob] of results.win_probabilities) {
        total_prob += prob
        expect(prob).to.be.at.least(0)
        expect(prob).to.be.at.most(1)
      }
      expect(total_prob).to.be.closeTo(1, 0.01)

      // Score distributions should have expected properties
      for (const [, dist] of results.score_distributions) {
        expect(dist).to.have.property('mean')
        expect(dist).to.have.property('std')
        expect(dist).to.have.property('min')
        expect(dist).to.have.property('max')
        expect(dist).to.have.property('median')
        expect(dist).to.have.property('percentile_25')
        expect(dist).to.have.property('percentile_75')
      }
    })

    it('should handle more than 2 teams', () => {
      const players = [
        {
          pid: 'p1',
          nfl_team: 'KC',
          position: 'QB',
          position_rank: 'QB1',
          team_id: 1
        },
        {
          pid: 'p2',
          nfl_team: 'SF',
          position: 'QB',
          position_rank: 'QB1',
          team_id: 2
        },
        {
          pid: 'p3',
          nfl_team: 'PHI',
          position: 'QB',
          position_rank: 'QB1',
          team_id: 3
        }
      ]

      const projections = new Map([
        ['p1', 20],
        ['p2', 18],
        ['p3', 19]
      ])

      const variance_cache = new Map([
        ['p1', { std_points: 8 }],
        ['p2', { std_points: 7.2 }],
        ['p3', { std_points: 7.6 }]
      ])

      const schedule = {
        KC: { opponent: 'SF', esbid: 1001, is_home: true },
        SF: { opponent: 'KC', esbid: 1001, is_home: false },
        PHI: { opponent: 'DAL', esbid: 1002, is_home: true },
        DAL: { opponent: 'PHI', esbid: 1002, is_home: false }
      }

      const teams = [
        { team_id: 1, name: 'Team 1' },
        { team_id: 2, name: 'Team 2' },
        { team_id: 3, name: 'Team 3' }
      ]

      const results = simulation.run_simulation({
        players,
        projections,
        variance_cache,
        correlation_cache: new Map(),
        archetypes: new Map(),
        schedule,
        teams,
        n_simulations: 500
      })

      expect(results.win_probabilities.size).to.equal(3)

      let total_prob = 0
      for (const [, prob] of results.win_probabilities) {
        total_prob += prob
      }
      expect(total_prob).to.be.closeTo(1, 0.01)
    })
  })

  describe('correlation constants', function () {
    it('should export SAME_TEAM_CORRELATIONS', () => {
      expect(simulation.SAME_TEAM_CORRELATIONS).to.be.an('object')
      expect(simulation.SAME_TEAM_CORRELATIONS).to.have.property('QB')
      expect(simulation.SAME_TEAM_CORRELATIONS.QB).to.have.property('WR1')
    })

    it('should export CROSS_TEAM_CORRELATIONS', () => {
      expect(simulation.CROSS_TEAM_CORRELATIONS).to.be.an('object')
      expect(simulation.CROSS_TEAM_CORRELATIONS).to.have.property('QB')
      expect(simulation.CROSS_TEAM_CORRELATIONS.QB).to.have.property('QB')
    })

    it('should export CV_BOUNDS', () => {
      expect(simulation.CV_BOUNDS).to.be.an('object')
      expect(simulation.CV_BOUNDS).to.have.property('QB')
      expect(simulation.CV_BOUNDS.QB).to.have.property('min')
      expect(simulation.CV_BOUNDS.QB).to.have.property('max')
    })

    it('should export POSITION_TO_DEFAULT_RANK', () => {
      expect(simulation.POSITION_TO_DEFAULT_RANK).to.be.an('object')
      expect(simulation.POSITION_TO_DEFAULT_RANK.WR).to.equal('WR3')
      expect(simulation.POSITION_TO_DEFAULT_RANK.RB).to.equal('RB2')
      expect(simulation.POSITION_TO_DEFAULT_RANK.TE).to.equal('TE1')
    })
  })

  describe('normalize_position_rank', function () {
    it('should return valid position ranks unchanged', () => {
      expect(simulation.normalize_position_rank('QB')).to.equal('QB')
      expect(simulation.normalize_position_rank('WR1')).to.equal('WR1')
      expect(simulation.normalize_position_rank('WR2')).to.equal('WR2')
      expect(simulation.normalize_position_rank('WR3')).to.equal('WR3')
      expect(simulation.normalize_position_rank('RB1')).to.equal('RB1')
      expect(simulation.normalize_position_rank('RB2')).to.equal('RB2')
      expect(simulation.normalize_position_rank('TE1')).to.equal('TE1')
      expect(simulation.normalize_position_rank('K')).to.equal('K')
      expect(simulation.normalize_position_rank('DST')).to.equal('DST')
    })

    it('should map bare WR to WR3', () => {
      expect(simulation.normalize_position_rank('WR')).to.equal('WR3')
    })

    it('should map bare RB to RB2', () => {
      expect(simulation.normalize_position_rank('RB')).to.equal('RB2')
    })

    it('should map bare TE to TE1', () => {
      expect(simulation.normalize_position_rank('TE')).to.equal('TE1')
    })

    it('should return unknown positions unchanged', () => {
      expect(simulation.normalize_position_rank('UNKNOWN')).to.equal('UNKNOWN')
    })
  })

  describe('get_default_correlation', function () {
    it('should return correlation for valid position ranks', () => {
      const correlation = simulation.get_default_correlation({
        position_rank_a: 'QB',
        position_rank_b: 'WR1',
        relationship_type: 'same_team'
      })
      expect(correlation).to.equal(0.42)
    })

    it('should handle bare WR position by normalizing to WR3', () => {
      // WR (normalized to WR3) vs QB same_team should return WR3-QB correlation
      const correlation = simulation.get_default_correlation({
        position_rank_a: 'WR',
        position_rank_b: 'QB',
        relationship_type: 'same_team'
      })
      // Should equal SAME_TEAM_CORRELATIONS.WR3.QB = 0.28
      expect(correlation).to.equal(0.28)
    })

    it('should handle bare RB position by normalizing to RB2', () => {
      const correlation = simulation.get_default_correlation({
        position_rank_a: 'RB',
        position_rank_b: 'QB',
        relationship_type: 'same_team'
      })
      // Should equal SAME_TEAM_CORRELATIONS.RB2.QB = 0.08
      expect(correlation).to.equal(0.08)
    })

    it('should handle bare TE position by normalizing to TE1', () => {
      const correlation = simulation.get_default_correlation({
        position_rank_a: 'TE',
        position_rank_b: 'QB',
        relationship_type: 'same_team'
      })
      // Should equal SAME_TEAM_CORRELATIONS.TE1.QB = 0.32
      expect(correlation).to.equal(0.32)
    })

    it('should handle both positions being bare', () => {
      const correlation = simulation.get_default_correlation({
        position_rank_a: 'WR',
        position_rank_b: 'RB',
        relationship_type: 'same_team'
      })
      // WR3 vs RB2 same_team should be SAME_TEAM_CORRELATIONS.WR3.RB2 = 0.04
      expect(correlation).to.equal(0.04)
    })

    it('should handle cross-team correlations with bare positions', () => {
      const correlation = simulation.get_default_correlation({
        position_rank_a: 'WR',
        position_rank_b: 'DST',
        relationship_type: 'cross_team_same_game'
      })
      // WR3 vs DST cross_team should be CROSS_TEAM_CORRELATIONS.WR3.DST = -0.2
      expect(correlation).to.equal(-0.2)
    })
  })

  describe('apply_archetype_adjustment', function () {
    it('should return base correlation unchanged for cross-team relationships', () => {
      const result = simulation.apply_archetype_adjustment({
        base_correlation: 0.3,
        archetype_a: 'rushing_qb',
        archetype_b: null,
        position_a: 'QB',
        position_b: 'RB',
        position_rank_a: 'QB',
        position_rank_b: 'RB1',
        relationship_type: 'cross_team_same_game'
      })
      expect(result).to.equal(0.3)
    })

    it('should return base correlation unchanged when no archetypes', () => {
      const result = simulation.apply_archetype_adjustment({
        base_correlation: 0.15,
        archetype_a: null,
        archetype_b: null,
        position_a: 'QB',
        position_b: 'RB',
        position_rank_a: 'QB',
        position_rank_b: 'RB1',
        relationship_type: 'same_team'
      })
      expect(result).to.equal(0.15)
    })

    it('should apply rushing_qb adjustment to own RB (-0.2)', () => {
      const result = simulation.apply_archetype_adjustment({
        base_correlation: 0.15,
        archetype_a: 'rushing_qb',
        archetype_b: null,
        position_a: 'QB',
        position_b: 'RB',
        position_rank_a: 'QB',
        position_rank_b: 'RB1',
        relationship_type: 'same_team'
      })
      // 0.15 + (-0.2) = -0.05
      expect(result).to.be.closeTo(-0.05, 0.001)
    })

    it('should apply rushing_qb adjustment to WR1 only (-0.05)', () => {
      // WR1 should get the adjustment
      const result_wr1 = simulation.apply_archetype_adjustment({
        base_correlation: 0.42,
        archetype_a: 'rushing_qb',
        archetype_b: null,
        position_a: 'QB',
        position_b: 'WR',
        position_rank_a: 'QB',
        position_rank_b: 'WR1',
        relationship_type: 'same_team'
      })
      // 0.42 + (-0.05) = 0.37
      expect(result_wr1).to.be.closeTo(0.37, 0.001)

      // WR2 should NOT get the adjustment
      const result_wr2 = simulation.apply_archetype_adjustment({
        base_correlation: 0.35,
        archetype_a: 'rushing_qb',
        archetype_b: null,
        position_a: 'QB',
        position_b: 'WR',
        position_rank_a: 'QB',
        position_rank_b: 'WR2',
        relationship_type: 'same_team'
      })
      // Should remain 0.35 (no adjustment)
      expect(result_wr2).to.equal(0.35)
    })

    it('should apply mobile_qb adjustment to own RB (-0.1)', () => {
      const result = simulation.apply_archetype_adjustment({
        base_correlation: 0.15,
        archetype_a: 'mobile_qb',
        archetype_b: null,
        position_a: 'QB',
        position_b: 'RB',
        position_rank_a: 'QB',
        position_rank_b: 'RB1',
        relationship_type: 'same_team'
      })
      // 0.15 + (-0.1) = 0.05
      expect(result).to.be.closeTo(0.05, 0.001)
    })

    it('should apply pocket_passer adjustment to own RB (+0.05)', () => {
      const result = simulation.apply_archetype_adjustment({
        base_correlation: 0.15,
        archetype_a: 'pocket_passer',
        archetype_b: null,
        position_a: 'QB',
        position_b: 'RB',
        position_rank_a: 'QB',
        position_rank_b: 'RB1',
        relationship_type: 'same_team'
      })
      // 0.15 + 0.05 = 0.20
      expect(result).to.be.closeTo(0.2, 0.001)
    })

    it('should apply target_hog_wr adjustment to own QB (+0.1)', () => {
      const result = simulation.apply_archetype_adjustment({
        base_correlation: 0.42,
        archetype_a: null,
        archetype_b: 'target_hog_wr',
        position_a: 'QB',
        position_b: 'WR',
        position_rank_a: 'QB',
        position_rank_b: 'WR1',
        relationship_type: 'same_team'
      })
      // 0.42 + 0.1 = 0.52
      expect(result).to.be.closeTo(0.52, 0.001)
    })

    it('should apply wr1_level adjustment to own QB (+0.03)', () => {
      const result = simulation.apply_archetype_adjustment({
        base_correlation: 0.42,
        archetype_a: null,
        archetype_b: 'wr1_level',
        position_a: 'QB',
        position_b: 'WR',
        position_rank_a: 'QB',
        position_rank_b: 'WR1',
        relationship_type: 'same_team'
      })
      // 0.42 + 0.03 = 0.45
      expect(result).to.be.closeTo(0.45, 0.001)
    })

    it('should apply pass_catching_rb adjustment to own QB (+0.08)', () => {
      const result = simulation.apply_archetype_adjustment({
        base_correlation: 0.15,
        archetype_a: null,
        archetype_b: 'pass_catching_rb',
        position_a: 'QB',
        position_b: 'RB',
        position_rank_a: 'QB',
        position_rank_b: 'RB1',
        relationship_type: 'same_team'
      })
      // 0.15 + 0.08 = 0.23
      expect(result).to.be.closeTo(0.23, 0.001)
    })

    it('should apply hybrid_rb adjustment to own QB (+0.04)', () => {
      const result = simulation.apply_archetype_adjustment({
        base_correlation: 0.15,
        archetype_a: null,
        archetype_b: 'hybrid_rb',
        position_a: 'QB',
        position_b: 'RB',
        position_rank_a: 'QB',
        position_rank_b: 'RB1',
        relationship_type: 'same_team'
      })
      // 0.15 + 0.04 = 0.19
      expect(result).to.be.closeTo(0.19, 0.001)
    })

    it('should combine adjustments from both players', () => {
      // rushing_qb (-0.2 to RB) + pass_catching_rb (+0.08 to QB)
      const result = simulation.apply_archetype_adjustment({
        base_correlation: 0.15,
        archetype_a: 'rushing_qb',
        archetype_b: 'pass_catching_rb',
        position_a: 'QB',
        position_b: 'RB',
        position_rank_a: 'QB',
        position_rank_b: 'RB1',
        relationship_type: 'same_team'
      })
      // 0.15 + (-0.2) + 0.08 = 0.03
      expect(result).to.be.closeTo(0.03, 0.001)
    })

    it('should clamp result to [-1, 1]', () => {
      // Test lower bound clamping
      const result_low = simulation.apply_archetype_adjustment({
        base_correlation: -0.9,
        archetype_a: 'rushing_qb',
        archetype_b: null,
        position_a: 'QB',
        position_b: 'RB',
        position_rank_a: 'QB',
        position_rank_b: 'RB1',
        relationship_type: 'same_team'
      })
      // -0.9 + (-0.2) = -1.1, should clamp to -1
      expect(result_low).to.equal(-1)

      // Test upper bound clamping
      const result_high = simulation.apply_archetype_adjustment({
        base_correlation: 0.95,
        archetype_a: null,
        archetype_b: 'target_hog_wr',
        position_a: 'QB',
        position_b: 'WR',
        position_rank_a: 'QB',
        position_rank_b: 'WR1',
        relationship_type: 'same_team'
      })
      // 0.95 + 0.1 = 1.05, should clamp to 1
      expect(result_high).to.equal(1)
    })

    it('should apply own_rb adjustment to both RB1 and RB2', () => {
      // RB1 should get adjustment
      const result_rb1 = simulation.apply_archetype_adjustment({
        base_correlation: 0.15,
        archetype_a: 'rushing_qb',
        archetype_b: null,
        position_a: 'QB',
        position_b: 'RB',
        position_rank_a: 'QB',
        position_rank_b: 'RB1',
        relationship_type: 'same_team'
      })
      expect(result_rb1).to.be.closeTo(-0.05, 0.001)

      // RB2 should also get adjustment (own_rb applies to all RBs)
      const result_rb2 = simulation.apply_archetype_adjustment({
        base_correlation: 0.08,
        archetype_a: 'rushing_qb',
        archetype_b: null,
        position_a: 'QB',
        position_b: 'RB',
        position_rank_a: 'QB',
        position_rank_b: 'RB2',
        relationship_type: 'same_team'
      })
      // 0.08 + (-0.2) = -0.12
      expect(result_rb2).to.be.closeTo(-0.12, 0.001)
    })

    it('should handle undefined archetypes gracefully', () => {
      const result = simulation.apply_archetype_adjustment({
        base_correlation: 0.15,
        archetype_a: 'nonexistent_archetype',
        archetype_b: undefined,
        position_a: 'QB',
        position_b: 'RB',
        position_rank_a: 'QB',
        position_rank_b: 'RB1',
        relationship_type: 'same_team'
      })
      // No valid archetype, should return base unchanged
      expect(result).to.equal(0.15)
    })
  })

  describe('build_extended_correlation_matrix', function () {
    it('should build extended matrix with correct dimensions', () => {
      const players = [
        { pid: 'p1', nfl_team: 'KC', position: 'QB', esbid: 'game1' },
        { pid: 'p2', nfl_team: 'KC', position: 'RB', esbid: 'game1' },
        { pid: 'p3', nfl_team: 'BUF', position: 'QB', esbid: 'game2' }
      ]
      const schedule = {
        KC: { opponent: 'DEN', esbid: 'game1', is_home: true, is_final: false },
        BUF: { opponent: 'MIA', esbid: 'game2', is_home: true, is_final: false }
      }
      const correlation_cache = new Map()
      const archetypes = new Map()
      const game_outcome_correlations = new Map([
        ['p1', { correlation: 0.3, confidence: 0.9 }],
        ['p2', { correlation: 0.4, confidence: 0.85 }],
        ['p3', { correlation: 0.25, confidence: 0.8 }]
      ])
      const position_defaults = new Map()

      const result = simulation.build_extended_correlation_matrix({
        players,
        schedule,
        correlation_cache,
        archetypes,
        game_outcome_correlations,
        position_defaults
      })

      // 3 players + 2 games = 5x5 matrix
      expect(result.matrix.length).to.equal(5)
      expect(result.matrix[0].length).to.equal(5)
      expect(result.n_players).to.equal(3)
      expect(result.n_games).to.equal(2)
      expect(result.game_indices.size).to.equal(2)
    })

    it('should set player-game correlations correctly', () => {
      const players = [
        { pid: 'p1', nfl_team: 'KC', position: 'RB', esbid: 'game1' }
      ]
      const schedule = {
        KC: { opponent: 'DEN', esbid: 'game1', is_home: true, is_final: false }
      }
      const correlation_cache = new Map()
      const archetypes = new Map()
      const game_outcome_correlations = new Map([
        ['p1', { correlation: 0.45, confidence: 0.95 }]
      ])
      const position_defaults = new Map()

      const result = simulation.build_extended_correlation_matrix({
        players,
        schedule,
        correlation_cache,
        archetypes,
        game_outcome_correlations,
        position_defaults
      })

      // Player-game correlation should be set (index 0 for player, index 1 for game)
      // Note: positive definiteness adjustment can modify values slightly
      expect(result.matrix[0][1]).to.be.closeTo(0.45, 0.05)
      expect(result.matrix[1][0]).to.be.closeTo(0.45, 0.05)
    })

    it('should have zero cross-game correlations', () => {
      const players = [
        { pid: 'p1', nfl_team: 'KC', position: 'QB', esbid: 'game1' },
        { pid: 'p2', nfl_team: 'BUF', position: 'QB', esbid: 'game2' }
      ]
      const schedule = {
        KC: { opponent: 'DEN', esbid: 'game1', is_home: true, is_final: false },
        BUF: { opponent: 'MIA', esbid: 'game2', is_home: true, is_final: false }
      }
      const correlation_cache = new Map()
      const archetypes = new Map()
      const game_outcome_correlations = new Map([
        ['p1', { correlation: 0.3, confidence: 0.9 }],
        ['p2', { correlation: 0.3, confidence: 0.9 }]
      ])
      const position_defaults = new Map()

      const result = simulation.build_extended_correlation_matrix({
        players,
        schedule,
        correlation_cache,
        archetypes,
        game_outcome_correlations,
        position_defaults
      })

      // Game indices are at n_players + offset
      const game1_idx = result.game_indices.get('game1')
      const game2_idx = result.game_indices.get('game2')

      // Cross-game correlation should be 0
      expect(result.matrix[game1_idx][game2_idx]).to.equal(0)
      expect(result.matrix[game2_idx][game1_idx]).to.equal(0)
    })

    it('should blend with position defaults when confidence is low', () => {
      const players = [
        { pid: 'p1', nfl_team: 'KC', position: 'RB', esbid: 'game1' }
      ]
      const schedule = {
        KC: { opponent: 'DEN', esbid: 'game1', is_home: true, is_final: false }
      }
      const correlation_cache = new Map()
      const archetypes = new Map()
      // Low confidence triggers blending
      const game_outcome_correlations = new Map([
        ['p1', { correlation: 0.5, confidence: 0.5 }]
      ])
      const position_defaults = new Map([['RB', { default_correlation: 0.35 }]])

      const result = simulation.build_extended_correlation_matrix({
        players,
        schedule,
        correlation_cache,
        archetypes,
        game_outcome_correlations,
        position_defaults
      })

      // Blended correlation should be between player (0.5) and default (0.35)
      expect(result.matrix[0][1]).to.be.greaterThan(0.35)
      expect(result.matrix[0][1]).to.be.lessThan(0.5)
    })

    it('should produce positive definite matrix', () => {
      const players = [
        { pid: 'p1', nfl_team: 'KC', position: 'QB', esbid: 'game1' },
        { pid: 'p2', nfl_team: 'KC', position: 'RB', esbid: 'game1' },
        { pid: 'p3', nfl_team: 'KC', position: 'WR', esbid: 'game1' }
      ]
      const schedule = {
        KC: { opponent: 'DEN', esbid: 'game1', is_home: true, is_final: false }
      }
      const correlation_cache = new Map()
      const archetypes = new Map()
      const game_outcome_correlations = new Map([
        ['p1', { correlation: 0.2, confidence: 0.9 }],
        ['p2', { correlation: 0.4, confidence: 0.9 }],
        ['p3', { correlation: 0.1, confidence: 0.9 }]
      ])
      const position_defaults = new Map()

      const result = simulation.build_extended_correlation_matrix({
        players,
        schedule,
        correlation_cache,
        archetypes,
        game_outcome_correlations,
        position_defaults
      })

      // Matrix should be positive definite (can generate samples without error)
      expect(() => {
        simulation.generate_correlated_uniforms({
          correlation_matrix: result.matrix,
          n_simulations: 10
        })
      }).to.not.throw()
    })
  })

  describe('get_effective_game_outcome_correlation', function () {
    it('should return player correlation when confidence is high', () => {
      const player_correlations = new Map([
        ['p1', { correlation: 0.45, confidence: 0.9 }]
      ])
      const position_defaults = new Map([['RB', { default_correlation: 0.35 }]])

      const result = simulation.get_effective_game_outcome_correlation({
        pid: 'p1',
        pos: 'RB',
        archetype: null,
        player_correlations,
        position_defaults
      })

      expect(result).to.equal(0.45)
    })

    it('should return position default when no player data', () => {
      const player_correlations = new Map()
      const position_defaults = new Map([['RB', { default_correlation: 0.35 }]])

      const result = simulation.get_effective_game_outcome_correlation({
        pid: 'p1',
        pos: 'RB',
        archetype: null,
        player_correlations,
        position_defaults
      })

      expect(result).to.equal(0.35)
    })

    it('should prefer archetype-specific default over position default', () => {
      const player_correlations = new Map()
      const position_defaults = new Map([
        ['RB', { default_correlation: 0.35 }],
        ['RB:power', { default_correlation: 0.42 }]
      ])

      const result = simulation.get_effective_game_outcome_correlation({
        pid: 'p1',
        pos: 'RB',
        archetype: 'power',
        player_correlations,
        position_defaults
      })

      expect(result).to.equal(0.42)
    })
  })

  describe('calculate_variance_scale', function () {
    it('should return 1.0 for baseline game total', () => {
      const result = simulation.calculate_variance_scale({
        game_total: 46 // BASELINE_GAME_TOTAL
      })
      expect(result).to.equal(1.0)
    })

    it('should increase variance for high-scoring games', () => {
      const result = simulation.calculate_variance_scale({
        game_total: 56 // 10 points above baseline
      })
      // 1.0 + 10 * 0.003 = 1.03
      expect(result).to.be.greaterThan(1.0)
      expect(result).to.be.closeTo(1.03, 0.01)
    })

    it('should decrease variance for low-scoring games', () => {
      const result = simulation.calculate_variance_scale({
        game_total: 36 // 10 points below baseline
      })
      // 1.0 - 10 * 0.003 = 0.97
      expect(result).to.be.lessThan(1.0)
      expect(result).to.be.closeTo(0.97, 0.01)
    })

    it('should clamp to minimum bound', () => {
      const result = simulation.calculate_variance_scale({
        game_total: 0 // Extremely low
      })
      expect(result).to.be.greaterThanOrEqual(0.85)
    })

    it('should clamp to maximum bound', () => {
      const result = simulation.calculate_variance_scale({
        game_total: 100 // Extremely high
      })
      expect(result).to.be.lessThanOrEqual(1.15)
    })

    it('should return 1.0 for null game_total', () => {
      const result = simulation.calculate_variance_scale({
        game_total: null
      })
      expect(result).to.equal(1.0)
    })
  })

  describe('calculate_spread_adjustment', function () {
    it('should return 1.0 for null spread', () => {
      const result = simulation.calculate_spread_adjustment({
        position: 'RB',
        team_spread: null,
        base_projection: 15
      })
      expect(result).to.equal(1.0)
    })

    it('should boost RB projection when team is favored', () => {
      const result = simulation.calculate_spread_adjustment({
        position: 'RB',
        team_spread: -7, // 7 point favorite
        base_projection: 15
      })
      // RB coefficient is 0.005, -(-7) * 0.005 = 0.035
      expect(result).to.be.greaterThan(1.0)
      expect(result).to.be.closeTo(1.035, 0.01)
    })

    it('should slightly reduce WR projection when team is favored', () => {
      const result = simulation.calculate_spread_adjustment({
        position: 'WR',
        team_spread: -7, // 7 point favorite
        base_projection: 12
      })
      // WR coefficient is -0.003, -(-7) * -0.003 = -0.021
      expect(result).to.be.lessThan(1.0)
    })

    it('should clamp adjustment to reasonable bounds', () => {
      const result = simulation.calculate_spread_adjustment({
        position: 'RB',
        team_spread: -30, // Extreme favorite
        base_projection: 15
      })
      expect(result).to.be.lessThanOrEqual(1.1)
      expect(result).to.be.greaterThanOrEqual(0.9)
    })
  })

  describe('extract_game_outcome_samples', function () {
    it('should extract game outcome values from extended samples', () => {
      const samples = [0.1, 0.2, 0.3, 0.6, 0.7] // 3 players, 2 games
      const game_indices = new Map([
        ['game1', 3],
        ['game2', 4]
      ])
      const n_players = 3

      const result = simulation.extract_game_outcome_samples({
        samples,
        game_indices,
        n_players
      })

      expect(result.get('game1')).to.equal(0.6)
      expect(result.get('game2')).to.equal(0.7)
    })
  })
})
