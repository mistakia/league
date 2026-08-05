/* global describe before beforeEach it */

import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { getRoster } from '#libs-server'
import {
  current_season,
  player_tag_types,
  roster_slot_types,
  transaction_types
} from '#constants'
import { selectPlayer, addPlayer } from './utils/index.mjs'
import { insert_restricted_free_agency_bid } from './utils/insert-restricted-free-agency-bid.mjs'

process.env.NODE_ENV = 'test'

const { expect } = chai
const { regular_season_start } = current_season

// Regression gate for the bid a roster is priced from.
//
// `scripts/process-restricted-free-agency-bids.mjs` settles a losing bid with `is_successful: 0`
// and a `processed` timestamp and deliberately leaves `cancelled` null -- cancellation
// means the team withdrew, settlement means the auction resolved, and the table records
// both. `get-roster.mjs` filtered on `cancelled` alone, so a settled bid kept being
// attached to the roster player afterwards. `getExtensionAmount` coalesces that with
// `??`, so a settled $0 bid priced the player at $0 and handed the team free cap space
// wherever `getRoster` is read -- the add-player gate, waivers, poaches and the bid
// dialog all share this loader.
//
// The 2026 bids were all unprocessed own-player bids when this was found, which is why
// nothing was visibly wrong yet; the first processing run is what makes it live.

const league_id = 1
const team_id = 2
const user_id = 1

const insert_bid = async ({
  pid,
  bid,
  processed = null,
  cancelled = null,
  is_successful = null,
  player_tid = team_id,
  tid = team_id
}) =>
  insert_restricted_free_agency_bid({
    pid,
    lid: league_id,
    tid,
    bid,
    userid: user_id,
    original_team_id: player_tid,
    processed,
    cancelled,
    is_successful
  })

const get_roster_player = async (pid) => {
  const roster = await getRoster({ tid: team_id, week: 0 })
  return roster.players.find((p) => p.pid === pid)
}

const add_restricted_free_agent = async ({ value = 6 } = {}) => {
  const player = await selectPlayer({ exclude_rostered_players: true })
  await addPlayer({
    leagueId: league_id,
    teamId: team_id,
    userId: user_id,
    player,
    value,
    slot: roster_slot_types.BENCH,
    transaction: transaction_types.RESTRICTED_FREE_AGENCY_TAG,
    tag: player_tag_types.RESTRICTED_FREE_AGENCY
  })
  return player
}

describe('LIBS-SERVER getRoster - restricted free agency bids', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    MockDate.set(regular_season_start.subtract('2', 'month').toISOString())
    await league(knex)
  })

  it('attaches a live own-player bid', async () => {
    const player = await add_restricted_free_agent()
    await insert_bid({ pid: player.pid, bid: 23 })

    const roster_player = await get_roster_player(player.pid)
    expect(roster_player.bid).to.equal(23)
  })

  it('attaches a live $0 bid rather than treating it as no bid', async () => {
    const player = await add_restricted_free_agent()
    await insert_bid({ pid: player.pid, bid: 0 })

    const roster_player = await get_roster_player(player.pid)
    expect(roster_player.bid).to.equal(0)
  })

  it('does NOT attach a settled bid left uncancelled by the processing run', async () => {
    // The regression. `is_successful: false` with `processed` set and `cancelled` null is
    // exactly the row shape `process-restricted-free-agency-bids.mjs` writes for a
    // losing bid, and it is the shape production carries after every run.
    const player = await add_restricted_free_agent()
    await insert_bid({
      pid: player.pid,
      bid: 0,
      is_successful: false,
      processed: Math.round(Date.now() / 1000)
    })

    const roster_player = await get_roster_player(player.pid)
    expect(roster_player.bid).to.equal(undefined)
  })

  it('does NOT attach a settled WINNING bid', async () => {
    // A won bid is already priced into the player's transaction value, so attaching
    // it again is at best redundant and at worst a second charge.
    const player = await add_restricted_free_agent()
    await insert_bid({
      pid: player.pid,
      bid: 14,
      is_successful: true,
      processed: Math.round(Date.now() / 1000)
    })

    const roster_player = await get_roster_player(player.pid)
    expect(roster_player.bid).to.equal(undefined)
  })

  it('does NOT attach a cancelled bid', async () => {
    const player = await add_restricted_free_agent()
    await insert_bid({
      pid: player.pid,
      bid: 19,
      cancelled: Math.round(Date.now() / 1000)
    })

    const roster_player = await get_roster_player(player.pid)
    expect(roster_player.bid).to.equal(undefined)
  })

  it('does NOT attach a bid to a player who is not restricted-free-agency tagged', async () => {
    const player = await selectPlayer({ exclude_rostered_players: true })
    await addPlayer({
      leagueId: league_id,
      teamId: team_id,
      userId: user_id,
      player,
      value: 6,
      slot: roster_slot_types.BENCH,
      tag: player_tag_types.REGULAR
    })
    await insert_bid({ pid: player.pid, bid: 23 })

    const roster_player = await get_roster_player(player.pid)
    expect(roster_player.bid).to.equal(undefined)
  })

  it('does NOT attach a bid the team made on another roster', async () => {
    // `tid` selects bids the team MADE; only an own-player bid prices this roster.
    // The player is on this roster and the bid is live, so the ownership filter is
    // the only thing excluding it.
    const player = await add_restricted_free_agent()
    await insert_bid({ pid: player.pid, bid: 23, player_tid: 3 })

    const roster_player = await get_roster_player(player.pid)
    expect(roster_player.bid).to.equal(undefined)
  })
})
