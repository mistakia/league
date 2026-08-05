/* global describe before beforeEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import cache from '#api/cache.mjs'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season } from '#constants'
import { user1, user2 } from './fixtures/token.mjs'
import { selectPlayer, addPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chai_http)
const expect = chai.expect
const { regular_season_start } = current_season

// Companion to players.restricted-free-agency-bid-amount.spec.mjs, which pins the
// `bid_amount` contract alone. This file covers the rest of what the three players
// routes uniquely decide: WHOSE bids a response carries, and whether the two
// duplicated copies of that decision agree.
//
// Scope is deliberately not a field-by-field snapshot of the player payload. The
// fields worth pinning are the ones that fail SILENTLY -- a bid attached to the
// wrong viewer is a 200 with plausible JSON, exactly like the 2026-08-05 break
// that shipped under a fully green suite.
describe('API /players - bid visibility across the three players routes', function () {
  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    await league(knex)

    // All three routes memoize the player LIST in the module-level
    // `#api/cache.mjs` singleton, so without this a test reads the previous
    // test's list and fails as "player missing from response" -- cache bleed
    // wearing the costume of a bid defect. Same hazard the sibling spec
    // documents; it is a property of the routes, not of either file.
    for (const key of cache.keys()) {
      cache.del(key)
    }
  })

  // Places a restricted free agency bid for `teamId` through the real route, so
  // the row under test is one the write path actually produces. Returns the
  // tagged player, plus any player rostered purely to be a conditional release.
  const place_bid = async ({ bid, teamId, token, release = [] }) => {
    MockDate.set(regular_season_start.subtract('2', 'month').toISOString())

    const leagueId = 1
    const player = await selectPlayer()
    await addPlayer({ leagueId, player, teamId, userId: teamId })

    const release_players = []
    for (let i = 0; i < release.length; i++) {
      const release_player = await selectPlayer()
      await addPlayer({
        leagueId,
        player: release_player,
        teamId,
        userId: teamId
      })
      release_players.push(release_player)
    }

    const res = await chai_request
      .execute(server)
      .post(`/api/teams/${teamId}/tag/restricted-free-agency`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        leagueId,
        bid,
        pid: player.pid,
        playerTid: teamId,
        release: release_players.map((p) => p.pid)
      })

    res.should.have.status(200)

    return { player, release_players }
  }

  describe('GET /leagues/:leagueId/players', function () {
    it('omits bid fields entirely for an unauthenticated caller', async () => {
      // The route is public (it mounts above the blanket auth guard), so an
      // anonymous caller must get the player list and none of the viewer-scoped
      // bid state. A leak here is a 200 with correct-looking JSON.
      const { player } = await place_bid({
        bid: 11,
        teamId: 1,
        token: user1
      })

      const res = await chai_request
        .execute(server)
        .get('/api/leagues/1/players')

      res.should.have.status(200)
      res.body.should.be.an('array')

      const row = res.body.find((p) => p.pid === player.pid)
      expect(row, 'bid player missing from response').to.exist
      expect(row).to.not.have.property('bid_amount')
      expect(row).to.not.have.property(
        'restricted_free_agency_conditional_releases'
      )
    })

    it('does not show a rival team bid to another manager', async () => {
      // getRestrictedFreeAgencyBids resolves userId -> that user's team in the
      // league and returns only that team's bids. If the scoping regressed, every
      // manager would see every rival's bid amount -- which is the whole auction.
      const { player } = await place_bid({ bid: 13, teamId: 1, token: user1 })

      const res = await chai_request
        .execute(server)
        .get('/api/leagues/1/players')
        .set('Authorization', `Bearer ${user2}`)

      res.should.have.status(200)

      const row = res.body.find((p) => p.pid === player.pid)
      expect(row, 'bid player missing from response').to.exist
      expect(row.bid_amount, 'rival bid leaked to another manager').to.be
        .undefined
    })

    it('returns conditional releases alongside the bid', async () => {
      // The other field these routes uniquely produce. The RFA dialog iterates it,
      // and a reducer clearing it to an explicit null has already crashed that
      // page once, so the shape is worth pinning rather than just the amount.
      const { player, release_players } = await place_bid({
        bid: 17,
        teamId: 1,
        token: user1,
        release: [1]
      })

      const res = await chai_request
        .execute(server)
        .get('/api/leagues/1/players')
        .set('Authorization', `Bearer ${user1}`)

      res.should.have.status(200)

      const row = res.body.find((p) => p.pid === player.pid)
      expect(row, 'bid player missing from response').to.exist
      expect(row).to.have.property('bid_amount', 17)
      expect(row.restricted_free_agency_conditional_releases).to.be.an('array')
      expect(row.restricted_free_agency_conditional_releases).to.include(
        release_players[0].pid
      )
    })
  })

  describe('GET /teams/:teamId/players', function () {
    it('withholds bids from a caller who does not manage the team', async () => {
      // This route gates the bid merge on a users_teams lookup, which its sibling
      // league route has no equivalent of. user2 manages team 2, so asking for
      // team 1's roster must return players with no bid state attached.
      const { player } = await place_bid({ bid: 19, teamId: 1, token: user1 })

      const res = await chai_request
        .execute(server)
        .get('/api/teams/1/players?leagueId=1')
        .set('Authorization', `Bearer ${user2}`)

      res.should.have.status(200)

      const row = res.body.find((p) => p.pid === player.pid)
      expect(row, 'bid player missing from response').to.exist
      expect(row.bid_amount, 'bid shown to a non-manager').to.be.undefined
    })

    it('returns the same bid state on a warm cache as on a cold one', async () => {
      // The bid merge is written TWICE in this route -- once in the cache-hit
      // branch and once in the cache-miss branch -- so a fix applied to one copy
      // and not the other is invisible on a single request. That is precisely the
      // 2026-08-05 shape: correct on the path the author exercised, silently wrong
      // on the other. Both branches must produce the same row.
      const { player, release_players } = await place_bid({
        bid: 23,
        teamId: 1,
        token: user1,
        release: [1]
      })

      const request_team_players = async () => {
        const res = await chai_request
          .execute(server)
          .get('/api/teams/1/players?leagueId=1')
          .set('Authorization', `Bearer ${user1}`)

        res.should.have.status(200)
        return res.body.find((p) => p.pid === player.pid)
      }

      const cold = await request_team_players()
      const warm = await request_team_players()

      expect(cold, 'bid player missing from cold response').to.exist
      expect(warm, 'bid player missing from warm response').to.exist

      expect(cold).to.have.property('bid_amount', 23)
      expect(warm).to.have.property(
        'bid_amount',
        cold.bid_amount,
        'cached branch disagrees with uncached branch on bid_amount'
      )
      expect(
        warm.restricted_free_agency_conditional_releases,
        'cached branch disagrees with uncached branch on conditional releases'
      ).to.deep.equal(cold.restricted_free_agency_conditional_releases)
      expect(cold.restricted_free_agency_conditional_releases).to.include(
        release_players[0].pid
      )
    })
  })

  describe('POST /players', function () {
    it('returns only the requested pids', async () => {
      // `pids` is normalized from either a scalar or an array, and it also decides
      // whether the response is cached at all -- a pid-filtered request must never
      // populate the unfiltered cache entry that every other caller reads.
      const { player } = await place_bid({ bid: 29, teamId: 1, token: user1 })

      const res = await chai_request
        .execute(server)
        .post('/api/players')
        .set('Authorization', `Bearer ${user1}`)
        .send({ leagueId: 1, pids: [player.pid] })

      res.should.have.status(200)
      res.body.should.be.an('array')
      res.body.should.have.length(1)
      res.body[0].should.have.property('pid', player.pid)
    })

    it('accepts a scalar pid as well as an array', async () => {
      const { player } = await place_bid({ bid: 31, teamId: 1, token: user1 })

      const res = await chai_request
        .execute(server)
        .post('/api/players')
        .set('Authorization', `Bearer ${user1}`)
        .send({ leagueId: 1, pids: player.pid })

      res.should.have.status(200)
      res.body.should.be.an('array')
      res.body.should.have.length(1)
      res.body[0].should.have.property('pid', player.pid)
    })

    it('does not show a rival team bid to another manager', async () => {
      const { player } = await place_bid({ bid: 37, teamId: 1, token: user1 })

      const res = await chai_request
        .execute(server)
        .post('/api/players')
        .set('Authorization', `Bearer ${user2}`)
        .send({ leagueId: 1, pids: [player.pid] })

      res.should.have.status(200)

      const row = res.body.find((p) => p.pid === player.pid)
      expect(row, 'bid player missing from response').to.exist
      expect(row.bid_amount, 'rival bid leaked to another manager').to.be
        .undefined
    })
  })
})
