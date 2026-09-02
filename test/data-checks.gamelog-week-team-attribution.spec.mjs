/* global describe it */
import * as chai from 'chai'

import { classify_check_rows } from '#libs-server/data-check.mjs'
import registry from '#db/checks/registry.mjs'

const expect = chai.expect

/*
  The red and green demonstrations for gamelog-week-team-attribution.

  The check reads live production rows and cannot mutate them to prove it goes
  red, so this fixture corpus driven through the SHIPPED registry entry is the
  substitute -- the precondition and the threshold exercised here are the same
  objects the runner grades with, not a copy, so weakening either is what these
  tests catch.

  The green case is not decoration. This check's whole calibration rests on one
  season reading EXACTLY 1.0, and a floor of 1.0 that reported a finding on a
  clean week would be indistinguishable in production from the standing debt it
  is expected to report anyway.
*/

const check = registry.find(
  (entry) => entry.check_id === 'gamelog-week-team-attribution'
)

// Grain values are drawn from visibly different distributions -- a four-digit
// season against a single-digit week -- so a transposition between two grain
// columns changes the key rather than passing unnoticed.
const week_row = ({
  season_year = 2025,
  season_type = 'REG',
  week = 7,
  numerator,
  denominator
}) => ({ season_year, season_type, week, numerator, denominator })

describe('data check: gamelog-week-team-attribution', function () {
  it('is registered', () => {
    expect(check).to.exist
    expect(check.min_rate).to.equal(1.0)
    expect(check.grain).to.deep.equal(['season_year', 'season_type', 'week'])
  })

  it('GREEN: a REG week where every admissible row agrees reports nothing', () => {
    const result = classify_check_rows({
      check,
      rows: [week_row({ numerator: 1081, denominator: 1081 })]
    })

    expect(result.findings).to.have.lengthOf(0)
    expect(result.gradeable).to.have.lengthOf(1)
    expect(result.ungradeable).to.have.lengthOf(0)
  })

  it('RED: ONE disagreement in over a thousand rows is a finding', () => {
    // 0.99907 against a floor of 1.0. This is the reading the check exists for
    // and the reason the floor is exact rather than a percentile: the defect
    // occupies single rows inside a week of a thousand, so any tolerance wide
    // enough to be comfortable swallows it whole.
    const result = classify_check_rows({
      check,
      rows: [
        week_row({ season_year: 2024, numerator: 1080, denominator: 1081 })
      ]
    })

    expect(result.findings).to.have.lengthOf(1)
    expect(result.findings[0].season_year).to.equal(2024)
  })

  it('reports PRE and POST weeks as un-gradeable rather than grading them', () => {
    // Both read around 0.93 on this population even in a season known clean, so
    // grading them would either flood the queue or force a floor that cannot
    // see the REG defect. They must not be silently dropped either -- an
    // un-gradeable row is reported, a missing one is invisible.
    const result = classify_check_rows({
      check,
      rows: [
        week_row({
          season_type: 'PRE',
          week: 2,
          numerator: 900,
          denominator: 970
        }),
        week_row({
          season_type: 'POST',
          week: 1,
          numerator: 520,
          denominator: 560
        })
      ]
    })

    expect(result.ungradeable).to.have.lengthOf(2)
    expect(result.gradeable).to.have.lengthOf(0)
    expect(result.findings).to.have.lengthOf(0)
  })

  it('reports a week whose admissible population collapsed as un-gradeable, not clean', () => {
    // The failure this guards is the oracle going silent: if nfl_snaps stops
    // being reachable the two resolver sources stop speaking, every row falls
    // out of the admissible set, and a week of pure agreement over four rows
    // would otherwise read 1.0 and pass.
    const result = classify_check_rows({
      check,
      rows: [week_row({ numerator: 4, denominator: 4 })]
    })

    expect(result.ungradeable).to.have.lengthOf(1)
    expect(result.gradeable).to.have.lengthOf(0)
    expect(result.findings).to.have.lengthOf(0)
  })

  it('a week that scanned nothing is un-gradeable rather than a clean sweep', () => {
    const result = classify_check_rows({
      check,
      rows: [week_row({ numerator: 0, denominator: 0 })]
    })

    expect(result.ungradeable).to.have.lengthOf(1)
    expect(result.findings).to.have.lengthOf(0)
  })
})
