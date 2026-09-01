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
        { tid: NOMINATOR, maximum_bid: 0, amount_set_at: at('2026-09-01') },
        { tid: 2, maximum_bid: 20, amount_set_at: at('2026-09-02') },
        { tid: 3, maximum_bid: 12, amount_set_at: at('2026-09-02') },
        { tid: 4, maximum_bid: 4, amount_set_at: at('2026-09-02') }
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
        { tid: NOMINATOR, maximum_bid: 0, amount_set_at: at('2026-09-01') },
        { tid: 2, maximum_bid: 20, amount_set_at: at('2026-09-02') },
        { tid: 3, maximum_bid: 20, amount_set_at: at('2026-09-03') }
      ])

      expect(result.price).to.equal(20)
    })

    it('floors the price at the opening bid', function () {
      const result = resolve(
        [
          { tid: NOMINATOR, maximum_bid: 5, amount_set_at: at('2026-09-01') },
          { tid: 2, maximum_bid: 30, amount_set_at: at('2026-09-02') }
        ],
        { opening_bid: 5 }
      )

      expect(result.winner_tid).to.equal(2)
      expect(result.price).to.equal(6)
    })

    it('sells an uncontested nomination to its nominator at the opening bid', function () {
      // 32% of real players draw a single bid, so this is the mainline, not an
      // edge case. Nominating is bidding: there is no unsold outcome.
      const result = resolve(
        [{ tid: NOMINATOR, maximum_bid: 3, amount_set_at: at('2026-09-01') }],
        { opening_bid: 3 }
      )

      expect(result.winner_tid).to.equal(NOMINATOR)
      expect(result.price).to.equal(3)
    })

    it('settles a $0 player at $0', function () {
      // 36% of historical wins went for exactly $0.
      const result = resolve([
        { tid: NOMINATOR, maximum_bid: 0, amount_set_at: at('2026-09-01') },
        { tid: 2, maximum_bid: 0, amount_set_at: at('2026-09-02') }
      ])

      expect(result.price).to.equal(0)
      expect(result.winner_tid).to.equal(NOMINATOR)
    })
  })

  describe('ties', function () {
    it('awards the nominating team its own player', function () {
      const result = resolve([
        { tid: NOMINATOR, maximum_bid: 20, amount_set_at: at('2026-09-05') },
        { tid: 2, maximum_bid: 20, amount_set_at: at('2026-09-01') }
      ])

      expect(result.winner_tid).to.equal(NOMINATOR)
      expect(result.price).to.equal(20)
      expect(result.outcomes.get(2).outcome).to.equal(
        auction_election_outcomes.LOST_TIEBREAK
      )
    })

    it('awards the earliest amount_set_at when neither team nominated', function () {
      const result = resolve([
        { tid: NOMINATOR, maximum_bid: 0, amount_set_at: at('2026-09-01') },
        { tid: 2, maximum_bid: 20, amount_set_at: at('2026-09-04') },
        { tid: 3, maximum_bid: 20, amount_set_at: at('2026-09-02') }
      ])

      expect(result.winner_tid).to.equal(3)
      expect(result.price).to.equal(20)
    })

    it('is deterministic across repeated runs', function () {
      const claims = [
        { tid: NOMINATOR, maximum_bid: 0, amount_set_at: at('2026-09-01') },
        { tid: 2, maximum_bid: 7, amount_set_at: at('2026-09-04') },
        { tid: 3, maximum_bid: 7, amount_set_at: at('2026-09-02') },
        { tid: 4, maximum_bid: 7, amount_set_at: at('2026-09-03') }
      ]

      const winners = new Set()
      for (let i = 0; i < 25; i++) winners.add(resolve(claims).winner_tid)

      expect(Array.from(winners)).to.eql([3])
    })

    it('ranks on when the amount was last set, not when the row was created', function () {
      // The raise-then-lower sequence is the only gaming vector this rule has:
      // team 2 parked $5 on day one, raised, and dropped back to $20 later, so
      // its amount_set_at is the LATER timestamp and it loses.
      const result = resolve([
        { tid: NOMINATOR, maximum_bid: 0, amount_set_at: at('2026-09-01') },
        {
          tid: 2,
          maximum_bid: 20,
          submitted_at: at('2026-09-01'),
          amount_set_at: at('2026-09-05')
        },
        {
          tid: 3,
          maximum_bid: 20,
          submitted_at: at('2026-09-04'),
          amount_set_at: at('2026-09-04')
        }
      ])

      expect(result.winner_tid).to.equal(3)
    })
  })

  describe('declines', function () {
    it('never wins, even alone against the nominator', function () {
      const result = resolve([
        { tid: NOMINATOR, maximum_bid: 0, amount_set_at: at('2026-09-01') },
        { tid: 2, maximum_bid: null, amount_set_at: at('2026-09-02') }
      ])

      expect(result.winner_tid).to.equal(NOMINATOR)
      expect(result.outcomes.get(2).outcome).to.equal(
        auction_election_outcomes.DECLINED
      )
    })

    it('never wins on re-resolution after the leader is disqualified', function () {
      const result = resolve(
        [
          { tid: NOMINATOR, maximum_bid: 1, amount_set_at: at('2026-09-01') },
          { tid: 2, maximum_bid: 30, amount_set_at: at('2026-09-02') },
          { tid: 3, maximum_bid: null, amount_set_at: at('2026-09-01') }
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
        [
          { tid: NOMINATOR, maximum_bid: 2, amount_set_at: at('2026-09-01') },
          { tid: 2, maximum_bid: 30, amount_set_at: at('2026-09-02') }
        ],
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
        [
          { tid: NOMINATOR, maximum_bid: 0, amount_set_at: at('2026-09-01') },
          { tid: 2, maximum_bid: 30, amount_set_at: at('2026-09-02') }
        ],
        { overrides: { 2: open_roster({ is_eligible_for_slot: false }) } }
      )

      expect(result.outcomes.get(2).outcome).to.equal(
        auction_election_outcomes.POSITION_LIMIT
      )
      expect(result.winner_tid).to.equal(NOMINATOR)
    })

    it('drops a team whose effective maximum falls below the price', function () {
      const result = resolve(
        [
          { tid: NOMINATOR, maximum_bid: 10, amount_set_at: at('2026-09-01') },
          { tid: 2, maximum_bid: 30, amount_set_at: at('2026-09-02') }
        ],
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
          { tid: NOMINATOR, maximum_bid: 0, amount_set_at: at('2026-09-01') },
          { tid: 2, maximum_bid: 30, amount_set_at: at('2026-09-02') },
          { tid: 3, maximum_bid: 15, amount_set_at: at('2026-09-02') }
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
          { tid: NOMINATOR, maximum_bid: 0, amount_set_at: at('2026-09-01') },
          { tid: 2, maximum_bid: 30, amount_set_at: at('2026-09-02') },
          { tid: 3, maximum_bid: 18, amount_set_at: at('2026-09-02') },
          { tid: 4, maximum_bid: 9, amount_set_at: at('2026-09-02') }
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
          {
            tid: NOMINATOR,
            maximum_bid: opening_bid,
            amount_set_at: at('2026-09-01')
          },
          { tid: 2, maximum_bid: a, amount_set_at: at('2026-09-02') },
          { tid: 3, maximum_bid: b, amount_set_at: at('2026-09-03') }
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
          {
            tid: NOMINATOR,
            maximum_bid: opening_bid,
            amount_set_at: at('2026-09-01')
          },
          { tid: 2, maximum_bid: a, amount_set_at: at('2026-09-02') },
          { tid: 3, maximum_bid: null, amount_set_at: at('2026-09-03') },
          { tid: 4, maximum_bid: b, amount_set_at: at('2026-09-04') }
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
