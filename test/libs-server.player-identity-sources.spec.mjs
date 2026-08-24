/* global describe it */
import * as chai from 'chai'

import { from_weekly_roster_row } from '#libs-server/player-identity-sources.mjs'

const expect = chai.expect

// A real 2003 row, which is the era this rung exists to reach.
const weekly_row = {
  season: '2003',
  position: 'RB',
  ngs_position: '',
  first_name: 'Rabih',
  last_name: 'Abdullah',
  football_name: 'Rabih',
  birth_date: '1975-04-27',
  height: '72',
  weight: '220',
  college: 'Lehigh',
  gsis_id: '00-0000007',
  esb_id: 'ABD675101',
  pfr_id: '',
  smart_id: '32004142-4467-5101-8326-4b71f9f0a7b7',
  gsis_it_id: ''
}

describe('LIBS-SERVER player-identity-sources weekly rosters', function () {
  it('carries the identifiers that make an attach decidable without a name', () => {
    const record = from_weekly_roster_row(weekly_row)

    expect(record.gsis_player_id).to.equal('00-0000007')
    expect(record.esb_id).to.equal('ABD675101')
    expect(record.smart_id).to.equal('32004142-4467-5101-8326-4b71f9f0a7b7')
  })

  // The CSV writes an empty string where it has no value, and an empty string is
  // NOT an absence to `merge_record`, which only fills null. Left uncoerced, an
  // empty pfr_id from a weekly row would mask a real one from NFL Pro.
  it('normalizes an empty identifier to null rather than an empty string', () => {
    const record = from_weekly_roster_row(weekly_row)

    expect(record.pfr_id).to.equal(null)
    expect(record.gsis_it_id).to.equal(null)
  })

  // The corruption class this repeats from the NFL Pro mapper: create-player
  // builds short_name from the first initial, so taking the legal first name
  // writes `J.Berry` for a player every other source calls `E.Berry` -- and
  // short_name is the exact column a name comparison reads.
  it('prefers football_name over the legal first name', () => {
    const record = from_weekly_roster_row({
      ...weekly_row,
      first_name: 'Elbert',
      football_name: 'Eric'
    })

    expect(record.first_name).to.equal('Eric')
    expect(record.legal_first_name).to.equal('Elbert')
  })

  it('falls back to the legal first name when football_name is absent', () => {
    const record = from_weekly_roster_row({
      ...weekly_row,
      first_name: 'Elbert',
      football_name: ''
    })

    expect(record.first_name).to.equal('Elbert')
  })

  // The one field where the weekly CSV and the players parquet genuinely differ:
  // the parquet's `college_name` semicolon-concatenates transfers, the weekly
  // `college` records a single school. Reading the parquet's rule here would
  // strip nothing and split nothing, but reading the weekly column with the
  // parquet's NAME finds undefined and drops the college entirely.
  it('reads the single-school college column', () => {
    const record = from_weekly_roster_row(weekly_row)

    expect(record.college).to.equal('Lehigh')
  })

  it('records no college rather than an empty string', () => {
    const record = from_weekly_roster_row({ ...weekly_row, college: '' })

    expect(record.college).to.equal(null)
  })

  // The CSV yields strings where the parquet and NFL Pro yield numbers, and a
  // completeness check reads truthiness. `'0'` is truthy and `0` is not, so
  // leaving the string uncoerced mints a row asserting a zero weight instead of
  // reporting the measurement as missing. Measured against production
  // 2026-08-24: `00-0037599` carries weight `'0'` and moved from `mint_new` to
  // `residue_incomplete_source` on exactly this change.
  it('reports a zero measurement as absent rather than as a value', () => {
    const record = from_weekly_roster_row({ ...weekly_row, weight: '0' })

    expect(record.weight_pounds).to.equal(null)
  })

  it('carries a real measurement through as a number', () => {
    const record = from_weekly_roster_row(weekly_row)

    expect(record.weight_pounds).to.equal(220)
    expect(record.height_inches).to.equal(72)
  })

  it('names itself as its own source, so a merged record reports both', () => {
    expect(from_weekly_roster_row(weekly_row).source).to.equal(
      'nflverse_weekly_rosters'
    )
  })
})
