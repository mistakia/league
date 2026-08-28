/* global describe, it, before, after */

import * as chai from 'chai'

import db from '#db'
import registry from '#db/checks/registry.mjs'
import { classify_check_rows } from '#libs-server/data-check.mjs'
import { game_prop_column_resolution_rows } from '#libs-server/game-prop-column-resolution.mjs'

const expect = chai.expect

/*
  The three states of betting-market-game-prop-column-resolution, driven rather
  than asserted.

  A check whose only demonstrated state is green is indistinguishable from a
  check that cannot report, and this one is built for a defect — an inner
  nfl_games join that annihilates its row set — whose whole signature is silence.
  So each state gets a seeded corpus that produces it:

    PASS           a week whose markets link to an nfl_games row, resolved in
                   full by the SHIPPED column through get_data_view_results
    NOT EXERCISED  the live week, with no player game props for it at all,
                   present in the scan carrying a denominator of 0
    FAIL           a second week of markets the seeded week's query must NOT
                   return, which is what losing the nfl_games join produces

  The FAIL arm is the one that matters, and it is driven end to end rather than
  asserted against the classifier. It seeds a SECOND game in the same season at
  a different week, so a column that has stopped scoping to the week resolves
  both weeks' players. Grading the intersection over the union is what turns
  that into a finding: the naive measure — resolved over reference — reads 2.0
  and sails past a floor of 1.0, which is precisely how a game-grain column can
  go season-wide without a murmur. The join being EMITTED at all is pinned
  separately and structurally by test/data-views.betting-market-grain.spec.mjs.
*/

const CHECK = registry.find(
  (check) => check.check_id === 'betting-market-game-prop-column-resolution'
)

// One season behind the live week the seed declares, so it lands inside the
// check's own scope without depending on the wall clock.
const LIVE_WEEK = { year: 2026, seas_type: 'REG', week: 1 }
const GRADED = { season_year: 2025, season_type: 'REG', week: 7 }

// A SECOND week in the same season, with its own players. Nothing in the graded
// week's verdict may come from it. This is what makes the PASS arm a negative
// control rather than a tautology: a column that has stopped scoping to the
// week returns both weeks' players for either query, which the union measure
// reports as a rate of 0.5 rather than as the 2.0 the naive measure would.
const DECOY = { season_year: 2025, season_type: 'REG', week: 8 }

const MARKETS = [
  { key: 'graded', game: GRADED, esbid: 2025100500 },
  { key: 'decoy', game: DECOY, esbid: 2025101200 }
]

const PLAYERS = {
  graded: [
    { pid: 'TEST-PSSR-900001', line: 245.5 },
    { pid: 'TEST-PSSR-900002', line: 268.5 },
    { pid: 'TEST-PSSR-900003', line: 221.5 }
  ],
  decoy: [
    { pid: 'TEST-PSSR-900004', line: 199.5 },
    { pid: 'TEST-PSSR-900005', line: 305.5 }
  ]
}

const ALL_PIDS = Object.values(PLAYERS).flatMap((list) =>
  list.map(({ pid }) => pid)
)

const seed_player = (pid) => ({
  pid,
  first_name: 'Seeded',
  last_name: pid.slice(-6),
  short_name: 'S.Test',
  formatted_name: `seeded ${pid.slice(-6)}`,
  primary_position: 'QB',
  secondary_position: 'QB'
})

const market_id = (key) => `seeded-market-${key}`

const insert_seed = async () => {
  await db('player').insert(ALL_PIDS.map((pid) => seed_player(pid)))

  for (const { key, game, esbid } of MARKETS) {
    await db('nfl_games').insert({
      esbid,
      season_year: game.season_year,
      season_type: game.season_type,
      week: game.week,
      home_nfl_team: 'KC',
      away_nfl_team: 'BUF'
    })

    await db('prop_markets_index').insert({
      market_type: 'GAME_PASSING_YARDS',
      source_id: 'FANDUEL',
      source_market_id: market_id(key),
      esbid,
      selection_count: PLAYERS[key].length,
      time_type: 'CLOSE',
      observed_at: db.fn.now(),
      season_year: game.season_year
    })

    await db('prop_market_selections_index').insert(
      PLAYERS[key].map(({ pid, line }, index) => ({
        source_id: 'FANDUEL',
        source_market_id: market_id(key),
        source_selection_id: `seeded-selection-${key}-${index}`,
        selection_pid: pid,
        selection_type: 'OVER',
        selection_metric_line: line,
        time_type: 'CLOSE',
        observed_at: db.fn.now()
      }))
    )
  }
}

