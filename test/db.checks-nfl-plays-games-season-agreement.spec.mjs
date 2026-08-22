/* global describe before after it */
import * as chai from 'chai'

import db from '#db'
import registry from '#db/checks/registry.mjs'
import { classify_check_rows } from '#libs-server/data-check.mjs'

const expect = chai.expect

/*
  The negative control for `nfl-plays-games-season-agreement`, and the reason it
  is a spec rather than the calibration prose every other registered check
  relies on.

  test/data-checks.spec.mjs states the general position: a check reading live
  production rows cannot mutate its corpus to prove it goes red. That is true of
  the checks it was written for and false of this one -- nfl_plays and nfl_games
  are ordinary tables in the suite's own database, so the disagreement this
  check exists to catch can be SEEDED and the check run over it for real. A
  fixture-driven classifier test would only prove the classifier works, which
  test/data-checks.spec.mjs already proves; what needs proving here is that the
  QUERY can see a disagreement, which is the half that fails silently.

  Every case asserts the same pair in both directions -- absent from the
  findings while the rows agree, present once they disagree -- because a
  selector that has stopped matching anything reports a clean corpus in exactly
  the same words as a clean corpus.
*/

const check = registry.find(
  (entry) => entry.check_id === 'nfl-plays-games-season-agreement'
)

// Outside every seeded fixture's range, so the rows cannot collide with another
// spec's and a leftover cannot be mistaken for one.
const esbid = 99000001
const season_year = 2024

const seed_game = async ({ week, season_type }) =>
  db('nfl_games').insert({
    esbid,
    season_year,
    week,
    season_type,
    away_nfl_team: 'ZZ',
    home_nfl_team: 'ZY'
  })

const seed_play = async ({ week, season_type }) =>
  db('nfl_plays').insert({
    esbid,
    play_id: 1,
    season_year,
    week,
    season_type,
    updated: new Date()
  })

const clear = async () => {
  await db('nfl_plays').where({ esbid }).del()
  await db('nfl_games').where({ esbid }).del()
}

// The check's own rows, run for real, reduced to the two questions each case
// asks: did it report OUR game, and did it scan anything at all.
const run = async () => {
  const rows = await check.rows()
  const result = classify_check_rows({ rows, check, parked: [] })
  return {
    reports_our_game: result.findings.some((row) => row.esbid === esbid),
    // Read off the rows rather than recomputed here: a denominator this spec
    // derived itself could agree with a query that scanned nothing.
    denominator: Math.max(...rows.map((row) => Number(row.denominator)))
  }
}

describe('data checks / nfl-plays-games-season-agreement', function () {
  this.timeout(30000)

  before(clear)
  after(clear)

  it('is a registered check', () => {
    expect(check, 'check is absent from db/checks/registry.mjs').to.exist
    expect(check.max_count).to.equal(0)
  })

  it('does NOT report a play that agrees with its game', async () => {
    await clear()
    await seed_game({ week: 5, season_type: 'REG' })
    await seed_play({ week: 5, season_type: 'REG' })

    const { reports_our_game, denominator } = await run()
    expect(reports_our_game).to.equal(false)
    // The green above is worthless if the scan reached no rows; this is the
    // same denominator the check's own detector-health floor reads.
    expect(denominator).to.be.greaterThan(0)
  })

  it('reports a play whose WEEK disagrees with its game', async () => {
    await clear()
    await seed_game({ week: 5, season_type: 'REG' })
    await seed_play({ week: 6, season_type: 'REG' })

    const { reports_our_game } = await run()
    expect(reports_our_game).to.equal(true)
  })

  it('reports a play whose SEASON TYPE disagrees with its game', async () => {
    await clear()
    await seed_game({ week: 5, season_type: 'REG' })
    await seed_play({ week: 5, season_type: 'POST' })

    const { reports_our_game } = await run()
    expect(reports_our_game).to.equal(true)
  })

  it('does NOT report a play holding no nfl_games row at all', async () => {
    await clear()
    await seed_play({ week: 5, season_type: 'REG' })

    // Deliberate, and stated in the check's calibration: the period CTE inner
    // joins nfl_games, so an orphan play is dropped whether or not the nfl_games
    // predicate is emitted. Production holds 23,858 of them and reporting the
    // class would stand 132 findings in front of the one that is real.
    const { reports_our_game } = await run()
    expect(reports_our_game).to.equal(false)
  })
})
