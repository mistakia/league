/* global describe it */

import * as chai from 'chai'

import {
  migrate_column_entry,
  migrate_table_state
} from '#libs-shared/data-views-saved-view-migration.mjs'

const { expect } = chai

describe('data-views saved-view migrator', () => {
  describe('rate_type -> output', () => {
    it('translates known rate_type token and drops legacy key', () => {
      const result = migrate_column_entry({
        column_id: 'player_rush_yards_from_plays',
        params: { year: [2023], rate_type: ['per_game'] }
      })
      expect(result.changed).to.equal(true)
      expect(result.params).to.deep.equal({
        year: [2023],
        output: { period: 'game', aggregation: 'rate', threshold: null }
      })
    })

    it('preserves existing output and still strips legacy rate_type', () => {
      const result = migrate_column_entry({
        column_id: 'player_rush_yards_from_plays',
        params: {
          year: [2023],
          rate_type: ['per_game'],
          output: { period: 'team_play', aggregation: 'rate', threshold: null }
        }
      })
      expect(result.changed).to.equal(true)
      expect(result.params.output).to.deep.equal({
        period: 'team_play',
        aggregation: 'rate',
        threshold: null
      })
      expect(result.params).to.not.have.property('rate_type')
    })

    it('drops unknown rate_type without producing output', () => {
      const result = migrate_column_entry({
        column_id: 'player_rush_yards_from_plays',
        params: { rate_type: ['bogus'] }
      })
      expect(result.changed).to.equal(true)
      expect(result.params).to.deep.equal({})
    })

    it('is a no-op when no rate_type and no override keys', () => {
      const result = migrate_column_entry({
        column_id: 'player_rush_yards_from_plays',
        params: { year: [2023] }
      })
      expect(result.changed).to.equal(false)
      expect(result.params).to.deep.equal({ year: [2023] })
    })
  })

  describe('param_override_config key rename', () => {
    it('renames rate_type_match_column_params and rate_type_column_params', () => {
      const result = migrate_column_entry({
        column_id: 'player_rush_yards_from_plays',
        params: {
          rate_type_match_column_params: ['year', 'week'],
          rate_type_column_params: { year: [2023] }
        }
      })
      expect(result.changed).to.equal(true)
      expect(result.params).to.deep.equal({
        output_match_column_params: ['year', 'week'],
        output_column_params: { year: [2023] }
      })
    })
  })

  describe('team_<stat>_from_plays + limit_to_player_active_games', () => {
    it('rewrites to player_team_ variant and drops the trigger param', () => {
      const result = migrate_column_entry({
        column_id: 'team_pass_attempts_from_plays',
        params: { year: [2023], limit_to_player_active_games: true }
      })
      expect(result.changed).to.equal(true)
      expect(result.column_id).to.equal('player_team_pass_attempts_from_plays')
      expect(result.params).to.deep.equal({ year: [2023] })
    })

    it('leaves team_ ids alone when limit_to_player_active_games is absent', () => {
      const result = migrate_column_entry({
        column_id: 'team_pass_attempts_from_plays',
        params: { year: [2023] }
      })
      expect(result.changed).to.equal(false)
      expect(result.column_id).to.equal('team_pass_attempts_from_plays')
    })

    it('composes with rate_type translation', () => {
      const result = migrate_column_entry({
        column_id: 'team_pass_attempts_from_plays',
        params: {
          year: [2023],
          limit_to_player_active_games: true,
          rate_type: ['per_game']
        }
      })
      expect(result.changed).to.equal(true)
      expect(result.column_id).to.equal('player_team_pass_attempts_from_plays')
      expect(result.params).to.deep.equal({
        year: [2023],
        output: { period: 'game', aggregation: 'rate', threshold: null }
      })
    })
  })

  describe('migrate_table_state', () => {
    it('wraps missing subjects with the default player subject', () => {
      const result = migrate_table_state({
        columns: [{ column_id: 'player_name' }]
      })
      expect(result.changed).to.equal(true)
      expect(result.table_state.subjects).to.deep.equal(['player'])
    })

    it('preserves an existing non-empty subjects array', () => {
      const result = migrate_table_state({
        columns: [{ column_id: 'player_name' }],
        subjects: ['team']
      })
      expect(result.changed).to.equal(false)
      expect(result.table_state.subjects).to.deep.equal(['team'])
    })

    it('migrates columns, prefix_columns, and where in one pass', () => {
      const result = migrate_table_state({
        prefix_columns: ['player_name'],
        columns: [
          {
            column_id: 'player_rush_yards_from_plays',
            params: { year: [2023], rate_type: ['per_game'] }
          },
          {
            column_id: 'team_pass_attempts_from_plays',
            params: { year: [2023], limit_to_player_active_games: true }
          }
        ],
        where: [
          {
            column_id: 'player_rush_yards_from_plays',
            operator: '>=',
            value: 100,
            params: { rate_type: ['per_game'] }
          }
        ],
        subjects: ['player']
      })
      expect(result.changed).to.equal(true)
      expect(result.table_state.columns[0].params.output.period).to.equal(
        'game'
      )
      expect(result.table_state.columns[1].column_id).to.equal(
        'player_team_pass_attempts_from_plays'
      )
      expect(result.table_state.where[0].params).to.not.have.property(
        'rate_type'
      )
      expect(result.table_state.where[0].operator).to.equal('>=')
      expect(result.table_state.where[0].value).to.equal(100)
    })

    it('propagates column rename to sort entries that referenced the legacy id', () => {
      const result = migrate_table_state({
        columns: [
          {
            column_id: 'team_pass_attempts_from_plays',
            params: { year: [2023], limit_to_player_active_games: true }
          }
        ],
        sort: [{ column_id: 'team_pass_attempts_from_plays', desc: true }]
      })
      expect(result.changed).to.equal(true)
      expect(result.table_state.sort[0]).to.deep.equal({
        column_id: 'player_team_pass_attempts_from_plays',
        desc: true
      })
    })

    it('leaves sort entries alone when no column rename occurred', () => {
      const result = migrate_table_state({
        columns: [
          {
            column_id: 'team_pass_attempts_from_plays',
            params: { year: [2023] }
          }
        ],
        sort: [{ column_id: 'team_pass_attempts_from_plays', desc: true }]
      })
      expect(result.changed).to.equal(true) // subjects default applied
      expect(result.table_state.sort[0].column_id).to.equal(
        'team_pass_attempts_from_plays'
      )
    })

    it('is idempotent (running twice == running once)', () => {
      const input = {
        prefix_columns: ['player_name'],
        columns: [
          {
            column_id: 'player_rush_yards_from_plays',
            params: { year: [2023], rate_type: ['per_game'] }
          },
          {
            column_id: 'team_pass_attempts_from_plays',
            params: { year: [2023], limit_to_player_active_games: true }
          }
        ]
      }
      const once = migrate_table_state(input)
      const twice = migrate_table_state(once.table_state)
      expect(twice.changed).to.equal(false)
      expect(twice.table_state).to.deep.equal(once.table_state)
    })

    it('returns input unchanged when table_state is non-object', () => {
      expect(migrate_table_state(null)).to.deep.equal({
        changed: false,
        table_state: null
      })
    })
  })
})
