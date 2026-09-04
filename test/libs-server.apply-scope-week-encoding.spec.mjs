/* global describe it */

import * as chai from 'chai'

import db from '#db'
import { apply_scope_to_query } from '#libs-server/data-views/apply-scope-to-query.mjs'

const expect = chai.expect

// nfl_week_id is GENERATED from (season_year, season_type, week), so the scope
// emitter can state a narrowed week scope in either encoding. It prefers the
// decomposed `week IN (...)` because emitting BOTH hands the planner two
// encodings of one restriction, which it multiplies as independent -- measured
// on nfl_games at an estimate of 4 against an actual 272.
//
// The swap is only sound when the decomposed form selects exactly the same
// rows, and that is a CORRECTNESS property, not a performance one: the
// decomposed form of a ragged list is strictly WIDER, so choosing it wrongly
// silently returns rows the caller did not ask for. No golden covers the ragged
// case -- the corpus fixtures are all clean single-season cross products -- so
// this spec is the whole gate on that boundary.
//
// Every assertion is paired with a control that must read the other way, so a
// matcher that has stopped matching cannot pass by finding nothing.

const emitted_sql = ({ table_name, nfl_week_ids, ...rest }) => {
  const query = db(table_name)
  apply_scope_to_query({
    query,
    table_name,
    query_context: { nfl_week_ids },
    ...rest
  })
  return query.toString()
}

describe('scope emitter week encoding', () => {
  describe('an exact cross product decomposes', () => {
    it('emits week and drops the composite for a contiguous single-season slice', () => {
      const sql = emitted_sql({
        table_name: 'nfl_games',
        nfl_week_ids: ['2025_REG_WEEK_1', '2025_REG_WEEK_2', '2025_REG_WEEK_3']
      })
      expect(sql).to.include('"nfl_games"."week" in (1, 2, 3)')
      expect(sql).to.not.include('nfl_week_id')
      // The decomposed form is only equivalent BECAUSE these two ride with it.
      expect(sql).to.include('"nfl_games"."season_type" in (\'REG\')')
      expect(sql).to.include('"nfl_games"."season_year" in (2025)')
    })

    it('decomposes a multi-year list that is still a clean cross product', () => {
      // 2 years x 1 seas_type x 2 weeks = 4 ids. Every combination present, so
      // year IN (2024,2025) AND week IN (1,2) selects exactly these four.
      const sql = emitted_sql({
        table_name: 'nfl_games',
        nfl_week_ids: [
          '2024_REG_WEEK_1',
          '2024_REG_WEEK_2',
          '2025_REG_WEEK_1',
          '2025_REG_WEEK_2'
        ]
      })
      expect(sql).to.include('"nfl_games"."week" in (1, 2)')
      expect(sql).to.include('"nfl_games"."season_year" in (2024, 2025)')
      expect(sql).to.not.include('nfl_week_id')
    })
  })

  describe('anything that would widen keeps the composite', () => {
    it('keeps nfl_week_id for a ragged list, where the decomposed form is wider', () => {
      // 2024 week 1 and 2025 week 2 only. The decomposed form would be
      // year IN (2024,2025) AND week IN (1,2) -- four combinations for two
      // requested weeks, so it would ALSO return 2024 week 2 and 2025 week 1.
      const sql = emitted_sql({
        table_name: 'nfl_games',
        nfl_week_ids: ['2024_REG_WEEK_1', '2025_REG_WEEK_2']
      })
      expect(sql).to.include('nfl_week_id')
      expect(sql).to.not.include('"nfl_games"."week" in')
    })

    it('keeps nfl_week_id when season types are ragged across weeks', () => {
      // REG week 1 plus POST weeks 1-2: 1 year x 2 types x 2 weeks = 4 against
      // 3 requested, so the cross product is not exact.
      const sql = emitted_sql({
        table_name: 'nfl_games',
        nfl_week_ids: [
          '2025_REG_WEEK_1',
          '2025_POST_WEEK_1',
          '2025_POST_WEEK_2'
        ]
      })
      expect(sql).to.include('nfl_week_id')
      expect(sql).to.not.include('"nfl_games"."week" in')
    })

    it('keeps the composite when the caller suppressed the season-year half', () => {
      // week alone does not narrow to a season, so the decomposed form would
      // reach every year the table holds.
      const sql = emitted_sql({
        table_name: 'nfl_games',
        nfl_week_ids: ['2025_REG_WEEK_1', '2025_REG_WEEK_2'],
        has_season_year: false
      })
      expect(sql).to.include('nfl_week_id')
      expect(sql).to.not.include('"nfl_games"."week" in')
    })

    it('keeps the composite when the caller suppressed the season-type half', () => {
      const sql = emitted_sql({
        table_name: 'nfl_games',
        nfl_week_ids: ['2025_REG_WEEK_1', '2025_REG_WEEK_2'],
        has_season_type: false
      })
      expect(sql).to.include('nfl_week_id')
      expect(sql).to.not.include('"nfl_games"."week" in')
    })

    // The registry is an inclusion set precisely because the fallback for an
    // unregistered name is a CTE alias, which projects the vocabulary columns
    // and need not project `week` at all. Emitting it there is a 42703.
    it('keeps the composite for a relation with no registered week column', () => {
      const sql = emitted_sql({
        table_name: 'some_cte_alias',
        nfl_week_ids: ['2025_REG_WEEK_1', '2025_REG_WEEK_2']
      })
      expect(sql).to.include('nfl_week_id')
      expect(sql).to.not.include('"some_cte_alias"."week" in')
    })
  })

  // Full (year x seas_type) coverage needs no week predicate at all, and this
  // short-circuit predates the swap. A regression here would emit an 18-element
  // week list on every full-season view.
  it('emits no week predicate at all when the scope covers a whole season type', () => {
    const nfl_week_ids = Array.from(
      { length: 18 },
      (unused, index) => `2025_REG_WEEK_${index + 1}`
    )
    const sql = emitted_sql({ table_name: 'nfl_games', nfl_week_ids })
    expect(sql).to.not.include('nfl_week_id')
    expect(sql).to.not.include('"nfl_games"."week" in')
    expect(sql).to.include('"nfl_games"."season_year" in (2025)')
  })
})
