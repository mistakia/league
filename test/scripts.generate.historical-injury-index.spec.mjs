/* global describe it */
import * as chai from 'chai'

import { rebuild_sql } from '#scripts/historical-injury-index-sql.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

describe('SCRIPTS /generate-historical-injury-index SQL string', function () {
  it('contains every named CTE the processor relies on', function () {
    for (const cte of [
      'reg_games AS',
      'gl AS',
      'practice_signal AS',
      'changelog_signal AS',
      'team_spans AS',
      'schedule_spine AS'
    ]) {
      expect(rebuild_sql).to.include(cte)
    }
  })

  it('uses the asymmetric (-7d, +3h) changelog window', function () {
    expect(rebuild_sql).to.include('gm.timestamp - 7*86400')
    expect(rebuild_sql).to.include('gm.timestamp + 3*3600')
  })

  it('binds start_year and end_year on every base-table scan', function () {
    expect(rebuild_sql).to.include(':start_year')
    expect(rebuild_sql).to.include(':end_year')
    // Both the reg_games CTE (nfl_games) and the gl CTE (player_gamelogs)
    // must be bounded -- otherwise the index would silently scan every
    // season on every per-year rebuild.
    expect(rebuild_sql).to.match(/nfl_games[\s\S]*?BETWEEN :start_year AND :end_year/)
    expect(rebuild_sql).to.match(/player_gamelogs[\s\S]*?BETWEEN :start_year AND :end_year/)
  })

  it('keys schedule_spine on team via h/v varchar(3) columns', function () {
    // Per the plan: reg_games CTE exposes h AS home_team and v AS away_team.
    // The schedule_spine MUST NOT key on home_team_id / away_team_id (the
    // mostly-NULL varchar(36) UUID columns).
    expect(rebuild_sql).to.include('h AS home_team')
    expect(rebuild_sql).to.include('v AS away_team')
    expect(rebuild_sql).to.not.include('home_team_id')
    expect(rebuild_sql).to.not.include('away_team_id')
  })

  it('caps confidence at medium for year < 2021', function () {
    // C5: 2009-2020 must not produce 'high'.
    expect(rebuild_sql).to.match(/spine_year\s*<\s*2021/)
    expect(rebuild_sql).to.include("THEN 'medium'")
  })

  it('handles spine-only rows (no gamelog) without NULL-collapse bugs', function () {
    // C3 fix: when gl.pid IS NULL, played explicitly false (not NULL > 0
    // returning NULL) and snap_count explicitly NULL (not 0).
    expect(rebuild_sql).to.match(/WHEN gl\.pid IS NULL THEN false/)
    expect(rebuild_sql).to.match(/WHEN gl\.pid IS NULL THEN NULL/)
  })

  it('orders missed_reason cascade with no-gamelog-row first', function () {
    const sql = rebuild_sql
    // Top-down branch order in the cascade -- verified by relative position
    // of the literal strings rather than parsing CASE structure.
    const idx_nrow = sql.indexOf("'no-gamelog-row'")
    const idx_inactive = sql.indexOf("'inactive'")
    const idx_reserve = sql.indexOf("'reserve-list'")
    const idx_zero = sql.indexOf("'zero-snap'")
    expect(idx_nrow).to.be.greaterThan(-1)
    expect(idx_nrow).to.be.lessThan(idx_inactive)
    expect(idx_inactive).to.be.lessThan(idx_reserve)
    expect(idx_reserve).to.be.lessThan(idx_zero)
  })
})
