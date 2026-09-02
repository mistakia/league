/* global describe it */
import * as chai from 'chai'

import { transaction_types } from '#constants'
import { resolve_nominating_team_id } from '#libs-server/auction-completion.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

// `resolve_nominating_team_id` is pure and is the ONE implementation of the
// rotation rule -- the socket, the REST settlement path and the auction-complete
// derivation all read the turn from here. So the skip is asserted against it
// directly.
//
// NO DATABASE, and deliberately in its own file: these cases need neither a
// seeded league nor a socket, and living beside the eligibility specs cost them
// a full league fixture rebuild each for nothing.
//
// The rotation only advances past a team when the newest transaction is an
// AUCTION_PROCESSED. While a player is open its nominator holds the clock, so
// every skip case here ends in one.
describe('auction nomination rotation', function () {
  const tids = [1, 2, 3, 4]
  const settled_log = [
    { type: transaction_types.AUCTION_PROCESSED, tid: 1 },
    { type: transaction_types.AUCTION_BID, tid: 1 }
  ]
  const teams_with_space = (space_by_tid) =>
    tids.map((team_id) => ({
      team_id,
      availableSpace: space_by_tid[team_id]
    }))

  it('hands the clock to the next team when it has roster space', function () {
    // The negative control for the skips below: without it they are consistent
    // with a rotation that never advances at all.
    const nominating_team_id = resolve_nominating_team_id({
      transactions: settled_log,
      tids,
      teams: teams_with_space({ 1: 1, 2: 1, 3: 1, 4: 1 })
    })
    expect(nominating_team_id).to.equal(2)
  })

  it('skips a team with no roster space', function () {
    const nominating_team_id = resolve_nominating_team_id({
      transactions: settled_log,
      tids,
      teams: teams_with_space({ 1: 1, 2: 0, 3: 1, 4: 1 })
    })
    expect(nominating_team_id, 'team 2 is skipped').to.equal(3)
  })

  it('skips a run of full teams and wraps the rotation', function () {
    const nominating_team_id = resolve_nominating_team_id({
      transactions: settled_log,
      tids,
      teams: teams_with_space({ 1: 1, 2: 0, 3: 0, 4: 0 })
    })
    // The walk starts after the last nominator and wraps, so team 1 -- the team
    // that just nominated -- takes the clock again rather than the rotation
    // stalling on team 2.
    expect(nominating_team_id, 'the rotation wraps to team 1').to.equal(1)
  })

  it('returns null when every team is full, which is auction-complete', function () {
    // Not an error condition. `is_auction_complete` derives the end of the
    // auction from exactly this, so a thrown or a defaulted value here would
    // read as an auction that never finishes.
    const nominating_team_id = resolve_nominating_team_id({
      transactions: settled_log,
      tids,
      teams: teams_with_space({ 1: 0, 2: 0, 3: 0, 4: 0 })
    })
    expect(nominating_team_id).to.equal(null)
  })

  it('holds the clock with the nominator while a player is open', function () {
    // The other negative control: capacity is not consulted at all on this
    // branch, so a team with no space still holds the clock on the player it
    // opened. Without this, deleting the open-player branch entirely would
    // still pass every case above.
    const open_log = [
      { type: transaction_types.AUCTION_BID, tid: 2 },
      { type: transaction_types.AUCTION_PROCESSED, tid: 1 }
    ]
    const nominating_team_id = resolve_nominating_team_id({
      transactions: open_log,
      tids,
      teams: teams_with_space({ 1: 1, 2: 0, 3: 1, 4: 1 })
    })
    expect(nominating_team_id, 'the nominator holds its own player').to.equal(2)
  })
})
