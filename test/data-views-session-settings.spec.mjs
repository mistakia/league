/* global describe it */
import * as chai from 'chai'

import get_data_view_results from '#libs-server/get-data-view-results.mjs'

const expect = chai.expect

// Everything else covering this module exercises `get_data_view_results_query`,
// the BUILDER, which never emits the `SET LOCAL` prelude. The prelude is only
// produced by the default export and only reaches Postgres on a cache MISS, so
// a malformed one is invisible to the whole suite while failing every organic
// execution in production. That is exactly what shipped: extracting the
// per-query budget into `DATA_VIEW_WORK_MEM` moved the quotes off the SQL
// literal, emitting `SET LOCAL work_mem = 1GB`, which Postgres rejects with
// `trailing junk after numeric literal at or near "1GB"`.
//
// This asserts by ROUND TRIP rather than by reading the emitted string,
// because a well-formed JavaScript template and a statement a real server will
// accept are different claims and only execution separates them.
describe('data view session settings', function () {
  this.timeout(30000)

  it('executes the SET LOCAL prelude against a real server', async function () {
    const result = await get_data_view_results({
      columns: ['player_name'],
      limit: 1,
      timeout: 10000
    })

    expect(result.data_view_results).to.be.an('array')
  })

  it('executes the prelude on the no-timeout fallback arm', async function () {
    // `|| 40000` is the defensive arm for a null timeout; it is emitted into
    // the same statement and so has the same failure mode.
    const result = await get_data_view_results({
      columns: ['player_name'],
      limit: 1,
      timeout: null
    })

    expect(result.data_view_results).to.be.an('array')
  })
})
