/* global describe it */

import fs from 'fs'

import * as chai from 'chai'

import nfl_plays_column_params from '#libs-shared/nfl-plays-column-params.mjs'
import data_view_fields_index from '#libs-shared/data-view-fields-index.mjs'
import {
  RENAME_REGISTRY,
  COLUMN_ID_RENAMES,
  apply_column_id_rename,
  migrate_column_entry,
  migrate_table_state
} from '#libs-shared/data-views-saved-view-migration.mjs'

const { expect } = chai

// The live `nfl_plays` param-key registry (plus nfl_games), used as the liveness
// oracle below. The ADP table's `number_quarterback` is the one legacy key whose
// target is not on nfl_plays -- it lives on the ADP table, whose registry is in
// an `app/` module that imports extensionless paths and so cannot be imported
// here. Read from source.
const adp_source = fs.readFileSync(
  new URL(
    '../app/core/data-views-fields/player-adp-table-fields.js',
    import.meta.url
  ),
  'utf8'
)
const is_adp_param = (name) =>
  new RegExp(`^\\s{4}${name}: \\{$`, 'm').test(adp_source)

const is_live_param = (name) =>
  Object.prototype.hasOwnProperty.call(nfl_plays_column_params, name) ||
  is_adp_param(name)

// Every record in the `param_key` half of the registry, in declared order.
// This is the same data the client migration and the server boundary both run;
// the specs below iterate it directly so a rename can no longer be declared in
// one place and forgotten in a second.
const param_key_batches = RENAME_REGISTRY.filter(
  (batch) => batch.level === 'param_key'
)
const param_key_froms = param_key_batches.flatMap((batch) =>
  Object.keys(batch.records)
)

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

  describe('param-key renames (registry)', () => {
    // The registry key IS the persisted key, and
    // apply_play_by_play_column_params_to_query skips an unrecognised one
    // silently -- so a missing rule is a dropped filter with no error and no
    // other failing test. This iterates the RECORDS, so a rename that lands in
    // the registry is carried here automatically; the count assertions below
    // are what catch a rule DELETED from the registry (a loop over records
    // cannot see an entry that is no longer iterated).
    it('migrates every param_key legacy key to a single live registry key', () => {
      for (const batch of param_key_batches) {
        if (batch.id === 'LEGACY_OUTPUT') continue
        for (const legacy_key of Object.keys(batch.records)) {
          const result = migrate_column_entry({
            column_id: 'player_pass_attempts_from_plays',
            params: { [legacy_key]: [1] }
          })
          expect(result.changed, legacy_key).to.equal(true)
          const resolved = Object.keys(result.params)
          expect(resolved.length, legacy_key).to.equal(1)
          const [current_key] = resolved
          expect(
            is_live_param(current_key),
            `${legacy_key} -> ${current_key} is not a registry key`
          ).to.equal(true)
        }
      }
    })

    // The registry is declared in a load-bearing order; collapsing a rename's
    // intermediate hop changes the both-keys-present edge case (see the
    // route_ngs + route test below), so these chains are asserted exactly.
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

    // qb_pressure and qb_pressure_tracking both exist in the registry today
    // and are different params. The legacy qb_pressure_ngs is the tracking one.
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

    it('chains cov_type_ngs through to coverage_type_ngs', () => {
      const result = migrate_column_entry({
        column_id: 'player_targets_from_plays',
        params: { cov_type_ngs: ['COVER_1'] }
      })
      expect(result.params).to.deep.equal({ coverage_type_ngs: ['COVER_1'] })
    })

    it('chains ret_yds through to return_yards', () => {
      const result = migrate_column_entry({
        column_id: 'player_pass_attempts_from_plays',
        params: { ret_yds: [1] }
      })
      expect(result.params).to.deep.equal({ return_yards: [1] })
    })

    it('chains recv_yds through to receiving_yards', () => {
      const result = migrate_column_entry({
        column_id: 'player_pass_attempts_from_plays',
        params: { recv_yds: [60, 99] }
      })
      expect(result.params).to.deep.equal({ receiving_yards: [60, 99] })
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

    // box_defenders is ambiguous across the 2025-07-24 rename (box_ngs became
    // box_defenders while the old box_defenders became box_defenders_charted),
    // so it must pass through untouched rather than be guessed at. The registry
    // deliberately declares no box_defenders FROM rule.
    it('leaves a bare box_defenders key alone', () => {
      const result = migrate_column_entry({
        column_id: 'team_pass_attempts_from_plays',
        params: { box_defenders: [6, 8] }
      })
      expect(result.changed).to.equal(false)
      expect(result.params).to.deep.equal({ box_defenders: [6, 8] })
    })

    it('leaves no renamed param key still present in the registry', () => {
      const stranded = param_key_froms.filter((key) => is_live_param(key))
      expect(stranded).to.deep.equal([])
    })

    it('carries a rule for each of the 190 param keys that moved', () => {
      expect(param_key_froms.length).to.equal(190)
    })
  })

  describe('both-keys-present rule', () => {
    // A view carrying BOTH spellings keeps the "current" one: the legacy key is
    // the stale copy by construction. When an intermediate hop is present, the
    // surviving value still chains to the live terminal.
    it('keeps the current key when route_ngs and route are both present', () => {
      const result = migrate_column_entry({
        column_id: 'team_pass_attempts_from_plays',
        params: { route_ngs: ['GO'], route: ['SLANT'] }
      })
      expect(result.changed).to.equal(true)
      // route_ngs is dropped because route is already present; the surviving
      // route is then carried to charted_route by the shorthand batch.
      expect(result.params).to.deep.equal({ charted_route: ['SLANT'] })
    })

    it('keeps the current key when motion and is_motion are both present', () => {
      const result = migrate_column_entry({
        column_id: 'player_pass_attempts_from_plays',
        params: { motion: true, is_motion: false }
      })
      expect(result.params).to.deep.equal({ is_motion: false })
    })

    it('keeps the current key when qtr and quarter are both present', () => {
      const result = migrate_column_entry({
        column_id: 'player_pass_attempts_from_plays',
        params: { qtr: [1], quarter: [4] }
      })
      expect(result.params).to.deep.equal({ quarter: [4] })
    })

    it('keeps the current key when sec_rem_qtr and seconds_remaining_quarter are both present', () => {
      const result = migrate_column_entry({
        column_id: 'player_pass_attempts_from_plays',
        params: { sec_rem_qtr: [30], seconds_remaining_quarter: [60] }
      })
      expect(result.params).to.deep.equal({ seconds_remaining_quarter: [60] })
    })
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

    // Dropping an unknown hash would turn a filter the coverage oracle can
    // still find into one it cannot.
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

    it('declares both keys once, in the LEGACY_OUTPUT batch', () => {
      // The registry is the only declaration of this rename; the second copy
      // in data-views-output-tokens is gone. Pinned by VALUE rather than
      // against that copy, because an assertion comparing two declarations
      // proves only that they agree -- it goes vacuous the moment one is
      // derived from the other, which is exactly what happened here.
      const declared = RENAME_REGISTRY.find(
        (batch) => batch.id === 'LEGACY_OUTPUT'
      ).records
      expect(declared).to.deep.equal({
        rate_type_column_params: 'output_column_params',
        rate_type_match_column_params: 'output_match_column_params'
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

// Every legacy key must RESOLVE to a name a live registry carries today.
//
// Resolution rather than the raw target is the assertion, because CHAINS are
// legitimate here (route_ngs -> route -> charted_route; fg_prob ->
// field_goal_prob -> field_goal_probability): asserting on the raw `to` would
// forbid those. This is the spec mirror of the rename-target-liveness gate in
// db/, which enforces the same thing over the same RENAME_REGISTRY data as a
// durable cluster gate.
describe('rename-map target liveness', () => {
  it('resolves every param_key legacy key to a live registry key', () => {
    const stranded = []
    for (const batch of param_key_batches) {
      if (batch.id === 'LEGACY_OUTPUT') continue
      for (const legacy_key of Object.keys(batch.records)) {
        const result = migrate_column_entry({
          column_id: 'player_pass_attempts_from_plays',
          params: { [legacy_key]: [1] }
        })
        const resolved = Object.keys(result.params)
        if (resolved.length !== 1) {
          stranded.push(
            `${batch.id}.${legacy_key} resolved to ${resolved.length} keys`
          )
          continue
        }
        const [current_key] = resolved
        if (!is_live_param(current_key)) {
          stranded.push(`${batch.id}.${legacy_key} -> ${current_key}`)
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

  // The assertions above iterate the registry under test, so they cannot see a
  // record DELETED from it. These counts are what catch that; raise a number
  // deliberately when a rename legitimately adds or removes entries.
  it('carries a rule for each of the 190 param keys that moved', () => {
    expect(param_key_froms.length).to.equal(190)
  })

  it('carries a rule for each of the 45 column ids that moved', () => {
    expect(Object.keys(COLUMN_ID_RENAMES)).to.have.lengthOf(45)
  })

  // LEGACY_OUTPUT keys rewrite to names this module's generic loop treats as a
  // separate vocabulary (output_column_params etc. are not nfl_plays registry
  // keys), so they are asserted here rather than in the generic param loop.
  it('resolves every LEGACY_OUTPUT key to its canonical output key', () => {
    const legacy_output_records = RENAME_REGISTRY.find(
      (batch) => batch.id === 'LEGACY_OUTPUT'
    ).records
    for (const [legacy_key, current_key] of Object.entries(
      legacy_output_records
    )) {
      const result = migrate_column_entry({
        column_id: 'player_pass_attempts_from_plays',
        params: { [legacy_key]: { year: [2023] } }
      })
      expect(result.changed, legacy_key).to.equal(true)
      expect(result.params, legacy_key).to.deep.equal({
        [current_key]: { year: [2023] }
      })
    }
  })

  describe('adj retirement column-id renames (2026-08-18)', () => {
    // Both halves of the retirement change their persisted id, so a saved view
    // carrying either old spelling needs a rule.
    const cases = [
      [
        'player_season_projected_inflation_adjusted_market_salary',
        'player_season_projected_positive_salary_at_available_cap'
      ],
      [
        'player_week_projected_salary_adjusted_points_added',
        'player_week_projected_points_added_positive_including_cap_savings'
      ],
      [
        'player_season_projected_salary_adjusted_points_added',
        'player_season_projected_points_added_positive_including_cap_savings'
      ],
      [
        'player_rest_of_season_projected_salary_adjusted_points_added',
        'player_rest_of_season_projected_points_added_positive_including_cap_savings'
      ]
    ]

    for (const [legacy_column_id, current_column_id] of cases) {
      it(`migrates ${legacy_column_id}`, () => {
        const result = migrate_column_entry({ column_id: legacy_column_id })
        expect(result.changed).to.equal(true)
        expect(result.column_id).to.equal(current_column_id)
      })

      it(`rewrites ${legacy_column_id} on a short-URL column id`, () => {
        expect(apply_column_id_rename(legacy_column_id)).to.equal(
          current_column_id
        )
      })
    }

    it("leaves a column entry's params untouched while renaming its id", () => {
      // The id moves; nothing about these columns changes a param, so a rule
      // that also rewrote params would be silently destroying a saved filter.
      const result = migrate_column_entry({
        column_id: 'player_season_projected_salary_adjusted_points_added',
        params: { year: [2025], league_format_id: ['genesis'] }
      })
      expect(result.changed).to.equal(true)
      expect(result.params).to.deep.equal({
        year: [2025],
        league_format_id: ['genesis']
      })
    })

    it('leaves an unrelated column id alone', () => {
      // The negative control. Without it a green above cannot be told apart
      // from a migrator that rewrites every id it is handed.
      const result = migrate_column_entry({
        column_id: 'player_season_projected_points_added'
      })
      expect(result.column_id).to.equal('player_season_projected_points_added')
      expect(
        apply_column_id_rename('player_season_projected_points_added')
      ).to.equal('player_season_projected_points_added')
    })

    it('does not rewrite an already-migrated id a second time', () => {
      // migrate_column_entry is a SINGLE lookup with no chaining, so a NEW id
      // appearing as a KEY here would resolve a live column to a dead one and
      // render a blank cell. Assert the new ids are absent from the key set.
      for (const [, current_column_id] of cases) {
        expect(
          Object.prototype.hasOwnProperty.call(
            COLUMN_ID_RENAMES,
            current_column_id
          ),
          `${current_column_id} is live and must not be a rename KEY`
        ).to.equal(false)
      }
    })
  })
})
