/* global describe it */
import * as chai from 'chai'

import calculatePrices from '#libs-shared/calculate-prices.mjs'
import get_discretionary_cap from '#libs-shared/get-discretionary-cap.mjs'

const expect = chai.expect

// A league format is only ever read for the fields get_discretionary_cap and the
// pricing_model gate need, so the fixture carries exactly those. min_bid 0 keeps
// the discretionary cap equal to the full cap, which makes the expected dollar
// figures below readable by hand.
const league_format = {
  num_teams: 10,
  cap: 200,
  min_bid: 0,
  starter_slots_quarterback: 1,
  starter_slots_running_back: 2,
  starter_slots_wide_receiver: 3,
  starter_slots_tight_end: 1,
  starter_slots_running_back_wide_receiver_flex: 0,
  srbwrte: 1,
  sqbrbwrte: 0,
  starter_slots_wide_receiver_tight_end_flex: 0,
  starter_slots_defense_special_teams: 1,
  starter_slots_kicker: 1,
  bench_slot_count: 7,
  practice_squad_slot_count: 4,
  reserve_short_term_limit: 3
}

const make_players = (pts_added_by_pid, aggregate_key) =>
  Object.entries(pts_added_by_pid).map(([pid, value]) => ({
    pid,
    pts_added: { [aggregate_key]: value }
  }))

