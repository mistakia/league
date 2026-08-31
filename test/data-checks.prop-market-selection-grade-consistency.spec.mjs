/* global describe, it, before, after */

import * as chai from 'chai'

import db from '#db'
import registry from '#db/checks/registry.mjs'
import { classify_check_rows } from '#libs-server/data-check.mjs'

const expect = chai.expect

/*
  The states of prop-market-selection-grade-consistency, driven through the
  SHIPPED expression rather than a copy of it.

  This check's whole value is that it reads settlement OUTPUT, so the defect it
  hunts is a row that looks perfectly well-formed and simply disagrees with
  itself. That failure mode is silent by construction: every column is
  populated, every type is right, and no constraint objects. A green here
  therefore proves nothing unless a planted disagreement is shown to turn it
  red, and unless the correctly-graded rows beside it are shown NOT to.

  So the corpus plants all four gradeable shapes against one another:

    WON / LOST     the two ordinary correct gradings, which must stay silent
    PUSH           metric exactly on the line, the third branch -- planted
                   because a predicate that dropped it would still report the
                   violation and look correct
    INVERTED       the defect: numbers that give LOST carrying WON

  and three non-gradeable shapes that must each be handled differently:

    MISSING OPERAND   settled with no metric -- un-gradeable, counted, never
                      graded, because a settlement path writing results it
                      cannot substantiate would otherwise shrink the population
                      and make this check report CLEANER
    OUT OF SCOPE      a YES selection, whose grading rule these two operands do
                      not express -- absent from the scan entirely, not merely
                      un-gradeable
    NOTHING GRADEABLE a book holding only un-gradeable rows, which must emit no
                      graded arm at all rather than a clean sentinel over a
                      population of zero

  The clean book is the negative control that makes the finding meaningful: a
  predicate matching everything would light it up too.
*/

const CHECK = registry.find(
  (check) => check.check_id === 'prop-market-selection-grade-consistency'
)

// Values drawn from different distributions per grain column, so a
// transposition between two of them changes the key rather than reading
// identically in the output.
const LINE = 64.5
const OVER_LINE = 70.0
const UNDER_LINE = 30.0

// The book carrying the planted defect, the book that must stay clean, and the
// book with nothing to grade. Three real source_id values so the enum is
// exercised as the shipped query casts it.
const DEFECT_BOOK = 'FANDUEL'
const CLEAN_BOOK = 'PRIZEPICKS'
const EMPTY_BOOK = 'CAESARS'

const seed_row = ({
  source_id,
  source_market_id,
  source_selection_id,
  selection_type = 'OVER',
  selection_metric_line = LINE,
  metric_result_value = OVER_LINE,
  selection_result = 'WON',
  time_type = 'CLOSE'
}) => ({
  source_id,
  source_market_id,
  source_selection_id,
  selection_type,
  selection_metric_line,
  metric_result_value,
  selection_result,
  time_type,
  observed_at: new Date('2025-11-02T17:00:00Z')
})

const CORPUS = [
  // Correct gradings. Each must stay silent, and together they are what stops
  // a match-everything predicate from passing this spec.
  seed_row({
    source_id: DEFECT_BOOK,
    source_market_id: 'mkt-correct-won',
    source_selection_id: 'sel-over-won',
    selection_type: 'OVER',
    metric_result_value: OVER_LINE,
    selection_result: 'WON'
  }),
  seed_row({
    source_id: DEFECT_BOOK,
    source_market_id: 'mkt-correct-lost',
    source_selection_id: 'sel-under-lost',
    selection_type: 'UNDER',
    metric_result_value: OVER_LINE,
    selection_result: 'LOST'
  }),
  // The third branch. Metric exactly on the line grades PUSH, and planting it
  // is what proves the branch is live rather than dead code the violation arm
  // happens to skip.
  seed_row({
    source_id: DEFECT_BOOK,
    source_market_id: 'mkt-correct-push',
    source_selection_id: 'sel-over-push',
    selection_type: 'OVER',
    selection_metric_line: LINE,
    metric_result_value: LINE,
    selection_result: 'PUSH'
  }),
  // THE DEFECT. 70.0 over a 64.5 line is a WON for OVER; this row says LOST.
  seed_row({
    source_id: DEFECT_BOOK,
    source_market_id: 'mkt-inverted',
    source_selection_id: 'sel-over-inverted',
    selection_type: 'OVER',
    metric_result_value: OVER_LINE,
    selection_result: 'LOST'
  }),
  // Settled with no metric: un-gradeable, and counted so it cannot shrink the
  // population silently.
  seed_row({
    source_id: DEFECT_BOOK,
    source_market_id: 'mkt-no-metric',
    source_selection_id: 'sel-no-metric',
    selection_type: 'OVER',
    metric_result_value: null,
    selection_result: 'WON'
  }),
  // Out of scope by selection_type, not merely un-gradeable. A YES selection
  // grades by a rule these operands do not express.
  seed_row({
    source_id: DEFECT_BOOK,
    source_market_id: 'mkt-yes',
    source_selection_id: 'sel-yes',
    selection_type: 'YES',
    selection_metric_line: null,
    metric_result_value: null,
    selection_result: 'WON'
  }),
  // The clean book.
  seed_row({
    source_id: CLEAN_BOOK,
    source_market_id: 'mkt-clean',
    source_selection_id: 'sel-under-won',
    selection_type: 'UNDER',
    metric_result_value: UNDER_LINE,
    selection_result: 'WON'
  }),
  // A book with nothing gradeable at all.
  seed_row({
    source_id: EMPTY_BOOK,
    source_market_id: 'mkt-empty-book',
    source_selection_id: 'sel-empty-book',
    selection_type: 'OVER',
    metric_result_value: null,
    selection_result: 'WON'
  })
]

