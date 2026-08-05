/* global describe before beforeEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import cache from '#api/cache.mjs'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season } from '#constants'
import { user1 } from './fixtures/token.mjs'
import { selectPlayer, addPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chai_http)
const expect = chai.expect
const { regular_season_start } = current_season

// The three players routes attach the authenticated manager's live restricted
// free agency bid to each player row. They are the ONLY producer of that field
// for the SPA: roster rows carry their own `bid` for `libs-shared/roster.mjs`
// cap pricing, and no selector merges it into `player_map`, so every bid the
// client renders arrives through here.
//
// On 2026-08-05 all three broke at once and silently. The `bid` -> `bid_amount`
// column rename (db/adhoc/2026-08-04-conform-shorthand-tail.sql) left them
// reading `b.bid` off the row -- a column that no longer exists, so the value
// was `undefined` rather than an error -- and emitting it under the pre-rename
// key `bid` while the SPA had been renamed to read `bid_amount`. Every manager's
// bid rendered as $0/blank for roughly thirteen hours and several re-entered
// bids they could still see in the database, creating duplicate rows.
//
// Nothing failed. No route 500'd, no query threw 42703, and the full suite
// stayed green, because no spec had ever asserted the shape of these three
// responses. That absence is the defect this file closes: the assertion is on
// the KEY as much as the value, since reading the right column and emitting it
// under the wrong name is the half of the break that a server-side grep for the
// old column name cannot find.
describe('API /players - restricted free agency bid_amount', function () {
  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    await league(knex)

    // All three routes memoize the player LIST in the module-level `#api/cache.mjs`
    // singleton, keyed only by league (and team), with the manager's bids merged
    // in fresh afterwards. Each test rosters a different randomly chosen player,
    // so without this the second test reads the first test's one-player list and
    // fails as "player missing from response" -- which looks like a bid defect
    // and is really cache bleed.
    for (const key of cache.keys()) {
      cache.del(key)
    }
  })

  const place_bid = async ({ bid }) => {
    MockDate.set(regular_season_start.subtract('2', 'month').toISOString())

    const player = await selectPlayer()
    const leagueId = 1
    const teamId = 1
    const userId = 1

    await addPlayer({ leagueId, player, teamId, userId })

    const res = await chai_request
      .execute(server)
      .post('/api/teams/1/tag/restricted-free-agency')
      .set('Authorization', `Bearer ${user1}`)
      .send({ leagueId, bid, pid: player.pid, playerTid: teamId })

    res.should.have.status(200)

    return player
  }

  it('GET /leagues/:leagueId/players returns the bid under bid_amount', async () => {
    const bid = 17
    const player = await place_bid({ bid })

    const res = await chai_request
      .execute(server)
      .get('/api/leagues/1/players')
      .set('Authorization', `Bearer ${user1}`)

    res.should.have.status(200)

    const row = res.body.find((p) => p.pid === player.pid)
    expect(row, 'bid player missing from response').to.exist
    expect(row).to.have.property('bid_amount', bid)
    expect(row).to.not.have.property('bid')
  })

  it('GET /teams/:teamId/players returns the bid under bid_amount', async () => {
    const bid = 23
    const player = await place_bid({ bid })

    const res = await chai_request
      .execute(server)
      .get('/api/teams/1/players?leagueId=1')
      .set('Authorization', `Bearer ${user1}`)

    res.should.have.status(200)

    const row = res.body.find((p) => p.pid === player.pid)
    expect(row, 'bid player missing from response').to.exist
    expect(row).to.have.property('bid_amount', bid)
    expect(row).to.not.have.property('bid')
  })

  it('POST /players returns the bid under bid_amount', async () => {
    const bid = 31
    const player = await place_bid({ bid })

    const res = await chai_request
      .execute(server)
      .post('/api/players')
      .set('Authorization', `Bearer ${user1}`)
      .send({ leagueId: 1, pids: [player.pid] })

    res.should.have.status(200)

    const row = res.body.find((p) => p.pid === player.pid)
    expect(row, 'bid player missing from response').to.exist
    expect(row).to.have.property('bid_amount', bid)
    expect(row).to.not.have.property('bid')
  })

  // `??`, not `||`, at every merge site. A $0 bid is a real bid and a falsiness
  // coalesce strips it from the payload, which the client then reads as an unbid
  // player and prices at the prior salary through `getExtensionAmount`.
  it('preserves a $0 bid rather than dropping it as falsy', async () => {
    const player = await place_bid({ bid: 0 })

    const res = await chai_request
      .execute(server)
      .get('/api/leagues/1/players')
      .set('Authorization', `Bearer ${user1}`)

    res.should.have.status(200)

    const row = res.body.find((p) => p.pid === player.pid)
    expect(row, 'bid player missing from response').to.exist
    expect(row).to.have.property('bid_amount', 0)
  })
})
