/* global describe it */
import * as chai from 'chai'

import {
  STORAGE_SCHEMA_VERSION,
  run_migrations
} from '#libs-shared/data-view-storage/migrations.mjs'
import { migrate_table_state } from '#libs-shared/data-views-nfl-week-migration.mjs'

const { expect } = chai

const legacy_snapshot = () => ({
  timestamp: Date.now(),
  change_type: 'user_edit',
  table_state: {
    columns: [
      {
        column_id: 'player_dfs_salary',
        params: { year: [2024], week: [5], seas_type: ['REG'] }
      }
    ],
    prefix_columns: ['player_name'],
    sort: [],
    where: []
  }
})

describe('data-view-storage migrations module', () => {
  it('v0 snapshot chains through all migrations and reaches STORAGE_SCHEMA_VERSION', () => {
    const { snapshot, migrated } = run_migrations(legacy_snapshot())
    expect(migrated).to.be.true
    expect(snapshot.version).to.equal(STORAGE_SCHEMA_VERSION)
    expect(
      snapshot.table_state.columns[0].params.single_nfl_week_id
    ).to.deep.equal(['2024_REG_WEEK_5'])
  })

  it('treats a snapshot with no version field as version 0', () => {
    const input = legacy_snapshot()
    expect(input.version).to.equal(undefined)
    const { snapshot } = run_migrations(input)
    expect(snapshot.version).to.equal(STORAGE_SCHEMA_VERSION)
  })

  it('is idempotent when already at STORAGE_SCHEMA_VERSION', () => {
    const already_current = {
      version: STORAGE_SCHEMA_VERSION,
      timestamp: 0,
      change_type: 'user_edit',
      table_state: {
        columns: [],
        prefix_columns: ['player_name'],
        sort: [],
        where: []
      }
    }
    const { snapshot, migrated } = run_migrations(already_current)
    expect(migrated).to.be.false
    expect(snapshot).to.equal(already_current)
  })

  it('v2_to_v3 rewrites splits to row_axes and drops splits key', () => {
    const v2_snapshot = {
      version: 2,
      timestamp: Date.now(),
      change_type: 'user_edit',
      table_state: {
        columns: [],
        prefix_columns: ['player_name'],
        sort: [],
        where: [],
        splits: ['year']
      }
    }
    const { snapshot, migrated } = run_migrations(v2_snapshot)
    expect(migrated).to.be.true
    expect(snapshot.version).to.equal(STORAGE_SCHEMA_VERSION)
    expect(snapshot.table_state.row_axes).to.deep.equal(['year'])
    expect(snapshot.table_state).to.not.have.property('splits')
  })

  it('Object.freeze-d input does not throw and is not mutated', () => {
    const input = Object.freeze(legacy_snapshot())
    expect(() => run_migrations(input)).to.not.throw()
    // The input reference itself must still be frozen with original shape
    expect(input.version).to.equal(undefined)
    expect(input.table_state.columns[0].params.year).to.deep.equal([2024])
  })

  it('migrate_table_state does not mutate a frozen table_state', () => {
    const frozen_state = Object.freeze({
      columns: Object.freeze([
        Object.freeze({
          column_id: 'player_dfs_salary',
          params: Object.freeze({ year: [2024], week: [5], seas_type: ['REG'] })
        })
      ]),
      prefix_columns: Object.freeze([]),
      sort: [],
      where: []
    })
    expect(() => migrate_table_state(frozen_state)).to.not.throw()
  })
})
