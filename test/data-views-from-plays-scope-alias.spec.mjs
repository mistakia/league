/* global describe it before */

import MockDate from 'mockdate'
import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server'

// Regression: two *_from_plays columns whose params differ only by year (or by
// seas_type) hashed to one table alias, landed in one join group, and shared a
// single CTE built from whichever column seeded the group. The second column
// silently rendered the first column's values under its own header -- no error,
// no failing test, just a wrong answer.
//
// The alias key derives its membership from nfl_plays_column_params;
// 64a28f9dc removed year / week / seas_type from that registry in favor of the
// composite nfl_week_id and this key lost them without a diff of its own. See
// libs-server/data-views/get-stats-column-param-key.mjs.
//
// These assert on the generated SQL rather than on the alias hash, because the
// hash is an implementation detail and the observable defect is the shared CTE.

const { expect } = chai

const count_occurrences = (haystack, needle) => {
  let count = 0
  let i = 0
  while (true) {
    const idx = haystack.indexOf(needle, i)
    if (idx === -1) return count
    count++
    i = idx + needle.length
  }
}

describe('Data View from-plays scope alias identity', () => {
  before(() => {
    MockDate.reset()
  })

  it('builds a separate CTE per year for two otherwise identical columns', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_receiving_yards_from_plays',
          params: { year: [2025] }
        },
        {
          column_id: 'player_receiving_yards_from_plays',
          params: { year: [2024] }
        }
      ],
      sort: [],
      where: []
    })
    const sql = query.toString()

    expect(
      count_occurrences(sql, '"nfl_plays"."season_year" in (2025)')
    ).to.equal(1)
    expect(
      count_occurrences(sql, '"nfl_plays"."season_year" in (2024)')
    ).to.equal(1)
  })

  it('projects each year column from its own CTE rather than one shared alias', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_receiving_yards_from_plays',
          params: { year: [2025] }
        },
        {
          column_id: 'player_receiving_yards_from_plays',
          params: { year: [2024] }
        }
      ],
      sort: [],
      where: []
    })
    const sql = query.toString()

    const projections = [
      ...sql.matchAll(
        /"(t[0-9a-f]{32})"\."rec_yds_from_plays" AS "rec_yds_from_plays_\d+"/g
      )
    ].map((match) => match[1])

    expect(projections).to.have.lengthOf(2)
    expect(projections[0]).to.not.equal(projections[1])
  })

  it('builds a separate CTE per seas_type for two otherwise identical columns', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        {
          column_id: 'player_receiving_yards_from_plays',
          params: { year: [2024], seas_type: ['REG'] }
        },
        {
          column_id: 'player_receiving_yards_from_plays',
          params: { year: [2024], seas_type: ['POST'] }
        }
      ],
      sort: [],
      where: []
    })
    const sql = query.toString()

    expect(
      count_occurrences(sql, '"nfl_plays"."season_type" in (\'REG\')')
    ).to.equal(1)
    expect(
      count_occurrences(sql, '"nfl_plays"."season_type" in (\'POST\')')
    ).to.equal(1)
  })

  it('shares one CTE across columns that declare no time scope', async () => {
    const { query } = await get_data_view_results_query({
      columns: [
        { column_id: 'player_receiving_yards_from_plays', params: {} },
        { column_id: 'player_receiving_yards_from_plays', params: {} }
      ],
      sort: [],
      where: []
    })
    const sql = query.toString()

    expect(
      count_occurrences(sql, 'as rec_yds_from_plays from "nfl_plays"')
    ).to.equal(1)
  })
})
