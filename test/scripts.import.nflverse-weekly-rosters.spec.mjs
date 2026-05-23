/* global describe it */
import * as chai from 'chai'

import { validate_response_shape } from '#scripts/import-nflverse-weekly-rosters.validate.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const make_row = (overrides = {}) => ({
  season: '2024',
  week: '1',
  team: 'KC',
  status: 'ACT',
  game_type: 'REG',
  gsis_id: '00-0033873',
  full_name: 'Patrick Mahomes',
  first_name: 'Patrick',
  last_name: 'Mahomes',
  entry_year: '2017',
  ...overrides
})

describe('SCRIPTS /import-nflverse-weekly-rosters validator', function () {
  it('passes on a well-formed row set with ACT + INA', function () {
    const rows = [
      make_row({ status: 'ACT' }),
      make_row({ status: 'INA', full_name: 'Inactive Player' })
    ]
    const result = validate_response_shape({ rows })
    expect(result.rows).to.equal(2)
    expect(result.status_counts).to.deep.equal({ ACT: 1, INA: 1 })
  })

  it('passes on pre-2020 row set with ACT + RES (no INA token)', function () {
    // 2009-2019 nflverse data uses RES/SUS/PUP/RSN for absences, no INA.
    // Validator must accept these years.
    const rows = [
      make_row({ season: '2014', status: 'ACT' }),
      make_row({ season: '2014', status: 'RES', full_name: 'IR Player' })
    ]
    const result = validate_response_shape({ rows })
    expect(result.rows).to.equal(2)
  })

  it('throws when rows is empty', function () {
    expect(() => validate_response_shape({ rows: [] })).to.throw(
      /rows missing or empty/
    )
  })

  it('throws when a required column is missing', function () {
    const row = make_row()
    delete row.gsis_id
    expect(() => validate_response_shape({ rows: [row] })).to.throw(
      /required column 'gsis_id' missing/
    )
  })

  it('throws when no ACT entries present', function () {
    const rows = [make_row({ status: 'RES' }), make_row({ status: 'INA' })]
    expect(() => validate_response_shape({ rows })).to.throw(
      /zero ACT entries/
    )
  })

  it('throws when every row is ACT (no reserves/inactives at all)', function () {
    const rows = [
      make_row({ status: 'ACT', full_name: 'A' }),
      make_row({ status: 'ACT', full_name: 'B' })
    ]
    expect(() => validate_response_shape({ rows })).to.throw(
      /every one of .* is ACT/
    )
  })
})