describe('LIBS-SHARED calculate-prices', function () {
  describe('denominator', function () {
    // The defect this spec exists for. A signed aggregate sums NEGATIVE across
    // the board -- measured at -41,841.3 against 3,114.5 of positive parts on
    // live 2026 genesis_10_team rest-of-season data -- so a raw-total
    // denominator yields a negative rate, every price computes negative, every
    // one hits the floor, and the entire board prices at $0 with no error.
    it('prices a signed aggregate whose raw total is negative', function () {
      // Three players clear replacement; the rest sit far below it, which is
      // what drives the raw sum negative. Positive parts sum to 60.
      const pts_added = { a: 30, b: 20, c: 10 }
      for (let i = 0; i < 40; i++) {
        pts_added[`sub_${i}`] = -25
      }

      const raw_total = Object.values(pts_added).reduce((a, b) => a + b, 0)
      const positive_total = Object.values(pts_added)
        .filter((value) => value > 0)
        .reduce((a, b) => a + b, 0)
      expect(raw_total).to.be.lessThan(0)
      expect(positive_total).to.equal(60)

      const players = calculatePrices({
        league_format,
        players: make_players(pts_added, 'net'),
        aggregate_key: 'net'
      })

      const by_pid = Object.fromEntries(players.map((p) => [p.pid, p]))

      // rate = 2000 discretionary cap / 60 positive parts = 33.33 per point
      const rate = get_discretionary_cap(league_format) / positive_total
      expect(by_pid.a.market_salary.net).to.equal(Math.round(rate * 30))
      expect(by_pid.b.market_salary.net).to.equal(Math.round(rate * 20))
      expect(by_pid.c.market_salary.net).to.equal(Math.round(rate * 10))

      // Every player with a positive aggregate prices strictly positive...
      for (const pid of ['a', 'b', 'c']) {
        expect(by_pid[pid].market_salary.net).to.be.greaterThan(0)
      }
      // ...and every player below replacement prices at $0 rather than negative.
      for (let i = 0; i < 40; i++) {
        expect(by_pid[`sub_${i}`].market_salary.net).to.equal(0)
      }
    })

    // The control. A test that cannot fail against the pre-change arithmetic
    // proves nothing, so the raw-total denominator is reproduced here directly.
    //
    // Its failure mode is worse than "the board prices at $0", which is how it
    // was recorded before this spec measured it. A negative rate times a
    // NEGATIVE aggregate is POSITIVE, so the board INVERTS: every player above
    // replacement floors to $0 and every player below replacement prices
    // positive, in proportion to how far below he is. The output is a populated,
    // plausible-looking board that ranks the population upside down.
    it('inverts the board under a raw-total denominator', function () {
      const pts_added = { a: 30, b: 20, c: 10 }
      for (let i = 0; i < 40; i++) {
        pts_added[`sub_${i}`] = -25
      }

      const raw_total = Object.values(pts_added).reduce((a, b) => a + b, 0)
      const rate = get_discretionary_cap(league_format) / raw_total
      expect(rate).to.be.lessThan(0)

      const price = (value) => Math.max(Math.round(rate * value) || 0, 0)

      // Every player who actually clears replacement is priced at nothing.
      for (const pid of ['a', 'b', 'c']) {
        expect(price(pts_added[pid])).to.equal(0)
      }
      // ...while every player below it carries a salary.
      expect(price(pts_added.sub_0)).to.be.greaterThan(0)

      // And the fix reverses exactly that ordering.
      const players = calculatePrices({
        league_format,
        players: make_players(pts_added, 'net'),
        aggregate_key: 'net'
      })
      const by_pid = Object.fromEntries(players.map((p) => [p.pid, p]))
      expect(by_pid.a.market_salary.net).to.be.greaterThan(0)
      expect(by_pid.sub_0.market_salary.net).to.equal(0)
    })

    // Σ max(x, 0) = Σ x wherever x >= 0, which is why deriving the denominator
    // cannot move any aggregate the system priced before this change.
    it('is unchanged for a non-negative aggregate', function () {
      const pts_added = { a: 30, b: 20, c: 10, d: 0 }
      const positive_total = 60

      const players = calculatePrices({
        league_format,
        players: make_players(pts_added, 'ros'),
        aggregate_key: 'ros'
      })

      const rate = get_discretionary_cap(league_format) / positive_total
      const by_pid = Object.fromEntries(players.map((p) => [p.pid, p]))
      for (const [pid, value] of Object.entries(pts_added)) {
        expect(by_pid[pid].market_salary.ros).to.equal(
          Math.max(Math.round(rate * value) || 0, 0)
        )
      }
    })

    // The -999 sentinel marks a player who was never priced. It must not reach
    // the denominator, and max() is what keeps it out.
    it('excludes the -999 sentinel from the denominator', function () {
      const with_sentinel = calculatePrices({
        league_format,
        players: make_players({ a: 30, b: 20, c: 10, absent: -999 }, 'ros'),
        aggregate_key: 'ros'
      })
      const without_sentinel = calculatePrices({
        league_format,
        players: make_players({ a: 30, b: 20, c: 10 }, 'ros'),
        aggregate_key: 'ros'
      })

      expect(with_sentinel[0].market_salary.ros).to.equal(
        without_sentinel[0].market_salary.ros
      )
      expect(with_sentinel[3].market_salary.ros).to.equal(0)
    })

    // Two variants of the same board are genuinely different quantities, not a
    // rescale: a player can carry a positive positive-only aggregate and a
    // negative net one, so he belongs in the first denominator and not the
    // second. Measured live at 3,230.7 against 3,114.5.
    it('prices each variant against its own population', function () {
      const players = [
        { pid: 'a', pts_added: { ros: 30, ros_net: 30 } },
        { pid: 'b', pts_added: { ros: 20, ros_net: 20 } },
        // Positive on the positive-only variant, negative on the net one.
        { pid: 'c', pts_added: { ros: 10, ros_net: -40 } }
      ]

      calculatePrices({ league_format, players, aggregate_key: 'ros' })
      calculatePrices({ league_format, players, aggregate_key: 'ros_net' })

      const cap = get_discretionary_cap(league_format)
      // ros denominator is 60; ros_net denominator is 50.
      expect(players[0].market_salary.ros).to.equal(Math.round((cap / 60) * 30))
      expect(players[0].market_salary.ros_net).to.equal(
        Math.round((cap / 50) * 30)
      )
      expect(players[0].market_salary.ros_net).to.be.greaterThan(
        players[0].market_salary.ros
      )
      expect(players[2].market_salary.ros).to.be.greaterThan(0)
      expect(players[2].market_salary.ros_net).to.equal(0)
    })

    // Dividing by zero would price every player at Infinity, and the `|| 0`
    // guard on the product does NOT catch it. Leaving the board unpriced is the
    // honest answer; the generators assert on the unpriced count themselves.
    it('leaves the board unpriced when no player clears replacement', function () {
      const players = calculatePrices({
        league_format,
        players: make_players({ a: -5, b: -10 }, 'net'),
        aggregate_key: 'net'
      })

      for (const player of players) {
        expect(player.market_salary).to.equal(undefined)
      }
    })
  })

  describe('pricing_model gate', function () {
    it('declines to price a dfs_fixed format', function () {
      const players = calculatePrices({
        league_format: { ...league_format, pricing_model: 'dfs_fixed' },
        players: make_players({ a: 30, b: 20 }, 'earned'),
        aggregate_key: 'earned'
      })

      for (const player of players) {
        expect(player.market_salary).to.equal(undefined)
      }
    })
  })
})
