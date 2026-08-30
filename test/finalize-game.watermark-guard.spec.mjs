/* global describe it beforeEach after */

// The finalization watermark guard: the change that took the league host from
// re-finalizing every completed game ~96 times a day to finalizing only games
// whose play data actually moved.
//
// A guard that skips EVERYTHING looks identical to one that works -- both make
// the load graph fall -- so the cases that matter most here are the ones
// asserting a legitimate re-finalization still happens. Inverting the guard
// condition must turn one of these red.
//
// This spec can import finalize-game.mjs only because its NGS import is lazy.
// A static one reaches #private/libs-server/ngs.mjs, which CI does not check
// out, and would abort the entire mocha run at load rather than fail one test.
//
// WHAT THIS SPEC CANNOT REACH: the success-path write. Three of the seven steps
// need vendor credentials and network, so under test `success` is never true.
// The failure branch IS covered below; the branch that stamps the watermark
// after a clean run is verified in production by the population-level coverage
// check, not here.

import * as chai from 'chai'

import db from '#db'
import { finalize_game } from '#libs-server/finalize-game.mjs'

const expect = chai.expect

const esbid = 9900004

// A season the fixtures do not populate, deliberately. Four of finalize_game's
// seven steps SUCCEED here, and several of them are WEEK-scoped rather than
// game-scoped -- generate_player_snaps_for_week and process_all_format_gamelogs
// take a week and no esbid. Pointed at a season the suite seeds, they rewrite
// shared fixture state and the damage surfaces in some other spec file as a
// wrong value, which reads as a pre-existing break rather than as pollution
// from here. That is exactly what an earlier draft of this spec did to a
// keeptradecut data-view case by using 2025 REG week 1.
const season_year = 2009
const week = 1
const season_type = 'REG'

const seed = async ({ finalized_plays_updated_at, plays_updated }) => {
  await db('nfl_plays').where({ esbid }).del()
  await db('nfl_games').where({ esbid }).del()

  await db('nfl_games').insert({
    esbid,
    season_year,
    week,
    season_type,
    away_nfl_team: 'NE',
    home_nfl_team: 'KC',
    finalized_plays_updated_at
  })

  await db('nfl_plays').insert({
    esbid,
    play_id: 1,
    season_year,
    week,
    season_type,
    play_type_nfl: 'END_GAME',
    updated: plays_updated
  })
}

// run_step catches every step failure into results.steps_failed, so a
// let-through run RETURNS normally in an environment with no vendor
// credentials rather than throwing. That makes `skipped` a clean observable.
//
// Deliberately no try/catch: an earlier version of this helper swallowed
// throws and reported them as skipped=false, which made a mutation that broke
// the guard's null handling look like a pass -- the mutant died on an
// unrelated TypeError inside the skip branch and the catch hid it. A throw
// from here is a defect and must fail the test.
const did_skip = async (params = {}) => {
  const result = await finalize_game({
    esbid,
    season_year,
    week,
    season_type,
    ...params
  })
  return result.skipped
}

describe('finalize_game watermark guard', function () {
  beforeEach(async () => {
    await db('nfl_plays').where({ esbid }).del()
    await db('nfl_games').where({ esbid }).del()
  })

  // Seeding a game and LEAVING it behind is not a tidiness question: the suite
  // shares one database across every spec file, and a stray nfl_games row is
  // read by anything deriving a season's shape from that table. Without this,
  // the seeded 2025 REG week 1 game moved the computed opening day and failed
  // an unrelated keeptradecut data-view case -- in a DIFFERENT file, which
  // reads as a pre-existing break rather than as pollution from here.
  after(async () => {
    await db('nfl_plays').where({ esbid }).del()
    await db('nfl_games').where({ esbid }).del()
  })

  it('skips when the watermark already covers the play data', async () => {
    await seed({
      finalized_plays_updated_at: new Date('2026-06-01T00:00:00Z'),
      plays_updated: new Date('2026-06-01T00:00:00Z')
    })

    expect(await did_skip()).to.equal(true)
  })

  it('finalizes when a play changed after the watermark', async () => {
    // The negative control the whole design rests on. A corrected play must
    // re-finalize, and this is the case a skip-everything guard fails.
    await seed({
      finalized_plays_updated_at: new Date('2026-06-01T00:00:00Z'),
      plays_updated: new Date('2026-06-02T00:00:00Z')
    })

    expect(await did_skip()).to.equal(false)
  })

  it('finalizes a game that has never been finalized', async () => {
    await seed({
      finalized_plays_updated_at: null,
      plays_updated: new Date('2026-06-01T00:00:00Z')
    })

    expect(await did_skip()).to.equal(false)
  })

  it('finalizes a never-finalized game that has no plays at all', async () => {
    // The case that makes the `finalized_through !== null` conjunct
    // load-bearing rather than redundant. Without it, max(updated) being null
    // reads as "nothing newer than the watermark" and the game is skipped --
    // and since a skip writes no watermark, it would evaluate the same way
    // forever. A game whose play import failed would be silently unfinalizable.
    await db('nfl_games').insert({
      esbid,
      season_year,
      week,
      season_type,
      away_nfl_team: 'NE',
      home_nfl_team: 'KC',
      finalized_plays_updated_at: null
    })

    expect(await did_skip()).to.equal(false)
  })

  it('finalizes when force_finalize overrides a current watermark', async () => {
    // A new scoring or league format changes nothing in nfl_plays, so the
    // watermark cannot see it and the flag is the only way through.
    await seed({
      finalized_plays_updated_at: new Date('2026-06-01T00:00:00Z'),
      plays_updated: new Date('2026-06-01T00:00:00Z')
    })

    expect(await did_skip({ force_finalize: true })).to.equal(false)
  })

  it('leaves the watermark null when a step failed, so the next pass retries', async () => {
    // Claiming the watermark on a partial run would strand whatever the failing
    // step was meant to produce, with nothing left to trigger a retry.
    await seed({
      finalized_plays_updated_at: null,
      plays_updated: new Date('2026-06-01T00:00:00Z')
    })

    await did_skip()

    const game = await db('nfl_games').where({ esbid }).first()
    expect(game.finalized_plays_updated_at).to.equal(null)
  })

  it('reports the skip distinctly from a finalization', async () => {
    // The caller logs on this and report_job reasons on it, so "skipped as
    // already current" must not read as "finalized".
    await seed({
      finalized_plays_updated_at: new Date('2026-06-01T00:00:00Z'),
      plays_updated: new Date('2026-06-01T00:00:00Z')
    })

    const result = await finalize_game({
      esbid,
      season_year,
      week,
      season_type
    })

    expect(result.skipped).to.equal(true)
    expect(result.steps_completed).to.deep.equal([])
    expect(result.steps_failed).to.deep.equal([])
  })
})
