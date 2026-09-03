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

  // THE CLICK IS DRAWN BEFORE THE ROUND TRIP. The opt-in route re-evaluates
  // finalization and rebuilds the whole schedule before it answers, so without
  // this the button and the hour's density mark both sat unchanged for the
  // length of that request -- which reads as a click that did not land.
  describe('the optimistic opt-in', function () {
    const seeded = () =>
      auction_reducer(undefined, {
        type: auction_actions.AUCTION_BLOCK_SCHEDULE,
        payload: schedule
      })

    const toggle = (state, { block_ats, is_opted_in }) =>
      auction_reducer(state, {
        type: auction_actions.SET_AUCTION_BLOCK_OPT_IN,
        payload: { leagueId: 1, teamId: 4, block_ats, is_opted_in }
      })

    it('adds the viewing team to a slot nobody has taken', function () {
      const state = toggle(seeded(), {
        block_ats: [1_800_007_200],
        is_opted_in: true
      })

      expect(
        state.live_blocks.getIn([1_800_007_200, 'opt_in_tids']).toJS()
      ).to.deep.equal([4])
      expect(state.live_blocks.getIn([1_800_007_200, 'is_finalized'])).to.equal(
        false
      )
    })

    it('takes a whole hour in one action', function () {
      const block_ats = [0, 900, 1800, 2700].map(
        (offset) => 1_800_010_800 + offset
      )
      const state = toggle(seeded(), { block_ats, is_opted_in: true })

      for (const block_at of block_ats) {
        expect(
          state.live_blocks.getIn([block_at, 'opt_in_tids']).toJS(),
          `slot ${block_at}`
        ).to.deep.equal([4])
      }
    })

    it('leaves other teams alone on a withdrawal', function () {
      const opted_in = toggle(seeded(), {
        block_ats: [1_800_003_600],
        is_opted_in: true
      })
      expect(
        opted_in.live_blocks.getIn([1_800_003_600, 'opt_in_tids']).toJS()
      ).to.deep.equal([2, 4])

      const withdrawn = toggle(opted_in, {
        block_ats: [1_800_003_600],
        is_opted_in: false
      })
      expect(
        withdrawn.live_blocks.getIn([1_800_003_600, 'opt_in_tids']).toJS()
      ).to.deep.equal([2])
    })

    it('is replaced wholesale by the server reply', function () {
      const optimistic = toggle(seeded(), {
        block_ats: [1_800_007_200],
        is_opted_in: true
      })

      // The prediction covers only the viewing team's own tid. Unanimity, a
      // convened session and the moved final block all arrive with the reply,
      // which rebuilds the map rather than merging into the guess.
      const settled = auction_reducer(optimistic, {
        type: auction_actions.POST_AUCTION_BLOCK_OPT_IN_FULFILLED,
        payload: { data: schedule }
      })

      expect(settled.live_blocks.get(1_800_007_200)).to.equal(undefined)
    })
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
