/* global describe it */

import * as chai from 'chai'

import { calculate_wager_summary } from '#libs-server/wager-analysis/wager-calculations.mjs'
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
