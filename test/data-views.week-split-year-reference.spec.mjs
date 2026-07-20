/* global describe before after it */

import * as chai from 'chai'

import db from '#db'
import { get_data_view_results_query } from '#libs-server'

const expect = chai.expect

// Regression for the unreachable-year_reference bug: a week-only-split view
// (row_grain ['player'], row_axes ['week']) uses the player_year_week identity,
// whose from-source defines the player_years CTE but never joins it -- only
// player_years_weeks is joined. When the identity's year_reference pointed at
// player_years.year, any source correlated on year (projections
// player_week_projected_*, DFS salary) emitted `... = player_years.year` and
// Postgres rejected it with `missing FROM-clause entry for table "player_years"`.
// The fix points player_year_week.year_column at the always-joined
// player_years_weeks.year (mirroring the team_year_week analogue).
//
// Also covers the co-located slate-multiplicity issue: player_salaries carries
// no slate-type discriminator, so a book listing a player in more than one
// same-week slate (e.g. FanDuel main + single-game) yields duplicate (pid, week)
// rows unless the salary CTE selects one canonical (main-slate) price per week.

const YEAR = 2025
const WEEK = 1
const NFL_WEEK_ID = `${YEAR}_REG_WEEK_${WEEK}`
const MAIN_PID = 'XR-ROOK-000000'
const OTHER_PID = 'XR-ROOK-000005'
const ESBID_A = 990001
const ESBID_B = 990002

describe('data-views week-split year_reference reachability', () => {
  before(async () => {
    await db('nfl_games')
      .insert([
        {
          esbid: ESBID_A,
          year: YEAR,
          week: WEEK,
          seas_type: 'REG',
          date: '2025/09/07',
          v: 'KC',
          h: 'BAL'
        },
        {
          esbid: ESBID_B,
          year: YEAR,
          week: WEEK,
          seas_type: 'REG',
          date: '2025/09/07',
          v: 'NYG',
          h: 'DAL'
        }
      ])
      .onConflict('esbid')
      .ignore()

    // nfl_year_week_timestamp is a materialized view over nfl_games (REG); the
    // week bridge (player_years_weeks) reads it, so it must be populated for any
    // week-split query to execute.
    await db.raw('REFRESH MATERIALIZED VIEW nfl_year_week_timestamp')

    // FanDuel lists MAIN_PID in both its main slate (covers both games) and a
    // single-game slate (covers one), at different prices. OTHER_PID appears in
    // the main slate's second game so the main slate covers two distinct games
    // and outranks the single-game slate on slate_size.
    await db('player_salaries')
      .insert([
        {
          pid: MAIN_PID,
          esbid: ESBID_A,
          source_contest_id: 'TEST_MAIN',
          source_id: 'FANDUEL',
          salary: 8000
        },
        {
          pid: MAIN_PID,
          esbid: ESBID_A,
          source_contest_id: 'TEST_SINGLE',
          source_id: 'FANDUEL',
          salary: 6000
        },
        {
          pid: OTHER_PID,
          esbid: ESBID_B,
          source_contest_id: 'TEST_MAIN',
          source_id: 'FANDUEL',
          salary: 7000
        }
      ])
      .onConflict(['pid', 'esbid', 'source_contest_id'])
      .merge()
  })

  after(async () => {
    await db('player_salaries')
      .whereIn('source_contest_id', ['TEST_MAIN', 'TEST_SINGLE'])
      .del()
    await db('nfl_games').whereIn('esbid', [ESBID_A, ESBID_B]).del()
    await db.raw('REFRESH MATERIALIZED VIEW nfl_year_week_timestamp')
  })

  describe('projections player_week_projected_* on a week-only split', () => {
    const week_only_projected_request = (column_id) => ({
      columns: [{ column_id, params: { year: [YEAR], week: [WEEK] } }],
      prefix_columns: ['player_name'],
      sort: [],
      where: [],
      row_grain: ['player'],
      row_axes: ['week']
    })

    const projected_columns = [
      'player_week_projected_pass_yds',
      'player_week_projected_points',
      'player_week_projected_rush_yds'
    ]

    for (const column_id of projected_columns) {
      it(`${column_id} correlates year on the reachable week relation`, async () => {
        const { query } = await get_data_view_results_query(
          week_only_projected_request(column_id)
        )
        const sql = query.toString()
        // The projection join must correlate year against the always-joined
        // player_years_weeks.year, never the unjoined player_years.year.
        expect(sql).to.match(/\.year = player_years_weeks\.year/)
        expect(sql).to.not.match(/\.year = player_years\.year\b/)
      })

      it(`${column_id} executes without a missing-FROM-clause error`, async () => {
        const { query } = await get_data_view_results_query(
          week_only_projected_request(column_id)
        )
        // Executing against the seeded DB proves every referenced relation is in
        // the FROM clause. The projection tables are unseeded, so the result set
        // is empty -- the assertion is that the query resolves (no 42P01).
        await query
      })
    }
  })

  describe('player_dfs_salary slate multiplicity', () => {
    const dfs_params = {
      single_nfl_week_id: [NFL_WEEK_ID],
      platform_source_id: ['FANDUEL']
    }

    // Filter to players that actually carry a salary so the two seeded test
    // players surface within the row limit (unseeded players sort ahead of the
    // 'X'-prefixed test pids). Same params as the column so the CTE is reused.
    const dfs_request = () => ({
      columns: [{ column_id: 'player_dfs_salary', params: dfs_params }],
      prefix_columns: ['player_name'],
      sort: [],
      where: [
        {
          column_id: 'player_dfs_salary',
          params: dfs_params,
          value: '1',
          operator: '>='
        }
      ],
      row_grain: ['player'],
      row_axes: ['week']
    })

    const salary_of = (row) => {
      const key = Object.keys(row).find((k) => /dfs_salary/.test(k))
      return row[key]
    }

    it('returns exactly one salary row per (pid, week) despite two slates', async () => {
      const { query } = await get_data_view_results_query(dfs_request())
      const rows = await query
      const main_rows = rows.filter((r) => r.pid === MAIN_PID)
      expect(main_rows).to.have.length(1)
    })

    it('selects the main-slate (largest-slate) price, not the single-game price', async () => {
      const { query } = await get_data_view_results_query(dfs_request())
      const rows = await query
      const main_row = rows.find((r) => r.pid === MAIN_PID)
      expect(main_row, 'expected a salary row for the player').to.exist
      expect(Number(salary_of(main_row))).to.equal(8000)
    })
  })
})
