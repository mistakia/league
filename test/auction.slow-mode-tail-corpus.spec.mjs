/* global describe, it */

import fs from 'fs'
import path from 'path'

import * as chai from 'chai'

import { auction_election_outcomes } from '#constants'
import { resolve_auction_player } from '#libs-server/resolve-auction-player.mjs'

const expect = chai.expect

// THE COMPLETENESS AND SETTLEMENT GATE. These ten nominations settled under slow
// mode at the tail of the 2025 auction, and they are the only production
// evidence completeness-based settlement has.
//
// Kept separate from test/auction.second-price-corpus.spec.mjs on purpose, even
// though these ten are a subset of that corpus. The claims are different: nine
// of the ten drew a single bidding team and every one sold for $0-2, so second
// price and the old award-at-standing-bid rule agree by construction and this
// file says almost nothing about pricing. What it does say is that an eligible
// set completes and the player settles to the right team. A failure here is a
// settlement-mechanics failure, and the split is what makes the red run say so.

const corpus = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), 'test/fixtures/auction-2025-slow-mode-tail.json'),
    'utf8'
  )
)

const open_roster = () => ({
  available_space: 99,
  available_cap: 1000,
  is_eligible_for_slot: true
})

const rosters_for = (claims) => {
  const rosters = new Map()
  for (const claim of claims) rosters.set(claim.tid, open_roster())
  return rosters
}

const replay = (nomination) =>
  resolve_auction_player({
    claims: nomination.claims,
    rosters: rosters_for(nomination.claims),
    nominating_team_id: nomination.nominating_team_id,
    opening_bid: nomination.opening_bid
  })

describe('auction 2025 slow-mode tail corpus', function () {
  it('carries the ten nominations the tail is made of', function () {
    expect(corpus.nominations).to.have.lengthOf(10)
    expect(corpus.summary.uncontested).to.equal(9)
    expect(corpus.summary.contested).to.equal(1)
  })

  for (const nomination of corpus.nominations) {
    describe(`${nomination.pid} (sale ${nomination.sale_sequence})`, function () {
      it('settles to the team that actually signed the player', function () {
        const { winner_tid } = replay(nomination)
        expect(winner_tid).to.equal(nomination.actual_winner_tid)
      })

      it('settles at the price the player actually sold for', function () {
        const { price } = replay(nomination)
        expect(price).to.equal(nomination.actual_price)
      })

      it('marks exactly one election won', function () {
        const { outcomes } = replay(nomination)
        const won = [...outcomes.entries()].filter(
          ([, entry]) => entry.outcome === auction_election_outcomes.WON
        )
        expect(won).to.have.lengthOf(1)
        expect(won[0][0]).to.equal(nomination.actual_winner_tid)
      })

      it('assigns an outcome to every team holding a claim', function () {
        const { outcomes } = replay(nomination)
        for (const claim of nomination.claims) {
          expect(
            outcomes.get(claim.tid),
            `team ${claim.tid} left with no outcome on ${nomination.pid}`
          ).to.exist
        }
      })
    })
  }

  // Nine of the ten are the shape the auction is mostly made of: the nominator
  // holds the only claim and wins at their opening bid. There is no all-decline
  // case because nominating is bidding, so an uncontested nomination must always
  // sell rather than going unsold.
  it('sells every uncontested nomination to its nominator at the opening bid', function () {
    const uncontested = corpus.nominations.filter(
      (nomination) => nomination.claims.length === 1
    )
    expect(uncontested).to.have.lengthOf(9)

    for (const nomination of uncontested) {
      const { winner_tid, price } = replay(nomination)
      expect(winner_tid, `${nomination.pid} went unsold`).to.equal(
        nomination.nominating_team_id
      )
      expect(
        price,
        `${nomination.pid} did not sell at its opening bid`
      ).to.equal(nomination.opening_bid)
    }
  })

  it('spends the dollars the tail actually spent', function () {
    const replayed = corpus.nominations.reduce(
      (total, nomination) => total + replay(nomination).price,
      0
    )
    expect(replayed).to.equal(corpus.summary.dollars)
  })
})
