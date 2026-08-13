/* global describe it */
import * as chai from 'chai'

import { classify_week_coverage } from '../scripts/audit-route-share-coverage.mjs'

const expect = chai.expect

// The condition this grades is the one the nflfastR importer's own oracle
// structurally cannot see: that oracle is year-grained
// (plays_matched/plays_processed over a whole season), so 2021 REG week 15 --
// 9 of 16 games taking no enrichment at all -- was ~2% of its denominator and
// never breached any floor. This classifier grades at week grain.
describe('SCRIPTS audit-route-share-coverage', function () {
  const week = ({
    season_year = 2024,
    week: week_number = 1,
    season_type = 'REG',
    plays = 2800,
    enriched_plays = 2660
  } = {}) => ({
    season_year,
    week: week_number,
    season_type,
    plays: String(plays),
    enriched_plays: String(enriched_plays)
  })

  it('grades a healthy week as covered', () => {
    const result = classify_week_coverage({ rows: [week()] })

    expect(result.weeks_graded).to.equal(1)
    expect(result.below_floor).to.have.lengthOf(0)
  })

  it('reports a week below the floor', () => {
    // The real 2021 week 15 rate, on a season the baseline does not cover.
    const result = classify_week_coverage({
      rows: [
        week({ season_year: 2024, week: 15, plays: 2846, enriched_plays: 1210 })
      ]
    })

    expect(result.below_floor).to.have.lengthOf(1)
    expect(result.below_floor[0].coverage).to.be.below(0.8)
  })

  it('does not report a week that is merely below the median', () => {
    // 85.7% is the corpus 1st percentile -- healthy, and the reason the floor
    // sits at 80 rather than at 90.
    const result = classify_week_coverage({
      rows: [week({ plays: 1000, enriched_plays: 857 })]
    })

    expect(result.below_floor).to.have.lengthOf(0)
  })

  // The known-gap roster is injected here rather than taken from the script's
  // own constant, which is EMPTY in its healthy state -- every entry gets
  // removed as its gap is repaired. Specced against the live roster, these two
  // graded whether a gap happens to be recorded today; injected, they grade the
  // exclusion behavior, which has to keep working for the next entry.
  const known_gaps = [{ season_year: 2021, week: 15, season_type: 'REG' }]

  it('excludes a registered known gap and counts it separately', () => {
    const result = classify_week_coverage({
      known_gaps,
      rows: [
        week({
          season_year: 2021,
          week: 15,
          season_type: 'REG',
          plays: 2846,
          enriched_plays: 1210
        })
      ]
    })

    expect(result.below_floor).to.have.lengthOf(0)
    expect(result.known_gaps_below_floor).to.have.lengthOf(1)
  })

  it('does not exclude a different week of the known gap season', () => {
    const result = classify_week_coverage({
      known_gaps,
      rows: [
        week({
          season_year: 2021,
          week: 16,
          season_type: 'REG',
          plays: 2846,
          enriched_plays: 1210
        })
      ]
    })

    expect(result.below_floor).to.have.lengthOf(1)
  })

  it('excludes nothing when the roster is empty, its repaired state', () => {
    const result = classify_week_coverage({
      known_gaps: [],
      rows: [
        week({
          season_year: 2021,
          week: 15,
          season_type: 'REG',
          plays: 2846,
          enriched_plays: 1210
        })
      ]
    })

    expect(result.below_floor).to.have.lengthOf(1)
    expect(result.known_gaps_below_floor).to.have.lengthOf(0)
  })

  it('drops a week too small to grade rather than reporting it', () => {
    // A PRE week 0 stub or an import in flight is not a gradeable population,
    // and counting one as a finding would fire on every partial week.
    const result = classify_week_coverage({
      rows: [week({ plays: 40, enriched_plays: 0 })]
    })

    expect(result.weeks_graded).to.equal(0)
    expect(result.below_floor).to.have.lengthOf(0)
  })
})
