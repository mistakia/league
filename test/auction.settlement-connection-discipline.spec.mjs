/* global describe before beforeEach afterEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'
import fs from 'fs'
import path from 'path'
import url from 'url'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season } from '#constants'
import { settle_auction_player_if_complete } from '#libs-server/auction-settlement.mjs'
import getLeague from '#libs-server/get-league.mjs'
import { nominate_auction_player } from './utils/nominate-auction-player.mjs'
import { selectPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const repo_root = path.join(
  path.dirname(url.fileURLToPath(import.meta.url)),
  '..'
)

const league_id = 1
const season_year = current_season.year

// THE SCARCE RESOURCE IS THE POOL, NOT THE JS THREAD.
//
// A settlement holds the league's `pg_advisory_xact_lock` and then reads a
// roster PER TEAM, several queries each. On the MODULE POOL that makes the lock
// holder ask for connections the teams blocked on its lock are already holding:
// at league size the pool empties and the deadlock breaks only when knex's
// `acquireConnectionTimeout` fires and rolls the settlement back. Election mode
// has no clock, so the player then sits open until some unrelated election
// happens to trigger another settle.
//
// THIS FILE USED TO BE A SOURCE RATCHET THAT SAID THE BEHAVIOR WAS UNREACHABLE
// FROM MOCHA, on the grounds that the failure needs ~10 simultaneous lock
// waiters and mocha runs single-threaded. That reasoning was wrong, and the
// error is worth naming because it is easy to repeat: the connections are held
// by the DRIVER, not by the JS thread. Ten pending `db.transaction()` promises
// hold ten connections on one thread, and -- more to the point -- the waiters are
// not the mechanism at all. They are only one way to make the pool empty.
//
// So the harness below distills the mechanism instead of staging the incident:
// hold the pool at zero free and require the settlement to complete anyway. It
// asks the exact property the fix installs -- that the locked region acquires no
// connection beyond the one its own transaction holds -- and it discriminates
// hard, because unfixed code cannot get a connection at all and blocks until
// knex times it out sixty seconds later.
//
// Two cases, because the fix has two halves and each shipped separately:
//
// - THE LOCKED REGION owns its reads (`get_auction_team_capacities`,
//   `persist_auction_settlement`). Exercised by holding EVERY connection and
//   handing the settlement a transaction the spec opened itself.
// - `getLeague` RUNS BEFORE THE TRANSACTION OPENS. Exercised by leaving exactly
//   ONE connection free and letting the settlement resolve the league itself:
//   the one free connection serves `getLeague` and is then taken by the
//   transaction, so a `getLeague` moved back inside the lock finds nothing.
describe('auction settlement acquires no connection under the league lock', function () {
  let held = []

  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(
      current_season.regular_season_start.subtract('1', 'month').toISOString()
    )
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    held = []
    await league(knex)
    await knex('seasons')
      .where({ lid: league_id, season_year })
      .update({
        free_agency_period_start: current_season.regular_season_start
          .subtract(2, 'months')
          .toDate(),
        free_agency_period_end: current_season.regular_season_start.toDate()
      })
  })

  // RELEASED WHATEVER HAPPENS. A spec that fails while holding the pool wedges
  // every spec after it, and the wreckage reads as a regression in whatever ran
  // next rather than as this file leaking.
  afterEach(async function () {
    this.timeout(60 * 1000)
    await Promise.all(held.map((trx) => trx.rollback().catch(() => {})))
    held = []
  })

  // One connection, held open by an uncommitted transaction, until afterEach
  // rolls it back. `knex.transaction()` without a callback hands back the
  // transaction object rather than running one, which is the only form that
  // lets a caller hold a connection across awaits.
  const hold_one_connection = async () => {
    const trx = await knex.transaction()
    // The pool hands out a connection lazily, so the transaction is not holding
    // one until something runs on it.
    await trx.raw('SELECT 1')
    held.push(trx)
    return trx
  }

  const pool_max = () => knex.client.pool.max

  // A settlement that is READY: every team has elected, so completeness is
  // reached and the run reaches `persist_auction_settlement` -- which holds a
  // `getRoster` of its own, on the far side of the writes, and is the half a
  // capacities-only harness would miss.
  //
  // The elections are written DIRECTLY rather than through
  // `submit_auction_election`, because that route settles the player itself the
  // moment the last one lands. This spec has to be the thing that calls settle.
  const stage_a_complete_nomination = async () => {
    const player = await selectPlayer({
      exclude_rostered_players: true,
      random: false
    })
    const teams = await knex('teams').where({ lid: league_id, season_year })
    const team_ids = teams.map((team) => team.team_id).sort((a, b) => a - b)

    await nominate_auction_player({
      lid: league_id,
      pid: player.pid,
      tid: team_ids[0],
      value: 0
    })

    const now = new Date()
    await knex('auction_elections').insert(
      team_ids.map((tid) => ({
        lid: league_id,
        season_year,
        pid: player.pid,
        tid,
        user_id: 1,
        // The nominator states a ceiling and wins; everyone else declines. A
        // decline is a null maximum, which is a real election and discharges.
        maximum_bid: tid === team_ids[0] ? 5 : null,
        submitted_at: now,
        amount_set_at: now
      }))
    )

    return { pid: player.pid, team_ids }
  }

  // The whole discrimination. A settlement that never leaves its own connection
  // finishes in well under a second here; one that reaches for the pool cannot
  // get a connection at all and sits until knex's default 60s
  // `acquireConnectionTimeout`. Ten seconds separates those two by an order of
  // magnitude in both directions, so this is a verdict rather than a race.
  const within_ten_seconds = async (promise, label) => {
    let timer
    const deadline = new Promise((_resolve, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(
              `${label}: still blocked after 10s with the pool empty, which is ` +
                'the deadlock this fix removes -- the settlement asked for a ' +
                'connection while holding the league lock'
            )
          ),
        10 * 1000
      )
    })
    try {
      return await Promise.race([promise, deadline])
    } finally {
      clearTimeout(timer)
    }
  }

  it('settles with every pool connection held by somebody else', async function () {
    this.timeout(60 * 1000)

    const { pid, team_ids } = await stage_a_complete_nomination()

    // Resolved BEFORE the pool is drained, and passed in. `getLeague` reads the
    // pool by design and runs outside the transaction; this case is about the
    // locked region, and the case below is about that hoist.
    const resolved_league = await getLeague({ lid: league_id })

    // The settlement's own connection, taken first so draining cannot starve
    // the thing under test of the one connection it is entitled to.
    const settlement_trx = await knex.transaction()
    await settlement_trx.raw('SELECT 1')

    try {
      // EVERY REMAINING CONNECTION. Not `max - 1`: the settlement already holds
      // one, so this leaves the pool at zero free and any further acquisition
      // blocks outright.
      for (let i = 0; i < pool_max() - 1; i++) await hold_one_connection()

      const settlement = await within_ten_seconds(
        settle_auction_player_if_complete({
          lid: league_id,
          season_year,
          league: resolved_league,
          trx: settlement_trx
        }),
        'settlement under a drained pool'
      )

      expect(
        settlement,
        'the fixture must actually settle, or this spec proves nothing about ' +
          'connections -- it would only show that returning null early is fast'
      ).to.not.equal(null)
      expect(settlement.pid).to.equal(pid)
      expect(settlement.winner_tid).to.equal(team_ids[0])

      await settlement_trx.commit()
    } catch (error) {
      await settlement_trx.rollback().catch(() => {})
      throw error
    }

    // The settlement is only real once it has committed and is visible from
    // outside the transaction that wrote it.
    const rostered = await knex('rosters_players').where({
      lid: league_id,
      season_year,
      pid
    })
    expect(rostered, 'the settlement committed a roster row').to.have.length(1)
  })

  it('resolves the league before the transaction opens, not under the lock', async function () {
    this.timeout(60 * 1000)

    const { pid } = await stage_a_complete_nomination()

    // EXACTLY ONE FREE. `getLeague` takes it and gives it back; the settlement
    // transaction then takes it and holds it for the whole locked region. A
    // `getLeague` moved back inside `run()` would be asking for a second
    // connection with none left -- which is the shape the hoist removed, needing
    // one connection rather than the N the roster reads needed.
    for (let i = 0; i < pool_max() - 1; i++) await hold_one_connection()

    const settlement = await within_ten_seconds(
      // No `league` and no `trx`: the settlement resolves and opens both.
      settle_auction_player_if_complete({ lid: league_id, season_year }),
      'settlement resolving its own league under a drained pool'
    )

    expect(settlement, 'the fixture must actually settle').to.not.equal(null)
    expect(settlement.pid).to.equal(pid)
  })

  // THE RATCHET STAYS, and it is now anchored on the CLASS rather than on
  // `getRoster`.
  //
  // Scoping a guard to the symbol whose absence was noticed first is how the
  // `getLeague` acquisition survived the commit that fixed the `getRoster` one:
  // the old ratchet enumerated `getRoster(` calls, so a pool read through any
  // other helper satisfied it completely. The behavioral cases above cover the
  // two call sites that exist today; this covers the one somebody adds next,
  // which no behavioral spec can see until it is written.
  describe('the locked region names no module-pool client', function () {
    const locked_region_source = () => {
      const source = fs.readFileSync(
        path.join(repo_root, 'libs-server/auction-settlement.mjs'),
        'utf8'
      )

      // From the transaction body to the end of `persist_auction_settlement`,
      // which is everything that runs with the advisory lock held.
      const start = source.indexOf('const run = async (trx) => {')
      const end = source.indexOf('sweep_unnominated_auction_elections')

      expect(
        start,
        'the locked region no longer starts at `const run = async (trx)`; this ' +
          'check cannot locate what it guards and is vacuous until re-anchored'
      ).to.be.greaterThan(-1)
      expect(end, 'the end anchor has gone stale').to.be.greaterThan(start)

      return source.slice(start, end)
    }

    it('issues no query on the module pool', function () {
      // Anchored on the query CALL FORM `db(` rather than the bare token, so
      // the `db_client = db` defaults and the import do not read as violations.
      // The leading class excludes `db_client(`, `trx.db(` and similar.
      const pool_queries = locked_region_source().match(/[^_.\w]db\(/g) || []

      expect(
        pool_queries,
        'every query in the locked region must run on `trx`; a module-pool ' +
          'query here asks for a connection the lock waiters are holding'
      ).to.deep.equal([])
    })

    it('passes a db_client or a trx to every helper it calls', function () {
      const region = locked_region_source()

      // The helpers in this module that reach the database and take a client.
      // Enumerated from the CODE that defines them rather than from the names
      // of the two that have gone wrong so far.
      const client_taking_helpers = [
        'getRoster',
        'getLeague',
        'get_auction_team_capacities',
        'get_team_auction_capacity',
        'get_active_auction_nomination'
      ]

      const unthreaded = []
      for (const helper of client_taking_helpers) {
        const calls =
          region.match(new RegExp(`\\b${helper}\\(\\{[^}]*\\}\\)`, 'g')) || []
        for (const call of calls) {
          if (!call.includes('db_client') && !call.includes('trx')) {
            unthreaded.push(call)
          }
        }
      }

      expect(
        unthreaded,
        'a database helper called under the lock without the lock holder’s ' +
          'own client reads the shared pool and can deadlock against its waiters'
      ).to.deep.equal([])
    })

    it('accepts a db_client in getRoster and uses it for every query', function () {
      const source = fs.readFileSync(
        path.join(repo_root, 'libs-server/get-roster.mjs'),
        'utf8'
      )

      expect(
        source,
        'getRoster must accept a db_client for the settlement path to pass one'
      ).to.include('db_client = db')

      // The mixed-client hazard, which is worse than either client alone: a
      // roster assembled from BOTH the transaction and the pool would combine a
      // pre-write player list with post-write salaries.
      const body = source.slice(source.indexOf('export default async function'))
      const pool_queries = body.match(/[^_.\w]db\(/g) || []
      expect(
        pool_queries,
        'every query inside getRoster must run on db_client, not the module pool'
      ).to.deep.equal([])
    })
  })
})
