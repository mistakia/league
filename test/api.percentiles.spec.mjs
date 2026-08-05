/* global describe before after it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'

import server from '#api'
import knex from '#db'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chai_http)
const expect = chai.expect

// Pins the API KEY NAMES of GET /percentiles/:percentile_key against the physical
// column names, which are now different and must stay decoupled.
//
// This route used to `SELECT *` and `res.send` the row verbatim, so 72346e579's
// rename of every percentile column -- p25 -> percentile_25, min/max ->
// minimum_value/maximum_value -- silently changed the response shape.
// app/core/percentiles/reducer.js spreads the row straight into redux
// (`{ field, percentile_key, ...percentile }`), and percentile-metric.js reads
// .p25/.p75/.min/.max, so every read became undefined and the color arithmetic
// collapsed through `NaN || 0` to a flat cell. Nothing threw and the route kept
// answering 200, which is why no existing gate or test could see it.
//
// The spec has to EXECUTE the round trip rather than inspect the query builder:
// at the pre-fix revision the handler was well-formed JavaScript naming columns
// that exist, and only the returned KEYS tell the two revisions apart. Confirmed
// red at 782b78907~1 on all four assertions below.
//
// Scope is deliberately the key contract and nothing else. These keys are a
// client contract, not an implementation detail -- the SPA reads them by name
// and an Immutable-free plain spread means a missing one is undefined rather
// than an error.
describe('API /percentiles', function () {
  const percentile_key = 'TEST_PERCENTILE_KEY'
  const field = 'test_field'

  const row = {
    percentile_key,
    field,
    percentile_25: 1.25,
    percentile_50: 2.5,
    percentile_75: 3.75,
    percentile_90: 4.9,
    percentile_95: 5.95,
    percentile_98: 6.98,
    percentile_99: 7.99,
    minimum_value: 0.5,
    maximum_value: 9.5
  }

  before(async function () {
    this.timeout(60 * 1000)
    await knex('percentiles').where({ percentile_key }).del()
    await knex('percentiles').insert(row)
  })

  after(async function () {
    await knex('percentiles').where({ percentile_key }).del()
  })

  it('returns the seven percentile bands under their API key names', async function () {
    const response = await chai_request
      .execute(server)
      .get(`/api/percentiles/${percentile_key}`)

    response.should.have.status(200)
    response.body.should.be.an('array').with.length(1)

    const [entry] = response.body
    expect(entry.field).to.equal(field)
    expect(entry.percentile_key).to.equal(percentile_key)
    for (const [key, expected] of [
      ['p25', row.percentile_25],
      ['p50', row.percentile_50],
      ['p75', row.percentile_75],
      ['p90', row.percentile_90],
      ['p95', row.percentile_95],
      ['p98', row.percentile_98],
      ['p99', row.percentile_99]
    ]) {
      expect(Number(entry[key]), `key ${key}`).to.equal(expected)
    }
  })

  it('returns min and max, the two whose names diverge most from the column', async function () {
    const response = await chai_request
      .execute(server)
      .get(`/api/percentiles/${percentile_key}`)

    const [entry] = response.body
    // minimum_value/maximum_value are the columns; the SPA reads .min/.max, and
    // percentile-metric divides by (max - p25), so an undefined here is the
    // NaN that silently flattened every cell.
    expect(Number(entry.min)).to.equal(row.minimum_value)
    expect(Number(entry.max)).to.equal(row.maximum_value)
  })

  it('does NOT leak the physical column names into the payload', async function () {
    const response = await chai_request
      .execute(server)
      .get(`/api/percentiles/${percentile_key}`)

    const [entry] = response.body
    // The inverse assertion, and the one that fails at the pre-fix revision even
    // if someone "fixes" this by sending both spellings. Sending both would let
    // the next rename reach the SPA again.
    for (const column of [
      'percentile_25',
      'percentile_99',
      'minimum_value',
      'maximum_value'
    ]) {
      expect(
        entry,
        `column ${column} must not be in the payload`
      ).to.not.have.property(column)
    }
  })

  it('answers an unknown percentile_key with an empty array, not an error', async function () {
    const response = await chai_request
      .execute(server)
      .get('/api/percentiles/NO_SUCH_PERCENTILE_KEY')

    response.should.have.status(200)
    response.body.should.be.an('array').with.length(0)
  })
})
