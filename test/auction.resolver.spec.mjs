/* global describe, it */

import * as chai from 'chai'

import { auction_election_outcomes } from '#constants'
import { resolve_auction_player } from '#libs-server/resolve-auction-player.mjs'

const expect = chai.expect

const NOMINATOR = 1

// A team with room and money, which is the uninteresting case every test below
// varies away from one term at a time.
const open_roster = ({
  available_space = 5,
  available_cap = 200,
  is_eligible_for_slot = true
} = {}) => ({ available_space, available_cap, is_eligible_for_slot })

const rosters_for = (claims, overrides = {}) => {
  const map = new Map()
  for (const claim of claims) {
    map.set(claim.tid, overrides[claim.tid] || open_roster())
  }
  return map
}

const at = (iso) => new Date(iso).toISOString()

// A claim states COMMITMENTS -- `{ amount, at }`, "on record for at least this
// much at this instant" -- and never a ranking timestamp, because the ranking
// timestamp is derived from the clamped amount and only the resolver knows the
// caps. The single-commitment claim below is the ordinary case: one election,
// stated once. Cases that turn on the derivation build their commitments
// inline.
//
// A DECLINE gets no commitment. A null maximum is not a position at any price.
const claim = (tid, maximum_bid, at_iso) => ({
  tid,
  maximum_bid,
  commitments:
    maximum_bid === null ? [] : [{ amount: maximum_bid, at: at(at_iso) }]
})

const resolve = (claims, { opening_bid = 0, overrides = {} } = {}) =>
  resolve_auction_player({
    claims,
    rosters: rosters_for(claims, overrides),
    nominating_team_id: NOMINATOR,
    opening_bid
  })