const delete_seed = async () => {
  const market_ids = MARKETS.map(({ key }) => market_id(key))

  await db('prop_market_selections_index')
    .whereIn('source_market_id', market_ids)
    .del()
  await db('prop_markets_index').whereIn('source_market_id', market_ids).del()
  await db('nfl_games')
    .whereIn(
      'esbid',
      MARKETS.map(({ esbid }) => esbid)
    )
    .del()
  await db('player').whereIn('pid', ALL_PIDS).del()
}

describe('DATA CHECKS game prop column resolution', function () {
  this.timeout(60000)

  before(async () => {
    await delete_seed()
    await insert_seed()
  })

  after(async () => {
    await delete_seed()
  })

  it('is registered', function () {
    expect(CHECK, 'the check is absent from the registry').to.exist
    expect(CHECK.min_rate).to.equal(1.0)
  })

  it('PASS: the column resolves the week exactly, neither dropping nor inventing', async function () {
    const rows = await game_prop_column_resolution_rows({
      live_week: LIVE_WEEK
    })

    const graded = rows.find(
      (row) =>
        row.season_year === GRADED.season_year &&
        row.season_type === GRADED.season_type &&
        row.week === GRADED.week
    )

    expect(graded, 'the seeded week is absent from the scan').to.exist

    // Exact on BOTH sides. The decoy week's two players are in the same season
    // and the same market type, so a column that has lost its week scoping
    // returns five here and this assertion is what reports it.
    expect(graded.reference_players).to.equal(PLAYERS.graded.length)
    expect(graded.resolved_players).to.equal(PLAYERS.graded.length)
    expect(graded.numerator).to.equal(PLAYERS.graded.length)
    expect(graded.denominator).to.equal(PLAYERS.graded.length)

    const result = classify_check_rows({ rows: [graded], check: CHECK })
    expect(result.gradeable).to.have.lengthOf(1)
    expect(result.findings).to.have.lengthOf(0)
  })

  it('PASS: the decoy week grades on its own players, not the graded week', async function () {
    const rows = await game_prop_column_resolution_rows({
      live_week: LIVE_WEEK
    })

    const decoy = rows.find(
      (row) => row.week === DECOY.week && row.season_year === DECOY.season_year
    )

    expect(decoy, 'the decoy week is absent from the scan').to.exist
    expect(decoy.resolved_players).to.equal(PLAYERS.decoy.length)
    expect(decoy.numerator).to.equal(decoy.denominator)
  })

  it('NOT EXERCISED: the live week is in the scan and un-gradeable, never a pass', async function () {
    const rows = await game_prop_column_resolution_rows({
      live_week: LIVE_WEEK
    })

    const live = rows.find((row) => row.is_live_week)

    // Present in the scan is the whole point. A season with no props yet must
    // be a reported question, not an absence that reads like health.
    expect(live, 'the live week is missing from the scan').to.exist
    expect(live.season_year).to.equal(LIVE_WEEK.year)
    expect(live.season_type).to.equal(LIVE_WEEK.seas_type)
    expect(live.week).to.equal(LIVE_WEEK.week)
    expect(live.denominator).to.equal(0)

    const result = classify_check_rows({ rows: [live], check: CHECK })
    expect(result.ungradeable).to.have.lengthOf(1)
    expect(result.gradeable).to.have.lengthOf(0)
    expect(result.findings).to.have.lengthOf(0)
  })

  // The two directions the union measure exists to make symmetric. Both are
  // driven through the SHIPPED check config, so loosening `min_rate` below 1.0
  // fails these rather than quietly widening what counts as healthy.
  it('FAIL: a column that DROPS players is a finding', function () {
    // The join gone wrong: three players expected, none resolved.
    const result = classify_check_rows({
      rows: [{ ...GRADED, numerator: 0, denominator: 3 }],
      check: CHECK
    })

    expect(result.gradeable).to.have.lengthOf(1)
    expect(result.findings).to.have.lengthOf(1)
  })

  it('FAIL: a column that INVENTS players is a finding, which a naive rate would miss', function () {
    // The join gone MISSING: three players expected, thirty resolved because
    // the column went season-wide. Resolved-over-reference reads 10.0 and
    // passes; intersection-over-union reads 0.1 and does not.
    const result = classify_check_rows({
      rows: [{ ...GRADED, numerator: 3, denominator: 30 }],
      check: CHECK
    })

    expect(result.findings).to.have.lengthOf(1)
  })

  it('FAIL: a PARTIAL resolution is a finding too, not a rounding tolerance', function () {
    const result = classify_check_rows({
      rows: [{ ...GRADED, numerator: 2, denominator: 3 }],
      check: CHECK
    })

    expect(result.findings).to.have.lengthOf(1)
  })
})
