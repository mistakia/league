/* global describe it */
import * as chai from 'chai'

import {
  auction_election_outcomes,
  auction_election_outcome_values,
  auction_election_outcome_display_names,
  auction_election_outcome_descriptions
} from '#libs-shared/constants/auction-constants.mjs'
import { resolve_auction_player } from '#libs-server/resolve-auction-player.mjs'

const expect = chai.expect

// EVERY OUTCOME IN THE SET MUST HAVE AN INPUT THAT PRODUCES IT.
//
// `auction-constants.mjs` states the rule itself -- "a value with no
// constructible input does not belong in the set", and it already dropped two
// values from the restricted-free-agency shape on exactly that argument. The
// rule needs a gate or it decays: a named state that cannot fire reads to every
// later reader as a case that is handled, and the reader most likely to be
// misled is a manager reading the label off their own settled election.
//
// So this enumerates the outcome set FROM THE MODULE THAT DEFINES IT rather than
// from the names of the cases anyone happened to write, and requires each value
// to be either produced here or declared unconstructible with a reason. Adding a
// value forces that decision instead of allowing it to be skipped.
describe('auction election outcome coverage', function () {
  const NOMINATOR = 1

  const claim = (tid, maximum_bid, committed_at = '2026-09-02') => ({
    tid,
    maximum_bid,
    user_id: 1,
    commitments:
      maximum_bid === null
        ? []
        : [{ amount: maximum_bid, at: new Date(committed_at).toISOString() }]
  })

  const open_roster = ({
    available_space = 5,
    available_cap = 200,
    is_eligible_for_slot = true
  } = {}) => ({ available_space, available_cap, is_eligible_for_slot })

  const outcomes_from = (claims, { opening_bid = 0, overrides = {} } = {}) => {
    const rosters = new Map()
    for (const entry of claims) {
      rosters.set(entry.tid, overrides[entry.tid] || open_roster())
    }
    return resolve_auction_player({
      claims,
      rosters,
      nominating_team_id: NOMINATOR,
      opening_bid
    }).outcomes
  }

  // Each entry constructs the input the constant's own comment names, and
  // returns the outcome the resolver assigned to the team under test.
  const constructions = {
    [auction_election_outcomes.WON]: () =>
      outcomes_from([claim(NOMINATOR, 0), claim(2, 20)]).get(2).outcome,

    [auction_election_outcomes.OUTBID]: () =>
      outcomes_from([claim(NOMINATOR, 0), claim(2, 20), claim(3, 10)]).get(3)
        .outcome,

    // Tied at the top maximum. The nominator takes the player, so the equal
    // claim loses on the tiebreak rather than on the amount -- and this is a
    // MAINLINE path rather than an edge case, since 36% of historical wins went
    // for exactly $0.
    [auction_election_outcomes.LOST_TIEBREAK]: () =>
      outcomes_from([claim(NOMINATOR, 5), claim(2, 5)]).get(2).outcome,

    // A null maximum IS the decline, which is why a pre-nomination decline can
    // be recorded at all -- there is no price yet to record.
    [auction_election_outcomes.DECLINED]: () =>
      outcomes_from([claim(NOMINATOR, 0), claim(2, null)]).get(2).outcome,

    // An effective maximum is min(stated, availableCap), so a ceiling is CAPPED
    // rather than invalidated; this team cannot reach the floor even capped.
    [auction_election_outcomes.BUDGET_EXCEEDED]: () =>
      outcomes_from([claim(NOMINATOR, 10), claim(2, 30)], {
        opening_bid: 10,
        overrides: { 2: open_roster({ available_cap: 3 }) }
      }).get(2).outcome,

    [auction_election_outcomes.ROSTER_FULL]: () =>
      outcomes_from([claim(NOMINATOR, 0), claim(2, 30)], {
        overrides: { 2: open_roster({ available_space: 0 }) }
      }).get(2).outcome,

    [auction_election_outcomes.POSITION_LIMIT]: () =>
      outcomes_from([claim(NOMINATOR, 0), claim(2, 30)], {
        overrides: { 2: open_roster({ is_eligible_for_slot: false }) }
      }).get(2).outcome
  }

  // The two the resolver cannot reach, each with the reason and where it IS
  // reached. Listing them is what keeps the exhaustiveness assertion honest --
  // it is a small, visible hole rather than a silent one.
  const not_produced_by_the_resolver = {
    [auction_election_outcomes.NOT_NOMINATED]:
      'written by sweep_unnominated_auction_elections at auction close, not by ' +
      'resolution -- the player was never nominated, so there is no claim set ' +
      'to resolve. Covered by auction.settlement.spec.mjs.',
    [auction_election_outcomes.PROCESSING_ERROR]:
      'a defensive catch-all in persist_auction_settlement for an election the ' +
      'resolver returned no outcome for. The resolver assigns one outcome per ' +
      'claim, asserted in auction.resolver.spec.mjs, so it has no constructible ' +
      'input by design and carries its message in outcome_detail.'
  }

  for (const [outcome, construct] of Object.entries(constructions)) {
    it(`produces ${outcome} from the input its comment names`, function () {
      expect(construct()).to.equal(outcome)
    })
  }

  // THE GATE. Enumerated from the constant rather than from the cases above, so
  // adding a tenth outcome reds this until somebody either constructs it or
  // writes down why it cannot be constructed.
  it('accounts for every value in the outcome set', function () {
    const accounted = new Set([
      ...Object.keys(constructions),
      ...Object.keys(not_produced_by_the_resolver)
    ])
    const unaccounted = auction_election_outcome_values.filter(
      (value) => !accounted.has(value)
    )

    expect(
      unaccounted,
      `outcome values with neither a construction nor a stated reason: ${unaccounted.join(', ')}`
    ).to.have.length(0)

    // And nothing accounted for that the set no longer carries, which is the
    // other direction the two can drift.
    const stale = [...accounted].filter(
      (value) => !auction_election_outcome_values.includes(value)
    )
    expect(
      stale,
      `accounted for but not in the set: ${stale.join(', ')}`
    ).to.have.length(0)
  })

  // The server writes codes and the client owns every label, so a value with no
  // label renders as a raw code to the manager whose election it settled.
  it('carries a display name and a description for every value', function () {
    for (const value of auction_election_outcome_values) {
      expect(
        auction_election_outcome_display_names[value],
        `display name for ${value}`
      ).to.be.a('string').and.not.empty
      expect(
        auction_election_outcome_descriptions[value],
        `description for ${value}`
      ).to.be.a('string').and.not.empty
    }
  })
})
