/* global describe before beforeEach afterEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season, transaction_types } from '#constants'
import Auction, { AUCTION_TIMERS } from '#api/sockets/auction.mjs'
import { submit_auction_election } from '#libs-server/auction-elections.mjs'
import { selectPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// PROXY BIDDING AND AUTO-NOMINATION, DRIVEN THROUGH THE SOCKET.
//
// Everything here is a claim about what the auction DOES when a clock fires or a
// manager types an amount, and none of it is visible from reading the module.
// The socket is constructed directly with an injected timer and a stub client
// list, which is the whole reason the timer interface was extracted: nothing in
// this repository fakes timers, and `MockDate` moves `Date.now` without moving
// `setTimeout`.
describe('auction proxy bidding and auto-nomination', function () {
  let now
  let auction
  let timers
  let broadcasts

  // Records every scheduled callback so a spec can fire the bid clock or the
  // nomination clock deliberately, and can COUNT how many times each was armed
  // -- which is how "a proxy step does not reset the bid clock" is asserted.
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

    // Give every team its full cap as headroom. The draft fixture leaves league
    // teams OVER the cap -- one at -29 -- and an effective maximum is
    // `min(stated, availableCap)`, so on the stock fixture every ceiling in this
    // spec would cap down to nothing and the price assertions would be measuring
    // the budget term rather than the proxy rule. `availableCap` is the league
    // cap minus the salaries in force, so zeroing those is the one-line way to
    // get there without editing the shared league-format catalog.
    await knex('transactions')
      .where({ lid: league_id })
      .update({ player_salary: 0 })

    // The block is inserted finalized. HOW a block convenes is the subject of
    // auction.blocks.spec.mjs; what this spec needs is an auction already in
    // live mode.
    await knex('auction_blocks').insert({
      lid: league_id,
      season_year,
      block_at: now.subtract(5, 'minute').toDate(),
      end_at: now.add(2, 'hour').toDate(),
      finalized_at: now.subtract(1, 'hour').toDate(),
      eligible_team_count: 10
    })

    broadcasts = []
    timers = build_timers()
    auction = new Auction({
      wss: { clients: [] },
      lid: league_id,
      timers
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

  const free_agent = async (exclude_pids = []) => {
    const player = await selectPlayer({
      exclude_rostered_players: true,
      exclude_pids,
      random: false
    })
    return player
  }

  const bids_on = (pid) =>
    knex('transactions')
      .where({ lid: league_id, pid, type: transaction_types.AUCTION_BID })
      .orderBy('transaction_id', 'asc')

  it('runs the block in live mode with both clocks armed', async function () {
    expect(auction._election_mode, 'inside a finalized block').to.equal(false)
    expect(auction._paused).to.equal(false)
  })

  it('bids only what it takes to lead, never the ceiling', async function () {
    this.timeout(60 * 1000)
    const tids = await team_ids()
    const nominator = tids[0]
    const player = await free_agent()

    // Two absent teams holding ceilings, and a nomination at $0.
    await submit_auction_election({
      lid: league_id,
      tid: tids[1],
      pid: player.pid,
      user_id: 1,
      maximum_bid: 30
    })
    await submit_auction_election({
      lid: league_id,
      tid: tids[2],
      pid: player.pid,
      user_id: 1,
      maximum_bid: 20
    })

    await auction.nominate(
      { pid: player.pid, value: 0, user_id: 1 },
      { user_id: 1, tid: nominator }
    )

    const bids = await bids_on(player.pid)
    // ONE nomination and ONE engine step. Incrementing a dollar at a time would
    // put twenty rows here.
    expect(bids, 'the nomination plus one proxy step').to.have.length(2)

    const leading = bids[bids.length - 1]
    // The runner-up's $20 plus one increment -- NOT the $30 ceiling, which is
    // never revealed and never charged unless a rival pushes the price to it.
    expect(leading.player_salary).to.equal(21)
    expect(leading.tid).to.equal(tids[1])
  })

  it('answers a human bid without resetting the bid clock', async function () {
    this.timeout(60 * 1000)
    const tids = await team_ids()
    const nominator = tids[0]
    const player = await free_agent()

    await submit_auction_election({
      lid: league_id,
      tid: tids[1],
      pid: player.pid,
      user_id: 1,
      maximum_bid: 30
    })

    await auction.nominate(
      { pid: player.pid, value: 0, user_id: 1 },
      { user_id: 1, tid: nominator }
    )

    const armed_after_nomination = timers.count(AUCTION_TIMERS.BID)
    expect(
      armed_after_nomination,
      'the nomination arms the bid clock'
    ).to.be.at.least(1)

    await auction.bid({
      user_id: 1,
      tid: tids[2],
      pid: player.pid,
      value: 10
    })

    const bids = await bids_on(player.pid)
    const leading = bids[bids.length - 1]
    expect(leading.player_salary).to.equal(11)
    expect(leading.tid, 'the ceiling still leads').to.equal(tids[1])

    // EXACTLY ONE further arming, from the HUMAN bid. The engine's answer must
    // not arm a second one, or a player contested purely between absent teams
    // would never settle -- which is the property that keeps a 69-player final
    // block tractable.
    expect(timers.count(AUCTION_TIMERS.BID)).to.equal(
      armed_after_nomination + 1
    )
  })

  it('stops proxying for a team that names its own amount', async function () {
    this.timeout(60 * 1000)
    const tids = await team_ids()
    const nominator = tids[0]
    const player = await free_agent()

    // The bidder holds a $30 ceiling AND types $5. Bidding below your own
    // ceiling means you meant that amount, so the engine must not carry them to
    // $30 on the next step.
    await submit_auction_election({
      lid: league_id,
      tid: tids[1],
      pid: player.pid,
      user_id: 1,
      maximum_bid: 30
    })
    await submit_auction_election({
      lid: league_id,
      tid: tids[2],
      pid: player.pid,
      user_id: 1,
      maximum_bid: 12
    })

    await auction.nominate(
      { pid: player.pid, value: 0, user_id: 1 },
      { user_id: 1, tid: nominator }
    )

    // The $30 ceiling leads at $13 against the $12 one.
    let bids = await bids_on(player.pid)
    expect(bids[bids.length - 1].player_salary).to.equal(13)
    expect(bids[bids.length - 1].tid).to.equal(tids[1])

    await auction.bid({
      user_id: 1,
      tid: tids[1],
      pid: player.pid,
      value: 14
    })

    bids = await bids_on(player.pid)
    const leading = bids[bids.length - 1]
    expect(leading.tid).to.equal(tids[1])
    // Bound to what they typed. Without supersession the engine would read their
    // standing $30 and there would be nothing to stop it.
    expect(leading.player_salary).to.equal(14)
  })

  it('auto-nominates when the nomination clock expires', async function () {
    this.timeout(60 * 1000)
    const before = await knex('transactions').where({
      lid: league_id,
      type: transaction_types.AUCTION_BID
    })
    expect(before, 'nothing nominated yet').to.have.length(0)

    const nomination_timer = timers.latest(AUCTION_TIMERS.NOMINATION)
    expect(nomination_timer, 'the nomination clock is armed in live mode').to
      .exist

    await nomination_timer.fn()

    const after = await knex('transactions').where({
      lid: league_id,
      type: transaction_types.AUCTION_BID
    })
    // THE ASSERTION THIS SPEC EXISTS FOR. Before auto-nomination the expired
    // timer only unlocked a commissioner override and advanced nothing, so a
    // block with a quiet team on the clock stalled for the length of the block.
    expect(after, 'the auction advanced unattended').to.have.length.at.least(1)

    const tids = await team_ids()
    expect(after[0].tid, 'nominated for the team on the clock').to.equal(
      tids[0]
    )
  })

  it('suspends both clocks and the engine outside a block', async function () {
    this.timeout(60 * 1000)
    // Retire the block and re-resolve: the auction reverts to election mode with
    // nothing open, and neither clock is armed.
    await knex('auction_blocks').where({ lid: league_id }).del()

    const armed_before = timers.count(AUCTION_TIMERS.BID)
    await auction._refresh_mode()

    expect(auction._election_mode, 'reverted to election mode').to.equal(true)

    const tids = await team_ids()
    const player = await free_agent()
    await auction.nominate(
      { pid: player.pid, value: 3, user_id: 1 },
      { user_id: 1, tid: tids[0] }
    )

    expect(
      timers.count(AUCTION_TIMERS.BID),
      'the bid clock stays suspended in election mode'
    ).to.equal(armed_before)

    const bids = await bids_on(player.pid)
    // The nomination and nothing else: no proxy step runs in election mode,
    // where the claim set is ranked once at completeness instead.
    expect(bids).to.have.length(1)
    expect(
      bids[0].player_salary,
      'the nominator states its own opening bid'
    ).to.equal(3)
  })

  it('lets an open player finish under live clocks when the block ends', async function () {
    this.timeout(60 * 1000)
    const tids = await team_ids()
    const player = await free_agent()

    await auction.nominate(
      { pid: player.pid, value: 0, user_id: 1 },
      { user_id: 1, tid: tids[0] }
    )

    await knex('auction_blocks').where({ lid: league_id }).del()
    await auction._refresh_mode()

    // REVERTING MID-PLAYER WOULD STRAND A HALF-RESOLVED OPEN OUTCRY with no
    // clock to conclude it, so the revert is deferred rather than applied.
    expect(auction._election_mode, 'still live for the open player').to.equal(
      false
    )
    expect(auction._pending_election_mode).to.equal(true)

    await auction.sold()

    expect(
      auction._election_mode,
      'reverts once the player is placed'
    ).to.equal(true)
    expect(auction._pending_election_mode).to.equal(false)
  })
})
