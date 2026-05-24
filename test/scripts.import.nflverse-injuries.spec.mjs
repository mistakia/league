/* global describe it */
import * as chai from 'chai'

import { validate_response_shape } from '#scripts/import-nflverse-injuries.validate.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const make_row = (overrides = {}) => ({
  season: '2024',
  game_type: 'REG',
  team: 'KC',
  week: '1',
  gsis_id: '00-0033873',
  position: 'QB',
  full_name: 'Patrick Mahomes',
  first_name: 'Patrick',
  last_name: 'Mahomes',
  report_primary_injury: 'Ankle',
  report_secondary_injury: '',
  report_status: 'Questionable',
  practice_primary_injury: 'Ankle',
  practice_secondary_injury: '',
  practice_status: 'Limited Participation in Practice',
  date_modified: '2024-09-06T19:05:21Z',
  ...overrides
})

describe('SCRIPTS /import-nflverse-injuries validator', function () {
  it('passes on a well-formed row set with Out/Questionable/Doubtful tokens', function () {
    const rows = [
      make_row({ report_status: 'Out' }),
      make_row({ report_status: 'Questionable' }),
      make_row({ report_status: 'Doubtful' })
    ]
    const result = validate_response_shape({ rows })
    expect(result.rows).to.equal(3)
    expect(result.report_status_counts).to.include.keys(
      'OUT',
      'QUESTIONABLE',
      'DOUBTFUL'
    )
  })

  it('passes on pre-2016 row set with Probable as the dominant value', function () {
    // 2009-2015 nflverse has Probable as the most common token plus the
    // Out/Doubtful/Questionable trio. Validator just needs at least one
    // recognised report-status token across the file.
    const rows = [
      make_row({ season: '2012', report_status: 'Probable' }),
      make_row({ season: '2012', report_status: 'Probable' }),
      make_row({ season: '2012', report_status: 'Questionable' })
    ]
    const result = validate_response_shape({ rows })
    expect(result.rows).to.equal(3)
  })

  it('throws when rows is empty', function () {
    expect(() => validate_response_shape({ rows: [] })).to.throw(
      /rows missing or empty/
    )
  })

  it('throws when a required column is missing', function () {
    const row = make_row()
    delete row.report_status
    expect(() => validate_response_shape({ rows: [row] })).to.throw(
      /required column 'report_status' missing/
    )
  })

  it('throws when no Out/Doubtful/Questionable tokens present', function () {
    // Only Probable + blank -- preflight rejects because the enum may have
    // been renamed and we would otherwise silently write zero changelog rows.
    const rows = [
      make_row({ report_status: 'Probable' }),
      make_row({ report_status: '' })
    ]
    expect(() => validate_response_shape({ rows })).to.throw(
      /zero Out\/Doubtful\/Questionable/
    )
  })

  it('throws when practice_status column is missing', function () {
    const row = make_row()
    delete row.practice_status
    expect(() => validate_response_shape({ rows: [row] })).to.throw(
      /required column 'practice_status' missing/
    )
  })
})
