/* global describe before after it */
import * as chai from 'chai'

import db from '#db'
import registry from '#db/checks/registry.mjs'
import { classify_check_rows } from '#libs-server/data-check.mjs'

const expect = chai.expect

/*
  The negative control for `gamelogs-games-season-agreement`, written for the
  same reason its nfl_plays and nfl_snaps siblings have one: player_gamelogs and
  nfl_games are ordinary tables in the suite's own database, so the disagreement
  this check exists to catch can be SEEDED and the shipped query run over it for
  real.

  The check's `calibration` records a demonstrated red taken by inverting the
  predicate against production, which proves the JOIN reaches rows. An inverted
  predicate is not the shipped one, though, and what fails silently is whether
  the SHIPPED comparison can see a disagreement -- so the seeded case is the
  only thing that proves the half that matters.

  One case here has no sibling: season_year is part of this table's PRIMARY KEY
  (esbid, pid, season_year) and the writer does not delete before upserting, so
  a drifted season leaves the OLD row in place beside the new one. Both rows
  point at the same game and only one of them agrees with it, which is the shape
  the repair command warns a regeneration will produce.
*/

const check = registry.find(
  (entry) => entry.check_id === 'gamelogs-games-season-agreement'
)

// Outside every seeded fixture's range, and distinct from the esbids the
// nfl_plays and nfl_snaps sibling specs use, so a leftover from any of the three
// cannot be mistaken for another's.
const esbid = 99000003
const pid = 'ZZZZ-ZZZZ-999901'
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

const seed_gamelog = async ({ season_year }) =>
  db('player_gamelogs').insert({
    esbid,
    pid,
    season_year,
    nfl_team: 'ZY',
    opponent_nfl_team: 'ZZ',
    player_position: 'WR'
  })

const clear = async () => {
  await db('player_gamelogs').where({ esbid }).del()
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

describe('data checks / gamelogs-games-season-agreement', function () {
  this.timeout(30000)

  before(clear)
  after(clear)

  it('is a registered check', () => {
    expect(check, 'check is absent from db/checks/registry.mjs').to.exist
    expect(check.max_count).to.equal(0)
  })

  it('does NOT report a gamelog that agrees with its game', async () => {
    await clear()
    await seed_game()
    await seed_gamelog({ season_year: game_season_year })

    const { reports_our_game, denominator } = await run()
    expect(reports_our_game).to.equal(false)
    // The green above is worthless if the scan reached no rows; this is the
    // same denominator the check's own detector-health floor reads.
    expect(denominator).to.be.greaterThan(0)
  })

  it('reports a gamelog whose SEASON disagrees with its game', async () => {
    await clear()
    await seed_game()
    await seed_gamelog({ season_year: other_season_year })

    const { reports_our_game } = await run()
    expect(reports_our_game).to.equal(true)
  })

  it('reports the stale row a re-generation leaves beside a corrected one', async () => {
    await clear()
    await seed_game()
    // season_year is in the primary key and the writer does not delete first,
    // so regenerating a game whose season was corrected INSERTS rather than
    // updates. The agreeing row must not mask the stale one it sits next to.
    await seed_gamelog({ season_year: other_season_year })
    await seed_gamelog({ season_year: game_season_year })

    const { reports_our_game } = await run()
    expect(reports_our_game).to.equal(true)
  })

  it('does NOT report a gamelog holding no nfl_games row at all', async () => {
    await clear()
    await seed_gamelog({ season_year: game_season_year })

    // Deliberate, and stated in the check's calibration: production holds 2,310
    // such rows across 124 esbids, all of them the 2013 and 2014 PRE games the
    // nfl_plays sibling names too. Reporting the class would stand 124
    // permanently-open findings in front of the one that is real.
    const { reports_our_game } = await run()
    expect(reports_our_game).to.equal(false)
  })
})