describe('auction settlement resolver', function () {
  describe('second price', function () {
    it('prices at the runner-up maximum plus one increment', function () {
      const result = resolve([
        claim(NOMINATOR, 0, '2026-09-01'),
        claim(2, 20, '2026-09-02'),
        claim(3, 12, '2026-09-02'),
        claim(4, 4, '2026-09-02')
      ])

      expect(result.winner_tid).to.equal(2)
      expect(result.price).to.equal(13)
      expect(result.outcomes.get(3).outcome).to.equal(
        auction_election_outcomes.OUTBID
      )
      expect(result.outcomes.get(4).outcome).to.equal(
        auction_election_outcomes.OUTBID
      )
    })

    it('never charges the winner above their own maximum', function () {
      // The runner-up plus one increment would be 21, above the winner's 20.
      const result = resolve([
        claim(NOMINATOR, 0, '2026-09-01'),
        claim(2, 20, '2026-09-02'),
        claim(3, 20, '2026-09-03')
      ])

      expect(result.price).to.equal(20)
    })

    it('floors the price at the opening bid', function () {
      const result = resolve(
        [claim(NOMINATOR, 5, '2026-09-01'), claim(2, 30, '2026-09-02')],
        { opening_bid: 5 }
      )

      expect(result.winner_tid).to.equal(2)
      expect(result.price).to.equal(6)
    })

    it('sells an uncontested nomination to its nominator at the opening bid', function () {
      // 32% of real players draw a single bid, so this is the mainline, not an
      // edge case. Nominating is bidding: there is no unsold outcome.
      const result = resolve([claim(NOMINATOR, 3, '2026-09-01')], {
        opening_bid: 3
      })

      expect(result.winner_tid).to.equal(NOMINATOR)
      expect(result.price).to.equal(3)
    })

    it('settles a $0 player at $0', function () {
      // 36% of historical wins went for exactly $0.
      const result = resolve([
        claim(NOMINATOR, 0, '2026-09-01'),
        claim(2, 0, '2026-09-02')
      ])

      expect(result.price).to.equal(0)
      expect(result.winner_tid).to.equal(NOMINATOR)
    })
  })

  describe('ties', function () {
    it('awards the nominating team its own player', function () {
      const result = resolve([
        claim(NOMINATOR, 20, '2026-09-05'),
        claim(2, 20, '2026-09-01')
      ])

      expect(result.winner_tid).to.equal(NOMINATOR)
      expect(result.price).to.equal(20)
      expect(result.outcomes.get(2).outcome).to.equal(
        auction_election_outcomes.LOST_TIEBREAK
      )
    })

    it('awards the earliest commitment when neither team nominated', function () {
      const result = resolve([
        claim(NOMINATOR, 0, '2026-09-01'),
        claim(2, 20, '2026-09-04'),
        claim(3, 20, '2026-09-02')
      ])

      expect(result.winner_tid).to.equal(3)
      expect(result.price).to.equal(20)
    })

    it('is deterministic across repeated runs', function () {
      const claims = [
        claim(NOMINATOR, 0, '2026-09-01'),
        claim(2, 7, '2026-09-04'),
        claim(3, 7, '2026-09-02'),
        claim(4, 7, '2026-09-03')
      ]

      const winners = new Set()
      for (let i = 0; i < 25; i++) winners.add(resolve(claims).winner_tid)

      expect(Array.from(winners)).to.eql([3])
    })

    it('ranks on when the amount was committed, not when the row was created', function () {
      // The raise-then-lower sequence is the only gaming vector this rule has:
      // team 2 parked $5 on day one, raised, and dropped back to $20 later, so
      // its only commitment AT $20 is the later instant and it loses. The
      // day-one row is still on file -- `submitted_at` -- and buys it nothing.
      const result = resolve([
        claim(NOMINATOR, 0, '2026-09-01'),
        {
          ...claim(2, 20, '2026-09-05'),
          submitted_at: at('2026-09-01')
        },
        {
          ...claim(3, 20, '2026-09-04'),
          submitted_at: at('2026-09-04')
        }
      ])

      expect(result.winner_tid).to.equal(3)
    })

    // The two defects the commitment shape replaced. Both are ties, both were
    // decided by a timestamp the team never committed the ranked amount at, and
    // in both the loser had put the money up first.
    describe('the instant belongs to the RANKED amount', function () {
      it('ranks a clamped claim on when it covered the clamped amount', function () {
        // Team 2 stated $30 at 10:00 and holds $10. Team 3 stated $10 at 09:00.
        // Both are ranked at $10 -- and team 3 reached $10 first, so it wins.
        // Ranking team 2 on its $30 instant is ranking it on an amount that
        // never took effect; ranking it on 10:00 against 09:00 still loses here,
        // which is why the case that DISCRIMINATES is the one below it.
        const result = resolve(
          [
            claim(NOMINATOR, 0, '2026-09-01'),
            claim(2, 30, '2026-09-02T10:00:00Z'),
            claim(3, 10, '2026-09-02T09:00:00Z')
          ],
          { overrides: { 2: open_roster({ available_cap: 10 }) } }
        )

        expect(result.winner_tid).to.equal(3)
        expect(result.price).to.equal(10)
      })

      it('ranks a clamped claim on the EARLIER commitment that covers it', function () {
        // Team 2 bid $12 at 09:00 and then stated $30 at 11:00, against a $10
        // cap. Its effective maximum is $10, and the $12 bid covers $10 -- so
        // its instant is 09:00, not the 11:00 of a $30 that never took effect.
        // Team 3 committed $10 at 10:00. Team 2 wins on the earlier commitment.
        //
        // This is the case a single stated timestamp gets WRONG: it would rank
        // team 2 at 11:00 and hand the player to team 3.
        const result = resolve(
          [
            claim(NOMINATOR, 0, '2026-09-01'),
            {
              tid: 2,
              maximum_bid: 30,
              commitments: [
                { amount: 12, at: at('2026-09-02T09:00:00Z') },
                { amount: 30, at: at('2026-09-02T11:00:00Z') }
              ]
            },
            claim(3, 10, '2026-09-02T10:00:00Z')
          ],
          { overrides: { 2: open_roster({ available_cap: 10 }) } }
        )

        expect(result.winner_tid).to.equal(2)
        expect(result.price).to.equal(10)
      })

      it('keeps the bid instant when an election merely restates the same amount', function () {
        // The worked case: X bids $5 at 10:00, Y elects $5 at 10:05, X elects $5
        // at 10:10. All three are at $5, none is clamped, and X had real money
        // on the wire before Y said anything -- so X wins. The old raise guard
        // was a strict `<`, so X's own confirming election overwrote its bid
        // instant with 10:10 and handed the player to Y.
        const result = resolve([
          claim(NOMINATOR, 0, '2026-09-01'),
          {
            tid: 2,
            maximum_bid: 5,
            commitments: [
              { amount: 5, at: at('2026-09-02T10:00:00Z') },
              { amount: 5, at: at('2026-09-02T10:10:00Z') }
            ]
          },
          claim(3, 5, '2026-09-02T10:05:00Z')
        ])

        expect(result.winner_tid).to.equal(2)
      })

      it('ignores a commitment that does not cover the ranked amount', function () {
        // Team 2's $4 bid at 08:00 is earlier than everything, and says nothing
        // about $20. It must not buy priority at $20, or every team that ever
        // bid a dollar outranks one that committed the full amount on day one.
        const result = resolve([
          claim(NOMINATOR, 0, '2026-09-01'),
          {
            tid: 2,
            maximum_bid: 20,
            commitments: [
              { amount: 4, at: at('2026-09-02T08:00:00Z') },
              { amount: 20, at: at('2026-09-02T12:00:00Z') }
            ]
          },
          claim(3, 20, '2026-09-02T10:00:00Z')
        ])

        expect(result.winner_tid).to.equal(3)
      })
    })
  })

  describe('declines', function () {
    it('never wins, even alone against the nominator', function () {
      const result = resolve([
        claim(NOMINATOR, 0, '2026-09-01'),
        claim(2, null, '2026-09-02')
      ])

      expect(result.winner_tid).to.equal(NOMINATOR)
      expect(result.outcomes.get(2).outcome).to.equal(
        auction_election_outcomes.DECLINED
      )
    })

    it('never wins on re-resolution after the leader is disqualified', function () {
      const result = resolve(
        [
          claim(NOMINATOR, 1, '2026-09-01'),
          claim(2, 30, '2026-09-02'),
          claim(3, null, '2026-09-01')
        ],
        {
          opening_bid: 1,
          overrides: { 2: open_roster({ available_space: 0 }) }
        }
      )

      expect(result.winner_tid).to.equal(NOMINATOR)
      expect(result.outcomes.get(3).outcome).to.equal(
        auction_election_outcomes.DECLINED
      )
    })
  })

  describe('settlement-time invalidation', function () {
    it('drops a team with no open active spot as roster_full', function () {
      const result = resolve(
        [claim(NOMINATOR, 2, '2026-09-01'), claim(2, 30, '2026-09-02')],
        {
          opening_bid: 2,
          overrides: { 2: open_roster({ available_space: 0 }) }
        }
      )

      expect(result.outcomes.get(2).outcome).to.equal(
        auction_election_outcomes.ROSTER_FULL
      )
      expect(result.winner_tid).to.equal(NOMINATOR)
      expect(result.price).to.equal(2)
    })

    it('drops a team at its position cap as position_limit', function () {
      const result = resolve(
        [claim(NOMINATOR, 0, '2026-09-01'), claim(2, 30, '2026-09-02')],
        { overrides: { 2: open_roster({ is_eligible_for_slot: false }) } }
      )

      expect(result.outcomes.get(2).outcome).to.equal(
        auction_election_outcomes.POSITION_LIMIT
      )
      expect(result.winner_tid).to.equal(NOMINATOR)
    })

    it('drops a team whose effective maximum falls below the price', function () {
      const result = resolve(
        [claim(NOMINATOR, 10, '2026-09-01'), claim(2, 30, '2026-09-02')],
        {
          opening_bid: 10,
          overrides: { 2: open_roster({ available_cap: 4 }) }
        }
      )

      expect(result.outcomes.get(2).outcome).to.equal(
        auction_election_outcomes.BUDGET_EXCEEDED
      )
      expect(result.winner_tid).to.equal(NOMINATOR)
    })

    it('caps an underfunded ceiling rather than invalidating it', function () {
      // Team 2 stated $30 but holds $12. It stays in contention at $12 rather
      // than dropping out, which is what preserves monotonicity.
      const result = resolve(
        [
          claim(NOMINATOR, 0, '2026-09-01'),
          claim(2, 30, '2026-09-02'),
          claim(3, 15, '2026-09-02')
        ],
        { overrides: { 2: open_roster({ available_cap: 12 }) } }
      )

      expect(result.winner_tid).to.equal(3)
      expect(result.price).to.equal(13)
      expect(result.outcomes.get(2).outcome).to.equal(
        auction_election_outcomes.OUTBID
      )
    })

    it('re-resolves to the next claim when the top claim is disqualified', function () {
      const result = resolve(
        [
          claim(NOMINATOR, 0, '2026-09-01'),
          claim(2, 30, '2026-09-02'),
          claim(3, 18, '2026-09-02'),
          claim(4, 9, '2026-09-02')
        ],
        { overrides: { 2: open_roster({ available_space: 0 }) } }
      )

      expect(result.winner_tid).to.equal(3)
      expect(result.price).to.equal(10)
    })
  })

  describe('invariants over generated claim sets', function () {
    // A deterministic sweep rather than a random one: the same 1,000 shapes run
    // on every CI pass, so a failure names a reproducible input.
    const generated = []
    for (let a = 0; a <= 9; a++) {
      for (let b = 0; b <= 9; b++) {
        for (let opening_bid = 0; opening_bid <= 9; opening_bid++) {
          generated.push({ a, b, opening_bid })
        }
      }
    }

    it('never prices above the winning claim or below the opening bid', function () {
      for (const { a, b, opening_bid } of generated) {
        const claims = [
          claim(NOMINATOR, opening_bid, '2026-09-01'),
          claim(2, a, '2026-09-02'),
          claim(3, b, '2026-09-03')
        ]
        const result = resolve(claims, { opening_bid })

        const winning_claim = claims.find(
          (claim) => claim.tid === result.winner_tid
        )
        expect(result.price, `a=${a} b=${b} open=${opening_bid}`).to.be.at.most(
          winning_claim.maximum_bid
        )
        expect(
          result.price,
          `a=${a} b=${b} open=${opening_bid}`
        ).to.be.at.least(opening_bid)
      }
    })

    it('always names exactly one winner and one outcome per claim', function () {
      for (const { a, b, opening_bid } of generated) {
        const claims = [
          claim(NOMINATOR, opening_bid, '2026-09-01'),
          claim(2, a, '2026-09-02'),
          claim(3, null, '2026-09-03'),
          claim(4, b, '2026-09-04')
        ]
        const result = resolve(claims, { opening_bid })

        expect(result.winner_tid).to.not.equal(null)
        expect(result.outcomes.size).to.equal(claims.length)

        const won = Array.from(result.outcomes.values()).filter(
          ({ outcome }) => outcome === auction_election_outcomes.WON
        )
        expect(won.length).to.equal(1)
      }
    })
  })
})
