/* global describe it */

import * as chai from 'chai'

import { League } from '#app/core/leagues/league.js'
import { Trade } from '#app/core/trade/trade.js'
import { Waiver } from '#app/core/waivers/waiver.js'

const expect = chai.expect

// An Immutable Record silently drops any key its declaration does not list, so
// a wire field the API plumbs correctly still reaches the SPA as `undefined`.
// That is defect class 1 and 2 of the 2026-08-18 census -- `League` missing
// `league_id`, then `Trade`/`Waiver`/`Source` -- and the 4,185-test suite read
// identically at the broken and the fixed revision, because no spec anywhere
// loaded a Record.
//
// It could not: `app/core/leagues/league.js` reached for the `@constants` and
// `@libs-shared` WEBPACK aliases, which Node rejects outright
// (ERR_INVALID_MODULE_SPECIFIER -- `@constants` is not a valid package name).
// Those two aliases are now the Node subpath imports the package already
// declared, so the declaration is readable from a test for the first time.
//
// This spec asserts the CAPABILITY rather than a field roster: it proves a
// Record loads under plain Node and that its declared key set is legible. A
// gate over which ids each Record must declare is a separate, larger piece of
// work -- see the task entity.

const declared_fields = (RecordClass) => Object.keys(new RecordClass().toJS())

describe('app/core Record importability', function () {
  it('loads the League Record and reads its declared field list', () => {
    const fields = declared_fields(League)

    // A Record whose declaration failed to load would construct an empty
    // object rather than throwing, so the floor is what makes this non-vacuous.
    expect(fields.length).to.be.greaterThan(100)
    expect(fields).to.include('league_id')
  })

  it('loads the other wire-built Records the census named', () => {
    for (const RecordClass of [Trade, Waiver]) {
      expect(declared_fields(RecordClass).length).to.be.greaterThan(0)
    }
  })
})
