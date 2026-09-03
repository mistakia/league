/* global describe before after afterEach it */
import * as chai from 'chai'

import db from '#db'
import registry from '#db/checks/registry.mjs'
import { classify_check_rows } from '#libs-server/data-check.mjs'
import { naive_token_census_violations } from '#libs-server/nfl-team-abbreviation-conformance.mjs'

const expect = chai.expect

/*
  The negative control for `nfl-team-abbreviation-conformance`, and the reason
  it is a spec rather than the calibration prose most registered checks rely
  on: nfl_games is an ordinary table in the suite's own database, so the defect
  can be SEEDED and the check run over it for real.

  The case this file exists for is the 1975 `BAL` Colts row. It is the one the
  naive form of this check cannot see, because `BAL` is simultaneously an era
  token of the Colts and the canonical abbreviation of the Ravens -- so every
  test below is a PAIR, and the pair is the evidence rather than either half:

    1975 BAL   must be reported   (Colts, whose current abbreviation is IND)
    2020 BAL   must NOT be        (Ravens, already canonical)

  A check that flagged every `BAL` would pass the first assertion and fail the
  second; a check that resolved token-first -- the specific inversion this
  design rejects -- passes the second and fails the first. Only the season-first
  order passes both, which is what makes the pair discriminating.

  The naive token census is exercised alongside on the SAME seeded row and
  required to read it CLEAN. That assertion looks redundant and is not: it is
  the only thing establishing that the season-aware machinery is load-bearing
  rather than a more elaborate spelling of a query that would have worked.
*/

const check = registry.find(
  (entry) => entry.check_id === 'nfl-team-abbreviation-conformance'
)

// Outside every seeded fixture's range, so these rows cannot collide with
// another spec's and a leftover cannot be mistaken for one.
const esbid_base = 99100001

const seed_game = async ({
  esbid,
  season_year,
  away_nfl_team,
  home_nfl_team
}) =>
  db('nfl_games').insert({
    esbid,
    season_year,
    week: 1,
    season_type: 'REG',
    away_nfl_team,
    home_nfl_team
  })

const clear = async () => db('nfl_games').where('esbid', '>=', esbid_base).del()

/*
  The check's own rows, run for real. Reduced to the questions each case asks,
  and both are read off the returned rows rather than recomputed here -- a
  denominator this spec derived itself could agree with a query that scanned
  nothing.
*/
const run = async () => {
  const rows = await check.rows()
  const result = classify_check_rows({ rows, check, parked: [] })

  const finding_for = ({ column_name, season_year }) =>
    result.findings.find(
      (row) =>
        row.table_name === 'nfl_games' &&
        row.column_name === column_name &&
        Number(row.season_year) === season_year
    )

  return {
    finding_for,
    rows,
    result,
    scanned_seasons: new Set(
      rows
        .filter((row) => row.table_name === 'nfl_games')
        .map((row) => Number(row.season_year))
    )
  }
}

