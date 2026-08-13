/* global describe it */
import * as chai from 'chai'

import grade_matchup_import_run, {
  MAXIMUM_GAME_FAILURE_RATE,
  MAXIMUM_PLAYERS_UNMATCHED_RATE
} from '#libs-server/charting-data/grade-matchup-import-run.mjs'

const expect = chai.expect

// The 2025 backfill's real counters, used as the healthy baseline: 285 games
// (272 REG + 13 POST), none failed, none empty, 1,800 of 50,400 matchups
// unmatched.
const healthy_run = {
  games_selected: 285,
  games_attempted: 285,
  games_with_rows: 285,
  games_failed: 0,
  games_empty: 0,
  total_matchups_inserted: 48600,
  players_unmatched: 1800
}

describe('LIBS-SERVER grade_matchup_import_run', function () {
  it('passes a healthy run', () => {
    const grade = grade_matchup_import_run(healthy_run)
    expect(grade.passed).to.equal(true)
    expect(grade.failures).to.deep.equal([])
    expect(grade.summary).to.include('oracle PASS')
    expect(grade.summary).to.include('285 game(s) in scope')
    expect(grade.summary).to.include('48600 matchups written')
  })

  it('fails when the scope selected no games', () => {
    const grade = grade_matchup_import_run({
      ...healthy_run,
      games_selected: 0,
      games_attempted: 0,
      games_with_rows: 0,
      total_matchups_inserted: 0,
      players_unmatched: 0
    })
    expect(grade.passed).to.equal(false)
    expect(grade.failures).to.deep.equal(['scope selected no games'])
  })

  it('passes when every selected game is already imported', () => {
    // The healthy steady state of a scheduled run, and the one case that must
    // NOT be confused with the empty scope above.
    const grade = grade_matchup_import_run({
      games_selected: 16,
      games_attempted: 0,
      games_with_rows: 0,
      games_failed: 0,
      games_empty: 0,
      total_matchups_inserted: 0,
      players_unmatched: 0
    })
    expect(grade.passed).to.equal(true)
    expect(grade.summary).to.include('16 game(s) in scope, 0 attempted')
  })

  it('fails when no attempted game produced rows', () => {
    const grade = grade_matchup_import_run({
      games_selected: 16,
      games_attempted: 16,
      games_with_rows: 0,
      games_failed: 16,
      games_empty: 0,
      total_matchups_inserted: 0,
      players_unmatched: 0
    })
    expect(grade.passed).to.equal(false)
    expect(grade.failures[0]).to.include('no rows written')
  })

  it('fails a single-game run that produced nothing', () => {
    const grade = grade_matchup_import_run({
      games_selected: 1,
      games_attempted: 1,
      games_with_rows: 0,
      games_failed: 0,
      games_empty: 1,
      total_matchups_inserted: 0,
      players_unmatched: 0
    })
    expect(grade.passed).to.equal(false)
  })

  it('fails when the game failure rate exceeds the ceiling', () => {
    const games_attempted = 100
    const games_with_rows =
      games_attempted -
      Math.ceil(games_attempted * MAXIMUM_GAME_FAILURE_RATE) -
      1
    const grade = grade_matchup_import_run({
      ...healthy_run,
      games_selected: games_attempted,
      games_attempted,
      games_with_rows,
      games_failed: games_attempted - games_with_rows
    })
    expect(grade.passed).to.equal(false)
    expect(grade.failures[0]).to.include('game failure rate')
  })

  it('passes when the game failure rate sits at the ceiling', () => {
    const games_attempted = 100
    const games_with_rows =
      games_attempted - games_attempted * MAXIMUM_GAME_FAILURE_RATE
    const grade = grade_matchup_import_run({
      ...healthy_run,
      games_selected: games_attempted,
      games_attempted,
      games_with_rows,
      games_failed: games_attempted - games_with_rows
    })
    expect(grade.passed).to.equal(true)
  })

  it('fails when the player unmatched rate exceeds the ceiling', () => {
    const matchups_seen = 1000
    const players_unmatched =
      Math.ceil(matchups_seen * MAXIMUM_PLAYERS_UNMATCHED_RATE) + 1
    const grade = grade_matchup_import_run({
      ...healthy_run,
      total_matchups_inserted: matchups_seen - players_unmatched,
      players_unmatched
    })
    expect(grade.passed).to.equal(false)
    expect(grade.failures[0]).to.include('player unmatched rate')
  })

  it('reports both failures when a run is degraded on both measures', () => {
    const grade = grade_matchup_import_run({
      games_selected: 100,
      games_attempted: 100,
      games_with_rows: 50,
      games_failed: 50,
      games_empty: 0,
      total_matchups_inserted: 500,
      players_unmatched: 500
    })
    expect(grade.passed).to.equal(false)
    expect(grade.failures).to.have.lengthOf(2)
    expect(grade.summary).to.include('oracle FAIL')
  })
})
