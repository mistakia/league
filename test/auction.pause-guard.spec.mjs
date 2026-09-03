/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season, transaction_types } from '#constants'
import Auction from '#api/sockets/auction.mjs'
import { selectPlayer } from './utils/index.mjs'
import make_recording_timers from './utils/recording-timers.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// A socket server stub. The Auction only ever iterates `clients` to broadcast,
// so an empty set is a complete implementation for these assertions.
const stub_wss = { clients: new Set() }

describe('auction pause guard', function () {
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
  })

  const build_paused_auction = async () => {
    const timers = make_recording_timers()
    const auction = new Auction({ wss: stub_wss, lid: league_id, timers })
    await auction.setup()

    // The rollback state: election mode off leaves `_paused` at its constructor
    // default, and only an explicit AUCTION_RESUME clears it.
    auction._election_mode = false
    auction._paused = true

    return { auction, timers }
  }

  const count_auction_transactions = async () => {
    const rows = await knex('transactions')
      .where({ lid: league_id, season_year })
      .whereIn('type', [
        transaction_types.AUCTION_BID,
        transaction_types.AUCTION_PROCESSED
      ])
    return rows.length
  }

  it('writes no nomination while the auction is paused', async function () {
    const { auction } = await build_paused_auction()
    const player = await selectPlayer({
      exclude_rostered_players: true,
      random: false
    })

    const before = await count_auction_transactions()

    await auction.nominate(
      { pid: player.pid, value: 0, tid: auction._tids[0] },
      { user_id: 1, tid: auction._tids[0] }
    )

    expect(await count_auction_transactions()).to.equal(before)
  })

  it('starts no bid clock while the auction is paused', async function () {
    // The sharper half. A nomination that slipped through would start a
    // 14-second clock, and the player would sell to whoever happened to be
    // watching -- on an auction the commissioner had deliberately stopped.
    const { auction, timers } = await build_paused_auction()
    const player = await selectPlayer({
      exclude_rostered_players: true,
      random: false
    })

    await auction.nominate(
      { pid: player.pid, value: 0, tid: auction._tids[0] },
      { user_id: 1, tid: auction._tids[0] }
    )

    expect(timers.scheduled).to.have.length(0)
  })

  it('writes no bid while the auction is paused', async function () {
    // A REAL open nomination first. An earlier version of this test bid on a
    // made-up pid with nothing nominated, and passed with the guard removed --
    // `_validate_bid` was rejecting it for an unrelated reason, so the
    // assertion could not tell a guarded auction from an unguarded one.
    const { auction } = await build_paused_auction()
    const player = await selectPlayer({
      exclude_rostered_players: true,
      random: false
    })

    auction.start()
    await auction.nominate(
      { pid: player.pid, value: 0, tid: auction._tids[0] },
      { user_id: 1, tid: auction._tids[0] }
    )
    auction.pause()

    const before = await count_auction_transactions()

    // A raise the auction would accept were it running: higher than the
    // standing $0, on the player that is actually open, from another team.
    await auction.bid(
      { pid: player.pid, value: 5 },
      { user_id: 1, tid: auction._tids[1] }
    )

    expect(await count_auction_transactions()).to.equal(before)
  })

  it('accepts a nomination once the auction is resumed', async function () {
    // The control. Without it the three assertions above pass on an auction
    // that refuses everything for some unrelated reason, and prove nothing
    // about the pause.
    const { auction } = await build_paused_auction()
    const player = await selectPlayer({
      exclude_rostered_players: true,
      random: false
    })

    auction.start()
    expect(auction._paused).to.equal(false)

    const before = await count_auction_transactions()
    await auction.nominate(
      { pid: player.pid, value: 0, tid: auction._tids[0] },
      { user_id: 1, tid: auction._tids[0] }
    )

    expect(await count_auction_transactions()).to.equal(before + 1)
  })

  // WHAT THE OLD VERSION OF THIS BLOCK COULD NOT SEE.
  //
  // It set `_paused = false` by hand and asserted `_refuse_while_paused`
  // returned false -- which is the guard's first line restated, true of any
  // auction whose flag happens to be clear, and blind to every path that SETS
  // the flag. `pause()` had no election-mode branch at all, so a team
  // disconnecting under auto-pause, a commissioner tap, or a league pause being
  // read each drove a live election-mode auction into `_paused` with nothing
  // able to clear it again, and the whole league then read `Auction is paused`
  // over a board still settling elections over REST.
  //
  // Every assertion below therefore calls `pause()` -- the transition, not the
  // flag -- and the last one is the control that keeps the rest honest.
  describe('election mode has no clock to pause', function () {
    const build_election_auction = async () => {
      const auction = new Auction({
        wss: stub_wss,
        lid: league_id,
        timers: make_recording_timers()
      })
      await auction.setup()
      auction._election_mode = true
      auction._paused = false
      return auction
    }

    it('refuses a direct pause', async function () {
      const auction = await build_election_auction()

      auction.pause()

      expect(auction._paused).to.equal(false)
      expect(auction._refuse_while_paused('nomination', 1)).to.equal(false)
    })

    it('refuses the pause a disconnecting team triggers', async function () {
      // The path that took league 1 down. `pause_on_team_disconnect` calls
      // `pause()` from the close handler, and a phone changing networks is a
      // close.
      const auction = await build_election_auction()
      auction._pause_on_team_disconnect = true

      auction.pause()

      expect(auction._paused).to.equal(false)
    })

    it('refuses the pause a league pause triggers, and still refuses writes', async function () {
      // The two flags are separate on purpose. `_league_paused` is what `bid`
      // and `nominate` consult first, so declining to move `_paused` here costs
      // the league pause nothing -- and asserting BOTH halves is what stops a
      // future reader from "simplifying" the pause back into one flag.
      const auction = await build_election_auction()

      auction._league_paused = true
      auction.pause()

      expect(auction._paused).to.equal(false)
      expect(auction._league_paused).to.equal(true)
    })

    it('still pauses in live mode', async function () {
      // THE CONTROL. Without it every assertion above passes against a `pause()`
      // that was broken outright and never pauses anything, which is the same
      // reading as a correct election-mode refusal.
      const auction = await build_election_auction()
      auction._election_mode = false

      auction.pause()

      expect(auction._paused).to.equal(true)
      expect(auction._refuse_while_paused('nomination', 1)).to.equal(true)
    })
  })
})
