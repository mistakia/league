/* global describe before after beforeEach afterEach it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'
import WebSocket from 'ws'

import server from '#api'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season } from '#constants'
import { submit_auction_election } from '#libs-server/auction-elections.mjs'
import { nominate_free_agent_running_back } from './utils/nominate-auction-player.mjs'
import { count_roster_reads } from './utils/count-roster-reads.mjs'
import { user2 } from './fixtures/token.mjs'

process.env.NODE_ENV = 'test'
chai.use(chai_http)
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// IN ELECTION MODE THE SOCKET IS NOT THE WRITER, and this is the spec that
// holds the write path to that.
//
// Managers elect over REST and settlement fires from the election write path, so
// every effect a connected client depends on has to be broadcast from there.
// Before this, the route broadcast two message types no reducer handled plus a
// bare AUCTION_PROCESSED, and three things a manager can see went wrong on the
// ONE path the 2026 auction takes:
//
// - The outstanding list never shrank. Nine managers elect one at a time and
//   every client watched the list as it stood at nomination for the whole time.
//   That display IS the design's only forcing function.
// - The nomination turn never advanced. `auction-targets` gates the nominate
//   button on `nominating_team_id === app.teamId`, so the team whose turn it now
//   was had no control to act with until a page reload. Nomination is manual and
//   is the design's identified bottleneck, so this stalled the auction after
//   every sale.
// - No Discord message went out on any settlement.
//
// It drives a REAL `ws` client against the running server rather than stubbing
// the broadcast, because the claim under test is that an ALREADY-LOADED page
// updates. Anything that re-reads state cannot distinguish a working broadcast
// from a page reload, which is the shape of false green this plan keeps hitting.
describe('auction election broadcasts', function () {
  let port
  let opened_listener = false

  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()

    // The suite already has this server listening, and listening twice throws.
    // Reuse the live port rather than opening a second one.
    if (!server.listening) {
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
      opened_listener = true
    }
    port = server.address().port
  })

  after(function () {
    if (opened_listener) server.close()
  })

  afterEach(function () {
    MockDate.reset()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    MockDate.set(
      current_season.regular_season_start.subtract('1', 'month').toISOString()
    )
    await league(knex)

    // The elections write path refuses outside the free agency period, and the
    // shared league fixture configures none.
    await knex('seasons')
      .where({ lid: league_id, season_year })
      .update({
        free_agency_period_start: current_season.regular_season_start
          .subtract(2, 'months')
          .toDate(),
        free_agency_period_end: current_season.regular_season_start.toDate()
      })
  })

  // Collects every message the league's clients receive, so an assertion can ask
  // what arrived rather than racing one specific message.
  const open_client = () =>
    new Promise((resolve, reject) => {
      const socket = new WebSocket(
        `ws://127.0.0.1:${port}/?league_id=${league_id}`
      )
      const received = []
      socket.on('message', (data) => received.push(JSON.parse(data)))
      socket.on('error', reject)
      socket.on('open', () => resolve({ socket, received }))
    })

  // COUNTED ATTEMPTS, NOT A `Date.now()` DEADLINE. `MockDate` freezes the clock
  // for this whole describe block, so a `Date.now() + 5000` bound never expires:
  // a message that never arrives spins here until mocha's own timeout fires,
  // which reports a HANG rather than the missing broadcast and takes a minute to
  // say it. Harmless while every message arrives, and exactly wrong on the day
  // one stops -- the failure mode the assertions exist to name. The bound has to
  // survive a stopped clock.
  const POLL_INTERVAL_MS = 25
  const await_message = async (received, type, attempts = 200) => {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const message = received.find((entry) => entry.type === type)
      if (message) return message
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }
    return null
  }

  const team_ids = async () => {
    const teams = await knex('teams')
      .where({ lid: league_id, season_year })
      .orderBy('draft_order')
    return teams.map((team) => team.team_id)
  }

  // A free agent nobody holds, opened at $0 so that every team with an open
  // active spot is eligible regardless of budget -- the draft fixture leaves
  // teams over the cap, and a priced nomination would disqualify them all before
  // the broadcast under test ever ran.
  const nominate_free_agent = ({ tid, maximum_bid = null }) =>
    nominate_free_agent_running_back({ lid: league_id, tid, maximum_bid })

  // Drives the REAL ROUTE rather than the library function, because the defect
  // being closed is a MISSING CALL in the route. A spec against
  // `submit_auction_election` alone stays green with the handler unwired.
  const elect_over_rest = ({ teamId, pid, maximum_bid = null, token }) =>
    chai_request
      .execute(server)
      .post(`/api/leagues/${league_id}/auction-elections`)
      .set('Authorization', `Bearer ${token}`)
      .send({ teamId, pid, maximum_bid, leagueId: league_id })

  it('re-broadcasts the outstanding set when an election does not settle', async function () {
    this.timeout(60 * 1000)

    const pid = await nominate_free_agent({ tid: 1 })
    const { socket, received } = await open_client()

    try {
      const res = await elect_over_rest({ teamId: 2, pid, token: user2 })
      expect(res.status, JSON.stringify(res.body)).to.equal(200)

      // The input has to leave the set INCOMPLETE, or a settlement broadcast
      // would satisfy the assertion for the wrong reason and the spec could not
      // tell a working status broadcast from a working settlement one.
      expect(res.body.settlement, 'this election must not settle').to.not.exist

      const message = await await_message(received, 'AUCTION_SETTLEMENT_STATUS')
      expect(message, 'AUCTION_SETTLEMENT_STATUS on the wire').to.exist

      const outstanding = message.payload.outstanding_election_tids
      expect(outstanding).to.not.include(2)
      expect(outstanding.length).to.be.at.least(1)
    } finally {
      socket.close()
    }
  })

  it('answers a non-settling election with ONE capacity sweep, not two', async function () {
    this.timeout(60 * 1000)

    const pid = await nominate_free_agent({ tid: 1 })
    const { socket, received } = await open_client()

    try {
      // COUNTED ACROSS THE BROADCAST, NOT ACROSS THE REQUEST. The route calls
      // `res.send` and only THEN awaits the status broadcast, so the response
      // resolving means the second sweep has not run yet -- a counter that stops
      // there reports one sweep whatever the route does, which is how the first
      // version of this case passed against its own control.
      //
      // The wait is what makes the window right: the broadcast is the last thing
      // the handler does, so a message on the wire means every query it issues
      // has been issued.
      const { result, reads } = await count_roster_reads(async () => {
        const res = await elect_over_rest({ teamId: 2, pid, token: user2 })
        const message = await await_message(
          received,
          'AUCTION_SETTLEMENT_STATUS'
        )
        return { res, message }
      })

      expect(result.res.status, JSON.stringify(result.res.body)).to.equal(200)
      expect(result.res.body.settlement, 'this election must not settle').to.not
        .exist
      expect(result.message, 'the status broadcast must have gone out').to.exist

      // THE ROUTE, not the library, because the thing asserted is a hand-wired
      // argument in the handler. `submit_auction_election` returns the
      // outstanding set it computed under the lock and the route passes it on;
      // forget that argument and `broadcast_auction_settlement_status`
      // recomputes, which is a full roster sweep producing exactly the same
      // broadcast. The wiring FAILS SOFT, so nothing about the response or the
      // message can see it.
      expect(reads.length, 'the request must read some rosters').to.be.above(0)

      // Two sweeps overlap on every team that has not elected -- a non-empty set
      // precisely because this did not settle -- so a recompute shows up as a
      // team whose roster was read twice inside one request.
      const read_twice = reads.filter(
        (tid, index) => reads.indexOf(tid) !== index
      )
      expect(
        read_twice,
        'no team may have its roster read twice for one election: a second read ' +
          'means the outstanding set was recomputed rather than threaded through'
      ).to.deep.equal([])
    } finally {
      socket.close()
    }
  })

  it('advances the nomination turn on the wire when an election settles', async function () {
    this.timeout(60 * 1000)

    const tids = await team_ids()
    const pid = await nominate_free_agent({ tid: 1, maximum_bid: 0 })

    // Every team but the nominator and team 2 declines up front, so the one
    // election driven over the route is the one that completes the set.
    for (const tid of tids) {
      if (tid === 1 || tid === 2) continue
      await submit_auction_election({
        lid: league_id,
        tid,
        pid,
        user_id: 1,
        maximum_bid: null
      })
    }

    const { socket, received } = await open_client()

    try {
      const res = await elect_over_rest({ teamId: 2, pid, token: user2 })
      expect(res.status, JSON.stringify(res.body)).to.equal(200)
      expect(res.body.settlement, 'the last election must settle').to.exist

      const processed = await await_message(received, 'AUCTION_PROCESSED')
      expect(processed, 'AUCTION_PROCESSED on the wire').to.exist
      expect(processed.payload.pid).to.equal(pid)

      // THE ASSERTION THIS SPEC EXISTS FOR. A settlement that announces the sale
      // and not the advanced turn leaves the next team on the clock with no
      // nominate button, which is the auction stalling rather than a cosmetic
      // staleness.
      const info = await await_message(received, 'AUCTION_NOMINATION_INFO')
      expect(info, 'AUCTION_NOMINATION_INFO on the wire').to.exist
      expect(info.payload.nominating_team_id).to.not.equal(1)
      expect(tids).to.include(info.payload.nominating_team_id)
    } finally {
      socket.close()
    }
  })
})
