/* global describe before beforeEach afterEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'
import dayjs from 'dayjs'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season, transaction_types } from '#constants'
import Auction, { AUCTION_TIMERS } from '#api/sockets/auction.mjs'
import {
  submit_auction_election,
  get_auction_settlement_status
} from '#libs-server/auction-elections.mjs'
import { get_auction_final_block } from '#libs-server/auction-final-block.mjs'
import { selectPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// WHAT HAPPENS WHEN THE ELIGIBLE SET NEVER COMPLETES.
//
// Election mode advances on completeness and on nothing else -- no deadline, no
// timer, no commissioner nudge -- so one quiet manager parks the whole auction
// on one player for as long as they stay quiet. That is the design working as
// specified, not a fault, and the plan accepts it deliberately: pressure to
// elect is social for the first run. The thing that has to be true is that the
// stall is BOUNDED, and the only thing bounding it is the computed final block.
//
// Nothing had ever run a stall. The risk this covers is a stall that is quietly
// resolved by something -- a timer that was supposed to be suspended, a sweep, a
// skip -- because a stall silently settling is indistinguishable from the design
// working, right up until it charges a team for a player they never bid on.
describe('auction stall and the eligible set', function () {
  let now
  let auction
  let timers

  // Records every scheduled callback, TAGGED with which clock armed it. Counting
  // by duration cannot work here: the padded bid clock and the mode poll are both
  // 15,000ms in the test config, and the mode poll re-arms on every tick, so a
  // count of 15,000ms timers is a count of two different things.
  const build_timers = () => {
    const scheduled = []
    return {
      scheduled,
      set_timeout: (fn, ms, name) => {
        const handle = { fn, ms, name, cleared: false }
        scheduled.push(handle)
        return handle
      },
      clear_timeout: (handle) => {
        if (handle) handle.cleared = true
      },
      // The most recently armed timer of a given kind, which is the live one.
      latest: (name) =>
        [...scheduled].reverse().find((handle) => handle.name === name),
      count: (name) => scheduled.filter((handle) => handle.name === name).length
    }
  }

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

    // Full cap for every team, so a team that drops out of an eligible set does
    // so for the reason under test and not because the draft fixture left it
    // over the cap.
    await knex('transactions').where({ lid: league_id }).update({
      player_salary: 0
    })

    timers = build_timers()
    auction = new Auction({ wss: { clients: [] }, lid: league_id, timers })
    auction.broadcast = () => {}
    await auction.setup()
  })

  const team_ids = async () => {
    const teams = await knex('teams')
      .where({ lid: league_id, season_year })
      .orderBy('draft_order')
    return teams.map((team) => team.team_id)
  }

  const free_agent = async (exclude_pids = []) =>
    selectPlayer({
      exclude_rostered_players: true,
      exclude_pids,
      random: false
    })

  const processed_rows = (pid) =>
    knex('transactions').where({
      lid: league_id,
      pid,
      type: transaction_types.AUCTION_PROCESSED
    })

  describe('a nomination one team short', function () {
    it('sits indefinitely, with no clock running and nothing settled', async function () {
      this.timeout(60 * 1000)
      const tids = await team_ids()
      const [nominator, ...others] = tids
      const player = await free_agent()

      await auction.nominate(
        { pid: player.pid, value: 0 },
        { user_id: 1, tid: nominator }
      )

      expect(auction._election_mode, 'no block, so election mode').to.equal(
        true
      )

      // EVERY TEAM BUT ONE. `others` is nine teams; the last is left silent.
      const quiet_team = others[others.length - 1]
      for (const tid of others.slice(0, -1)) {
        await submit_auction_election({
          lid: league_id,
          tid,
          pid: player.pid,
          user_id: 1,
          maximum_bid: null
        })
      }

      const status = await get_auction_settlement_status({ lid: league_id })
      expect(status.outstanding_election_tids).to.deep.equal([quiet_team])
      expect(await processed_rows(player.pid)).to.have.length(0)

      // NO CLOCK OF ANY KIND. Election mode suspends both, and this is the
      // assertion that would catch one of them being armed anyway -- which is
      // the failure that would settle a stall without anybody deciding to.
      expect(timers.count(AUCTION_TIMERS.BID), 'no bid clock').to.equal(0)
      expect(
        timers.count(AUCTION_TIMERS.NOMINATION),
        'no nomination clock'
      ).to.equal(0)

      // Three days later, well past anything a clock would have fired on, and
      // past the point a deadline-based design would have swept it.
      MockDate.set(now.add(3, 'day').toISOString())
      await auction._refresh_mode()

      expect(
        await processed_rows(player.pid),
        'still unsold three days on'
      ).to.have.length(0)
      const later = await get_auction_settlement_status({ lid: league_id })
      expect(later.outstanding_election_tids).to.deep.equal([quiet_team])
    })

    it('settles the moment the quiet team elects, and not before', async function () {
      this.timeout(60 * 1000)
      const tids = await team_ids()
      const [nominator, ...others] = tids
      const player = await free_agent()

      await auction.nominate(
        { pid: player.pid, value: 0 },
        { user_id: 1, tid: nominator }
      )

      const quiet_team = others[others.length - 1]
      let settlement = null
      for (const tid of others.slice(0, -1)) {
        const result = await submit_auction_election({
          lid: league_id,
          tid,
          pid: player.pid,
          user_id: 1,
          maximum_bid: null
        })
        if (result.settlement) settlement = result.settlement
      }

      // THE CONTROL. Without it a spec that only asserts the final election
      // settles cannot tell completeness-driven settlement from a settlement
      // that would have fired on any election at all.
      expect(
        settlement,
        'nothing settled while one team was outstanding'
      ).to.equal(null)

      const last = await submit_auction_election({
        lid: league_id,
        tid: quiet_team,
        pid: player.pid,
        user_id: 1,
        maximum_bid: null
      })

      expect(last.settlement).to.not.equal(null)
      expect(last.settlement.winner_tid).to.equal(nominator)
      expect(await processed_rows(player.pid)).to.have.length(1)
    })
  })

  describe('the final block is what bounds the stall', function () {
    it('puts the stalled player under a bid clock without the quiet team ever electing', async function () {
      this.timeout(60 * 1000)
      const tids = await team_ids()
      const [nominator, ...others] = tids
      const player = await free_agent()

      await auction.nominate(
        { pid: player.pid, value: 0 },
        { user_id: 1, tid: nominator }
      )

      for (const tid of others.slice(0, -1)) {
        await submit_auction_election({
          lid: league_id,
          tid,
          pid: player.pid,
          user_id: 1,
          maximum_bid: null
        })
      }
      expect(await processed_rows(player.pid)).to.have.length(0)

      // THE FINAL BLOCK, reached the only way it ever is: by the clock arriving
      // at it. It carries no row and no opt-in -- `auction-final-block.mjs`
      // computes it from the configuration and the rosters -- so the spec asks
      // the same module the socket asks, then moves the clock onto it.
      const final_block = await get_auction_final_block({
        lid: league_id,
        season_year,
        now
      })
      expect(final_block, 'the league has a computed final block').to.not.equal(
        null
      )
      MockDate.set(
        dayjs(final_block.final_block_at).add(1, 'minute').toISOString()
      )

      await auction._refresh_mode()

      expect(
        auction._election_mode,
        'the final block holds the auction in live mode'
      ).to.equal(false)
      expect(auction._is_final_block).to.equal(true)

      // AND THE STALL NOW HAS A CLOCK ON IT. This is the whole termination
      // argument: the quiet team never acted, and the player sells anyway.
      expect(
        timers.count(AUCTION_TIMERS.BID),
        'the bid clock is armed on the open player'
      ).to.be.at.least(1)

      await auction.sold()

      const processed = await processed_rows(player.pid)
      expect(processed, 'sold under the final block').to.have.length(1)
      expect(processed[0].tid).to.equal(nominator)
    })
  })

  describe('a team that never nominates', function () {
    it('holds its turn indefinitely in election mode, and nothing skips it', async function () {
      this.timeout(60 * 1000)
      const tids = await team_ids()
      const on_the_clock = auction.nominating_team_id
      expect(on_the_clock, 'somebody is on the clock').to.equal(tids[0])

      expect(auction._election_mode).to.equal(true)
      expect(
        timers.count(AUCTION_TIMERS.NOMINATION),
        'no nomination clock in election mode'
      ).to.equal(0)

      MockDate.set(now.add(2, 'day').toISOString())
      await auction._refresh_mode()

      expect(
        auction.nominating_team_id,
        'the same team is still on the clock'
      ).to.equal(on_the_clock)
      const any_bid = await knex('transactions').where({
        lid: league_id,
        type: transaction_types.AUCTION_BID
      })
      expect(any_bid, 'nothing nominated on their behalf').to.have.length(0)
    })
  })
})
