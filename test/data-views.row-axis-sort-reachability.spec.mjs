/* global describe before after it */

import * as chai from 'chai'

import db from '#db'
import { get_data_view_results_query } from '#libs-server'
import { migrate_table_state } from '#libs-shared/data-views-saved-view-migration.mjs'

const expect = chai.expect

// Regression for two coupled defects found by the production-URL replay gate on
// 2026-08-05, three of the 100 most recent data-view URLs failing at EXPLAIN.
//
// 1. A sort on a row axis emitted a hardcoded `player_years_weeks.week` (or
//    `player_years.year`) regardless of whether that axis was active. The CTE is
//    registered only by the identity bridge for an ACTIVE axis, so an axis sort
//    without its axis produced `missing FROM-clause entry for table
//    "player_years_weeks"` and the whole statement was unexecutable. The
//    hardcoded table was also wrong at team grain, where the axes live in
//    team_years / team_years_weeks.
//
// 2. Legacy short URLs and saved views carry `splits`, the pre-rename spelling
//    of `row_axes`, and nothing migrated it -- so the axes were dropped and the
//    view rendered at the wrong grain silently. That is what put two of the
//    three failing URLs into the state defect 1 then failed on.
//
// Note db/adhoc/check-data-view-sql-validity.mjs cannot cover this class: it
// sweeps columns across grains and axes but never exercises `sort`, and it
// reported GATE OK on the same tree where these URLs failed.

const YEAR = 2025

const player_request = ({ sort_column_id, row_axes }) => ({
  columns: [
    { column_id: 'player_week_projected_points', params: { year: [YEAR] } }
  ],
  prefix_columns: ['player_name'],
  sort: [{ column_id: sort_column_id, desc: true }],
  where: [],
  row_grain: ['player'],
  row_axes
})

const team_request = ({ sort_column_id, row_axes }) => ({
  columns: [
    {
      column_id: 'team_unit_dvoa',
      params: { year: [YEAR], dvoa_type: ['total_dvoa'], team_unit: ['off'] }
    }
  ],
  prefix_columns: ['team_code'],
  sort: [{ column_id: sort_column_id, desc: true }],
  where: [],
  row_grain: ['team'],
  row_axes
})

const ESBID = 990101

describe('data-views row-axis sort reachability', () => {
  // nfl_year_week_timestamp is a materialized view over nfl_games (REG) that
  // both week bridges read, so it must be populated for any week-axis query to
  // execute at all.
  before(async () => {
    await db('nfl_games')
      .insert({
        esbid: ESBID,
        season_year: YEAR,
        week: 1,
        season_type: 'REG',
        date: '2025/09/07',
        away_nfl_team: 'KC',
        home_nfl_team: 'BAL'
      })
      .onConflict('esbid')
      .ignore()
    await db.raw('REFRESH MATERIALIZED VIEW nfl_year_week_timestamp')
  })

  after(async () => {
    await db('nfl_games').where({ esbid: ESBID }).del()
    await db.raw('REFRESH MATERIALIZED VIEW nfl_year_week_timestamp')
  })

  describe('sorting on an axis that is not an active row axis', () => {
    // The pre-fix emitter produced `order by player_years_weeks.week desc` here.
    it('emits no week reference when no week row axis is declared', async () => {
      const { query } = await get_data_view_results_query(
        player_request({ sort_column_id: 'week', row_axes: [] })
      )
      const sql = query.toString()
      expect(sql).to.not.match(/player_years_weeks/)
      expect(sql).to.not.match(/order by[\s\S]*\bweek\b/i)
    })

    it('emits no year reference when no year row axis is declared', async () => {
      const { query } = await get_data_view_results_query(
        player_request({ sort_column_id: 'year', row_axes: [] })
      )
      const sql = query.toString()
      expect(sql).to.not.match(/order by[\s\S]*player_years\.year/)
    })

    it('executes without a missing-FROM-clause error', async () => {
      const { query } = await get_data_view_results_query(
        player_request({ sort_column_id: 'week', row_axes: [] })
      )
      // Executing proves every referenced relation is in the FROM clause; the
      // pre-fix statement raised 42P01 on player_years_weeks.
      await query
    })
  })

  describe('sorting on an active row axis', () => {
    it('orders by the week axis when the week row axis is active', async () => {
      const { query } = await get_data_view_results_query(
        player_request({ sort_column_id: 'week', row_axes: ['year', 'week'] })
      )
      const sql = query.toString()
      expect(sql).to.match(/order by[\s\S]*player_years_weeks\.week desc/i)
      await query
    })

    it('resolves the axis against the team identity at team grain', async () => {
      const { query } = await get_data_view_results_query(
        team_request({ sort_column_id: 'week', row_axes: ['year', 'week'] })
      )
      const sql = query.toString()
      // The hardcoded player table was emitted here before the fix even though
      // a team view never joins it.
      expect(sql).to.not.match(/player_years_weeks/)
      expect(sql).to.match(/order by[\s\S]*team_years_weeks\.week desc/i)
      await query
    })
  })

  describe('legacy splits param on saved views', () => {
    it('migrates splits to row_axes', () => {
      const { changed, table_state } = migrate_table_state({
        columns: [],
        row_grain: ['player'],
        splits: ['year', 'week']
      })
      expect(changed).to.equal(true)
      expect(table_state.row_axes).to.eql(['year', 'week'])
      expect(table_state).to.not.have.property('splits')
    })

    it('drops splits without overwriting an existing row_axes', () => {
      const { table_state } = migrate_table_state({
        columns: [],
        row_grain: ['player'],
        row_axes: ['year'],
        splits: ['year', 'week']
      })
      expect(table_state.row_axes).to.eql(['year'])
      expect(table_state).to.not.have.property('splits')
    })

    it('leaves row_axes absent for an empty splits', () => {
      const { table_state } = migrate_table_state({
        columns: [],
        row_grain: ['player'],
        splits: []
      })
      expect(table_state).to.not.have.property('splits')
      expect(table_state.row_axes).to.equal(undefined)
    })
  })
})
