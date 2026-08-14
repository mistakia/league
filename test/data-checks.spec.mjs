/* global describe it */
import * as chai from 'chai'

import { classify_check_rows, load_parked } from '#libs-server/data-check.mjs'

const expect = chai.expect

/*
  Drives the SHIPPED classifier over fixtures rather than a copy of it, which is
  the compensating control for eight registered checks sharing one code path --
  editing libs-server/data-check.mjs is what these tests exercise.

  A check reading live production rows cannot mutate its corpus to prove it goes
  red, so this fixture corpus plus each check's `calibration` prose is the
  substitute for a negative control. Fixtures satisfy the sentinel rule by
  construction: nothing here derives a discriminator from the environment.

  ## Why the grain values differ in SHAPE

  Every fixture's grain columns carry values drawn from different distributions
  -- season years in the 2000s against weeks in single digits -- so a
  transposition between two grain columns changes the key and fails the
  matching. A fixture whose two grain columns hold the same value cannot detect
  that at all: the two are interchangeable in the output no matter how many
  assertions ride on them.
*/

const rate_check = {
  check_id: 'pfr-gamelog-agreement',
  grain: ['season_year', 'week'],
  min_rate: 1.0
}

const count_check = {
  check_id: 'gamelog-orphans',
  grain: ['child_table', 'esbid', 'pid'],
  max_count: 0
}

const gated_check = {
  check_id: 'reference-gated',
  grain: ['season_year', 'week'],
  precondition: (row) => row.reference_games === row.our_games,
  min_rate: 1.0
}

