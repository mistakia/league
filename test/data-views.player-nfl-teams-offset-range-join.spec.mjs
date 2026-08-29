/* global describe it */

import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server/get-data-view-results.mjs'

const { expect } = chai

// player_nfl_teams emits TWO shapes on the year-offset-range path and they must
// not converge. Without a year reference the CTE groups by pid alone, so the
// column reads `teams` off a retained JOIN; with one, the window correlates on
// the outer row's YEAR as well as its pid and no pid-keyed join can express it,
// so the correlated subquery stays and the join is dropped.
//
// The invariant that makes this safe is that `offset_range_reads_join_alias`
// (read by group_needs_join_alias in get-data-view-results.mjs, and by the
// group-by branch in data-views/select-string.mjs) agrees with the branch the
// override actually takes. Disagreement is not a wrong number, it is a broken
// statement: emit the alias read while the join is dropped and every such view
// is a 42P01, and emit it without the matching group-by entry and it is a 42803.
//
// A query-match golden CANNOT see either. Both are structurally valid SQL that
// differs from the fixture by nothing a text comparison flags, and the 42803 was
// in fact written and shipped past the fixture before this spec existed. That is
// why these tests EXECUTE rather than assert on strings alone.
const base_request = {
  prefix_columns: ['player_name'],
  columns: [
    {
      column_id: 'player_nfl_teams',
      params: { year: [2024], year_offset: [1, 9] }
    }
  ],
  where: [{ column_id: 'player_position', operator: 'IN', value: ['RB'] }],
  sort: [{ column_id: 'player_nfl_teams', column_index: 0, desc: true }]
}

const splits_request = { ...base_request, row_axes: ['year'] }

const correlated_subquery = 'array_agg(DISTINCT t)'
const cte_join_pattern = /left join "t[0-9a-f]{32}"/

describe('Data Views - player_nfl_teams year-offset-range join', function () {
  this.timeout(60 * 1000)

  describe('no year reference (year-less shape)', function () {
    it('reads the CTE off a retained join, with no correlated subquery', async () => {
      const { query } = await get_data_view_results_query(base_request)
      const sql = query.toString()

      expect(sql).to.not.include(
        correlated_subquery,
        'the year-less shape must read `teams` off the join, not re-derive it per row'
      )
      expect(sql).to.match(
        cte_join_pattern,
        'reading the alias requires the join to be retained, or the statement is a 42P01'
      )
    })

    it('carries the alias read in the GROUP BY', async () => {
      const { query } = await get_data_view_results_query(base_request)
      const sql = query.toString()

      const group_by = sql.slice(sql.indexOf(' group by '))
      expect(group_by).to.match(
        /t[0-9a-f]{32}\.teams/,
        'a bare column of a joined relation is not functionally dependent on the grouped player columns; omitting it is a 42803'
      )
    })

    // The gate the two string assertions above cannot be. Both a dropped join
    // and a missing group-by entry leave SQL that still looks right.
    it('EXECUTES against the database', async () => {
      const { query } = await get_data_view_results_query(base_request)
      const rows = await query
      expect(rows).to.be.an('array')
    })
  })

  describe('with a year reference (splits shape)', function () {
    // Guards the OVERRIDE, not the predicate, and the distinction was found by
    // mutating both. Collapsing the override's `if (!year_clause)` branch to
    // unconditional turns this shape into a pid-keyed alias read that returns
    // one window for every year -- valid SQL, correctly shaped, and wrong; both
    // tests below go red on it.
    //
    // Forcing the PREDICATE true is green here, and that is correct rather than
    // a gap: an over-permissive predicate only retains a join the correlated
    // form does not read and adds a redundant group-by entry, which is wasteful
    // and not wrong. The predicate is fatal only in the under-permissive
    // direction, where the alias is read with the join dropped -- covered by the
    // 42P01 assertion in the year-less block above.
    it('keeps the correlated subquery and drops the join', async () => {
      const { query } = await get_data_view_results_query(splits_request)
      const sql = query.toString()

      expect(sql).to.include(
        correlated_subquery,
        'the year-correlated window cannot be expressed as a pid-keyed join'
      )
      expect(sql).to.match(
        /\.year BETWEEN /,
        'the window must still correlate on the outer year'
      )
    })

    it('EXECUTES against the database', async () => {
      const { query } = await get_data_view_results_query(splits_request)
      const rows = await query
      expect(rows).to.be.an('array')
    })
  })
})
