/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season } from '#constants'
import Auction, { real_auction_announcer } from '#api/sockets/auction.mjs'
import make_recording_timers from './utils/recording-timers.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1
const season_year = current_season.year
const COMMISSIONER_USER_ID = 1

// THE CLAIM ANNOUNCEMENT, and the two questions a content assertion cannot ask:
// does the socket CALL its announcer, and does it correctly stay silent.
//
// `sendNotifications` refuses outside NODE_ENV=production, so under the suite
// the delivery half of every auction announcement is invisible -- and this
// subsystem has shipped a MISSING announcement twice on exactly that blind
// spot, each time with a correct builder nobody called. The injected
// `announce` seam is what makes the call observable; these cases are what make
// it worth having.
//
// THE MUTANT THESE ARE SCORED AGAINST is deleting the `await
// this._send_claim_notification(...)` line at its call site, NOT editing
// anything inside the builder. A builder assertion survives that deletion
// intact, which is precisely how the settlement defect stayed green.
const make_recording_wss = (user_ids) => ({
  wss: {
    clients: new Set(
      user_ids.map((user_id) => ({
        user_id,
        league_id,
        readyState: 1,
        send: () => {}
      }))
    )
  }
})

describe('auction claim announcement', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    MockDate.set(
      current_season.regular_season_start.subtract('1', 'month').toISOString()
    )
    await league(knex)

    // The auction only runs inside the free agency period, and the shared
    // fixture configures none.
    await knex('seasons')
      .where({ lid: league_id, season_year })
      .update({
        free_agency_period_start: current_season.regular_season_start
          .subtract(2, 'months')
          .toDate(),
        free_agency_period_end: current_season.regular_season_start.toDate(),
        is_auction_election_mode_enabled: true
      })
  })

  // Records every announce call instead of sending. Production passes nothing
  // and gets the real sender; this passes a recorder and gets to ask.
  const build_auction = async ({ election_mode }) => {
    const announced = []
    const { wss } = make_recording_wss([1, 2, 3])
    const auction = new Auction({
      wss,
      lid: league_id,
      timers: make_recording_timers(),
      announce: async (call) => {
        announced.push(call)
      }
    })
    await auction.setup()
    auction._election_mode = election_mode
    auction.start()

    expect(
      auction._league.commissioner_user_id,
      'the fixture commissioner is user 1; the nomination below relies on the ' +
        'election-mode commissioner bypass'
    ).to.equal(COMMISSIONER_USER_ID)

    return { auction, announced }
  }

  const a_free_agent = async () => {
    const rostered = await knex('rosters_players')
      .join('rosters', 'rosters.roster_id', 'rosters_players.roster_id')
      .where('rosters.lid', league_id)
      .pluck('rosters_players.pid')

    const [player] = await knex('player')
      .whereNot('current_nfl_team', 'INA')
      .where('primary_position', 'RB')
      .whereNotIn('pid', rostered.length ? rostered : [''])
      .orderBy('pid')
      .limit(1)
    expect(player, 'an unrostered running back').to.exist
    return player.pid
  }

  // THE DEFAULT MUST BE THE REAL SENDER. An injected seam whose default drifted
  // to a no-op would silence production while every case below stayed green --
  // the failure the seam is supposed to prevent, reintroduced by the seam.
  it('wires the real announcer by default', async function () {
    this.timeout(60 * 1000)
    const { wss } = make_recording_wss([1])
    const auction = new Auction({ wss, lid: league_id })

    expect(auction._announce).to.equal(real_auction_announcer)
  })

  describe('outside a live block', function () {
    it('announces a nomination', async function () {
      this.timeout(60 * 1000)

      const { auction, announced } = await build_auction({
        election_mode: true
      })
      const pid = await a_free_agent()

      await auction.nominate(
        { pid, value: 0 },
        { user_id: COMMISSIONER_USER_ID, tid: 1 }
      )

      expect(announced.length, 'the socket called its announcer').to.equal(1)
      expect(announced[0].message, 'the nomination verb').to.include(
        'nominated'
      )
      expect(announced[0].message).to.not.include('bid on')
      expect(announced[0].league, 'the league it sends to').to.exist
    })

    // THE OPERATOR'S RULE, first half. A bid outside a block is a rare,
    // deliberate act against a sealed field, so the league hears about it.
    it('announces a bid', async function () {
      this.timeout(60 * 1000)

      const { auction, announced } = await build_auction({
        election_mode: true
      })
      const pid = await a_free_agent()

      await auction.nominate(
        { pid, value: 0 },
        { user_id: COMMISSIONER_USER_ID, tid: 1 }
      )
      const after_nomination = announced.length

      await auction.bid({ pid, value: 2 }, { user_id: 2, tid: 2 })

      expect(
        announced.length,
        'the bid produced its own announcement'
      ).to.be.above(after_nomination)
      const bid_message = announced[announced.length - 1].message
      expect(bid_message, 'the bid verb').to.include('bid on')
      expect(bid_message, 'not the nomination verb').to.not.include('nominated')
      expect(bid_message, 'the amount bid').to.include('$2')
    })
  })

  // THE OPERATOR'S RULE, second half, and the only case here that asserts an
  // ABSENCE. Inside a block bidding is rapid open outcry; announcing each one
  // would bury the channel. Paired with the announcing case above rather than
  // standing alone, because a silence proves nothing on its own -- an announcer
  // that is never called under any mode would satisfy this case perfectly.
  describe('inside a live block', function () {
    it('does not announce a bid', async function () {
      this.timeout(60 * 1000)

      const { auction, announced } = await build_auction({
        election_mode: true
      })
      const pid = await a_free_agent()

      await auction.nominate(
        { pid, value: 0 },
        { user_id: COMMISSIONER_USER_ID, tid: 1 }
      )
      expect(
        announced.length,
        'the announcer is reachable in this setup, so the silence below is ' +
          'the mode gate rather than a broken harness'
      ).to.equal(1)

      const before_block = announced.length
      auction._election_mode = false

      await auction.bid({ pid, value: 3 }, { user_id: 2, tid: 2 })

      expect(
        announced.length,
        'a bid inside a live block announces nothing'
      ).to.equal(before_block)
    })
  })
})
