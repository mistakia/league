/* global describe before beforeEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season, restricted_free_agency_bid_outcomes } from '#constants'
import { user1 } from './fixtures/token.mjs'
import { selectPlayer } from './utils/index.mjs'
import {
  insert_restricted_free_agency_bid,
  insert_restricted_free_agency_nomination
} from './utils/insert-restricted-free-agency-bid.mjs'

process.env.NODE_ENV = 'test'
chai.should()
chai.use(chai_http)
const expect = chai.expect
const { regular_season_start } = current_season

const league_id = 1

describe('API /leagues/:leagueId/restricted-free-agency', function () {
  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    await league(knex)
  })

  const resolve_auction = async ({ pid, original_team_id, winning_bid_id }) => {
    const processed = Math.round(Date.now() / 1000)
    await knex('restricted_free_agency_nominations')
      .where({
        league_id,
        player_id: pid,
        season_year: current_season.year,
        original_team_id
      })
      .update({
        processed_at: knex.raw('to_timestamp(?)', [processed]),
        winning_bid_id
      })
    return processed
  }

  it('returns a completed auction with every bid and its outcome', async () => {
    const player = await selectPlayer()
    const original_team_id = 1
    const processed = Math.round(Date.now() / 1000)

    const winning_uid = await insert_restricted_free_agency_bid({
      pid: player.pid,
      lid: league_id,
      tid: 2,
      bid: 30,
      original_team_id,
      announced_at: processed - 3600,
      processed,
      succ: true,
      outcome: restricted_free_agency_bid_outcomes.WON
    })

    await insert_restricted_free_agency_bid({
      pid: player.pid,
      lid: league_id,
      tid: 3,
      bid: 12,
      original_team_id,
      processed,
      succ: false,
      outcome: restricted_free_agency_bid_outcomes.OUTBID
    })

    await resolve_auction({
      pid: player.pid,
      original_team_id,
      winning_bid_id: winning_uid
    })

    const res = await chai_request
      .execute(server)
      .get(`/api/leagues/${league_id}/restricted-free-agency`)
      .query({ year: current_season.year })

    res.should.have.status(200)
    res.body.should.be.an('array')
    expect(res.body.length).to.equal(1)

    const auction = res.body[0]
    expect(auction.pid).to.equal(player.pid)
    expect(auction.original_team_id).to.equal(original_team_id)
    expect(auction.winning_bid_id).to.equal(winning_uid)
    expect(auction.bids.length).to.equal(2)

    // sorted high to low, so the winner leads
    expect(auction.bids[0].bid).to.equal(30)
    expect(auction.bids[0].outcome).to.equal(
      restricted_free_agency_bid_outcomes.WON
    )
    expect(auction.bids[1].bid).to.equal(12)
    expect(auction.bids[1].outcome).to.equal(
      restricted_free_agency_bid_outcomes.OUTBID
    )
  })

  it('discloses competing bid amounts and bidders once the auction is resolved', async () => {
    // Full disclosure is the point of the history. This asserts the amounts are
    // present rather than redacted, which is the opposite of the live-auction
    // rule and so is worth pinning explicitly.
    const player = await selectPlayer()
    const original_team_id = 1
    const processed = Math.round(Date.now() / 1000)

    const winning_uid = await insert_restricted_free_agency_bid({
      pid: player.pid,
      lid: league_id,
      tid: original_team_id,
      bid: 40,
      original_team_id,
      announced_at: processed - 3600,
      processed,
      succ: true,
      outcome: restricted_free_agency_bid_outcomes.WON
    })

    await insert_restricted_free_agency_bid({
      pid: player.pid,
      lid: league_id,
      tid: 4,
      bid: 38,
      original_team_id,
      processed,
      succ: false,
      outcome: restricted_free_agency_bid_outcomes.MATCHED
    })

    await resolve_auction({
      pid: player.pid,
      original_team_id,
      winning_bid_id: winning_uid
    })

    const res = await chai_request
      .execute(server)
      .get(`/api/leagues/${league_id}/restricted-free-agency`)

    res.should.have.status(200)
    const losing_bid = res.body[0].bids.find((b) => b.tid === 4)
    expect(losing_bid.bid).to.equal(38)
    expect(losing_bid.outcome).to.equal(
      restricted_free_agency_bid_outcomes.MATCHED
    )
  })

  const insert_release = async ({ bid_id, pid }) =>
    knex('restricted_free_agency_releases').insert({
      restricted_free_agency_bid_id: bid_id,
      pid
    })

  // Three bids on one auction: the winner, the caller's own losing bid, and a
  // rival's losing bid, each with a release of its own. Returned so a test can
  // assert on all three from a single response.
  const seed_auction_with_releases = async () => {
    const player = await selectPlayer()
    const exclude_pids = [player.pid]
    const winner_release = await selectPlayer({ exclude_pids })
    exclude_pids.push(winner_release.pid)
    const own_release = await selectPlayer({ exclude_pids })
    exclude_pids.push(own_release.pid)
    const rival_release = await selectPlayer({ exclude_pids })

    const original_team_id = 1
    const processed = Math.round(Date.now() / 1000)

    const winning_uid = await insert_restricted_free_agency_bid({
      pid: player.pid,
      lid: league_id,
      tid: 2,
      bid: 30,
      original_team_id,
      announced_at: processed - 3600,
      processed,
      succ: true,
      outcome: restricted_free_agency_bid_outcomes.WON
    })

    // team 1 belongs to user1 in the league fixture
    const own_uid = await insert_restricted_free_agency_bid({
      pid: player.pid,
      lid: league_id,
      tid: original_team_id,
      bid: 20,
      original_team_id,
      processed,
      succ: false,
      outcome: restricted_free_agency_bid_outcomes.OUTBID
    })

    const rival_uid = await insert_restricted_free_agency_bid({
      pid: player.pid,
      lid: league_id,
      tid: 3,
      bid: 12,
      original_team_id,
      processed,
      succ: false,
      outcome: restricted_free_agency_bid_outcomes.OUTBID
    })

    await insert_release({ bid_id: winning_uid, pid: winner_release.pid })
    await insert_release({ bid_id: own_uid, pid: own_release.pid })
    await insert_release({ bid_id: rival_uid, pid: rival_release.pid })

    await resolve_auction({
      pid: player.pid,
      original_team_id,
      winning_bid_id: winning_uid
    })

    return { winner_release, own_release, rival_release }
  }

  it('returns the winning bid releases and withholds every losing one', async () => {
    // A losing bid's releases never happened -- they name the players that team
    // was willing to cut, which is live strategy rather than history.
    const { winner_release } = await seed_auction_with_releases()

    const res = await chai_request
      .execute(server)
      .get(`/api/leagues/${league_id}/restricted-free-agency`)

    res.should.have.status(200)
    const bids = res.body[0].bids
    expect(bids.find((b) => b.tid === 2).releases).to.eql([winner_release.pid])
    expect(bids.find((b) => b.tid === 1).releases).to.eql([])
    expect(bids.find((b) => b.tid === 3).releases).to.eql([])
  })

  it('returns the caller own losing bid releases', async () => {
    const { winner_release, own_release } = await seed_auction_with_releases()

    const res = await chai_request
      .execute(server)
      .get(`/api/leagues/${league_id}/restricted-free-agency`)
      .set('Authorization', `Bearer ${user1}`)

    res.should.have.status(200)
    const bids = res.body[0].bids
    expect(bids.find((b) => b.tid === 2).releases).to.eql([winner_release.pid])
    expect(bids.find((b) => b.tid === 1).releases).to.eql([own_release.pid])
    expect(bids.find((b) => b.tid === 3).releases).to.eql([])
  })

  it('omits an auction that has not been processed', async () => {
    // The gate is the nomination's processing timestamp, so a live sealed-bid
    // auction is structurally absent rather than filtered per caller.
    const player = await selectPlayer()

    await insert_restricted_free_agency_bid({
      pid: player.pid,
      lid: league_id,
      tid: 2,
      bid: 25,
      original_team_id: 1,
      announced_at: Math.round(Date.now() / 1000) - 3600
    })

    const res = await chai_request
      .execute(server)
      .get(`/api/leagues/${league_id}/restricted-free-agency`)

    res.should.have.status(200)
    expect(res.body.length).to.equal(0)
  })

  it('omits cancelled bids from a completed auction', async () => {
    const player = await selectPlayer()
    const original_team_id = 1
    const processed = Math.round(Date.now() / 1000)

    const winning_uid = await insert_restricted_free_agency_bid({
      pid: player.pid,
      lid: league_id,
      tid: original_team_id,
      bid: 20,
      original_team_id,
      announced_at: processed - 3600,
      processed,
      succ: true,
      outcome: restricted_free_agency_bid_outcomes.WON
    })

    await insert_restricted_free_agency_bid({
      pid: player.pid,
      lid: league_id,
      tid: 5,
      bid: 18,
      original_team_id,
      cancelled: processed - 100
    })

    await resolve_auction({
      pid: player.pid,
      original_team_id,
      winning_bid_id: winning_uid
    })

    const res = await chai_request
      .execute(server)
      .get(`/api/leagues/${league_id}/restricted-free-agency`)

    res.should.have.status(200)
    expect(res.body[0].bids.length).to.equal(1)
    expect(res.body[0].bids[0].tid).to.equal(original_team_id)
  })

  it('scopes to the requested season', async () => {
    const player = await selectPlayer()
    const original_team_id = 1
    const processed = Math.round(Date.now() / 1000)

    await insert_restricted_free_agency_bid({
      pid: player.pid,
      lid: league_id,
      tid: original_team_id,
      bid: 20,
      original_team_id,
      processed,
      succ: true,
      outcome: restricted_free_agency_bid_outcomes.WON
    })

    await knex('restricted_free_agency_nominations')
      .where({ league_id, player_id: player.pid })
      .update({ processed_at: knex.raw('to_timestamp(?)', [processed]) })

    const res = await chai_request
      .execute(server)
      .get(`/api/leagues/${league_id}/restricted-free-agency`)
      .query({ year: current_season.year - 1 })

    res.should.have.status(200)
    expect(res.body.length).to.equal(0)
  })

  it('rejects a non-numeric year', async () => {
    const res = await chai_request
      .execute(server)
      .get(`/api/leagues/${league_id}/restricted-free-agency`)
      .query({ year: 'notayear' })

    res.should.have.status(400)
    res.body.error.should.equal('invalid year')
  })

  it('returns an empty array for a league with no auctions', async () => {
    // Guards the nomination-id IN clause against being handed an empty list.
    await insert_restricted_free_agency_nomination({
      pid: 'NOSU-CHPL-000000',
      lid: 2,
      original_team_id: 1
    })

    const res = await chai_request
      .execute(server)
      .get(`/api/leagues/${league_id}/restricted-free-agency`)

    res.should.have.status(200)
    expect(res.body.length).to.equal(0)
  })
})
