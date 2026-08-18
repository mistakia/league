/* global describe it */

import fs from 'fs'

import * as chai from 'chai'

import nfl_plays_column_params from '#libs-shared/nfl-plays-column-params.mjs'
import data_view_fields_index from '#libs-shared/data-view-fields-index.mjs'
import * as migration_module from '#libs-shared/data-views-saved-view-migration.mjs'
import {
  BOOLEAN_PREFIX_PARAM_RENAMES,
  COLUMN_ID_RENAMES,
  COUNTING_STAT_PARAM_RENAMES,
  MARKETS_PARAM_RENAMES,
  PLAYS_LOCAL_PARAM_RENAMES,
  RECEIVING_PREFIX_PARAM_RENAMES,
  SHORTHAND_PARAM_RENAMES,
  apply_column_id_rename,
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

  describe('ngs play-filter param renames (8a4b6e4a)', () => {
    it('renames every legacy _ngs key, preserving the value', () => {
      const result = migrate_column_entry({
        column_id: 'team_pass_attempts_from_plays',
        params: {
          route_ngs: ['GO'],
          cov_type_ngs: ['COVER_1'],
          man_zone_ngs: ['MAN_COVERAGE'],
          time_to_throw_ngs: [0, 3],
          air_yards_ngs: [5, 20],
          pru_ngs: [1, 4],
          box_ngs: [6, 8]
        }
      })
      expect(result.changed).to.equal(true)
      // route and pru are NOT terminal: the 2026-08-05 shorthand sweep moved
      // both again, so each resolves through two rules in this single pass.
      expect(result.params).to.deep.equal({
        charted_route: ['GO'],
        coverage_type_ngs: ['COVER_1'],
        man_zone: ['MAN_COVERAGE'],
        time_to_throw: [0, 3],
        air_yards: [5, 20],
        ngs_pass_rushers: [1, 4],
        box_defenders: [6, 8]
      })
    })

    // qb_pressure and qb_pressure_tracking both exist in the registry today and
    // are different params. The legacy qb_pressure_ngs is the tracking one.
    // Both were then boolean-prefixed, so this is the one key that migrates
    // through two rules in a single pass.
    it('chains qb_pressure_ngs through to is_qb_pressure_tracking', () => {
      const result = migrate_column_entry({
        column_id: 'player_pass_attempts_from_plays',
        params: { qb_pressure_ngs: true }
      })
      expect(result.changed).to.equal(true)
      expect(result.params).to.deep.equal({ is_qb_pressure_tracking: true })
    })

    it('preserves a false value rather than dropping the filter', () => {
      const result = migrate_column_entry({
        column_id: 'player_pass_attempts_from_plays',
        params: { qb_pressure_ngs: false }
      })
      expect(result.params).to.deep.equal({ is_qb_pressure_tracking: false })
    })

    it('keeps the current key when both are present', () => {
      const result = migrate_column_entry({
        column_id: 'team_pass_attempts_from_plays',
        params: { route_ngs: ['GO'], route: ['SLANT'] }
      })
      expect(result.changed).to.equal(true)
      // route_ngs is dropped because route is already present; the surviving
      // route is then carried to charted_route by the shorthand map.
      expect(result.params).to.deep.equal({ charted_route: ['SLANT'] })
    })

    // box_defenders is ambiguous across that commit (box_ngs became
    // box_defenders while the old box_defenders became box_defenders_charted),
    // so it must pass through untouched rather than be guessed at.
    it('leaves a bare box_defenders key alone', () => {
      const result = migrate_column_entry({
        column_id: 'team_pass_attempts_from_plays',
        params: { box_defenders: [6, 8] }
      })
      expect(result.changed).to.equal(false)
      expect(result.params).to.deep.equal({ box_defenders: [6, 8] })
    })
  })

  describe('boolean-prefix param renames (2026-08-04 conformance sweep)', () => {
    // The registry key IS the persisted key, and
    // apply_play_by_play_column_params_to_query skips an unrecognised one
    // silently -- so a missing rule is a dropped filter with no error and no
    // other failing test. The second assertion below is the real gate: it fails
    // when a registry key that MOVED still has no rule. The first cannot catch a
    // rule deleted from the map -- it iterates the map under test, so an absent
    // entry is simply not iterated. Proven by mutation: deleting a rule leaves
    // this file fully green.
    it('migrates every legacy key to a key the registry still carries', () => {
      for (const [legacy_key, current_key] of Object.entries(
        BOOLEAN_PREFIX_PARAM_RENAMES
      )) {
        const result = migrate_column_entry({
          column_id: 'player_pass_attempts_from_plays',
          params: { [legacy_key]: true }
        })
        expect(result.changed, legacy_key).to.equal(true)
        expect(result.params, legacy_key).to.deep.equal({
          [current_key]: true
        })
        expect(
          Object.prototype.hasOwnProperty.call(
            nfl_plays_column_params,
            current_key
          ),
          `${current_key} is not a registry key`
        ).to.equal(true)
      }
    })

    it('leaves no renamed key still present in the registry', () => {
      const stranded = Object.keys(BOOLEAN_PREFIX_PARAM_RENAMES).filter((key) =>
        Object.prototype.hasOwnProperty.call(nfl_plays_column_params, key)
      )
      expect(stranded).to.deep.equal([])
    })

    // Both assertions above iterate the map under test, so neither can see a
    // rule DELETED from it. This count is what catches that: 81 registry keys
    // moved in the 2026-08-04 boolean-prefix rename and each needs exactly one
    // rule. If a future rename adds rules here, raise this number deliberately
    // rather than deleting the assertion.
    it('carries a rule for each of the 81 registry keys that moved', () => {
      expect(Object.keys(BOOLEAN_PREFIX_PARAM_RENAMES)).to.have.lengthOf(81)
    })

    // nfl_games.ot is the one renamed column outside nfl_plays; it is a
    // GAME-group param resolved against the joined nfl_games table.
    it('migrates the nfl_games overtime param', () => {
      const result = migrate_column_entry({
        column_id: 'player_pass_attempts_from_plays',
        params: { ot: true }
      })
      expect(result.params).to.deep.equal({ is_overtime: true })
    })

    it('preserves a non-boolean value vocabulary unchanged', () => {
      const result = migrate_column_entry({
        column_id: 'player_pass_attempts_from_plays',
        params: { motion: [true, false] }
      })
      expect(result.params).to.deep.equal({ is_motion: [true, false] })
    })

    it('keeps the current key when a view carries both', () => {
      const result = migrate_column_entry({
        column_id: 'player_pass_attempts_from_plays',
        params: { motion: true, is_motion: false }
      })
      expect(result.params).to.deep.equal({ is_motion: false })
    })
  })

  describe('shorthand param renames (2026-08-05 conformance sweep)', () => {
    // Same failure mode as the boolean-prefix block above, and the same gate
    // structure: assertion one proves each rule lands on a key the registry
    // still carries, assertion two proves no legacy key survived the rename,
    // and the count is what catches a rule DELETED from the map (the first two
    // iterate the map under test, so an absent entry is simply not iterated).
    it('migrates every legacy key to a key the registry still carries', () => {
      for (const [legacy_key, current_key] of Object.entries(
        SHORTHAND_PARAM_RENAMES
      )) {
        const result = migrate_column_entry({
          column_id: 'player_pass_attempts_from_plays',
          params: { [legacy_key]: [1] }
        })
        expect(result.changed, legacy_key).to.equal(true)
        expect(result.params, legacy_key).to.deep.equal({ [current_key]: [1] })
        expect(
          Object.prototype.hasOwnProperty.call(
            nfl_plays_column_params,
            current_key
          ),
          `${current_key} is not a registry key`
        ).to.equal(true)
      }
    })

    it('leaves no renamed key still present in the registry', () => {
      const stranded = Object.keys(SHORTHAND_PARAM_RENAMES).filter((key) =>
        Object.prototype.hasOwnProperty.call(nfl_plays_column_params, key)
      )
      expect(stranded).to.deep.equal([])
    })

    // 18 of the 204 renamed columns were also registry keys. If a future rename
    // adds rules here, raise this number deliberately rather than deleting the
    // assertion.
    it('carries a rule for each of the 18 registry keys that moved', () => {
      expect(Object.keys(SHORTHAND_PARAM_RENAMES)).to.have.lengthOf(18)
    })

    // The two keys whose rewrite is a CHAIN: an _ngs key renamed in 8a4b6e4a
    // lands on a shorthand key that the 2026-08-05 sweep then moved again. The
    // single migrate_params pass resolves this only because the shorthand map is
    // merged after PLAY_FILTER_PARAM_RENAMES.
    it('chains route_ngs through to charted_route', () => {
      const result = migrate_column_entry({
        column_id: 'player_targets_from_plays',
        params: { route_ngs: ['GO'] }
      })
      expect(result.params).to.deep.equal({ charted_route: ['GO'] })
    })

    it('chains pru_ngs through to ngs_pass_rushers', () => {
      const result = migrate_column_entry({
        column_id: 'player_pass_attempts_from_plays',
        params: { pru_ngs: [4] }
      })
      expect(result.params).to.deep.equal({ ngs_pass_rushers: [4] })
    })

    // `dot` is the depth-of-target param whose COLUMN moved to depth_of_target
    // while its key stayed. It must NOT be rewritten -- a rule for it would
    // create the orphan rather than fix one.
    it('leaves the dot param alone', () => {
      const result = migrate_column_entry({
        column_id: 'player_targets_from_plays',
        params: { dot: [10] }
      })
      expect(result.params).to.deep.equal({ dot: [10] })
      expect(
        Object.prototype.hasOwnProperty.call(nfl_plays_column_params, 'dot')
      ).to.equal(true)
    })

    it('keeps the current key when a view carries both', () => {
      const result = migrate_column_entry({
        column_id: 'player_pass_attempts_from_plays',
        params: { qtr: [1], quarter: [4] }
      })
      expect(result.params).to.deep.equal({ quarter: [4] })
    })
  })

  describe('plays-local param renames (2026-08-16 conform sweep)', () => {
    // Same failure mode and gate structure as the shorthand block: assertion
    // one proves each rule lands on a key the registry still carries, assertion
    // two proves no legacy key survived, and the count catches a rule DELETED
    // from the map. 28 of the 91 renamed plays-local columns were also registry
    // keys, and the registry key IS the persisted key.
    // ret_yds is the one rule here whose target was itself renamed again, by
    // the 2026-08-17 counting-stat conform (ret_yds -> return_yds ->
    // return_yards), so the loop resolves that hop rather than asserting on this
    // map's declared target. Same shape as the route_ngs and pru_ngs chains
    // above, and it means a rule that stops chaining correctly still fails here.
    it('migrates every legacy key to a key the registry still carries', () => {
      for (const [legacy_key, current_key] of Object.entries(
        PLAYS_LOCAL_PARAM_RENAMES
      )) {
        const counting_key =
          COUNTING_STAT_PARAM_RENAMES[current_key] ?? current_key
        const final_key = MARKETS_PARAM_RENAMES[counting_key] ?? counting_key
        const result = migrate_column_entry({
          column_id: 'player_pass_attempts_from_plays',
          params: { [legacy_key]: [1] }
        })
        expect(result.changed, legacy_key).to.equal(true)
        expect(result.params, legacy_key).to.deep.equal({ [final_key]: [1] })
        expect(
          Object.prototype.hasOwnProperty.call(
            nfl_plays_column_params,
            final_key
          ),
          `${final_key} is not a registry key`
        ).to.equal(true)
      }
    })

    it('chains ret_yds through to return_yards', () => {
      const result = migrate_column_entry({
        column_id: 'player_pass_attempts_from_plays',
        params: { ret_yds: [1] }
      })
      expect(result.params).to.deep.equal({ return_yards: [1] })
    })
  })

  describe('counting-stat param renames (2026-08-17 conform sweep)', () => {
    // Same failure mode and gate structure as the blocks above: assertion one
    // proves each rule lands on a key the registry still carries, assertion two
    // proves no legacy key survived, and the count catches a rule DELETED from
    // the map. 29 of the 148 renamed columns were live registry keys.
    it('migrates every legacy key to a key the registry still carries', () => {
      for (const [legacy_key, current_key] of Object.entries(
        COUNTING_STAT_PARAM_RENAMES
      )) {
        const final_key = MARKETS_PARAM_RENAMES[current_key] ?? current_key
        const result = migrate_column_entry({
          column_id: 'player_pass_attempts_from_plays',
          params: { [legacy_key]: [1] }
        })
        expect(result.changed, legacy_key).to.equal(true)
        expect(result.params, legacy_key).to.deep.equal({ [final_key]: [1] })
        expect(
          Object.prototype.hasOwnProperty.call(
            nfl_plays_column_params,
            final_key
          ),
          `${final_key} is not a registry key`
        ).to.equal(true)
      }
    })

    it('leaves no renamed key still present in the registry', () => {
      const stranded = Object.keys(COUNTING_STAT_PARAM_RENAMES).filter((key) =>
        Object.prototype.hasOwnProperty.call(nfl_plays_column_params, key)
      )
      expect(stranded).to.deep.equal([])
    })

    it('carries a rule for each of the 29 registry keys that moved', () => {
      expect(Object.keys(COUNTING_STAT_PARAM_RENAMES)).to.have.lengthOf(29)
    })

    it('chains recv_yds through to receiving_yards', () => {
      const result = migrate_column_entry({
        column_id: 'player_pass_attempts_from_plays',
        params: { recv_yds: [60, 99] }
      })
      expect(result.params).to.deep.equal({ receiving_yards: [60, 99] })
    })

    // cov_type takes its SOURCE QUALIFIER back rather than the plain expansion,
    // because nfl_plays already carries a coverage_type enum from the
    // PlayerProfiler charting mapping. Its sibling cov_type_charted is not a
    // registry key, so only this one appears in the map.
    it('chains cov_type_ngs through to coverage_type_ngs', () => {
      const result = migrate_column_entry({
        column_id: 'player_targets_from_plays',
        params: { cov_type_ngs: ['COVER_1'] }
      })
      expect(result.params).to.deep.equal({ coverage_type_ngs: ['COVER_1'] })
    })

    it('leaves no renamed key still present in the registry', () => {
      const stranded = Object.keys(PLAYS_LOCAL_PARAM_RENAMES).filter((key) =>
        Object.prototype.hasOwnProperty.call(nfl_plays_column_params, key)
      )
      expect(stranded).to.deep.equal([])
    })

    it('carries a rule for each of the 28 registry keys that moved', () => {
      expect(Object.keys(PLAYS_LOCAL_PARAM_RENAMES)).to.have.lengthOf(28)
    })
  })

  describe('receiving-prefix param renames (2026-08-18 conform sweep)', () => {
    // Same failure mode and gate structure as the blocks above. Exactly ONE of
    // the 41 renamed columns was also a registry key -- nfl_plays.recv_yards --
    // and the registry key IS the persisted key, so a saved view carrying it
    // would silently lose its filter rather than error.
    it('migrates every legacy key to a key the registry still carries', () => {
      for (const [legacy_key, current_key] of Object.entries(
        RECEIVING_PREFIX_PARAM_RENAMES
      )) {
        const result = migrate_column_entry({
          column_id: 'player_pass_attempts_from_plays',
          params: { [legacy_key]: [1] }
        })
        expect(result.changed, legacy_key).to.equal(true)
        expect(result.params, legacy_key).to.deep.equal({ [current_key]: [1] })
        expect(
          Object.prototype.hasOwnProperty.call(
            nfl_plays_column_params,
            current_key
          ),
          `${current_key} is not a registry key`
        ).to.equal(true)
      }
    })

    it('leaves no renamed key still present in the registry', () => {
      const stranded = Object.keys(RECEIVING_PREFIX_PARAM_RENAMES).filter(
        (key) =>
          Object.prototype.hasOwnProperty.call(nfl_plays_column_params, key)
      )
      expect(stranded).to.deep.equal([])
    })

    it('carries a rule for the 1 registry key that moved', () => {
      expect(Object.keys(RECEIVING_PREFIX_PARAM_RENAMES)).to.have.lengthOf(1)
    })
  })

  it('keeps the current key when a view carries both', () => {
    const result = migrate_column_entry({
      column_id: 'player_pass_attempts_from_plays',
      params: { sec_rem_qtr: [30], seconds_remaining_quarter: [60] }
    })
    expect(result.params).to.deep.equal({ seconds_remaining_quarter: [60] })
  })

  describe('scoring_format_hash -> scoring_format_id (44cf7fd9)', () => {
    it('maps a named-catalog hash to its slug', () => {
      const result = migrate_column_entry({
        column_id: 'player_fantasy_points_from_plays',
        params: {
          scoring_format_hash: [
            'ad64bf40cdfec0a1ebdf66453fa57687832f7556f3870251c044d5d270fc089e'
          ]
        }
      })
      expect(result.changed).to.equal(true)
      expect(result.params).to.deep.equal({
        scoring_format_id: ['draftkings']
      })
    })

    it('maps the user-created hash to its uuid', () => {
      const result = migrate_column_entry({
        column_id: 'player_fantasy_points_from_plays',
        params: {
          scoring_format_hash: [
            '0df3e49bb29d3dbbeb7e9479b9e77f2688c0521df4e147cd9035f042680ba13d'
          ]
        }
      })
      expect(result.params).to.deep.equal({
        scoring_format_id: ['b7855f1f-9f5e-47c4-ba3a-3e906272a60c']
      })
    })

    it('preserves a scalar value as a scalar', () => {
      const result = migrate_column_entry({
        column_id: 'player_games_played',
        params: {
          scoring_format_hash:
            'ad64bf40cdfec0a1ebdf66453fa57687832f7556f3870251c044d5d270fc089e'
        }
      })
      expect(result.params).to.deep.equal({ scoring_format_id: 'draftkings' })
    })

    // Dropping an unknown hash would turn a filter the coverage oracle can still
    // find into one it cannot.
    it('leaves an unrecognised hash in place rather than dropping the filter', () => {
      const params = { scoring_format_hash: ['deadbeef'] }
      const result = migrate_column_entry({
        column_id: 'player_fantasy_points_from_plays',
        params
      })
      expect(result.changed).to.equal(false)
      expect(result.params).to.deep.equal(params)
    })

    it('does not overwrite an existing scoring_format_id', () => {
      const result = migrate_column_entry({
        column_id: 'player_fantasy_points_from_plays',
        params: {
          scoring_format_hash: [
            'ad64bf40cdfec0a1ebdf66453fa57687832f7556f3870251c044d5d270fc089e'
          ],
          scoring_format_id: ['genesis']
        }
      })
      expect(result.params).to.deep.equal({ scoring_format_id: ['genesis'] })
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

  // The two ids were removed in edc8ec9a9 (2024-08-08) when player_games_played
  // unified the per-game denominator. They have no server column definition, so
  // a saved view still holding one threw "Field not found for column_id" on
  // every render (signal 124652) rather than merely losing a filter.
  describe('dead scoring-format-logs games-played column ids', () => {
    it('rewrites the seasonlogs id to player_games_played, keeping the year window', () => {
      const result = migrate_column_entry({
        column_id: 'player_fantasy_games_played_from_seasonlogs',
        params: { year: [2023, 2022] }
      })
      expect(result.changed).to.equal(true)
      expect(result.column_id).to.equal('player_games_played')
      expect(result.params).to.deep.equal({ year: [2023, 2022] })
    })

    it('rewrites the careerlogs id to player_games_played', () => {
      const result = migrate_column_entry({
        column_id: 'player_fantasy_games_played_from_careerlogs',
        params: {}
      })
      expect(result.changed).to.equal(true)
      expect(result.column_id).to.equal('player_games_played')
    })

    it('leaves the live rank ids alone', () => {
      const result = migrate_column_entry({
        column_id: 'player_fantasy_points_rank_from_seasonlogs',
        params: { year: [2023] }
      })
      expect(result.changed).to.equal(false)
      expect(result.column_id).to.equal(
        'player_fantasy_points_rank_from_seasonlogs'
      )
    })

    it('carries the rename into a sort entry naming the dead id', () => {
      const result = migrate_table_state({
        columns: [
          {
            column_id: 'player_fantasy_games_played_from_seasonlogs',
            params: { year: [2023] }
          }
        ],
        sort: [
          {
            column_id: 'player_fantasy_games_played_from_seasonlogs',
            desc: true
          }
        ],
        row_grain: ['player']
      })
      expect(result.changed).to.equal(true)
      expect(result.table_state.columns[0].column_id).to.equal(
        'player_games_played'
      )
      expect(result.table_state.sort[0].column_id).to.equal(
        'player_games_played'
      )
    })
  })

  describe('migrate_table_state', () => {
    it('wraps missing row_grain with the default player row_grain', () => {
      const result = migrate_table_state({
        columns: [{ column_id: 'player_name' }]
      })
      expect(result.changed).to.equal(true)
      expect(result.table_state.row_grain).to.deep.equal(['player'])
    })

    it('preserves an existing non-empty row_grain array', () => {
      const result = migrate_table_state({
        columns: [{ column_id: 'player_name' }],
        row_grain: ['team']
      })
      expect(result.changed).to.equal(false)
      expect(result.table_state.row_grain).to.deep.equal(['team'])
    })

    it('migrates a legacy subjects field into row_grain', () => {
      const result = migrate_table_state({
        columns: [{ column_id: 'player_name' }],
        subjects: ['team']
      })
      expect(result.changed).to.equal(true)
      expect(result.table_state).to.not.have.property('subjects')
      expect(result.table_state.row_grain).to.deep.equal(['team'])
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
        row_grain: ['player']
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
      expect(result.changed).to.equal(true) // row_grain default applied
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

// Every legacy param key must RESOLVE to a name a live registry carries today.
//
// This is the file-wide form of the rule stated beside PLAYS_LOCAL_PARAM_RENAMES:
// a map whose target is itself legacy is one reordering away from resolving to a
// key nothing recognises, and a saved view carrying it then loses its filter
// silently. The per-map specs above cover four of the eight maps by hand, which
// is why three stale targets shipped during the 2026-08-17 conform campaign --
// `pos_to_rem` and `ydl_num` (repointed with the long-tail batch) and `num_qb`,
// whose target sat stale with no spec covering POSITION_CODE_PARAM_RENAMES at all.
//
// Resolution rather than the raw target is the assertion, because CHAINS are
// legitimate here: eight entries deliberately target another map's legacy key and
// the merge order resolves them in one pass (fg_prob -> field_goal_prob ->
// field_goal_probability). Asserting on the raw target would forbid those.
describe('rename-map target liveness', () => {
  // `num_qb` is the one legacy key whose column is not on nfl_plays -- it is the
  // ADP table's, whose registry lives in an `app/` module that imports
  // extensionless paths and so cannot be imported here. Read from source.
  const adp_source = fs.readFileSync(
    new URL(
      '../app/core/data-views-fields/player-adp-table-fields.js',
      import.meta.url
    ),
    'utf8'
  )
  const is_adp_param = (name) =>
    new RegExp(`^\\s{4}${name}: \\{$`, 'm').test(adp_source)

  const rename_maps = Object.entries(migration_module).filter(
    ([name, value]) =>
      name.endsWith('_PARAM_RENAMES') && value && typeof value === 'object'
  )

  it('covers every exported rename map', () => {
    // A map added without being exported, or renamed out of the suffix
    // convention, would silently leave this whole check asserting nothing.
    expect(rename_maps.length).to.equal(9)
  })

  it('resolves every legacy key to a live registry key', () => {
    const stranded = []
    for (const [map_name, map] of rename_maps) {
      for (const legacy_key of Object.keys(map)) {
        const result = migrate_column_entry({
          column_id: 'player_pass_attempts_from_plays',
          params: { [legacy_key]: [1] }
        })
        const resolved = Object.keys(result.params)
        if (resolved.length !== 1) {
          stranded.push(
            `${map_name}.${legacy_key} resolved to ${resolved.length} keys`
          )
          continue
        }
        const [current_key] = resolved
        const is_live =
          Object.prototype.hasOwnProperty.call(
            nfl_plays_column_params,
            current_key
          ) || is_adp_param(current_key)
        if (!is_live) {
          stranded.push(`${map_name}.${legacy_key} -> ${current_key}`)
        }
      }
    }
    expect(
      stranded,
      'legacy keys resolving to a name no registry carries'
    ).to.deep.equal([])
  })

  it('resolves every legacy column id to a live fields-index key', () => {
    // COLUMN_ID_RENAMES is a SINGLE lookup with no chaining, so a value that
    // does not name a live id resolves to a dead one -- and the SPA renders a
    // blank cell rather than erroring, which no other gate can see. Resolve
    // through apply_column_id_rename rather than reading the raw values so a
    // legitimate future chain still passes.
    const stranded = []
    for (const legacy_column_id of Object.keys(COLUMN_ID_RENAMES)) {
      const current_column_id = apply_column_id_rename(legacy_column_id)
      const is_live = Object.prototype.hasOwnProperty.call(
        data_view_fields_index,
        current_column_id
      )
      if (!is_live) {
        stranded.push(`${legacy_column_id} -> ${current_column_id}`)
      }
    }
    expect(
      stranded,
      'legacy column ids resolving to a name the fields index does not carry'
    ).to.deep.equal([])
  })

  // The assertion above iterates the map under test, so it cannot see a rule
  // DELETED from it. This count is what catches that. If a future rename adds
  // rules here, raise this number deliberately rather than deleting the
  // assertion.
  it('carries a rule for each of the 41 column ids that moved', () => {
    expect(Object.keys(COLUMN_ID_RENAMES)).to.have.lengthOf(41)
  })
})
