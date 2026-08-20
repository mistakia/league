/* global describe it */

import * as chai from 'chai'

import { divergent_name_variants } from '#scripts/import-players-nflverse.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

/*
  The rule that decides which players teach us a second spelling of their own
  first name. It is what stops the nickname/legal-name duplicate class from
  re-forming: this feed runs daily at 3:05 and the Sleeper mint runs at 3:30, so
  a spelling seeded here is a spelling Sleeper's resolver can match instead of
  minting a second row for the same person.

  Every case below is a real 2026 row from players.parquet, not a synthetic one.
*/
describe('SCRIPTS /import-players-nflverse name variants', function () {
  it('returns both spellings when football_name diverges from first_name', function () {
    expect(
      divergent_name_variants({
        first_name: 'Lebbeus',
        last_name: 'Overton',
        football_name: 'L.T.'
      })
    ).to.deep.equal(['Lebbeus Overton', 'L.T. Overton'])
  })

  it('records the legal spelling too, not just the nickname', function () {
    // Either row can be minted first -- Sleeper often reaches a rookie before
    // nflverse lists him -- so seeding one direction leaves the other open.
    expect(
      divergent_name_variants({
        first_name: 'Khalil',
        last_name: 'Murdock',
        football_name: 'Red'
      })
    ).to.deep.equal(['Khalil Murdock', 'Red Murdock'])
  })

  it('returns nothing when the two spellings agree', function () {
    // Trey Smack carries football_name === first_name. Seeding his own name
    // would be a variant ensure_player_alias then has to refuse.
    expect(
      divergent_name_variants({
        first_name: 'Trey',
        last_name: 'Smack',
        football_name: 'Trey'
      })
    ).to.deep.equal([])
  })

  it('ignores case rather than reading it as a divergence', function () {
    expect(
      divergent_name_variants({
        first_name: 'Patrick',
        last_name: 'Coogan',
        football_name: 'PATRICK'
      })
    ).to.deep.equal([])
  })

  it('returns nothing when the feed carries no football_name', function () {
    expect(
      divergent_name_variants({
        first_name: 'Patrick',
        last_name: 'Mahomes',
        football_name: ''
      })
    ).to.deep.equal([])
  })
})
