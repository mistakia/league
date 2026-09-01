/* global describe, it, before, after */

import * as chai from 'chai'

import db from '#db'
import registry from '#db/checks/registry.mjs'
import { classify_check_rows } from '#libs-server/data-check.mjs'
import {
  game_prop_column_resolution_rows,
  game_prop_line_differential_rows
} from '#libs-server/game-prop-column-resolution.mjs'

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

// The second oracle this file drives: the line-differential check, which grades
// whether the COLUMN renders per-week line values. The resolution check grades
// the player SET a week and cannot see a column that resolves the right players
// while broadcasting one week's line onto every week — the report fc4a84ca0
// fixed. CI holds no betting data, so the differential is a production question
// for the weekly run; the seeds below drive the SHIPPED function red-capably.
const DIFFERENTIAL_CHECK = registry.find(
  (check) => check.check_id === 'betting-market-game-prop-line-differential'
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

// The VALUE-dimension universe for the differential: its own adjacent weeks (13,
// 14) with two players in both — one whose base lines DIFFER across the weeks
// (the case a broadcast column gets wrong) and one whose are EQUAL (the control
// that catches a column inventing differences). Kept on fresh weeks rather than
// the graded/decoy weeks so no exact-count assertion in the resolution units
// moves.
const VALUE_WEEKS = [
  { season_year: 2025, season_type: 'REG', week: 13, esbid: 2025131300 },
  { season_year: 2025, season_type: 'REG', week: 14, esbid: 2025131400 }
]
const VALUE_PLAYERS = [
  { pid: 'TEST-PSSR-900006', lines: [245.5, 101.5] },
  { pid: 'TEST-PSSR-900007', lines: [222.5, 222.5] }
]
const VALUE_PIDS = VALUE_PLAYERS.map(({ pid }) => pid)
const VALUE_MARKET_IDS = VALUE_WEEKS.map(
  (_, index) => `seeded-value-market-${index}`
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

  // The value universe. It must land before the materialized-view refresh so
  // weeks 13 and 14 are in the calendar alongside 7 and 8.
  await db('player').insert(VALUE_PIDS.map((pid) => seed_player(pid)))

  for (let i = 0; i < VALUE_WEEKS.length; i++) {
    const week = VALUE_WEEKS[i]

    await db('nfl_games').insert({
      esbid: week.esbid,
      season_year: week.season_year,
      season_type: week.season_type,
      week: week.week,
      home_nfl_team: 'KC',
      away_nfl_team: 'BUF'
    })

    await db('prop_markets_index').insert({
      market_type: 'GAME_PASSING_YARDS',
      source_id: 'FANDUEL',
      source_market_id: VALUE_MARKET_IDS[i],
      esbid: week.esbid,
      selection_count: VALUE_PLAYERS.length,
      time_type: 'CLOSE',
      observed_at: db.fn.now(),
      season_year: week.season_year
    })

    await db('prop_market_selections_index').insert(
      VALUE_PLAYERS.map(({ pid, lines }, index) => ({
        source_id: 'FANDUEL',
        source_market_id: VALUE_MARKET_IDS[i],
        source_selection_id: `seeded-value-selection-${i}-${index}`,
        selection_pid: pid,
        selection_type: 'OVER',
        selection_metric_line: lines[i],
        time_type: 'CLOSE',
        observed_at: db.fn.now()
      }))
    )
  }

  // The differential rows execute get_data_view_results, whose year+week row
  // axis joins nfl_year_week_timestamp. Refresh it now, after every seeded
  // game is present, so weeks 7, 8, 13 and 14 are all in the calendar.
  await db.raw('REFRESH MATERIALIZED VIEW nfl_year_week_timestamp')
}

const delete_seed = async () => {
  const market_ids = [
    ...MARKETS.map(({ key }) => market_id(key)),
    ...VALUE_MARKET_IDS
  ]

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
  await db('player').whereIn('pid', VALUE_PIDS).del()
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

  it('VALUE: the differential check is registered', function () {
    expect(DIFFERENTIAL_CHECK, 'the check is absent from the registry').to.exist
    expect(DIFFERENTIAL_CHECK.min_rate).to.equal(1.0)
  })

  it('VALUE: the column renders per-week lines that differ where the base tables say they differ', async function () {
    const rows = await game_prop_line_differential_rows({
      live_week: LIVE_WEEK
    })

    // The pair (13, 14) is the value universe: 900006's base lines differ
    // across the pair, 900007's are equal. Agreement on BOTH counts, so the
    // agreement ratio is 2/2. A broadcaster would render 900006 equal and read
    // 1/2.
    const value_pair = rows.find(
      (row) =>
        row.season_year === 2025 &&
        row.season_type === 'REG' &&
        row.week_b === 14
    )

    expect(value_pair, 'the 2025 REG week 13-14 pair is absent from the scan')
      .to.exist
    expect(value_pair.compared_players).to.equal(2)
    expect(value_pair.disagrees_players).to.equal(0)
    expect(value_pair.numerator).to.equal(2)
    expect(value_pair.denominator).to.equal(2)

    const result = classify_check_rows({
      rows: [value_pair],
      check: DIFFERENTIAL_CHECK
    })
    expect(result.gradeable).to.have.lengthOf(1)
    expect(result.findings).to.have.lengthOf(0)
  })

  it('VALUE: a week pair with nobody compared is reported, never a pass', async function () {
    const rows = await game_prop_line_differential_rows({
      live_week: LIVE_WEEK
    })

    // The graded and decoy weeks (7 and 8) are adjacent, but their players are
    // DISJOINT — nobody appears in both weeks — so there is no differential to
    // grade. That must read as NOT EXERCISED, exactly like the resolution
    // check's live-week unit: a season that has produced no answerable pair
    // must not read as health.
    const disjoint_pair = rows.find(
      (row) =>
        row.season_year === 2025 &&
        row.season_type === 'REG' &&
        row.week_b === 8
    )

    expect(disjoint_pair, 'the 2025 REG week 7-8 pair is absent from the scan')
      .to.exist
    expect(disjoint_pair.denominator).to.equal(0)

    const result = classify_check_rows({
      rows: [disjoint_pair],
      check: DIFFERENTIAL_CHECK
    })
    expect(result.ungradeable).to.have.lengthOf(1)
    expect(result.gradeable).to.have.lengthOf(0)
    expect(result.findings).to.have.lengthOf(0)
  })

  it('VALUE: a column that broadcasts one week line is a finding', function () {
    // The broadcast signature, hand-graded the way the seeded PASS unit is
    // computed: both compared players render the same line, so the agreement
    // ratio is 0/2 and the pair is a finding.
    const result = classify_check_rows({
      rows: [
        {
          season_year: 2025,
          season_type: 'REG',
          week_a: 13,
          week_b: 14,
          numerator: 0,
          denominator: 2
        }
      ],
      check: DIFFERENTIAL_CHECK
    })

    expect(result.gradeable).to.have.lengthOf(1)
    expect(result.findings).to.have.lengthOf(1)
  })

  it('VALUE: ONE wrong line in a pair is a finding, not a rounding tolerance', function () {
    const result = classify_check_rows({
      rows: [
        {
          season_year: 2025,
          season_type: 'REG',
          week_a: 13,
          week_b: 14,
          numerator: 1,
          denominator: 2
        }
      ],
      check: DIFFERENTIAL_CHECK
    })

    expect(result.findings).to.have.lengthOf(1)
  })
})