describe('data checks / prop-market-selection-grade-consistency', function () {
  this.timeout(30000)

  /** @type {Record<string, any>[]} */
  let rows

  before(async function () {
    // The check scans the whole table, so the corpus has to be the whole
    // table. Mocha runs serially and the isolated database is discarded after
    // the run.
    await db('prop_market_selections_index').del()
    await db('prop_market_selections_index').insert(CORPUS)
    rows = await CHECK.rows()
  })

  after(async function () {
    await db('prop_market_selections_index').del()
  })

  const graded_rows = () => rows.filter((row) => row.is_gradeable)
  const rows_for = (source_id) =>
    rows.filter((row) => row.source_id === source_id)

  it('reports the planted disagreement as a violation', function () {
    const violations = graded_rows().filter((row) => row.numerator > 0)

    expect(violations).to.have.lengthOf(1)
    expect(violations[0].source_market_id).to.equal('mkt-inverted')
    expect(violations[0].source_selection_id).to.equal('sel-over-inverted')
    expect(violations[0].time_type).to.equal('CLOSE')
    expect(violations[0].source_id).to.equal(DEFECT_BOOK)
  })

  it('leaves every correctly graded row silent, including the PUSH branch', function () {
    // The negative control. A predicate matching everything reports four
    // violations here rather than one, and a predicate that dropped the equal
    // case would still report the one above and look correct.
    const flagged = graded_rows()
      .filter((row) => row.numerator > 0)
      .map((row) => row.source_market_id)

    expect(flagged).to.not.include('mkt-correct-won')
    expect(flagged).to.not.include('mkt-correct-lost')
    expect(flagged).to.not.include('mkt-correct-push')
  })

  it('counts the PUSH row in the graded population rather than skipping it', function () {
    // Four gradeable rows in the defect book: two correct, one PUSH, one
    // inverted. A denominator of three would mean the equal case never
    // reached the scan.
    const denominators = rows_for(DEFECT_BOOK)
      .filter((row) => row.is_gradeable)
      .map((row) => row.denominator)

    expect(denominators).to.not.be.empty
    for (const denominator of denominators) {
      expect(denominator).to.equal(4)
    }
  })

  it('emits a clean sentinel for a book with no disagreement', function () {
    const clean = rows_for(CLEAN_BOOK).filter((row) => row.is_gradeable)

    expect(clean).to.have.lengthOf(1)
    expect(clean[0].numerator).to.equal(0)
    expect(clean[0].denominator).to.equal(1)
    expect(clean[0].source_market_id).to.equal('__clean__')
  })

  it('reports a settled row missing an operand as un-gradeable, and counts it', function () {
    const ungradeable = rows_for(DEFECT_BOOK).filter((row) => !row.is_gradeable)

    expect(ungradeable).to.have.lengthOf(1)
    // The no-metric row only. The YES row is out of scope and must not be
    // counted here either.
    expect(ungradeable[0].numerator).to.equal(1)
    expect(ungradeable[0].denominator).to.equal(5)
  })

  it('leaves a non-OVER/UNDER selection out of the scan entirely', function () {
    // Asserted on the POPULATION, not on the absence of the market id: both
    // sentinel arms report a sentinel id rather than the row's own, so an
    // id-absence test here passes whether or not the YES row entered the scan.
    // The defect book holds six seeded rows and exactly five are in scope.
    const ungradeable_arm = rows_for(DEFECT_BOOK).find(
      (row) => !row.is_gradeable
    )

    expect(ungradeable_arm.denominator).to.equal(5)

    const total_scanned = rows_for(DEFECT_BOOK)
      .filter((row) => row.is_gradeable)
      .map((row) => row.denominator)
      .concat(ungradeable_arm.denominator - ungradeable_arm.numerator)

    for (const scanned of total_scanned) {
      expect(scanned).to.equal(4)
    }
  })

  it('emits no graded arm for a book holding nothing gradeable', function () {
    // Un-gradeable, never a clean sentinel over a population of zero -- a row
    // that scanned nothing has no population to be judged against.
    const empty_book_rows = rows_for(EMPTY_BOOK)

    expect(empty_book_rows).to.have.lengthOf(1)
    expect(empty_book_rows[0].is_gradeable).to.equal(false)
    expect(empty_book_rows.filter((row) => row.is_gradeable)).to.be.empty
  })

  it('carries the disagreement through the shipped classifier as a finding', function () {
    // End to end rather than asserted against the rows alone: the check
    // declares max_count 0, so one unsuppressed violation must survive
    // grading as a finding.
    const result = classify_check_rows({
      check: CHECK,
      rows,
      parked_by_key: new Map(),
      parked_for_check: []
    })

    expect(result.findings).to.have.lengthOf(1)
    expect(result.findings[0].source_selection_id).to.equal('sel-over-inverted')
    // One un-gradeable arm per book, including the two whose count is zero:
    // the arm declares each book's scanned population whether or not anything
    // fell out of it.
    expect(result.ungradeable).to.have.lengthOf(3)
  })
})
