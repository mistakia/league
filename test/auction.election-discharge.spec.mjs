/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season, transaction_types } from '#constants'
import {
  submit_auction_election,
  get_auction_settlement_status
} from '#libs-server/auction-elections.mjs'
import { get_outstanding_election_team_ids } from '#libs-server/auction-settlement.mjs'
import { selectPlayer } from './utils/index.mjs'
import { nominate_auction_player } from './utils/nominate-auction-player.mjs'

process.env.NODE_ENV = 'test'
chai.should()
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// ONLY AN ELECTION DISCHARGES.
//
// Completeness is the only thing that settles a player in election mode, and it
// used to count three things: a live election, a placed bid, and the nomination.
// The last two are PRICE-SPECIFIC -- bidding $11 says a team was in at $11 and
// nothing about $12 -- so discharging on them settled players over teams that
// had never stated a position at the price the player actually sold at. With no
// clock in election mode, completeness was the only thing that could have asked
// them, and it had already stopped.
//
// Every case here runs as a PAIR against the same fixture. "Nothing settled" is
// the outcome of a broken fixture as much as of a correct rule, so each assertion
// that the auction WAITS is followed by the one write that should release it, and
// the two readings have to differ.
describe('only an election discharges a team from the outstanding set', function () {
  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(
      current_season.regular_season_start.subtract('1', 'month').toISOString()
    )
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
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

  const free_agent = async () => {
    const player = await selectPlayer({
      exclude_rostered_players: true,
      random: false
    })
    return player.pid
  }

  const all_team_ids = async () => {
    const teams = await knex('teams').where({ lid: league_id, season_year })
    return teams.map((team) => team.team_id).sort((a, b) => a - b)
  }

  // A COMPETING BID, which is the one thing `nominate_auction_player` does not
  // express and should not. The shared helper opens a nomination -- the first
  // bid on a player, optionally with the nominator's ceiling -- and every
  // nomination in this file goes through it. This is a LATER bid from a team
  // that did not nominate, and the distinction between the two is the whole
  // subject of the spec, so naming them the same thing is how a reader ends up
  // nominating with this.
  const write_competing_bid = async ({ pid, tid, value }) =>
    knex('transactions').insert({
      user_id: 1,
      tid,
      pid,
      lid: league_id,
      type: transaction_types.AUCTION_BID,
      player_salary: value,
      week: 0,
      season_year,
      occurred_at: new Date()
    })

  describe('the rule itself', function () {
    // PURE, and the cheapest place to pin it. An engine proxy bid and a human
    // bid are the same `transactions` row by design, so a bid arriving from the
    // live engine during a block would discharge a team that never acted at all
    // once the block ended and the mode returned to election. Both reduce to
    // this: the predicate is handed elections, and bids are not among its
    // inputs at all.
    const capacities = new Map([
      [1, { is_eligible: true }],
      [2, { is_eligible: true }],
      [3, { is_eligible: true }],
      [4, { is_eligible: false }]
    ])

    it('waits on every eligible team that holds no election', function () {
      const outstanding = get_outstanding_election_team_ids({
        capacities,
        elections: []
      })

      // Team 4 is absent because it is INELIGIBLE, not because it acted.
      expect(outstanding).to.deep.equal([1, 2, 3])
    })

    it('drops a team the moment it holds one, and only then', function () {
      const outstanding = get_outstanding_election_team_ids({
        capacities,
        elections: [{ tid: 2, maximum_bid: 30 }]
      })

      expect(outstanding).to.deep.equal([1, 3])
    })

    it('counts a decline and a stale maximum as elections', function () {
      // Both are still POSITIONS at every price -- "out", and "out above my
      // ceiling" -- which is the property completeness needs. A stale maximum
      // below the current price discharging is what stops a team holding a
      // nomination open forever by never revising it.
      const outstanding = get_outstanding_election_team_ids({
        capacities,
        elections: [
          { tid: 1, maximum_bid: null },
          { tid: 2, maximum_bid: 1 }
        ]
      })

      expect(outstanding).to.deep.equal([3])
    })
  })

  describe('a bid', function () {
    it('leaves its bidder outstanding, and the election releases it', async function () {
      this.timeout(60 * 1000)
      const pid = await free_agent()
      const team_ids = await all_team_ids()

      // Team 1 nominates and states its ceiling inline, so the nominator is not
      // what holds this open. Team 2 bids and elects nothing.
      await nominate_auction_player({
        lid: league_id,
        pid,
        tid: 1,
        value: 0,
        maximum_bid: 0
      })
      await write_competing_bid({ pid, tid: 2, value: 5 })

      let settlement = null
      for (const tid of team_ids.filter((tid) => tid !== 1 && tid !== 2)) {
        const result = await submit_auction_election({
          lid: league_id,
          tid,
          pid,
          user_id: 1,
          maximum_bid: null
        })
        if (result.settlement) settlement = result.settlement
      }

      // THE ASSERTION THIS SPEC EXISTS FOR. Every other team has elected and
      // team 2 leads the board at $5 -- under the old rule its bid discharged it
      // and the player sold here, with team 2 never asked about $6.
      expect(
        settlement,
        'a bid alone does not complete the eligible set'
      ).to.equal(null)

      const status = await get_auction_settlement_status({ lid: league_id })
      expect(status.outstanding_election_tids).to.deep.equal([2])

      // THE CONTROL. One election from the one outstanding team, and the same
      // fixture that would not settle now does.
      const released = await submit_auction_election({
        lid: league_id,
        tid: 2,
        pid,
        user_id: 1,
        maximum_bid: 5
      })

      expect(released.settlement, 'the election completes it').to.not.equal(
        null
      )
      expect(released.settlement.winner_tid).to.equal(2)
      expect(released.settlement.price).to.equal(5)
    })

    it('still BINDS its bidder even though it does not discharge them', async function () {
      this.timeout(60 * 1000)
      const pid = await free_agent()
      const team_ids = await all_team_ids()

      await nominate_auction_player({
        lid: league_id,
        pid,
        tid: 1,
        value: 0,
        maximum_bid: 0
      })

      // Team 2 is on the wire at $7 and then DECLINES. A decline is a
      // revocation going forward and cannot unwind money already bid, so team 2
      // still holds a binding claim at $7 -- discharging and binding are
      // separate axes and this is the case that tells them apart.
      await write_competing_bid({ pid, tid: 2, value: 7 })

      let settlement = null
      for (const tid of team_ids.filter((tid) => tid !== 1)) {
        const result = await submit_auction_election({
          lid: league_id,
          tid,
          pid,
          user_id: 1,
          maximum_bid: null
        })
        if (result.settlement) settlement = result.settlement
      }

      expect(settlement).to.not.equal(null)
      expect(settlement.winner_tid).to.equal(2)
      expect(settlement.price).to.equal(7)
    })
  })

  describe('a nomination', function () {
    it('leaves its nominator outstanding, and the election releases it', async function () {
      this.timeout(60 * 1000)
      const pid = await free_agent()
      const team_ids = await all_team_ids()

      // No inline ceiling. The nominator is bound to its $3 opening bid and can
      // still be outbid off its own nomination, so until it names a maximum the
      // auction does not know its position at any price above $3.
      // `maximum_bid: null` is the helper saying the nominator stated NO
      // ceiling, which is exactly the case under test.
      await nominate_auction_player({
        lid: league_id,
        pid,
        tid: 1,
        value: 3,
        maximum_bid: null
      })

      let settlement = null
      for (const tid of team_ids.filter((tid) => tid !== 1)) {
        const result = await submit_auction_election({
          lid: league_id,
          tid,
          pid,
          user_id: 1,
          maximum_bid: null
        })
        if (result.settlement) settlement = result.settlement
      }

      expect(
        settlement,
        'a nomination alone does not complete the eligible set'
      ).to.equal(null)

      const status = await get_auction_settlement_status({ lid: league_id })
      expect(status.outstanding_election_tids).to.deep.equal([1])

      const released = await submit_auction_election({
        lid: league_id,
        tid: 1,
        pid,
        user_id: 1,
        maximum_bid: 3
      })

      expect(released.settlement, 'the election completes it').to.not.equal(
        null
      )
      expect(released.settlement.winner_tid).to.equal(1)
      expect(released.settlement.price).to.equal(3)
    })
  })
})
