/* global describe it */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import knex from 'knex'
import * as chai from 'chai'

import { build_active_restricted_free_agency_bids_query } from '#libs-server/restricted-free-agency-bids-query.mjs'

process.env.NODE_ENV = 'test'

const { expect } = chai
const repo_root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

// Regression: `get-roster.mjs` filtered these bids on `cancelled` alone while its two
// siblings also filtered on `processed`. `process-restricted-free-agency-bids.mjs`
// settles a losing bid with `succ: 0` and a `processed` timestamp and leaves `cancelled`
// null, so the unguarded query kept returning bids after their processing run and kept
// attaching a `bid` to the roster player. `getExtensionAmount` coalesces that with `??`,
// so a settled $0 bid priced the player at $0 and handed the team free cap space --
// reaching the add-player gate, waivers and poaches, not only the bid dialog.
//
// The defect was the divergence rather than any one query, so the guards now live in one
// builder and the last test here fails if a call site starts rolling its own again.

const sql = build_active_restricted_free_agency_bids_query({
  db: knex({ client: 'pg' }),
  tid: 12,
  year: 2026
}).toString()

describe('build_active_restricted_free_agency_bids_query', function () {
  it('excludes processed bids', () => {
    expect(sql).to.include('"processed" is null')
  })

  it('excludes cancelled bids', () => {
    expect(sql).to.include('"cancelled" is null')
  })

  it('scopes to the bidding team and the season', () => {
    expect(sql).to.include('"tid" = 12')
    expect(sql).to.include('"year" = 2026')
  })

  it('does not constrain ownership -- the call site decides', () => {
    // The bid dialog wants every bid the team made; roster cap pricing wants only
    // the team's own players and adds `player_tid` itself.
    expect(sql).to.not.include('"player_tid"')
  })

  it('composes with an ownership filter without losing the liveness guards', () => {
    const own_player_sql = build_active_restricted_free_agency_bids_query({
      db: knex({ client: 'pg' }),
      tid: 12,
      year: 2026
    })
      .where('player_tid', 12)
      .toString()

    expect(own_player_sql).to.include('"player_tid" = 12')
    expect(own_player_sql).to.include('"processed" is null')
    expect(own_player_sql).to.include('"cancelled" is null')
  })

  describe('call sites', function () {
    // Every module that prices or lists live bids must go through the builder. A
    // hand-rolled query is exactly how the guards drifted apart the first time, and it
    // is invisible to the assertions above, which only ever see the builder's output.
    //
    // Note both roster loaders legitimately keep a SECOND, unguarded query against the
    // same table -- the one reading `processed`/`nominated`/`announced` to report the
    // state of a tag. It must not filter on `processed`, since that is the field it
    // exists to read, so "no raw query in this file" would be the wrong assertion.
    const pricing_call_sites = [
      'libs-server/get-roster.mjs',
      'libs-server/get-league-rosters-from-database.mjs'
    ]

    for (const call_site of pricing_call_sites) {
      it(`${call_site} prices own-player bids through the builder`, () => {
        const source = fs.readFileSync(path.join(repo_root, call_site), 'utf8')

        expect(source).to.include(
          'build_active_restricted_free_agency_bids_query'
        )
        expect(source).to.include("where('player_tid', tid)")
      })
    }

    it('libs-server/get-restricted-free-agency-bids.mjs lists bids through the builder', () => {
      const source = fs.readFileSync(
        path.join(repo_root, 'libs-server/get-restricted-free-agency-bids.mjs'),
        'utf8'
      )

      expect(source).to.include(
        'build_active_restricted_free_agency_bids_query'
      )
      expect(source).to.not.include("db('restricted_free_agency_bids')")
    })
  })
})
