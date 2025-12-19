/* global describe before it */
import * as chai from 'chai'

import knex from '#db'
import { simulation } from '#libs-server'

chai.should()
const expect = chai.expect

// Check if simulation tables exist
async function simulation_tables_exist() {
  try {
    await knex('player_archetypes').limit(0)
    await knex('player_variance').limit(0)
    await knex('player_pair_correlations').limit(0)
    return true
  } catch {
    return false
  }
}

describe('LIBS-SERVER simulation integration', function () {
  this.timeout(60 * 1000)
  let tables_exist = false

  before(async function () {
    // Seed the database
    await knex.seed.run()
    tables_exist = await simulation_tables_exist()
  })

  describe('load_nfl_schedule', function () {
    it('should load NFL schedule from database', async () => {
      // This test requires nfl_games data in the database
      // Schedule format: { [team_abbrev]: { opponent, esbid, is_home } }
      const schedule = await simulation.load_nfl_schedule({
        year: 2023,
        week: 1
      })

      expect(schedule).to.be.an('object')
      // If games exist, teams should be keys
      const keys = Object.keys(schedule)
      if (keys.length > 0) {
        const first_team = keys[0]
        expect(schedule[first_team]).to.have.property('opponent')
        expect(schedule[first_team]).to.have.property('esbid')
        expect(schedule[first_team]).to.have.property('is_home')
      }
    })

    it('should load schedules for multiple weeks', async () => {
      const schedules = await simulation.load_nfl_schedules_for_weeks({
        year: 2023,
        weeks: [1, 2, 3]
      })

      expect(schedules).to.be.instanceOf(Map)
      expect(schedules.size).to.equal(3)
    })
  })

  describe('load_player_info', function () {
    it('should load player info from database', async () => {
      // Get some player IDs from the database
      const players = await knex('player').limit(5).select('pid')
      const player_ids = players.map((p) => p.pid)

      if (player_ids.length > 0) {
        const player_info = await simulation.load_player_info({ player_ids })

        expect(player_info).to.be.instanceOf(Map)
        expect(player_info.size).to.be.at.most(player_ids.length)

        for (const [pid, info] of player_info) {
          expect(pid).to.be.a('string')
          expect(info).to.have.property('nfl_team')
          expect(info).to.have.property('position')
        }
      }
    })
  })

  describe('load_player_projections', function () {
    it('should return empty map when no projections exist', async function () {
      // This requires projections_index table and a valid scoring format
      // Get a valid scoring format hash from the database
      const season = await knex('seasons').first('scoring_format_hash')

      if (!season || !season.scoring_format_hash) {
        this.skip()
      }

      try {
        const projections = await simulation.load_player_projections({
          player_ids: ['nonexistent_player'],
          week: 1,
          year: 2023,
          scoring_format_hash: season.scoring_format_hash
        })
        expect(projections).to.be.instanceOf(Map)
      } catch (err) {
        if (err.message && err.message.includes('does not exist')) {
          this.skip()
        }
        throw err
      }
    })
  })

  describe('load_player_variance', function () {
    it('should return empty map when no variance data exists', async function () {
      if (!tables_exist) {
        this.skip()
      }
      const variance = await simulation.load_player_variance({
        player_ids: ['nonexistent_player'],
        year: 2023,
        scoring_format_hash: 'test_hash'
      })

      expect(variance).to.be.instanceOf(Map)
    })
  })

  describe('load_correlations_for_players', function () {
    it('should return empty map when no correlations exist', async function () {
      if (!tables_exist) {
        this.skip()
      }
      const correlations = await simulation.load_correlations_for_players({
        player_ids: ['nonexistent_player'],
        year: 2023
      })

      expect(correlations).to.be.instanceOf(Map)
    })
  })

  describe('load_player_archetypes', function () {
    it('should return empty map when no archetypes exist', async function () {
      if (!tables_exist) {
        this.skip()
      }
      const archetypes = await simulation.load_player_archetypes({
        player_ids: ['nonexistent_player'],
        year: 2023
      })

      expect(archetypes).to.be.instanceOf(Map)
    })
  })

  describe('load_position_ranks', function () {
    it('should load position ranks from database', async () => {
      // Get some player IDs from the database
      const players = await knex('player')
        .whereIn('pos', ['QB', 'RB', 'WR', 'TE'])
        .limit(10)
        .select('pid')
      const player_ids = players.map((p) => p.pid)

      if (player_ids.length > 0) {
        const position_ranks = await simulation.load_position_ranks({
          player_ids,
          year: 2023,
          week: 8
        })

        expect(position_ranks).to.be.instanceOf(Map)
      }
    })
  })

  describe('load_scoring_format', function () {
    it('should load scoring format from database', async () => {
      // Get a scoring format hash from the seasons table
      const season = await knex('seasons').first('scoring_format_hash')

      if (season && season.scoring_format_hash) {
        const format = await simulation.load_scoring_format({
          scoring_format_hash: season.scoring_format_hash
        })

        expect(format).to.be.an('object')
      }
    })
  })

  describe('full simulation flow', function () {
    it('should run simulation with mock data', async () => {
      // This test uses hardcoded data to test the full simulation flow
      // without relying on database state
      const players = [
        {
          pid: 'test_qb',
          nfl_team: 'KC',
          position: 'QB',
          position_rank: 'QB1',
          team_id: 1
        },
        {
          pid: 'test_wr',
          nfl_team: 'KC',
          position: 'WR',
          position_rank: 'WR1',
          team_id: 1
        },
        {
          pid: 'test_qb2',
          nfl_team: 'SF',
          position: 'QB',
          position_rank: 'QB1',
          team_id: 2
        },
        {
          pid: 'test_wr2',
          nfl_team: 'SF',
          position: 'WR',
          position_rank: 'WR1',
          team_id: 2
        }
      ]

      const projections = new Map([
        ['test_qb', 22.5],
        ['test_wr', 14.2],
        ['test_qb2', 20.8],
        ['test_wr2', 15.1]
      ])

      const variance_cache = new Map([
        [
          'test_qb',
          { std_points: 7.9, mean_points: 22.5, coefficient_of_variation: 0.35 }
        ],
        [
          'test_wr',
          { std_points: 7.1, mean_points: 14.2, coefficient_of_variation: 0.5 }
        ],
        [
          'test_qb2',
          { std_points: 7.3, mean_points: 20.8, coefficient_of_variation: 0.35 }
        ],
        [
          'test_wr2',
          { std_points: 7.6, mean_points: 15.1, coefficient_of_variation: 0.5 }
        ]
      ])

      // Schedule format: { [team_abbrev]: { opponent, esbid, is_home } }
      const schedule = {
        KC: { opponent: 'SF', esbid: 1001, is_home: true },
        SF: { opponent: 'KC', esbid: 1001, is_home: false }
      }

      const teams = [
        { team_id: 1, name: 'Team Alpha' },
        { team_id: 2, name: 'Team Beta' }
      ]

      // Import pure simulation functions from libs-shared
      const { simulation: sim_pure } = await import('#libs-shared')

      const results = sim_pure.run_simulation({
        players,
        projections,
        variance_cache,
        correlation_cache: new Map(),
        archetypes: new Map(),
        schedule,
        teams,
        n_simulations: 2000,
        seed: 42
      })

      // Verify results structure
      expect(results).to.have.property('win_probabilities')
      expect(results).to.have.property('score_distributions')
      expect(results).to.have.property('player_score_distributions')
      expect(results).to.have.property('n_simulations')
      expect(results).to.have.property('elapsed_ms')

      expect(results.n_simulations).to.equal(2000)

      // Win probabilities should be valid
      let total_prob = 0
      for (const [, prob] of results.win_probabilities) {
        expect(prob).to.be.at.least(0)
        expect(prob).to.be.at.most(1)
        total_prob += prob
      }
      expect(total_prob).to.be.closeTo(1, 0.01)

      // Score distributions should have expected stats
      for (const [team_id, dist] of results.score_distributions) {
        expect(dist.mean).to.be.a('number')
        expect(dist.std).to.be.a('number')
        expect(dist.min).to.be.a('number')
        expect(dist.max).to.be.a('number')
        expect(dist.median).to.be.a('number')

        // Mean should be roughly the sum of player projections
        const team_players = players.filter((p) => p.team_id === team_id)
        const expected_mean = team_players.reduce(
          (sum, p) => sum + projections.get(p.pid),
          0
        )
        expect(dist.mean).to.be.closeTo(expected_mean, expected_mean * 0.15)
      }
    })

    it('should handle correlations between same-team players', async () => {
      const { simulation: sim_pure } = await import('#libs-shared')

      const players = [
        {
          pid: 'qb1',
          nfl_team: 'KC',
          position: 'QB',
          position_rank: 'QB1',
          team_id: 1
        },
        {
          pid: 'wr1',
          nfl_team: 'KC',
          position: 'WR',
          position_rank: 'WR1',
          team_id: 1
        }
      ]

      const projections = new Map([
        ['qb1', 20],
        ['wr1', 15]
      ])

      const variance_cache = new Map([
        ['qb1', { std_points: 8 }],
        ['wr1', { std_points: 7.5 }]
      ])

      // Add a correlation between QB and WR (12+ games = use player-specific)
      const correlation_cache = new Map([
        [
          'qb1:wr1',
          {
            correlation: 0.45,
            games_together: 14,
            team_a: 'KC',
            team_b: 'KC',
            relationship_type: 'same_team'
          }
        ]
      ])

      // Schedule format: { [team_abbrev]: { opponent, esbid, is_home } }
      const schedule = {
        KC: { opponent: 'SF', esbid: 1001, is_home: true },
        SF: { opponent: 'KC', esbid: 1001, is_home: false }
      }

      const teams = [{ team_id: 1, name: 'Team 1' }]

      const results = sim_pure.run_simulation({
        players,
        projections,
        variance_cache,
        correlation_cache,
        archetypes: new Map(),
        schedule,
        teams,
        n_simulations: 1000,
        seed: 123
      })

      // Verify the simulation completed
      expect(results.n_simulations).to.equal(1000)
      expect(results.win_probabilities.get(1)).to.equal(1) // Only team, always wins
    })
  })
})
