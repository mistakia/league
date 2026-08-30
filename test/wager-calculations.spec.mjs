/* global describe it */

import * as chai from 'chai'

import {
  calculate_props_summary,
  calculate_wager_summary,
  format_american_odds_as_fractional,
  format_metric_result,
  format_threshold_distance,
  is_real_price
} from '#libs-server/wager-analysis/wager-calculations.mjs'
import { create_wager_summary_table } from '#libs-server/wager-analysis/wager-table-formatters.mjs'

const expect = chai.expect

// Two wagers whose potential_win values DIFFER, so a sum and a maximum give
// different answers. A fixture where they matched could not tell the two
// aggregations apart and would pass against either implementation.
const settled_win = {
  selections: [{ event_id: 1, selection_id: 1, is_won: true }],
  is_settled: true,
  is_won: true,
  stake: 10,
  actual_return: 60,
  potential_win: 60,
  parsed_odds: 500
}

const open_wager = {
  selections: [{ event_id: 2, selection_id: 2 }],
  is_settled: false,
  stake: 20,
  potential_win: 250,
  parsed_odds: 1200
}

describe('LIBS-SERVER wager-calculations', function () {
  describe('total_potential_win', function () {
    it('sums potential_win across wagers rather than taking the maximum', () => {
      const summary = calculate_wager_summary({
        wagers: [settled_win, open_wager]
      })

      expect(summary.total_potential_win).to.equal(310)

      // The name is the point of this spec: the field claimed to be a maximum
      // for as long as it was called max_potential_win, and 250 is what a
      // maximum would return here.
      expect(summary.total_potential_win).to.not.equal(250)
    })

    it('counts settled and open wagers alike', () => {
      const open_only = calculate_wager_summary({ wagers: [open_wager] })
      const both = calculate_wager_summary({
        wagers: [settled_win, open_wager]
      })

      // open_potential_win is the field that filters on settlement; the total
      // does not, which is what distinguishes them.
      expect(open_only.open_potential_win).to.equal(250)
      expect(both.open_potential_win).to.equal(250)
      expect(both.total_potential_win).to.equal(310)
    })

    it('treats a missing potential_win as zero', () => {
      const summary = calculate_wager_summary({
        wagers: [settled_win, { ...open_wager, potential_win: undefined }]
      })

      expect(summary.total_potential_win).to.equal(60)
    })
  })

  describe('max_wager_odds', function () {
    it('is a real maximum, unlike the total_ fields beside it', () => {
      const summary = calculate_wager_summary({
        wagers: [settled_win, open_wager]
      })

      // The finding that prompted the rename was that two adjacent fields
      // claimed the same aggregation for different operations. This holds the
      // other half: max_wager_odds must NOT become a sum (1700).
      expect(summary.max_wager_odds).to.equal(1200)
    })
  })

  // b89f5ab53 rewrote 245 lines of this module and introduced both mechanisms
  // below. Neither had a case until now, and both decide money.
  describe('wagers_by_odds_range', function () {
    const priced = (parsed_odds) => ({
      selections: [{ event_id: 1, selection_id: 1 }],
      is_settled: false,
      stake: 1,
      potential_win: 1,
      parsed_odds
    })

    it('files a price AT a bucket bound in the bucket above it', () => {
      // ODDS_BUCKETS is scanned for the first `wager_odds < upper_bound`, so
      // the bound is exclusive and +100 belongs to range_100_400. Flipping the
      // comparison to <= moves all three of these one bucket down, which is
      // exactly the off-by-one a fixture of interior values cannot see.
      const summary = calculate_wager_summary({
        wagers: [priced(99), priced(100), priced(400)]
      })

      expect(summary.wagers_by_odds_range.under_100).to.equal(1)
      expect(summary.wagers_by_odds_range.range_100_400).to.equal(1)
      expect(summary.wagers_by_odds_range.range_400_1000).to.equal(1)
    })

    it('files a negative price under_100 rather than dropping it', () => {
      // A favourite is the most common price there is. `find` returning
      // undefined for it would silently drop the wager from the histogram
      // while still counting it in `wagers`, so the two disagree.
      const summary = calculate_wager_summary({ wagers: [priced(-110)] })

      expect(summary.wagers_by_odds_range.under_100).to.equal(1)
      expect(summary.wagers).to.equal(1)
    })

    it('catches the top bucket, so no price falls out of the histogram', () => {
      // over_1000000 carries Infinity as its bound. A finite bound there sends
      // `find` to undefined and increment_odds_bucket returns the counts
      // unchanged -- a silent drop, not an error.
      const summary = calculate_wager_summary({
        wagers: [priced(1000000), priced(Number.MAX_SAFE_INTEGER)]
      })
      const histogram_total = Object.values(
        summary.wagers_by_odds_range
      ).reduce((total, count) => total + count, 0)

      expect(summary.wagers_by_odds_range.over_1000000).to.equal(2)
      expect(histogram_total).to.equal(summary.wagers)
    })

    it('leaves a wager carrying no price out of the histogram entirely', () => {
      // Odds of 0 mean "no price", per the module's own comment. It must not
      // land in under_100, which would drag the average price down.
      const summary = calculate_wager_summary({ wagers: [priced(0)] })
      const histogram_total = Object.values(
        summary.wagers_by_odds_range
      ).reduce((total, count) => total + count, 0)

      expect(summary.wagers).to.equal(1)
      expect(summary.wagers_with_odds).to.equal(0)
      expect(histogram_total).to.equal(0)
    })
  })

  describe('gross return', function () {
    const lost_leg_wager = {
      selections: [{ event_id: 1, selection_id: 1, is_lost: true }],
      is_settled: true,
      stake: 10,
      potential_win: 60
    }

    it('pays a hypothetical win its potential, not the nothing it really returned', () => {
      // The wager genuinely lost and the book paid 0. Asking "what if this prop
      // had hit" is the whole point of `props`, so only potential_win can
      // express the answer -- `actual_return ?? potential_win` would read the
      // real 0 here and report the counterfactual as a break-even.
      const summary = calculate_wager_summary({
        wagers: [{ ...lost_leg_wager, actual_return: 0 }],
        props: [{ event_id: 1, selection_id: 1 }]
      })

      expect(summary.wagers_won).to.equal(1)
      expect(summary.total_return).to.equal(60)
      expect(summary.total_won).to.equal(50)
    })

    it('prefers what the book actually paid on a real win', () => {
      // A real win must NOT read potential_win, or a partially-voided or
      // reduced-odds settlement reports profit the book never paid.
      const summary = calculate_wager_summary({
        wagers: [
          {
            selections: [{ event_id: 1, selection_id: 1, is_won: true }],
            is_settled: true,
            is_won: true,
            stake: 10,
            potential_win: 60,
            actual_return: 55
          }
        ]
      })

      expect(summary.total_return).to.equal(55)
      expect(summary.total_won).to.equal(45)
    })

    it('returns nothing for a lost wager even when the book recorded a payout', () => {
      // is_lost short-circuits ahead of the `actual_return || 0` tail. Without
      // it a stray actual_return on a losing wager becomes phantom profit.
      const summary = calculate_wager_summary({
        wagers: [{ ...lost_leg_wager, actual_return: 999 }]
      })

      expect(summary.wagers_loss).to.equal(1)
      expect(summary.total_return).to.equal(0)
      expect(summary.total_won).to.equal(0)
    })

    it('contributes nothing from an open wager', () => {
      const summary = calculate_wager_summary({
        wagers: [
          {
            selections: [{ event_id: 1, selection_id: 1 }],
            is_settled: false,
            stake: 10,
            potential_win: 60
          }
        ]
      })

      expect(summary.wagers_open).to.equal(1)
      expect(summary.total_return).to.equal(0)
    })
  })

  describe('calculate_props_summary', function () {
    it('counts every selection, hits only the winners, and sums implied probability', () => {
      // +100 implies 0.5 and -200 implies 0.6667; a selection with no price
      // contributes 0 to the implied total but still counts as a selection, so
      // the three fields cannot be collapsed into one another.
      const summary = calculate_props_summary([
        { event_id: 1, selection_id: 1, parsed_odds: 100, is_won: true },
        { event_id: 1, selection_id: 2, parsed_odds: -200, is_won: false },
        { event_id: 1, selection_id: 3, is_won: true }
      ])

      expect(summary.total_selections).to.equal(3)
      expect(summary.actual_hits).to.equal(2)
      expect(summary.market_implied_hits).to.be.closeTo(1.1667, 0.0001)
    })

    it('returns a zeroed summary for no props rather than NaN', () => {
      // Vacuity guard: the cases above compare against a populated fixture, so
      // an implementation that returned the seed unconditionally would still
      // need this to hold.
      const summary = calculate_props_summary([])

      expect(summary.total_selections).to.equal(0)
      expect(summary.actual_hits).to.equal(0)
      expect(summary.market_implied_hits).to.equal(0)
    })
  })

  describe('display formatters', function () {
    it('formats a metric result to one decimal, and a missing one as a dash', () => {
      expect(format_metric_result(12.34)).to.equal('12.3')
      // Zero is a real measurement and must not take the null branch.
      expect(format_metric_result(0)).to.equal('0.0')
      expect(format_metric_result(null)).to.equal('-')
      expect(format_metric_result(undefined)).to.equal('-')
    })

    it('signs a threshold distance only when it is above the line', () => {
      expect(format_threshold_distance(2.5)).to.equal('+2.5')
      expect(format_threshold_distance(-2.5)).to.equal('-2.5')
      // Exactly on the line is neither above nor below: `distance > 0` is
      // false, so no plus sign. A `>=` here would read as beating the line.
      expect(format_threshold_distance(0)).to.equal('0.0')
      expect(format_threshold_distance(null)).to.equal('-')
    })

    it('converts American odds to a profit ratio over 1', () => {
      // decimal - 1: +500 pays 5 to 1, -110 pays 0.91 to 1. Dropping the -1
      // reports the stake as profit on every row.
      expect(format_american_odds_as_fractional(500)).to.equal('5.00/1')
      expect(format_american_odds_as_fractional(-110)).to.equal('0.91/1')
      expect(format_american_odds_as_fractional(null)).to.equal('-')
      expect(format_american_odds_as_fractional(undefined)).to.equal('-')
    })

    it('renders anything that is not a real price as a dash', () => {
      // b89f5ab53 removed a try/catch here. It was already dead code -- oddslib
      // returns NaN rather than throwing -- so every one of these used to reach
      // the arithmetic and render 'NaN/1' or '0.00/1' on the row.
      expect(format_american_odds_as_fractional(NaN)).to.equal('-')
      expect(format_american_odds_as_fractional(Infinity)).to.equal('-')
      // Off-contract, and reachable: parsed_odds comes from three books' JSON
      // exports, so a string is what a changed export shape actually delivers.
      expect(format_american_odds_as_fractional('abc')).to.equal('-')
    })
  })

  describe('is_real_price', function () {
    it('agrees with the summary about which wagers carry a price', () => {
      // The defect this closes: a 0-odds wager was excluded from the summary's
      // odds statistics AND rendered as '0.00/1' by the formatter, so the same
      // wager was unpriced in one half of the module and even money in the
      // other. Asserting the two halves against the shared predicate is what
      // stops them drifting apart again -- checking either alone cannot.
      const unpriced = [0, NaN, null, undefined]

      for (const parsed_odds of unpriced) {
        const summary = calculate_wager_summary({
          wagers: [
            {
              selections: [{ event_id: 1, selection_id: 1 }],
              is_settled: false,
              stake: 1,
              potential_win: 1,
              parsed_odds
            }
          ]
        })

        expect(
          is_real_price(parsed_odds),
          `${parsed_odds} is not a price`
        ).to.equal(false)
        expect(
          summary.wagers_with_odds,
          `the summary must not count ${parsed_odds} as a price`
        ).to.equal(0)
        expect(
          format_american_odds_as_fractional(parsed_odds),
          `the formatter must not render ${parsed_odds} as a price`
        ).to.equal('-')
      }
    })

    it('accepts the prices a book does offer', () => {
      // Vacuity guard for the case above: without it, a predicate that
      // returned false for everything would satisfy every assertion there.
      for (const parsed_odds of [100, -110, 1, -1, 1000000]) {
        expect(
          is_real_price(parsed_odds),
          `${parsed_odds} is a price`
        ).to.equal(true)
        expect(format_american_odds_as_fractional(parsed_odds)).to.not.equal(
          '-'
        )
      }
    })
  })

  describe('create_wager_summary_table', function () {
    const rows_of = (summary) =>
      create_wager_summary_table(
        summary,
        { total_selections: 2 },
        true,
        true
      ).table.rows.map((row) => row.text ?? row)

    it('labels the summed field Total Potential Win', () => {
      const summary = calculate_wager_summary({
        wagers: [settled_win, open_wager]
      })
      const labels = rows_of(summary).map((row) => row.Metric)

      expect(labels).to.include('Total Potential Win')
      expect(labels).to.include('Total Potential ROI')
      expect(labels).to.not.include('Max Potential Win')
      expect(labels).to.not.include('Max Potential ROI')
    })

    it('still applies thousands separators after the relabel', () => {
      // add_row formats on `label.includes('Potential Win')`, so the label text
      // is load-bearing: a rename that dropped that substring would silently
      // stop formatting. A value below 1000 cannot detect it.
      const summary = calculate_wager_summary({
        wagers: [settled_win, { ...open_wager, potential_win: 1234567 }]
      })
      const row = rows_of(summary).find(
        (candidate) => candidate.Metric === 'Total Potential Win'
      )

      expect(row.Value).to.equal('1,234,627')
    })
  })
})
