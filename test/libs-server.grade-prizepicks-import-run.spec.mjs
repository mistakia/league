/* global describe it */
import * as chai from 'chai'

import grade_prizepicks_import_run, {
  MINIMUM_ESBID_RESOLUTION_RATE,
  MAXIMUM_FALLBACK_RESOLUTION_RATE
} from '#libs-server/grade-prizepicks-import-run.mjs'

const expect = chai.expect

// The real shape of the 2026-09-01 13:00 cycle: 4,094 markets, every one
// resolving an esbid through the crosswalk.
const healthy_run = {
  in_season: true,
  markets_fetched: 4094,
  markets_formatted: 4094,
  markets_with_esbid: 4094,
  markets_resolved_by_crosswalk: 4094,
  markets_resolved_by_fallback: 0,
  missing_market_types: 0,
  pages_fetched: 9
}

describe('LIBS-SERVER grade_prizepicks_import_run', function () {
  it('passes a healthy in-season run', () => {
    const grade = grade_prizepicks_import_run(healthy_run)
    expect(grade.passed).to.equal(true)
    expect(grade.skipped).to.equal(false)
    expect(grade.failures).to.deep.equal([])
    expect(grade.summary).to.include('oracle PASS')
    expect(grade.summary).to.include('4094 market(s) fetched')
  })

  // The defect this file exists for. Through August 2026 the ledger recorded
  // ~40 of these as successes, indistinguishable from the run above.
  it('reports an out-of-season run as a SKIP rather than an import', () => {
    const grade = grade_prizepicks_import_run({ in_season: false })
    expect(grade.passed).to.equal(true)
    expect(grade.skipped).to.equal(true)
    expect(grade.summary).to.include('oracle SKIP')
    expect(grade.summary).to.include('outside the NFL season window')
    // The whole point: a skip must not read as an import.
    expect(grade.summary).to.not.include('oracle PASS')
  })

  it('fails an in-season run that fetched nothing', () => {
    const grade = grade_prizepicks_import_run({
      in_season: true,
      markets_fetched: 0,
      pages_fetched: 1
    })
    expect(grade.passed).to.equal(false)
    expect(grade.failures).to.deep.equal([
      'no markets fetched across 1 page(s)'
    ])
  })

  it('fails an in-season run that fetched but formatted nothing', () => {
    const grade = grade_prizepicks_import_run({
      in_season: true,
      markets_fetched: 4094,
      markets_formatted: 0,
      pages_fetched: 9
    })
    expect(grade.passed).to.equal(false)
    expect(grade.failures).to.deep.equal([
      'no markets formatted from 4094 fetched'
    ])
  })

  // The zero-coverage rule, kept separate from the rate because a rate is
  // undefined precisely when the failure is total.
  it('fails when esbid resolution breaks wholesale', () => {
    const grade = grade_prizepicks_import_run({
      ...healthy_run,
      markets_with_esbid: 0,
      markets_resolved_by_crosswalk: 0,
      markets_resolved_by_fallback: 0
    })
    expect(grade.passed).to.equal(false)
    expect(grade.failures).to.deep.equal([
      'no market resolved an esbid across 4094 formatted market(s)'
    ])
  })

  it('fails when the esbid resolution rate falls below the floor', () => {
    // Deliberately just under the floor, so this asserts on the threshold
    // rather than on an arbitrary bad number.
    const below = Math.floor(4094 * MINIMUM_ESBID_RESOLUTION_RATE) - 1
    const grade = grade_prizepicks_import_run({
      ...healthy_run,
      markets_with_esbid: below,
      markets_resolved_by_crosswalk: below
    })
    expect(grade.passed).to.equal(false)
    expect(grade.failures).to.have.lengthOf(1)
    expect(grade.failures[0]).to.include('esbid resolution rate')
    expect(grade.failures[0]).to.include('below')
  })

  it('passes at the floor, so the threshold is exclusive as documented', () => {
    const at = Math.ceil(4094 * MINIMUM_ESBID_RESOLUTION_RATE)
    const grade = grade_prizepicks_import_run({
      ...healthy_run,
      markets_with_esbid: at,
      markets_resolved_by_crosswalk: at
    })
    expect(grade.passed).to.equal(true)
  })

  // The leading indicator. The team-based fallback is the mechanism that
  // produced 9,160 drifted markets, so a run leaning on it means the crosswalk
  // stopped answering -- visible one cycle before settlement writes a wrong
  // grade. It warns rather than fails, because a burst of genuinely new game
  // ids is legitimate.
  it('warns without failing when the crosswalk stops answering', () => {
    const grade = grade_prizepicks_import_run({
      ...healthy_run,
      markets_resolved_by_crosswalk: 100,
      markets_resolved_by_fallback: 3994
    })
    expect(grade.passed).to.equal(true)
    expect(grade.failures).to.deep.equal([])
    expect(grade.summary).to.include('WARNING')
    expect(grade.summary).to.include('team-based fallback')
  })

  it('does not warn while the crosswalk is carrying resolution', () => {
    const grade = grade_prizepicks_import_run(healthy_run)
    expect(grade.summary).to.not.include('WARNING')
  })

  it('holds the fallback warning to its documented threshold', () => {
    const total = 1000
    const just_under = Math.floor(total * MAXIMUM_FALLBACK_RESOLUTION_RATE)
    const grade = grade_prizepicks_import_run({
      ...healthy_run,
      markets_formatted: total,
      markets_with_esbid: total,
      markets_resolved_by_crosswalk: total - just_under,
      markets_resolved_by_fallback: just_under
    })
    expect(grade.summary).to.not.include('WARNING')
  })

  it('marks a dry run in the summary so it is not read as a write', () => {
    const grade = grade_prizepicks_import_run({
      ...healthy_run,
      dry_run: true
    })
    expect(grade.passed).to.equal(true)
    expect(grade.summary).to.include('dry run')
  })
})