describe('data checks', function () {
  describe('classifier / min_rate arm', function () {
    it('reports nothing on a clean corpus and still carries its denominator', () => {
      const result = classify_check_rows({
        rows: [
          { season_year: 2022, week: 8, numerator: 635, denominator: 635 },
          { season_year: 2024, week: 1, numerator: 913, denominator: 913 }
        ],
        check: rate_check
      })

      expect(result.findings).to.have.lengthOf(0)
      expect(result.gradeable).to.have.lengthOf(2)
      expect(result.ungradeable).to.have.lengthOf(0)
      expect(result.gradeable[0].denominator).to.equal(635)
    })

    it('reports a row below the threshold', () => {
      const result = classify_check_rows({
        rows: [
          { season_year: 2022, week: 8, numerator: 635, denominator: 636 },
          { season_year: 2024, week: 1, numerator: 913, denominator: 913 }
        ],
        check: rate_check
      })

      expect(result.findings).to.have.lengthOf(1)
      expect(result.findings[0].season_year).to.equal(2022)
      expect(result.findings[0].week).to.equal(8)
    })

    it('reads a string numerator and denominator as numbers', () => {
      // pg returns count() as a string, so a classifier comparing them raw
      // would compare lexically and pass everything.
      const result = classify_check_rows({
        rows: [
          { season_year: 2022, week: 8, numerator: '635', denominator: '636' }
        ],
        check: rate_check
      })

      expect(result.findings).to.have.lengthOf(1)
    })
  })

  describe('classifier / max_count arm', function () {
    it('reports a violation while still reporting the scanned population', () => {
      const result = classify_check_rows({
        rows: [
          {
            child_table: 'player_receiving_gamelogs',
            esbid: 2003081503,
            pid: 'TAYL-WHIT-019422',
            numerator: 1,
            denominator: 269483
          }
        ],
        check: count_check
      })

      expect(result.findings).to.have.lengthOf(1)
      expect(result.gradeable[0].denominator).to.equal(269483)
    })

    it('is clean on a zero-violation row rather than empty', () => {
      // The whole point of the denominator contract: a clean max_count check
      // still returns a row, so an emptied predicate is distinguishable from a
      // healthy corpus.
      const result = classify_check_rows({
        rows: [
          {
            child_table: 'player_receiving_gamelogs',
            esbid: null,
            pid: null,
            numerator: 0,
            denominator: 269483
          }
        ],
        check: count_check
      })

      expect(result.findings).to.have.lengthOf(0)
      expect(result.gradeable).to.have.lengthOf(1)
      expect(result.gradeable[0].denominator).to.equal(269483)
    })

    it('throws on a row carrying no denominator', () => {
      expect(() =>
        classify_check_rows({
          rows: [
            {
              child_table: 'player_receiving_gamelogs',
              esbid: 2003081503,
              pid: 'TAYL-WHIT-019422',
              numerator: 1
            }
          ],
          check: count_check
        })
      ).to.throw(/denominator/)
    })
  })

  describe('classifier / precondition', function () {
    it('reports a row failing the precondition as un-gradeable, never as passed', () => {
      const result = classify_check_rows({
        rows: [
          {
            season_year: 2022,
            week: 8,
            reference_games: 14,
            our_games: 14,
            numerator: 635,
            denominator: 635
          },
          {
            season_year: 2025,
            week: 3,
            reference_games: 11,
            our_games: 16,
            numerator: 550,
            denominator: 100
          }
        ],
        check: gated_check
      })

      expect(result.gradeable).to.have.lengthOf(1)
      expect(result.ungradeable).to.have.lengthOf(1)
      expect(result.ungradeable[0].season_year).to.equal(2025)
      // The un-gradeable row reads 5.5 -- above the floor rather than below it,
      // which is exactly how a stale reference passes a one-sided threshold
      // silently when nothing gates it.
      expect(result.findings).to.have.lengthOf(0)
    })
  })

  describe('classifier / parking', function () {
    const parked = [
      {
        check_id: 'pfr-gamelog-agreement',
        grain: { season_year: 2022, week: 8 },
        disposition: 'adjudicated',
        reason: 'PFR counts a reception our feed does not.',
        evidence: 'ours 635, PFR 636',
        validated_at: '2026-08-14'
      },
      {
        check_id: 'pfr-gamelog-agreement',
        grain: { season_year: 2024, week: 2 },
        disposition: 'baselined',
        owner: 'user:task/league/example.md'
      }
    ]

    it('suppresses an adjudicated finding and keeps its entry', () => {
      const result = classify_check_rows({
        rows: [
          { season_year: 2022, week: 8, numerator: 635, denominator: 636 }
        ],
        check: rate_check,
        parked
      })

      expect(result.findings).to.have.lengthOf(0)
      expect(result.adjudicated).to.have.lengthOf(1)
      expect(result.adjudicated[0].parked.reason).to.match(/reception/)
    })

    it('suppresses a baselined finding into its own population', () => {
      const result = classify_check_rows({
        rows: [{ season_year: 2024, week: 2, numerator: 10, denominator: 26 }],
        check: rate_check,
        parked
      })

      expect(result.findings).to.have.lengthOf(0)
      expect(result.baselined).to.have.lengthOf(1)
      expect(result.adjudicated).to.have.lengthOf(0)
    })

    it('reports a parked entry that suppressed nothing', () => {
      const result = classify_check_rows({
        rows: [
          { season_year: 2022, week: 8, numerator: 636, denominator: 636 }
        ],
        check: rate_check,
        parked
      })

      expect(result.findings).to.have.lengthOf(0)
      expect(result.stale_parked).to.have.lengthOf(2)
    })

    it('reports an UNREGISTERED subject rather than defaulting it to parked', () => {
      // The omission path, whose failure mode is silence. A grain row with no
      // entry must be a finding -- if it were suppressed by default, forgetting
      // to register a subject would silently disable the check for it.
      const result = classify_check_rows({
        rows: [
          { season_year: 2022, week: 10, numerator: 816, denominator: 817 }
        ],
        check: rate_check,
        parked
      })

      expect(result.findings).to.have.lengthOf(1)
      expect(result.findings[0].week).to.equal(10)
    })

    it('keys per grain row, so parking one week cannot mask another', () => {
      const result = classify_check_rows({
        rows: [
          { season_year: 2022, week: 8, numerator: 635, denominator: 636 },
          { season_year: 2022, week: 9, numerator: 700, denominator: 701 }
        ],
        check: rate_check,
        parked
      })

      expect(result.adjudicated).to.have.lengthOf(1)
      expect(result.findings).to.have.lengthOf(1)
      expect(result.findings[0].week).to.equal(9)
    })

    it('does not match a grain row whose columns are transposed', () => {
      // season_year 2022 / week 8 against season_year 8 / week 2022. A fixture
      // holding one value in both columns could not tell these apart.
      const result = classify_check_rows({
        rows: [
          { season_year: 8, week: 2022, numerator: 635, denominator: 636 }
        ],
        check: rate_check,
        parked
      })

      expect(result.adjudicated).to.have.lengthOf(0)
      expect(result.findings).to.have.lengthOf(1)
    })

    it('ignores entries belonging to another check', () => {
      const result = classify_check_rows({
        rows: [
          { season_year: 2022, week: 8, numerator: 635, denominator: 636 }
        ],
        check: { ...rate_check, check_id: 'another-check' },
        parked
      })

      expect(result.findings).to.have.lengthOf(1)
      expect(result.stale_parked).to.have.lengthOf(0)
    })
  })

  describe('parked loader', function () {
    const adjudicated = {
      check_id: 'pfr-gamelog-agreement',
      grain: { season_year: 2022, week: 8 },
      disposition: 'adjudicated',
      reason: 'PFR counts a reception our feed does not.',
      evidence: 'ours 635, PFR 636',
      validated_at: '2026-08-14'
    }

    const baselined = {
      check_id: 'gamelog-orphans',
      grain: { child_table: 'player_receiving_gamelogs', esbid: 1, pid: 'A' },
      disposition: 'baselined',
      owner: 'user:task/league/example.md'
    }

    it('accepts a well-formed file', () => {
      expect(
        load_parked({ entries: [adjudicated, baselined] })
      ).to.have.lengthOf(2)
    })

    it('throws on an adjudicated entry with no reason', () => {
      const { reason, ...without_reason } = adjudicated
      expect(reason).to.be.a('string')
      expect(() => load_parked({ entries: [without_reason] })).to.throw(
        /reason/
      )
    })

    it('throws on an adjudicated entry with no evidence', () => {
      const { evidence, ...without_evidence } = adjudicated
      expect(evidence).to.be.a('string')
      expect(() => load_parked({ entries: [without_evidence] })).to.throw(
        /evidence/
      )
    })

    it('does NOT require evidence on a baselined entry', () => {
      // The two dispositions demand different fields; that difference is the
      // whole reason the disposition exists.
      expect(() => load_parked({ entries: [baselined] })).to.not.throw()
    })

    it('throws on a baselined entry with no owner', () => {
      const { owner, ...without_owner } = baselined
      expect(owner).to.be.a('string')
      expect(() => load_parked({ entries: [without_owner] })).to.throw(/owner/)
    })

    it('throws on an entry with no disposition', () => {
      const { disposition, ...without_disposition } = adjudicated
      expect(disposition).to.equal('adjudicated')
      expect(() => load_parked({ entries: [without_disposition] })).to.throw(
        /disposition/
      )
    })

    it('throws on an entry naming a check that is not in the registry', () => {
      expect(() =>
        load_parked({
          entries: [{ ...adjudicated, check_id: 'no-such-check' }],
          checks_by_id: new Map([['pfr-gamelog-agreement', rate_check]])
        })
      ).to.throw(/not in the registry/)
    })
  })
})
