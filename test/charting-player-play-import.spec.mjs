/* global describe, it */
import * as chai from 'chai'

import { map_player_play_to_db_fields } from '#scripts/import-player-plays-charting.mjs'
import grade_player_play_import_run from '#libs-server/charting-data/grade-player-play-import-run.mjs'
import {
  resolve_nfl_team_sumer_id,
  resolve_sumer_team,
  SUMER_TEAM_ID_TO_NFL
} from '#libs-server/charting-data/team-mapping.mjs'

const expect = chai.expect

// One real row, copied from a live players/by-play response for 2025 REG week 1
// esbid 2025090400, Dallas. Trimmed to the fields under test; the nested
// objects are dropped because the mapper never reads them.
const sample_row = {
  sumerPlayerId: '01760788-c0d9-5d65-a917-4bbc17310d9d',
  jerseyNumber: '57',
  alignment: 'LB',
  alignmentSide: 'LEFT',
  role: 'COVERAGE',
  defenderTechnique: '2i',
  coverageResponsibility: 'HOOK CURL',
  coverageResponsibilitySide: 'RIGHT',
  primaryCoverage: false,
  pressure: false,
  press: false,
  boxAlignment: true,
  route: null,
  routeBreakDepth: null,
  passingEpa: null,
  defenseSacks: null
}

describe('LIBS-SERVER charting player-play mapping', function () {
  it('maps a real vendor row onto its columns', function () {
    const result = map_player_play_to_db_fields(sample_row)

    expect(result.jersey_number).to.equal('57')
    expect(result.alignment).to.equal('LB')
    expect(result.alignment_side).to.equal('LEFT')
    expect(result.snap_role).to.equal('COVERAGE')
    expect(result.defender_technique).to.equal('2i')
    expect(result.coverage_responsibility).to.equal('HOOK CURL')
    expect(result.coverage_responsibility_side).to.equal('RIGHT')
  })

  // A false is a measurement, not an absence: pressure, press and passBreakup
  // are non-null on every one of the 6,976 rows sampled, and the overwhelming
  // majority are false. A truthiness filter would drop all of them and leave
  // the columns looking like the vendor rarely reports them.
  it('keeps a false boolean and drops only null and undefined', function () {
    const result = map_player_play_to_db_fields(sample_row)

    expect(result.is_primary_coverage).to.equal(false)
    expect(result.is_pressure).to.equal(false)
    expect(result.is_press).to.equal(false)
    expect(result.is_box_alignment).to.equal(true)

    expect(result).to.not.have.property('route_run')
    expect(result).to.not.have.property('route_break_depth')
    expect(result).to.not.have.property('passing_epa')
    expect(result).to.not.have.property('defense_sacks')
  })

  it('renames the quarterback booleans in full, not as qb', function () {
    const result = map_player_play_to_db_fields({
      qbScramble: true,
      qbDesignedRun: false,
      isQbHitter: true
    })

    expect(result.is_quarterback_scramble).to.equal(true)
    expect(result.is_quarterback_designed_run).to.equal(false)
    expect(result.is_quarterback_hitter).to.equal(true)
    expect(result).to.not.have.property('is_qb_scramble')
  })
})

describe('LIBS-SERVER charting team mapping inverse', function () {
  it('round-trips every one of the 32 teams', function () {
    const teams = Object.values(SUMER_TEAM_ID_TO_NFL)
    expect(teams.length).to.equal(32)

    for (const nfl_team of teams) {
      const sumer_id = resolve_nfl_team_sumer_id(nfl_team)
      expect(sumer_id, nfl_team).to.be.a('string')
      expect(resolve_sumer_team(sumer_id), nfl_team).to.equal(nfl_team)
    }
  })

  it('returns null rather than undefined for an unknown team', function () {
    expect(resolve_nfl_team_sumer_id('ZZZ')).to.equal(null)
    expect(resolve_nfl_team_sumer_id(null)).to.equal(null)
  })
})

describe('LIBS-SERVER charting player-play import oracle', function () {
  const healthy = {
    games_selected: 10,
    requests_attempted: 20,
    requests_with_rows: 20,
    requests_failed: 0,
    requests_empty: 0,
    rows_returned: 34000,
    rows_inserted: 34000,
    rows_dropped: 0,
    pid_unresolved: 4000
  }

  it('passes a healthy run', function () {
    expect(grade_player_play_import_run(healthy).passed).to.equal(true)
  })

  it('fails a scope that selected no games', function () {
    const grade = grade_player_play_import_run({
      ...healthy,
      games_selected: 0,
      requests_attempted: 0,
      requests_with_rows: 0,
      rows_returned: 0,
      rows_inserted: 0,
      pid_unresolved: 0
    })
    expect(grade.passed).to.equal(false)
    expect(grade.summary).to.match(/selected no games/)
  })

  // The whole reason this oracle exists separately from the matchup one. Rows
  // at this grain cannot be validated by content -- 1,618 rows collapse to 796
  // distinct values -- so a shortfall against the vendor's own returned count
  // is the only truncation signal available, and it gets no tolerance.
  it('fails on a single row that did not reach the table', function () {
    const grade = grade_player_play_import_run({
      ...healthy,
      rows_inserted: 33999,
      rows_dropped: 1
    })
    expect(grade.passed).to.equal(false)
    expect(grade.summary).to.match(/did not reach the table/)
  })

  it('fails when the request failure rate exceeds the ceiling', function () {
    const grade = grade_player_play_import_run({
      ...healthy,
      requests_with_rows: 10,
      requests_failed: 10
    })
    expect(grade.passed).to.equal(false)
    expect(grade.summary).to.match(/request failure rate/)
  })

  it('fails when pid resolution collapses', function () {
    const grade = grade_player_play_import_run({
      ...healthy,
      pid_unresolved: 20000
    })
    expect(grade.passed).to.equal(false)
    expect(grade.summary).to.match(/pid unresolved rate/)
  })

  // An unresolved pid must never fail a run on its own: the row is stored under
  // the vendor's player id and pid is backfillable. The measured residual sits
  // around 13%, so a healthy run carries thousands of them.
  it('passes a run whose unresolved pids sit at the measured residual', function () {
    const grade = grade_player_play_import_run({
      ...healthy,
      pid_unresolved: 4420
    })
    expect(grade.passed).to.equal(true)
  })

  it('allows an empty scope when the caller does not expect games', function () {
    const grade = grade_player_play_import_run({
      games_selected: 0,
      requests_attempted: 0,
      requests_with_rows: 0,
      requests_failed: 0,
      requests_empty: 0,
      rows_returned: 0,
      rows_inserted: 0,
      rows_dropped: 0,
      pid_unresolved: 0,
      expects_games: false
    })
    expect(grade.passed).to.equal(true)
  })
})
