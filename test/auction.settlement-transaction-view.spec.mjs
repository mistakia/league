/* global describe it */
import * as chai from 'chai'
import fs from 'fs'
import path from 'path'
import url from 'url'

const expect = chai.expect

const repo_root = path.join(
  path.dirname(url.fileURLToPath(import.meta.url)),
  '..'
)

// EVERY ROSTER READ UNDER THE LEAGUE LOCK GOES THROUGH THE LOCK HOLDER'S OWN
// CONNECTION.
//
// `settle_auction_player_if_complete` holds a `pg_advisory_xact_lock` and then
// reads a roster PER TEAM through `getRoster`, several queries each. On the
// MODULE POOL that means the lock holder acquires connections that the teams
// blocked on its lock are already holding: at league size the pool empties, and
// the deadlock breaks only when knex's `acquireConnectionTimeout` fires and
// rolls the settlement back. Election mode has no clock, so the player then sits
// open until some unrelated election happens to trigger another settle.
//
// THIS IS A SOURCE RATCHET AND IT SAYS SO, because the behavior it guards cannot
// be reached from this suite. The deadlock needs ~10 simultaneous lock waiters
// in one league and mocha runs single-threaded, so no spec here can make the
// fixed code and the broken code disagree. Two behavioral levers were tried and
// neither discriminates: `teams.salary_cap` never reaches `availableCap` (Roster
// derives it from the league format minus ACTIVE player salaries), and an
// uncommitted signing inside the caller's transaction did not move the holdout
// out of the eligible set either.
//
// So the honest guard is the one that can actually fail: assert the call shape
// at the two sites where the connection matters. A future edit that drops
// `db_client` reintroduces a deadlock nothing else in this repo would notice.
describe('auction settlement roster reads stay on the lock holder connection', function () {
  const read_source = (relative_path) =>
    fs.readFileSync(path.join(repo_root, relative_path), 'utf8')

  it('threads a db_client into every getRoster call in the settlement module', function () {
    const source = read_source('libs-server/auction-settlement.mjs')

    // Anchored on the CALL, not on the file containing the token somewhere --
    // a bare `getRoster` in a comment or an import must not satisfy this.
    const calls = source.match(/getRoster\(\{[^}]*\}\)/g) || []

    expect(
      calls.length,
      'the settlement module still performs roster reads; if this is 0 the ' +
        'pattern has gone stale and the check is vacuous'
    ).to.be.greaterThan(0)

    const unthreaded = calls.filter((call) => !call.includes('db_client'))
    expect(
      unthreaded,
      'every getRoster call in the settlement path must pass db_client, or the ' +
        'lock holder reads the shared pool and can deadlock against its own waiters'
    ).to.deep.equal([])
  })

  it('accepts a db_client in getRoster and uses it for every query', function () {
    const source = read_source('libs-server/get-roster.mjs')

    expect(
      source,
      'getRoster must accept a db_client for the settlement path to pass one'
    ).to.include('db_client = db')

    // The mixed-client hazard, which is worse than either client alone: a
    // roster assembled from BOTH the transaction and the pool would combine a
    // pre-write player list with post-write salaries. Anchored on the query
    // call form `db(` rather than the bare token, so the `= db` default and the
    // import do not count as violations.
    const body = source.slice(source.indexOf('export default async function'))
    const pool_queries = body.match(/[^_.\w]db\(/g) || []
    expect(
      pool_queries,
      'every query inside getRoster must run on db_client, not the module pool'
    ).to.deep.equal([])
  })
})
