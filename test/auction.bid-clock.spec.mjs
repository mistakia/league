/* global describe before beforeEach afterEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import config from '#config'
import { current_season } from '#constants'
import Auction from '#api/sockets/auction.mjs'
import { auction_reducer } from '@core/auction/reducer'
import { auction_actions } from '@core/auction/actions'
import { submit_auction_election } from '#libs-server/auction-elections.mjs'
import { selectPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// THE BID CLOCK IS NOW OBSERVABLE FROM A CLIENT, AND IT DID NOT USED TO BE.
//
// "A proxy step does not reset the bid clock" is the property that keeps a full
// final block tractable, and it was asserted server-side only -- the end-to-end
// script reported it NOT DRIVABLE, because no broadcast carried an expiry and
// nothing a client received could distinguish a reset clock from an unreset one.
//
// The client did not merely fail to observe it. It rebuilt the countdown from a
// DURATION on every AUCTION_BID, so a proxy step -- which broadcasts a bid and
// deliberately does not reset the clock -- put a fresh countdown on screen while
// the sale was seconds away. A manager watching that clock, deciding they had
// time to answer a ceiling they cannot see, loses the player. And a client that
// RECONNECTED mid-block got no countdown at all, because `AUCTION_INIT` carried
// durations and no expiry.
//
// The server now owns the clock and says when it expires.
describe('auction bid clock on the wire', function () {
  let now
  let auction
  let broadcasts

  const build_timers = () => ({
    set_timeout: (fn, ms, name) => ({ fn, ms, name }),
    clear_timeout: () => {}
  })

  const timer_messages = () =>
    broadcasts.filter((message) => message.type === 'AUCTION_TIMER')

  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  afterEach(function () {
    if (auction) auction.stop()
    auction = null
    MockDate.reset()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    now = current_season.regular_season_start.subtract(1, 'month')
    MockDate.set(now.toISOString())
    await league(knex)

    await knex('seasons')
      .where({ lid: league_id, season_year })
      .update({
        free_agency_period_start: now.subtract(1, 'hour').toDate(),
        free_agency_period_end: now.add(5, 'day').toDate(),
        auction_block_notice_minutes: 60,
        is_auction_election_mode_enabled: true
      })

    await knex('transactions').where({ lid: league_id }).update({
      player_salary: 0
    })

    await knex('auction_blocks').insert({
      lid: league_id,
      season_year,
      block_at: now.subtract(5, 'minute').toDate(),
      end_at: now.add(2, 'hour').toDate(),
      finalized_at: now.subtract(1, 'hour').toDate(),
      eligible_team_count: 10
    })

    broadcasts = []
    auction = new Auction({
      wss: { clients: [] },
      lid: league_id,
      timers: build_timers()
    })
    auction.broadcast = (message) => broadcasts.push(message)
    await auction.setup()
  })

  const team_ids = async () => {
    const teams = await knex('teams')
      .where({ lid: league_id, season_year })
      .orderBy('draft_order')
    return teams.map((team) => team.team_id)
  }

  it('announces the expiry when a human bid arms the clock', async function () {
    this.timeout(60 * 1000)
    const tids = await team_ids()
    const player = await selectPlayer({
      exclude_rostered_players: true,
      random: false
    })

    await auction.nominate(
      { pid: player.pid, value: 0 },
      { user_id: 1, tid: tids[0] }
    )

    const announced = timer_messages()
    expect(
      announced.length,
      'the nomination armed and announced a clock'
    ).to.be.at.least(1)

    const latest = announced[announced.length - 1].payload.timer_expires_at
    expect(latest, 'an instant, not a duration').to.be.a('number')
    expect(latest, 'in the future by about the padded bid clock').to.be.closeTo(
      Math.round((Date.now() + config.bidTimer + 1000) / 1000),
      2
    )
  })

  it('does not move the expiry on a proxy step', async function () {
    this.timeout(60 * 1000)
    const tids = await team_ids()
    const [nominator, ceiling_team, rival] = tids
    const player = await selectPlayer({
      exclude_rostered_players: true,
      random: false
    })

    await submit_auction_election({
      lid: league_id,
      tid: ceiling_team,
      pid: player.pid,
      user_id: 1,
      maximum_bid: 30
    })

    await auction.nominate(
      { pid: player.pid, value: 0 },
      { user_id: 1, tid: nominator }
    )

    const after_nomination = timer_messages().length

    // A HUMAN BID, which resets the clock, and the engine's answer to it, which
    // must not. Both broadcast an AUCTION_BID; only one is a clock event.
    await auction.bid(
      { pid: player.pid, value: 10 },
      { user_id: 1, tid: rival }
    )

    const bids_broadcast = broadcasts.filter(
      (message) => message.type === 'AUCTION_BID'
    ).length
    expect(
      bids_broadcast,
      'the human bid AND the proxy answer went out'
    ).to.be.at.least(2)

    // THE ASSERTION THIS SPEC EXISTS FOR. Exactly one further clock event, from
    // the human bid. Rebuilding the countdown from AUCTION_BID would have
    // produced two, and the second would have handed the manager a full clock
    // they do not have.
    expect(timer_messages().length - after_nomination).to.equal(1)
  })

  it('clears the clock when the auction pauses', async function () {
    this.timeout(60 * 1000)
    const tids = await team_ids()
    const player = await selectPlayer({
      exclude_rostered_players: true,
      random: false
    })
    await auction.nominate(
      { pid: player.pid, value: 0 },
      { user_id: 1, tid: tids[0] }
    )

    auction.pause()

    const latest = timer_messages().pop()
    expect(latest.payload.timer_expires_at, 'no clock while paused').to.equal(
      null
    )
  })

  it('carries the expiry on AUCTION_INIT, for a client joining mid-block', async function () {
    this.timeout(60 * 1000)
    const tids = await team_ids()
    const player = await selectPlayer({
      exclude_rostered_players: true,
      random: false
    })
    await auction.nominate(
      { pid: player.pid, value: 0 },
      { user_id: 1, tid: tids[0] }
    )

    broadcasts = []
    await auction._send_auction_init(1)

    const init = broadcasts.find((message) => message.type === 'AUCTION_INIT')
    // A RECONNECTING CLIENT GOT NOTHING HERE. The payload carried `bidTimer` and
    // `nominationTimer`, which are durations, and the reducer set no countdown
    // from either -- so a manager who dropped mid-block came back to a board
    // with no clock on it at all.
    expect(
      init.payload.timer_expires_at,
      'the instant, not the duration'
    ).to.be.a('number')
  })

  describe('the reducer', function () {
    const apply = (state, type, payload) =>
      auction_reducer(state, { type, payload })

    it('takes the countdown from the server and nowhere else', function () {
      const state = apply(undefined, auction_actions.AUCTION_TIMER, {
        timer_expires_at: 1_800_000_123
      })
      expect(state.timer).to.equal(1_800_000_123)
    })

    // THE CONTROL, and the whole point. A bid must not move the clock, or the
    // proxy step is back on screen as a full countdown.
    it('leaves the countdown alone on a bid', function () {
      const armed = apply(undefined, auction_actions.AUCTION_TIMER, {
        timer_expires_at: 1_800_000_123
      })
      const after_bid = apply(armed, auction_actions.AUCTION_BID, {
        pid: 'ABCD-EFGH-000001',
        player_salary: 11,
        tid: 2,
        type: 6
      })

      expect(after_bid.timer, 'unchanged by a bid').to.equal(1_800_000_123)
      expect(after_bid.bid, 'the bid still lands').to.equal(11)
    })

    it('takes the countdown from AUCTION_INIT on a join', function () {
      const state = apply(undefined, auction_actions.AUCTION_INIT, {
        transactions: [],
        tids: [],
        teams: [],
        connected: [],
        timer_expires_at: 1_800_000_456
      })
      expect(state.timer).to.equal(1_800_000_456)
    })

    it('clears the countdown when the server says there is none', function () {
      const armed = apply(undefined, auction_actions.AUCTION_TIMER, {
        timer_expires_at: 1_800_000_123
      })
      const cleared = apply(armed, auction_actions.AUCTION_TIMER, {
        timer_expires_at: null
      })
      expect(cleared.timer).to.equal(null)
    })
  })
})
