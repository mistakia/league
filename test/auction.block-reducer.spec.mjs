/* global describe it */
import * as chai from 'chai'

import { auction_reducer } from '@core/auction/reducer'
import { auction_actions } from '@core/auction/actions'

const expect = chai.expect

// THE REDUCER IS WHERE A BROADCAST GOES TO DIE UNNOTICED.
//
// Two message types shipped with no reducer case at all, and the symptom was
// not an error: every client simply watched a frozen list while the auction
// moved underneath it. Nothing in the suite could see it, because the route
// broadcast correctly and the reducer dropped it. So each message the server
// sends about blocks is asserted here against the state it is supposed to
// produce.
describe('auction block reducer', function () {
  const schedule = {
    eligible_team_ids: [1, 2, 3],
    blocks: [
      {
        block_at: 1_800_000_000,
        end_at: 1_800_001_800,
        finalized_at: 1_799_990_000,
        eligible_team_count: 3
      }
    ],
    opt_ins: [
      { block_at: 1_800_000_000, opt_in_tids: [1, 2, 3], is_finalized: true },
      { block_at: 1_800_003_600, opt_in_tids: [2], is_finalized: false }
    ],
    period_start: 1_799_000_000,
    period_end: 1_801_000_000,
    auction_block_notice_minutes: 60,
    final_block_at: 1_800_900_000,
    final_block_spots_remaining: 42
  }

  const apply = (type, payload) => auction_reducer(undefined, { type, payload })

  it('holds the schedule from the REST read', function () {
    const state = apply(auction_actions.GET_AUCTION_BLOCKS_FULFILLED, {
      data: schedule
    })

    expect(state.block_eligible_tids.toJS()).to.deep.equal([1, 2, 3])
    expect(state.final_block_at).to.equal(1_800_900_000)
    expect(state.final_block_spots_remaining).to.equal(42)
    expect(state.auction_block_notice_minutes).to.equal(60)
    expect(state.free_agency_period_start).to.equal(1_799_000_000)
    expect(state.free_agency_period_end).to.equal(1_801_000_000)

    // NAMED, NOT COUNTED. A manager cannot argue for a slot against a bare
    // count, so the team ids reach the client.
    expect(
      state.live_blocks.getIn([1_800_003_600, 'opt_in_tids']).toJS()
    ).to.deep.equal([2])
  })

  it('marks every slot a convened session covers', function () {
    const state = apply(auction_actions.AUCTION_BLOCK_SCHEDULE, schedule)

    // The session runs 30 minutes, which is TWO slots, and only the first
    // carries an opt-in row. Consecutive unanimous blocks run as one session, so
    // the second slot has to read as finalized or the calendar draws a gap in
    // the middle of a live block.
    expect(state.live_blocks.getIn([1_800_000_000, 'is_finalized'])).to.equal(
      true
    )
    expect(state.live_blocks.getIn([1_800_000_900, 'is_finalized'])).to.equal(
      true
    )
    expect(state.live_blocks.getIn([1_800_003_600, 'is_finalized'])).to.equal(
      false
    )
  })

  it('takes the mode from the server rather than deriving it', function () {
    const state = apply(auction_actions.AUCTION_MODE, {
      auction_mode: 'live',
      block_end_at: 1_800_001_800,
      is_final_block: false
    })

    expect(state.auction_mode).to.equal('live')
    expect(state.block_end_at).to.equal(1_800_001_800)
    expect(state.is_final_block).to.equal(false)
  })

  it('carries the final block through AUCTION_INIT', function () {
    const state = apply(auction_actions.AUCTION_INIT, {
      transactions: [],
      tids: [],
      teams: [],
      connected: [],
      paused: false,
      auction_mode: 'live',
      block_end_at: 1_800_001_800,
      is_final_block: true,
      outstanding_election_tids: []
    })

    expect(state.auction_mode).to.equal('live')
    expect(state.is_final_block).to.equal(true)
  })

  it('leaves state untouched on an unknown auction message', function () {
    const before = apply(auction_actions.AUCTION_BLOCK_SCHEDULE, schedule)
    const after = auction_reducer(before, {
      type: 'AUCTION_NOT_A_REAL_MESSAGE',
      payload: { blocks: [] }
    })
    expect(after).to.equal(before)
  })
})