describe('data checks / nfl-team-abbreviation-conformance', function () {
  this.timeout(60000)

  before(clear)
  afterEach(clear)
  after(clear)

  it('is registered', () => {
    expect(check).to.exist
    expect(check.grain).to.eql(['table_name', 'column_name', 'season_year'])
  })

  it('reports an unconformed 1975 BAL Colts row', async () => {
    await seed_game({
      esbid: esbid_base,
      season_year: 1975,
      away_nfl_team: 'BAL',
      home_nfl_team: 'MIA'
    })

    const { finding_for, scanned_seasons } = await run()

    // The scan reached the season at all. Without this, an absent finding and
    // an absent SEASON read identically.
    expect(scanned_seasons.has(1975)).to.equal(true)

    const finding = finding_for({
      column_name: 'away_nfl_team',
      season_year: 1975
    })
    expect(finding, 'the 1975 BAL row must be reported').to.exist
    expect(finding.numerator).to.equal(1)

    // MIA in the same row is canonical in 1975 and must not be swept up.
    expect(finding_for({ column_name: 'home_nfl_team', season_year: 1975 })).to
      .not.exist
  })

  it('does NOT report a 2020 BAL Ravens row', async () => {
    await seed_game({
      esbid: esbid_base + 1,
      season_year: 2020,
      away_nfl_team: 'BAL',
      home_nfl_team: 'MIA'
    })

    const { finding_for, scanned_seasons } = await run()

    expect(scanned_seasons.has(2020)).to.equal(true)
    expect(
      finding_for({ column_name: 'away_nfl_team', season_year: 2020 }),
      'BAL is the Ravens in 2020 and is already canonical'
    ).to.not.exist
  })

  it('the naive token census is BLIND to the 1975 BAL row', async () => {
    await seed_game({
      esbid: esbid_base + 2,
      season_year: 1975,
      away_nfl_team: 'BAL',
      home_nfl_team: 'MIA'
    })

    // Same row, same column, the check a reader would write first.
    const naive = await naive_token_census_violations({
      table_name: 'nfl_games',
      column: 'away_nfl_team'
    })
    expect(
      naive,
      'BAL is in the canonical 32, so a token census cannot see this row'
    ).to.equal(0)

    // And the season-aware form does see it. Asserting the blindness alone
    // would be satisfied by a census pointed at an empty table.
    const { finding_for } = await run()
    expect(finding_for({ column_name: 'away_nfl_team', season_year: 1975 })).to
      .exist
  })

  it('reports an era token whose canonical form differs by season', async () => {
    // STL is the Cardinals in 1975 and the Rams in 2000 -- the token whose
    // meaning MOVES, resolving to two different franchises with no overlap.
    await seed_game({
      esbid: esbid_base + 3,
      season_year: 1975,
      away_nfl_team: 'STL',
      home_nfl_team: 'MIA'
    })
    await seed_game({
      esbid: esbid_base + 4,
      season_year: 2000,
      away_nfl_team: 'STL',
      home_nfl_team: 'MIA'
    })

    const { finding_for } = await run()

    expect(finding_for({ column_name: 'away_nfl_team', season_year: 1975 })).to
      .exist
    expect(finding_for({ column_name: 'away_nfl_team', season_year: 2000 })).to
      .exist
  })

  it('reports an UNDATABLE row rather than grading it clean', async () => {
    /*
      nfl_games.season_year is nullable, and it is the only season column in
      scope that is. With a NULL season both range comparisons are NULL, so
      neither EXISTS fires and control used to reach the membership arm -- where
      BAL is canonical, so a Colts game with no season graded CLEAN. The check's
      whole reason for existing is that BAL cannot be judged on the token alone,
      and a missing season is the case where it cannot be judged at all.
    */
    await db('nfl_games').insert({
      esbid: esbid_base + 8,
      season_year: null,
      week: 1,
      season_type: 'REG',
      away_nfl_team: 'BAL',
      home_nfl_team: 'MIA'
    })

    const { result } = await run()
    const finding = result.findings.find(
      (row) =>
        row.table_name === 'nfl_games' &&
        row.column_name === 'away_nfl_team' &&
        row.season_year === null
    )

    expect(finding, 'a row with no season must not grade clean').to.exist
  })

  it('reports an unmodelled token rather than passing it through', async () => {
    // The SQL predicate's form of the resolver's `throw`: a token in no era
    // range and in neither the canonical nor the non-franchise set is a
    // violation, so a new abbreviation cannot enter the database unnoticed.
    await seed_game({
      esbid: esbid_base + 5,
      season_year: 2024,
      away_nfl_team: 'ZZZ',
      home_nfl_team: 'MIA'
    })

    const { finding_for } = await run()
    expect(finding_for({ column_name: 'away_nfl_team', season_year: 2024 })).to
      .exist
  })

  it('reports nothing over a conformed corpus', async () => {
    // The green half of the two-sided reading. A check that has only ever
    // fired carries as little information as one that never has.
    await seed_game({
      esbid: esbid_base + 6,
      season_year: 1975,
      away_nfl_team: 'IND',
      home_nfl_team: 'MIA'
    })

    const { result, scanned_seasons } = await run()

    expect(scanned_seasons.has(1975)).to.equal(true)
    expect(
      result.findings.filter((row) => row.table_name === 'nfl_games')
    ).to.have.lengthOf(0)
  })

  it("every declared source's query executes, and the undatable population is declared", async () => {
    // The suite's database is empty of plays, gamelogs and players, so a
    // source with no rows contributes no row here -- which is correct and is
    // exactly why this cannot assert that all five sources APPEAR. What it can
    // assert is that every source's generated SQL runs: check.rows() issues one
    // query per source and a malformed one throws rather than returning
    // nothing, so reaching the assertions below is itself the coverage.
    await seed_game({
      esbid: esbid_base + 7,
      season_year: 2024,
      away_nfl_team: 'BAL',
      home_nfl_team: 'MIA'
    })

    const { rows } = await run()

    const scanned_tables = new Set(rows.map((row) => row.table_name))
    expect(scanned_tables.has('nfl_games')).to.equal(true)

    // The undatable nfl_play_stats population is reported un-gradeable rather
    // than dropped by the esbid join. It is emitted unconditionally, so it is
    // present even over an empty corpus -- which is the point: a population
    // nothing can date must never leave the scan silently.
    const orphan_row = rows.find(
      (row) => row.table_name === 'nfl_play_stats' && row.season_year === null
    )
    expect(orphan_row, 'the undatable play-stat population must be reported').to
      .exist
    expect(orphan_row.denominator).to.equal(0)
  })
})
