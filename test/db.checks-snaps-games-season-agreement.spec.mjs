/* global describe before after it */
import * as chai from 'chai'

import db from '#db'
import registry from '#db/checks/registry.mjs'
import { classify_check_rows } from '#libs-server/data-check.mjs'

const expect = chai.expect

/*
  The negative control for `snaps-games-season-agreement`, written for the same
  reason its nfl_plays sibling has one: nfl_snaps and nfl_games are ordinary
  tables in the suite's own database, so the disagreement this check exists to
  catch can be SEEDED and the shipped query run over it for real.

  That matters more here than for any other check in the registry. This check's
  `calibration` records a demonstrated red taken by inverting the predicate
  against production, which proves the JOIN reaches rows -- but an inverted
  predicate is not the shipped one, and the half that fails silently is whether
  the SHIPPED comparison can see a disagreement. Only seeding proves that.

  Every case asserts the same pair in both directions -- absent from the
  findings while the rows agree, present once they disagree -- because a
  selector that has stopped matching anything reports a clean corpus in exactly
  the same words as a clean corpus.
*/

const check = registry.find(
  (entry) => entry.check_id === 'snaps-games-season-agreement'
)

// Outside every seeded fixture's range, and distinct from the esbid the
// nfl_plays sibling spec uses, so a leftover from either cannot be mistaken for
// the other's.
const esbid = 99000002
const game_season_year = 2024
const other_season_year = 2023

const seed_game = async () =>
  db('nfl_games').insert({
    esbid,
    season_year: game_season_year,
    week: 5,
    season_type: 'REG',
    away_nfl_team: 'ZZ',
    home_nfl_team: 'ZY'
  })

const seed_snap = async ({ season_year }) =>
  db('nfl_snaps').insert({
    esbid,
    play_id: 1,
    gsis_it_player_id: 9900001,
    season_year
  })

const clear = async () => {
  await db('nfl_snaps').where({ esbid }).del()
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

describe('data checks / snaps-games-season-agreement', function () {
  this.timeout(30000)

  before(clear)
  after(clear)

  it('is a registered check', () => {
    expect(check, 'check is absent from db/checks/registry.mjs').to.exist
    expect(check.max_count).to.equal(0)
  })

  it('does NOT report a snap that agrees with its game', async () => {
    await clear()
    await seed_game()
    await seed_snap({ season_year: game_season_year })

    const { reports_our_game, denominator } = await run()
    expect(reports_our_game).to.equal(false)
    // The green above is worthless if the scan reached no rows; this is the
    // same denominator the check's own detector-health floor reads.
    expect(denominator).to.be.greaterThan(0)
  })

  it('reports a snap whose SEASON disagrees with its game', async () => {
    await clear()
    await seed_game()
    await seed_snap({ season_year: other_season_year })

    const { reports_our_game } = await run()
    expect(reports_our_game).to.equal(true)
  })

  it('does NOT report a snap holding no nfl_games row at all', async () => {
    await clear()
    await seed_snap({ season_year: game_season_year })

    // Deliberate, and stated in the check's calibration: an esbid matching no
    // game is a different condition with a different owner, and reporting the
    // class would stand permanently-open findings in front of the one that is
    // real. Production holds zero of these on nfl_snaps today, which is why the
    // case is asserted here rather than left to observation.
    const { reports_our_game } = await run()
    expect(reports_our_game).to.equal(false)
  })
})
