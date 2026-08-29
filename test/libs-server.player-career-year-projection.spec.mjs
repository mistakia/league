/* global describe it */

import * as chai from 'chai'

import db from '#db'
import { current_season } from '#constants'
import { get_data_view_results_query } from '#libs-server/get-data-view-results.mjs'

const { expect } = chai

const year = current_season.year

// career_year is only materialized for seasons a player has actually appeared
// in, so before the season's first game the current-season rows render blank.
// The column definition now projects the value a player enters the season
// with: distinct seasons played before the current year, plus one. These specs
// pin (a) that the projection is emitted only when the current season is in
// the query's year scope, and (b) that the executed value is the projected one
// while stored past-year values are untouched.
describe('Data Views - player_career_year current-season projection', function () {
  this.timeout(20000)

  const year_axis_view = (years) => ({
    columns: [{ column_id: 'player_career_year', params: { year: years } }],
    prefix_columns: ['player_name'],
    where: [],
    sort: [],
    row_axes: ['year'],
    offset: 0,
    limit: 20
  })

  it('projects the current-season career year under a year axis', async () => {
    const { query } = await get_data_view_results_query(
      year_axis_view([year, year - 1, year - 2])
    )
    const sql = query.toString()
    expect(sql).to.include('COALESCE(')
    expect(sql).to.include('count(DISTINCT season_year) + 1')
    expect(sql).to.include(`season_year < ${year}`)
    expect(sql).to.include(`player_years.year = ${year}`)
    // Pre-aggregated, not correlated: one grouped pass joined onto the player
    // row, rather than a subquery evaluated once per outer row.
    expect(sql).to.include('group by pid')
    expect(sql).to.not.include('projected.pid = player.pid')
    // The join has to be LEFT and the read has to COALESCE, or every player
    // with no prior REG seasonlog is dropped or blanked. See the seeded
    // no-prior-seasons spec below for the executed proof.
    expect(sql).to.include('COALESCE(t')
    expect(sql).to.include('.career_year, 1::smallint)')
    expect(sql).to.match(/left join "t[0-9a-f]{32}" on/)
  })

  it('registers the pre-aggregated relation once for two career-year columns', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        { column_id: 'player_career_year', params: { year: [year, year - 1] } },
        {
          column_id: 'player_career_year',
          params: { year: [year, year - 1], seas_type: 'POST' }
        }
      ],
      prefix_columns: ['player_name'],
      where: [],
      sort: [],
      row_axes: ['year'],
      offset: 0,
      limit: 20
    })
    const sql = query.toString()
    // Both columns project the same season, so they read the same relation.
    // Registering it twice would emit a duplicate WITH alias (42712).
    const cte_bodies = sql.match(/select pid, \(count\(DISTINCT season_year\)/g)
    expect(cte_bodies).to.have.lengthOf(1)
  })

  it('leaves past-year-only queries on plain career_year', async () => {
    const { query } = await get_data_view_results_query(
      year_axis_view([year - 1, year - 2, year - 3])
    )
    const sql = query.toString()
    expect(sql).to.include('career_year as career_year_0')
    expect(sql).to.not.include('COALESCE(')
    expect(sql).to.not.include('count(DISTINCT season_year)')
    // The pre-aggregated relation is not registered either, so a past-year-only
    // query carries no extra CTE and no extra join.
    expect(sql).to.not.include('group by pid')
  })

  it('projects the current-season career year without a year axis', async () => {
    const { query } = await get_data_view_results_query({
      columns: [{ column_id: 'player_career_year', params: { year } }],
      prefix_columns: ['player_name'],
      where: [],
      row_axes: [],
      offset: 0,
      limit: 20
    })
    const sql = query.toString()
    expect(sql).to.include('COALESCE(')
    expect(sql).to.include('count(DISTINCT season_year) + 1')
    expect(sql).to.include(`season_year < ${year}`)
  })

  it('returns the projected value while past-year stored values are untouched', async () => {
    const trx = await db.transaction()
    try {
      // The seeded player appeared in the two seasons before the current one.
      await trx.raw(
        `INSERT INTO player (pid, first_name, last_name, short_name, formatted_name, primary_position, secondary_position, date_of_birth, nfl_draft_year, current_nfl_team) VALUES ('TEST-CYR-000001', 'Test', 'Cyproj', 'T.Cyproj', 'Test Cyproj', 'MLB', 'MLB', '2000-01-01', ${year - 2}, 'ZWA')`
      )
      for (const [season, career_year] of [
        [year - 2, 1],
        [year - 1, 2]
      ]) {
        await trx.raw(
          `INSERT INTO player_seasonlogs (pid, season_year, season_type, career_year, rushing_first_downs, receiving_first_downs, rushing_yards_excluding_kneels) VALUES ('TEST-CYR-000001', ${season}, 'REG', ${career_year}, 0, 0, 0)`
        )
      }

      const { query } = await get_data_view_results_query({
        columns: [
          {
            column_id: 'player_career_year',
            params: { year: [year, year - 1, year - 2] }
          }
        ],
        prefix_columns: ['player_name'],
        where: [
          { column_id: 'player_position', operator: 'IN', value: ['MLB'] }
        ],
        row_axes: ['year'],
        offset: 0,
        limit: 20
      })
      const rows = await query.transacting(trx)
      const seeded_rows = rows.filter((row) => row.pid === 'TEST-CYR-000001')
      expect(seeded_rows).to.have.lengthOf(3)
      const by_year = Object.fromEntries(
        seeded_rows.map((row) => [Number(row.year), row.career_year_0])
      )
      // Current season projects distinct seasons played before it, plus one.
      expect(by_year[year]).to.equal(3)
      // Stored values are untouched.
      expect(by_year[year - 1]).to.equal(2)
      expect(by_year[year - 2]).to.equal(1)
    } finally {
      await trx.rollback()
    }
  })

  // The correctness crux of the pre-aggregated form, and the one case a naive
  // rewrite gets wrong. The correlated subquery aggregated over an empty set
  // and returned `count(0) + 1 = 1` for a player with no prior REG seasonlog;
  // a GROUP BY relation simply has no row for that player, so a LEFT JOIN
  // yields NULL and the cell renders blank. On production this is 16,536 of
  // 28,807 players. Delete the COALESCE in projected_career_year_from_cte and
  // this spec goes red -- that is what makes it a gate rather than a
  // screenshot.
  it('projects 1 for a player with no prior regular-season seasonlog', async () => {
    const trx = await db.transaction()
    try {
      // Seeded with NO player_seasonlogs rows at all.
      await trx.raw(
        `INSERT INTO player (pid, first_name, last_name, short_name, formatted_name, primary_position, secondary_position, date_of_birth, nfl_draft_year, current_nfl_team) VALUES ('TEST-CYR-000002', 'Test', 'Cyrook', 'T.Cyrook', 'Test Cyrook', 'MLB', 'MLB', '2004-01-01', ${year}, 'ZWA')`
      )

      const { query } = await get_data_view_results_query({
        columns: [
          {
            column_id: 'player_career_year',
            params: { year: [year, year - 1] }
          }
        ],
        prefix_columns: ['player_name'],
        where: [
          { column_id: 'player_position', operator: 'IN', value: ['MLB'] }
        ],
        row_axes: ['year'],
        offset: 0,
        limit: 100
      })
      const rows = await query.transacting(trx)
      const seeded_rows = rows.filter((row) => row.pid === 'TEST-CYR-000002')
      expect(seeded_rows).to.have.lengthOf(2)
      const by_year = Object.fromEntries(
        seeded_rows.map((row) => [Number(row.year), row.career_year_0])
      )
      // Entering their first season: no prior REG seasons, plus one.
      expect(by_year[year]).to.equal(1)
      // A past season the player did not play stays blank, as before.
      expect(by_year[year - 1]).to.equal(null)
    } finally {
      await trx.rollback()
    }
  })
})
