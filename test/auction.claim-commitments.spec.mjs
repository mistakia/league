/* global describe, it */

import * as chai from 'chai'

import { build_auction_claims } from '#libs-server/auction-settlement.mjs'
import { resolve_auction_player } from '#libs-server/resolve-auction-player.mjs'

const expect = chai.expect

const NOMINATOR = 1

// DRIVEN THROUGH BOTH PURE FUNCTIONS ON PURPOSE, and that is the whole reason
// this file exists rather than another case in `auction.resolver.spec.mjs`.
//
// The resolver spec hands the resolver its commitments directly, so it can
// state what the ranking rule does with a given set and can say nothing about
// which set the builder produces. The defect this covers lives entirely in the
// builder -- a bid that EQUALS an existing claim used to leave no record of
// itself, because the raise was guarded on a strict `<` -- and a fixture that
// injects commitments by hand cannot see it. The only way to control the
// builder is to let it build.
const at = (iso) => new Date(iso).toISOString()

const open_roster = {
  available_space: 5,
  available_cap: 200,
  is_eligible_for_slot: true
}

const resolve_claims = (claims, { opening_bid = 0 } = {}) => {
  const rosters = new Map()
  for (const claim of claims) rosters.set(claim.tid, open_roster)
  return resolve_auction_player({
    claims,
    rosters,
    nominating_team_id: NOMINATOR,
    opening_bid
  })
}

describe('auction claim commitments', function () {
  // X bids $5 at 10:00. Y elects $5 at 10:05. X elects $5 at 10:10, merely
  // confirming money it already has on the wire. All three claims are $5 and
  // none is clamped, so the tiebreak decides the player -- and X committed
  // first.
  const worked_case = () =>
    build_auction_claims({
      elections: [
        {
          tid: 3,
          election_id: 30,
          user_id: 3,
          maximum_bid: 5,
          amount_set_at: at('2026-09-02T10:05:00Z')
        },
        {
          tid: 2,
          election_id: 20,
          user_id: 2,
          maximum_bid: 5,
          amount_set_at: at('2026-09-02T10:10:00Z')
        }
      ],
      bids: [
        {
          tid: NOMINATOR,
          user_id: 1,
          player_salary: 0,
          occurred_at: at('2026-09-02T09:00:00Z')
        },
        {
          tid: 2,
          user_id: 2,
          player_salary: 5,
          occurred_at: at('2026-09-02T10:00:00Z')
        }
      ],
      opening_bid: 0,
      nominating_team_id: NOMINATOR
    })

  it('records a bid that equals an existing claim', function () {
    const claims = worked_case()
    const bidder = claims.find((claim) => claim.tid === 2)

    // Both instants survive. The builder does not choose between them, because
    // which one applies depends on the clamped amount and the caps are not
    // here.
    //
    // Compared as a SET. `earliest_commitment_at` scans the whole array, so
    // nothing downstream reads the order and asserting it would redden this on a
    // reordering that changes no behavior.
    expect(bidder.commitments).to.have.deep.members([
      { amount: 5, at: at('2026-09-02T10:00:00Z') },
      { amount: 5, at: at('2026-09-02T10:10:00Z') }
    ])
    expect(bidder.commitments).to.have.length(2)
    expect(bidder.maximum_bid).to.equal(5)
  })

  it('awards the tie to the team whose money was on the wire first', function () {
    // The end-to-end statement, and the one a manager would recognise: team 2
    // bid at 10:00 and team 3 elected at 10:05, so team 2 wins. Under the strict
    // raise guard team 2's confirming election at 10:10 overwrote its bid
    // instant and handed the player to team 3.
    const result = resolve_claims(worked_case())

    expect(result.winner_tid).to.equal(2)
    expect(result.price).to.equal(5)
  })

  it('keeps the election instant when the election is the only commitment', function () {
    // The control on the case above: same shape, no bid behind team 2, so team
    // 3's earlier election wins. Without this, "team 2 wins" is consistent with
    // a builder that simply prefers team 2 for some other reason.
    const claims = build_auction_claims({
      elections: [
        {
          tid: 3,
          election_id: 30,
          user_id: 3,
          maximum_bid: 5,
          amount_set_at: at('2026-09-02T10:05:00Z')
        },
        {
          tid: 2,
          election_id: 20,
          user_id: 2,
          maximum_bid: 5,
          amount_set_at: at('2026-09-02T10:10:00Z')
        }
      ],
      bids: [
        {
          tid: NOMINATOR,
          user_id: 1,
          player_salary: 0,
          occurred_at: at('2026-09-02T09:00:00Z')
        }
      ],
      opening_bid: 0,
      nominating_team_id: NOMINATOR
    })

    expect(resolve_claims(claims).winner_tid).to.equal(3)
  })

  it('carries every bid a team placed, not only its highest', function () {
    // A live block puts more than one bid per team on the wire, and the earlier
    // smaller one is what covers a clamped amount. Folding them into the highest
    // would lose the instant that decides a clamped tie.
    const claims = build_auction_claims({
      elections: [],
      bids: [
        {
          tid: NOMINATOR,
          user_id: 1,
          player_salary: 1,
          occurred_at: at('2026-09-02T09:00:00Z')
        },
        {
          tid: 2,
          user_id: 2,
          player_salary: 12,
          occurred_at: at('2026-09-02T10:00:00Z')
        },
        {
          tid: 2,
          user_id: 2,
          player_salary: 20,
          occurred_at: at('2026-09-02T11:00:00Z')
        }
      ],
      opening_bid: 1,
      nominating_team_id: NOMINATOR
    })

    const bidder = claims.find((claim) => claim.tid === 2)
    expect(bidder.maximum_bid).to.equal(20)
    expect(bidder.commitments).to.have.deep.members([
      { amount: 12, at: at('2026-09-02T10:00:00Z') },
      { amount: 20, at: at('2026-09-02T11:00:00Z') }
    ])
    expect(bidder.commitments).to.have.length(2)
  })

  it('gives a decline no commitment', function () {
    const claims = build_auction_claims({
      elections: [
        {
          tid: 2,
          election_id: 20,
          user_id: 2,
          maximum_bid: null,
          amount_set_at: at('2026-09-02T10:00:00Z')
        }
      ],
      bids: [
        {
          tid: NOMINATOR,
          user_id: 1,
          player_salary: 0,
          occurred_at: at('2026-09-02T09:00:00Z')
        }
      ],
      opening_bid: 0,
      nominating_team_id: NOMINATOR
    })

    const decliner = claims.find((claim) => claim.tid === 2)
    expect(decliner.maximum_bid).to.equal(null)
    expect(decliner.commitments).to.eql([])
  })
})
