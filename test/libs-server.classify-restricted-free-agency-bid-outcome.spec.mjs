/* global describe it */
import * as chai from 'chai'

import classify_restricted_free_agency_bid_outcome from '#libs-server/classify-restricted-free-agency-bid-outcome.mjs'
import { restricted_free_agency_bid_outcomes } from '#constants'

const expect = chai.expect

const ORIGINAL_TEAM_ID = 5
const COMPETING_TEAM_ID = 9
const OTHER_COMPETING_TEAM_ID = 12

describe('LIBS SERVER classify restricted free agency bid outcome', function () {
  it('marks the winning bid as won', () => {
    const winning_bid = { bid_id: 1, tid: COMPETING_TEAM_ID, bid_amount: 30 }

    const outcome = classify_restricted_free_agency_bid_outcome({
      winning_bid,
      losing_bid: winning_bid,
      original_team_id: ORIGINAL_TEAM_ID
    })

    expect(outcome).to.equal(restricted_free_agency_bid_outcomes.WON)
  })

  it('marks a competing bid as matched when the original team wins', () => {
    const outcome = classify_restricted_free_agency_bid_outcome({
      winning_bid: { bid_id: 1, tid: ORIGINAL_TEAM_ID, bid_amount: 30 },
      losing_bid: { bid_id: 2, tid: COMPETING_TEAM_ID, bid_amount: 30 },
      original_team_id: ORIGINAL_TEAM_ID
    })

    expect(outcome).to.equal(restricted_free_agency_bid_outcomes.MATCHED)
  })

  it('prefers matched over the amount comparison', () => {
    // The original team's right of first refusal decides the auction
    // irrespective of what the competing bid offered, so a lower competing bid
    // is still MATCHED rather than OUTBID.
    const outcome = classify_restricted_free_agency_bid_outcome({
      winning_bid: { bid_id: 1, tid: ORIGINAL_TEAM_ID, bid_amount: 30 },
      losing_bid: { bid_id: 2, tid: COMPETING_TEAM_ID, bid_amount: 12 },
      original_team_id: ORIGINAL_TEAM_ID
    })

    expect(outcome).to.equal(restricted_free_agency_bid_outcomes.MATCHED)
  })

  it('marks a lower competing bid as outbid', () => {
    const outcome = classify_restricted_free_agency_bid_outcome({
      winning_bid: { bid_id: 1, tid: COMPETING_TEAM_ID, bid_amount: 30 },
      losing_bid: { bid_id: 2, tid: OTHER_COMPETING_TEAM_ID, bid_amount: 22 },
      original_team_id: ORIGINAL_TEAM_ID
    })

    expect(outcome).to.equal(restricted_free_agency_bid_outcomes.OUTBID)
  })

  it('marks an equal competing bid as a lost tiebreak', () => {
    const outcome = classify_restricted_free_agency_bid_outcome({
      winning_bid: { bid_id: 1, tid: COMPETING_TEAM_ID, bid_amount: 30 },
      losing_bid: { bid_id: 2, tid: OTHER_COMPETING_TEAM_ID, bid_amount: 30 },
      original_team_id: ORIGINAL_TEAM_ID
    })

    expect(outcome).to.equal(restricted_free_agency_bid_outcomes.LOST_TIEBREAK)
  })

  it('treats a null bid amount as zero rather than dropping to the fallback', () => {
    const outcome = classify_restricted_free_agency_bid_outcome({
      winning_bid: { bid_id: 1, tid: COMPETING_TEAM_ID, bid_amount: 30 },
      losing_bid: { bid_id: 2, tid: OTHER_COMPETING_TEAM_ID, bid_amount: null },
      original_team_id: ORIGINAL_TEAM_ID
    })

    expect(outcome).to.equal(restricted_free_agency_bid_outcomes.OUTBID)
  })

  it('classifies two null amounts as a tiebreak, not as unreachable', () => {
    const outcome = classify_restricted_free_agency_bid_outcome({
      winning_bid: { bid_id: 1, tid: COMPETING_TEAM_ID, bid_amount: null },
      losing_bid: { bid_id: 2, tid: OTHER_COMPETING_TEAM_ID, bid_amount: null },
      original_team_id: ORIGINAL_TEAM_ID
    })

    expect(outcome).to.equal(restricted_free_agency_bid_outcomes.LOST_TIEBREAK)
  })

  it('falls back to player ineligible when there is no winning bid', () => {
    const outcome = classify_restricted_free_agency_bid_outcome({
      winning_bid: null,
      losing_bid: { bid_id: 2, tid: COMPETING_TEAM_ID, bid_amount: 30 },
      original_team_id: ORIGINAL_TEAM_ID
    })

    expect(outcome).to.equal(
      restricted_free_agency_bid_outcomes.PLAYER_INELIGIBLE
    )
  })

  it('falls back to player ineligible when the losing amount exceeds the winner', () => {
    // Not reachable through the processing loop, which always settles the
    // higher bid first. Asserted so the branch cannot silently become OUTBID.
    const outcome = classify_restricted_free_agency_bid_outcome({
      winning_bid: { bid_id: 1, tid: COMPETING_TEAM_ID, bid_amount: 20 },
      losing_bid: { bid_id: 2, tid: OTHER_COMPETING_TEAM_ID, bid_amount: 44 },
      original_team_id: ORIGINAL_TEAM_ID
    })

    expect(outcome).to.equal(
      restricted_free_agency_bid_outcomes.PLAYER_INELIGIBLE
    )
  })
})
