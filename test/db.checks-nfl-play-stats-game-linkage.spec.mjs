/* global describe before after it */
import * as chai from 'chai'

import db from '#db'
import registry from '#db/checks/registry.mjs'
import { classify_check_rows } from '#libs-server/data-check.mjs'

const expect = chai.expect

/*
  The negative control for `nfl-play-stats-game-linkage`.

  This check's calibration records the target mapping proven exhaustively
  against production -- esbid + 50 resolves 130 of 130 of the 2013/2014 orphans
  -- but that establishes what the orphans ARE, not that the shipped query can
  still see one. Those are different failures and only seeding proves the
  second: nfl_play_stats and nfl_games are ordinary tables in the suite's own
  database, so an orphan can be created and the shipped `check.rows()` run over
  it for real.

  Every case asserts the pair in both directions -- silent while the game
  exists, reporting once it does not -- because a join that has stopped matching
  reports a clean corpus in exactly the same words as a clean corpus.
*/

const check = registry.find(
  (entry) => entry.check_id === 'nfl-play-stats-game-linkage'
)

// Outside every seeded fixture's range and distinct from the esbids the sibling
// games-season-agreement specs use, so a leftover from either cannot be
// mistaken for the other's.
const esbid = 99000003

const seed_game = async () =>
  db('nfl_games').insert({
    esbid,
    season_year: 2024,
    week: 5,
    season_type: 'REG',
    away_nfl_team: 'ZZ',
    home_nfl_team: 'ZY'
  })

const seed_play_stats = async () =>
  db('nfl_play_stats').insert([
    { esbid, play_id: 1, stat_id: 1, nfl_team: 'ZZ' },
    { esbid, play_id: 2, stat_id: 1, nfl_team: 'ZY' }
  ])

const clear = async () => {
  await db('nfl_play_stats').where({ esbid }).del()
  await db('nfl_games').where({ esbid }).del()
}

// The check's own rows, run for real, reduced to the questions each case asks.
const run = async () => {
  const rows = await check.rows()
  const result = classify_check_rows({ rows, check, parked: [] })
  const our_row = rows.find((row) => row.esbid === esbid)

  return {
    reports_our_game: result.findings.some((row) => row.esbid === esbid),
    // Read off the check's own rows rather than recomputed here: a denominator
    // this spec derived itself could agree with a query that scanned nothing.
    our_denominator: our_row ? our_row.denominator : 0,
    graded_rows: result.gradeable.length
  }
}

describe('data checks / nfl-play-stats-game-linkage', function () {
  this.timeout(30000)

  before(clear)
  after(clear)

  it('is a registered check at an exact threshold', () => {
    expect(check, 'check is absent from db/checks/registry.mjs').to.exist
    expect(check.max_count).to.equal(0)
    expect(check.grain).to.deep.equal(['esbid'])
  })

  it('does NOT report play stats whose esbid resolves to a game', async () => {
    await clear()
    await seed_game()
    await seed_play_stats()

    const { reports_our_game, our_denominator, graded_rows } = await run()
    expect(reports_our_game).to.equal(false)
    // The green above is worthless if the scan never reached our rows. The
    // denominator is the check's own per-esbid scan, which is what its
    // min_denominator floor reads.
    expect(our_denominator).to.equal(2)
    expect(graded_rows).to.be.greaterThan(0)
  })

  it('reports an esbid that resolves to no game', async () => {
    await clear()
    await seed_play_stats()

    const { reports_our_game, our_denominator } = await run()
    expect(reports_our_game).to.equal(true)
    // The orphan is still emitted with its real scanned population rather than
    // a zero denominator -- it is a gradeable violation here, not the
    // un-gradeable row nfl-team-abbreviation-conformance emits for the same
    // rows. That difference is the whole reason this check exists.
    expect(our_denominator).to.equal(2)
  })

  it('counts one violation per esbid rather than one per row', async () => {
    await clear()
    await seed_play_stats()

    const rows = await check.rows()
    const our_row = rows.find((row) => row.esbid === esbid)

    // Two orphan rows, numerator 1. `max_count` is a budget over the summed
    // violation count, so a numerator of the row count would make the budget
    // count rows and a parked entry per game could never balance against it.
    expect(our_row.numerator).to.equal(1)
    expect(our_row.denominator).to.equal(2)
  })

  it('suppresses a baselined esbid without suppressing its neighbours', async () => {
    await clear()
    await seed_play_stats()

    const rows = await check.rows()
    const parked = [
      {
        check_id: 'nfl-play-stats-game-linkage',
        grain: { esbid },
        disposition: 'baselined',
        owner: 'Seeded by the spec to prove the grain keys per game.'
      }
    ]
    const result = classify_check_rows({ rows, check, parked })

    expect(result.findings.some((row) => row.esbid === esbid)).to.equal(false)
    expect(result.baselined.some((row) => row.esbid === esbid)).to.equal(true)
    // A parked entry that suppressed nothing must resurface. Ours suppressed
    // our row, so it must NOT be reported stale -- the inverse assertion is
    // what catches a grain key that silently stopped matching.
    expect(result.stale_parked).to.have.lengthOf(0)
  })
})
