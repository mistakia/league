/* global describe it */
import * as chai from 'chai'

import { get_data_view_results_query } from '#libs-server/get-data-view-results.mjs'

const { expect } = chai

// year_offset is spliced into a QUOTED interval literal on two of the three
// keeptradecut boundary branches, so a value carrying a single quote closes the
// literal and injects arbitrary SQL. POST /api/data-views/search sits ahead of
// the blanket auth guard in api/index.mjs and its params schema declares only
// `output` and is not $$strict, so every other params key arrives from an
// anonymous request as arbitrary JSON -- this was a direct request-to-SQL path,
// and the injected statement EXECUTED rather than raising a syntax error.
//
// Falsifiable at the pre-fix revision: each payload below emitted valid SQL
// carrying the attacker's own expression, and the `+ interval '0' year` shape
// in the first assertion is exactly what the quote break produced.
describe('Data Views - keeptradecut year_offset injection', function () {
  this.timeout(20000)

  const payloads = [
    "0' year) OR (SELECT true) OR ('1'='1",
    "0' year) OR ((SELECT count(*) FROM users) >= 0) OR ('1'='1",
    "0' year, now()) - interval '0",
    '0 + (SELECT 1)',
    "1 year'); DROP TABLE users; --"
  ]

  const branches = [
    {
      label: 'year axis opening-day boundary',
      params: (year_offset) => ({ year_offset }),
      row_axes: ['year']
    },
    {
      label: 'date branch',
      params: (year_offset) => ({ date: '2024-01-01', year_offset }),
      row_axes: []
    },
    {
      label: 'year axis month/day boundary',
      params: (year_offset) => ({ as_of_month_day: '03-01', year_offset }),
      row_axes: ['year']
    }
  ]

  for (const branch of branches) {
    for (const payload of payloads) {
      it(`${branch.label} rejects ${JSON.stringify(payload)}`, async () => {
        let thrown = null
        try {
          await get_data_view_results_query({
            columns: [
              {
                column_id: 'player_keeptradecut_value',
                params: branch.params(payload)
              }
            ],
            row_axes: branch.row_axes,
            where: []
          })
        } catch (err) {
          thrown = err
        }

        expect(thrown, `expected ${JSON.stringify(payload)} to throw`).to.not.be
          .null
        // The four data-view routes map is_invalid_param to 400 rather than
        // 500, and the offending value is deliberately not echoed back.
        expect(thrown.is_invalid_param).to.equal(true)
        expect(thrown.message).to.not.include('SELECT')
      })
    }
  }

  // The guard must not move the emitter for any value that was already valid,
  // or every cached entry and saved view carrying a year_offset changes.
  for (const [label, year_offset] of [
    ['absent', undefined],
    ['zero', 0],
    ['positive', 3],
    ['negative', -5],
    ['numeric string', '2'],
    ['array', [4]]
  ]) {
    it(`emits an unchanged interval for a ${label} year_offset`, async () => {
      const { query } = await get_data_view_results_query({
        columns: [
          {
            column_id: 'player_keeptradecut_value',
            params: year_offset === undefined ? {} : { year_offset }
          }
        ],
        row_axes: ['year'],
        where: []
      })
      const expected = Array.isArray(year_offset)
        ? year_offset[0]
        : Number(year_offset || 0)
      expect(query.toString()).to.include(`interval '${expected} year'`)
    })
  }
})
