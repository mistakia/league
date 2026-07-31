/* global describe it */

import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'

const expect = chai.expect

// Regression for the dropped week predicate on the week-split row axis.
//
// The week bridges build the row-axis relation -- player_years_weeks and its
// team analogue team_years_weeks -- by joining the year relation to
// nfl_year_week_timestamp. Both applied a year predicate and NEVER a week one,
// so a view requesting `week: [1, 2, 3]` under row_axes ['year', 'week'] got all
// 18 regular-season weeks back: the CTE emitted `WHERE
// nfl_year_week_timestamp.year = 2024` with no week clause, and nothing
// downstream re-applied the parameter.
//
// It is a silent wrong answer rather than an error -- the query is valid, the
// rows are real, there are just six times too many of them -- so no gate in the
// suite could see it. The one golden that exercises this shape
// (keeptradecut-value-year-week-split.json) carries skip_query_match: true, which
// means the harness logs its SQL diff for review and asserts nothing about it.
// That is why this coverage is a spec and not a regenerated golden.
//
// get_week_range unions the `week` params across columns and where clauses,
// exactly mirroring how get_year_range scopes the year axis, so a column that
// omits `week` contributes nothing rather than widening the union back to every
// week.

// The CTE body contains parenthesised expressions (`week IN (1, 2, 3)`), so it
// has to be read by balancing parens -- a lazy `[^)]*` stops inside the very
// predicate these tests assert on and silently truncates it.
const week_cte_of = (query_string, cte_name) => {
  const opener = `"${cte_name}" as (`
  const start = query_string.indexOf(opener)
  if (start === -1) return null

  let depth = 1
  let index = start + opener.length
  for (; index < query_string.length && depth > 0; index++) {
    if (query_string[index] === '(') depth++
    else if (query_string[index] === ')') depth--
  }

  return depth === 0
    ? query_string.slice(start + opener.length, index - 1)
    : null
}

const player_week_cte = async (request) => {
  const { query } = await get_data_view_results_query(request)
  return week_cte_of(query.toString(), 'player_years_weeks')
}

describe('data-views week-split week param filter', () => {
  it('applies the week param to the player week-axis CTE', async () => {
    const cte = await player_week_cte({
      columns: [
        {
          column_id: 'player_keeptradecut_value',
          params: { year: [2024], week: [1, 2, 3] }
        }
      ],
      prefix_columns: ['player_name'],
      row_axes: ['year', 'week'],
      limit: 10
    })

    expect(cte).to.be.a('string')
    expect(cte).to.include('nfl_year_week_timestamp.year = 2024')
    expect(cte).to.include('nfl_year_week_timestamp.week IN (1, 2, 3)')
  })

  it('emits no week predicate when no column requests a week', async () => {
    const cte = await player_week_cte({
      columns: [
        {
          column_id: 'player_keeptradecut_value',
          params: { year: [2024] }
        }
      ],
      prefix_columns: ['player_name'],
      row_axes: ['year', 'week'],
      limit: 10
    })

    expect(cte).to.be.a('string')
    expect(cte).to.include('nfl_year_week_timestamp.year = 2024')
    expect(cte).to.not.include('nfl_year_week_timestamp.week IN')
  })

  it('unions the week params across columns and sorts them', async () => {
    const cte = await player_week_cte({
      columns: [
        {
          column_id: 'player_keeptradecut_value',
          params: { year: [2024], week: [3, 1] }
        },
        {
          column_id: 'player_keeptradecut_overall_rank',
          params: { year: [2024], week: [2, 3] }
        }
      ],
      prefix_columns: ['player_name'],
      row_axes: ['year', 'week'],
      limit: 10
    })

    expect(cte).to.include('nfl_year_week_timestamp.week IN (1, 2, 3)')
  })

  it('accepts a scalar week param', async () => {
    const cte = await player_week_cte({
      columns: [
        {
          column_id: 'player_keeptradecut_value',
          params: { year: [2024], week: 5 }
        }
      ],
      prefix_columns: ['player_name'],
      row_axes: ['year', 'week'],
      limit: 10
    })

    expect(cte).to.include('nfl_year_week_timestamp.week IN (5)')
  })

  // The week filter applies with no year predicate beside it: year_range holds
  // more than one year, so the bridge's single_year clause is absent and the
  // week clause has to stand on its own rather than be appended to it.
  it('applies the week param when the year range is not a single year', async () => {
    const cte = await player_week_cte({
      columns: [
        {
          column_id: 'player_keeptradecut_value',
          params: { year: [2023, 2024], week: [1] }
        }
      ],
      prefix_columns: ['player_name'],
      row_axes: ['year', 'week'],
      limit: 10
    })

    expect(cte).to.include('nfl_year_week_timestamp.week IN (1)')
    expect(cte).to.not.include('nfl_year_week_timestamp.year =')
  })

  // The team bridge carried the identical defect and is fixed in the same pass,
  // so it gets the same assertion rather than being left to regress alone.
  it('applies the week param to the team week-axis CTE', async () => {
    const { query } = await get_data_view_results_query({
      row_grain: ['team'],
      row_axes: ['year', 'week'],
      columns: [
        {
          column_id: 'team_pass_yards_from_plays',
          params: { year: [2024], week: [1, 2] }
        }
      ]
    })

    const cte = week_cte_of(query.toString(), 'team_years_weeks')

    expect(cte).to.be.a('string')
    expect(cte).to.include('nfl_year_week_timestamp.week IN (1, 2)')
  })
})
