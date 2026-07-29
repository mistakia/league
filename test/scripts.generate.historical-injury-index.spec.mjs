/* global describe it */
import * as chai from 'chai'

import db from '#db'
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
    expect(rebuild_sql).to.match(
      /nfl_games[\s\S]*?BETWEEN :start_year AND :end_year/
    )
    expect(rebuild_sql).to.match(
      /player_gamelogs[\s\S]*?BETWEEN :start_year AND :end_year/
    )
  })

  it('keys schedule_spine on team via home_nfl_team/away_nfl_team varchar(3) columns', function () {
    // Per the plan: reg_games CTE exposes home_nfl_team AS home_team and
    // away_nfl_team AS away_team. The schedule_spine MUST NOT key on
    // home_team_id / away_team_id (the mostly-NULL varchar(36) UUID columns).
    expect(rebuild_sql).to.include('home_nfl_team AS home_team')
    expect(rebuild_sql).to.include('away_nfl_team AS away_team')
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

  // Everything above this point only string-matches, and that is exactly how
  // this script shipped a broken rebuild. When `practice` was conformed to
  // season_year / season_type, the practice_signal CTE kept asking for year and
  // seas_type; the rebuild threw 42703 on every run while all seven assertions
  // above stayed green. Grep proves the absence of a string. Only the database
  // can say whether the query is valid, so these two assertions execute it.
  describe('executes against the real schema', function () {
    it('plans without error -- every column reference resolves', async function () {
      // EXPLAIN is enough: it resolves and type-checks every reference without
      // scanning. Bindings are inlined because EXPLAIN of a raw string is not a
      // prepared statement.
      const sql = rebuild_sql
        .replace(/:start_year/g, '2024')
        .replace(/:end_year/g, '2024')
      await db.raw(`EXPLAIN ${sql}`)
    })

    it('projects exactly the columns historical_injury_index accepts', async function () {
      // The generator spreads these rows straight into an insert
      // (generate-historical-injury-index.mjs), so the SELECT's output aliases
      // ARE the insert contract. An alias that is not a column on the table is
      // a 42703 at write time that no string assertion can see.
      const sql = rebuild_sql
        .replace(/:start_year/g, '2024')
        .replace(/:end_year/g, '2024')

      await db.raw(`CREATE TEMP VIEW rebuild_shape AS ${sql}`)
      try {
        // Checked in BOTH directions. Projected-but-absent is the 42703 at
        // write time. Absent-from-projection is quieter and worse: drop
        // s.nfl_team from the SELECT and every row still inserts, with the
        // column silently NULL on all 526k of them. inserted_at/updated_at are
        // the only legitimate absences -- the generator supplies those in JS.
        const { rows } = await db.raw(
          `SELECT COALESCE(v.column_name, t.column_name) AS column_name,
                  CASE WHEN t.column_name IS NULL THEN 'not a column on the table'
                       ELSE 'missing from the projection' END AS problem
             FROM (SELECT column_name FROM information_schema.columns
                    WHERE table_name = 'rebuild_shape'
                      AND table_schema LIKE 'pg_temp%') v
             FULL OUTER JOIN (SELECT column_name FROM information_schema.columns
                    WHERE table_name = 'historical_injury_index'
                      AND table_schema = 'public'
                      AND column_name NOT IN ('inserted_at', 'updated_at')) t
               ON v.column_name = t.column_name
            WHERE v.column_name IS NULL OR t.column_name IS NULL
            ORDER BY 1`
        )
        expect(
          rows.map((r) => `${r.column_name}: ${r.problem}`),
          'rebuild projection disagrees with historical_injury_index'
        ).to.eql([])
      } finally {
        await db.raw('DROP VIEW IF EXISTS rebuild_shape')
      }
    })
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
