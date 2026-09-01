/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season, transaction_types } from '#constants'
import Auction from '#api/sockets/auction.mjs'
import { selectPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

// A socket server stub. The Auction only ever iterates `clients` to broadcast,
// so an empty set is a complete implementation for these assertions.
const stub_wss = { clients: new Set() }

// The injected timer interface, which is the whole reason clock behavior is
// assertable at all -- MockDate moves Date.now without moving setTimeout, and
// nothing else in this repository fakes timers.
const make_recording_timers = () => {
  const scheduled = []
  return {
    scheduled,
    set_timeout: (fn, ms) => {
      scheduled.push({ fn, ms })
      return scheduled.length
    },
    clear_timeout: () => {}
  }
}

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
      { pid: player.pid, value: 0, user_id: 1, tid: auction._tids[0] },
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
      { pid: player.pid, value: 0, user_id: 1, tid: auction._tids[0] },
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
      { pid: player.pid, value: 0, user_id: 1, tid: auction._tids[0] },
      { user_id: 1, tid: auction._tids[0] }
    )
    auction.pause()

    const before = await count_auction_transactions()

    // A raise the auction would accept were it running: higher than the
    // standing $0, on the player that is actually open, from another team.
    await auction.bid({
      user_id: 1,
      tid: auction._tids[1],
      pid: player.pid,
      value: 5
    })

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
      { pid: player.pid, value: 0, user_id: 1, tid: auction._tids[0] },
      { user_id: 1, tid: auction._tids[0] }
    )

    expect(await count_auction_transactions()).to.equal(before + 1)
  })

  it('never pauses election mode, so the guard is inert on the mainline', async function () {
    const auction = new Auction({
      wss: stub_wss,
      lid: league_id,
      timers: make_recording_timers()
    })
    await auction.setup()
    auction._election_mode = true
    auction._paused = false

    expect(auction._refuse_while_paused('nomination', 1)).to.equal(false)
  })
})
