/* global describe, it, before, after */

import * as chai from 'chai'

import db from '#db'
import registry from '#db/checks/registry.mjs'
import { classify_check_rows } from '#libs-server/data-check.mjs'
import {
  game_prop_column_resolution_rows,
  game_prop_line_value_rows
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

// The second oracle this file drives: the line-VALUE check, which grades whether
// the COLUMN renders the line the base tables hold. The resolution check grades
// the player SET a week and cannot see a column that resolves the right players
// while rendering wrong values — the report fc4a84ca0 fixed. CI holds no betting
// data, so this is a production question for the weekly run; the seeds below
// drive the SHIPPED function red-capably.
//
// The failing arms inject a column READER rather than asserting hand-built
// numerator/denominator literals. A literal proves only that classify_check_rows
// divides — it exercises none of the code that decides what the numerator IS, so
// the arm would stay green if the comparison itself broke. Injecting a reader
// drives the real aggregation and leaves only get_data_view_results stubbed.
const VALUE_CHECK = registry.find(
  (check) => check.check_id === 'betting-market-game-prop-line-value'
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

  it('VALUE: the line-value check is registered', function () {
    expect(VALUE_CHECK, 'the check is absent from the registry').to.exist
    expect(VALUE_CHECK.min_rate).to.equal(1.0)
  })

  it('VALUE: the column renders the line the base tables hold, per week', async function () {
    const rows = await game_prop_line_value_rows({ live_week: LIVE_WEEK })

    // Weeks 13 and 14 are the value universe: 900006's line moves across them
    // (245.5 -> 101.5), 900007's does not (222.5 both weeks). Both must render
    // exactly, in both weeks, so each week reads 2/2.
    for (const week of [13, 14]) {
      const unit = rows.find(
        (row) =>
          row.season_year === 2025 &&
          row.season_type === 'REG' &&
          row.week === week
      )

      expect(unit, `the 2025 REG week ${week} unit is absent from the scan`).to
        .exist
      expect(unit.compared_players).to.equal(2)
      expect(unit.wrong_players).to.equal(0)
      expect(unit.numerator).to.equal(2)
      expect(unit.denominator).to.equal(2)

      const result = classify_check_rows({ rows: [unit], check: VALUE_CHECK })
      expect(result.gradeable).to.have.lengthOf(1)
      expect(result.findings).to.have.lengthOf(0)
    }
  })

  it('VALUE: a broadcaster is a finding', async function () {
    // The defect the check was built for: one week's line rendered on every
    // week. Driven through the real aggregation, not a hand-built ratio.
    const broadcast_reader = async ({ weeks }) => {
      const lines = new Map()
      for (const week of weeks) {
        lines.set(`TEST-PSSR-900006|${week}`, 245.5)
        lines.set(`TEST-PSSR-900007|${week}`, 222.5)
      }
      return { lines, truncated: false }
    }

    const rows = await game_prop_line_value_rows({
      live_week: LIVE_WEEK,
      read_column_lines: broadcast_reader
    })

    // Week 14's true lines are 101.5 and 222.5. The broadcast renders 245.5 and
    // 222.5, so 900006 is wrong and 900007 is accidentally right: 1/2.
    const unit = rows.find(
      (row) =>
        row.season_year === 2025 && row.season_type === 'REG' && row.week === 14
    )
    expect(unit.wrong_players).to.equal(1)
    expect(unit.denominator).to.equal(2)

    const result = classify_check_rows({ rows: [unit], check: VALUE_CHECK })
    expect(result.gradeable).to.have.lengthOf(1)
    expect(result.findings).to.have.lengthOf(1)
  })

  it('VALUE: a constant offset on every line is a finding, which the differential could not see', async function () {
    // THE reason this oracle replaced the differential. Every line one point
    // high preserves every week-to-week DIFFERENCE, so the differential graded
    // it a clean 1.0000. Equality reads 0/2 on every week.
    const offset_reader = async ({ weeks }) => {
      const base = {
        13: { 'TEST-PSSR-900006': 245.5, 'TEST-PSSR-900007': 222.5 },
        14: { 'TEST-PSSR-900006': 101.5, 'TEST-PSSR-900007': 222.5 }
      }
      const lines = new Map()
      for (const week of weeks) {
        for (const [pid, line] of Object.entries(base[week] || {})) {
          lines.set(`${pid}|${week}`, line + 1)
        }
      }
      return { lines, truncated: false }
    }

    const rows = await game_prop_line_value_rows({
      live_week: LIVE_WEEK,
      read_column_lines: offset_reader
    })

    for (const week of [13, 14]) {
      const unit = rows.find(
        (row) =>
          row.season_year === 2025 &&
          row.season_type === 'REG' &&
          row.week === week
      )
      expect(
        unit.numerator,
        `week ${week} graded a shifted line as correct`
      ).to.equal(0)
      expect(unit.denominator).to.equal(2)

      const result = classify_check_rows({ rows: [unit], check: VALUE_CHECK })
      expect(result.findings).to.have.lengthOf(1)
    }
  })

  it('VALUE: ONE wrong line is a finding, not a rounding tolerance', async function () {
    const one_wrong_reader = async ({ weeks }) => {
      const base = {
        13: { 'TEST-PSSR-900006': 245.5, 'TEST-PSSR-900007': 222.5 },
        14: { 'TEST-PSSR-900006': 101.5, 'TEST-PSSR-900007': 222.5 }
      }
      const lines = new Map()
      for (const week of weeks) {
        for (const [pid, line] of Object.entries(base[week] || {})) {
          const corrupt = week === 14 && pid === 'TEST-PSSR-900006'
          lines.set(`${pid}|${week}`, corrupt ? line + 0.5 : line)
        }
      }
      return { lines, truncated: false }
    }

    const rows = await game_prop_line_value_rows({
      live_week: LIVE_WEEK,
      read_column_lines: one_wrong_reader
    })

    const unit = rows.find(
      (row) =>
        row.season_year === 2025 && row.season_type === 'REG' && row.week === 14
    )
    expect(unit.numerator).to.equal(1)
    expect(unit.denominator).to.equal(2)

    const result = classify_check_rows({ rows: [unit], check: VALUE_CHECK })
    expect(result.findings).to.have.lengthOf(1)
  })

  it('VALUE: a truncated column read is reported, never graded on the prefix', async function () {
    // A read cut off at the result limit knows nothing about the rows past the
    // cut. Grading the survivors would report the agreement rate of the
    // alphabetical head of the season as though it were the season -- a clean
    // 1.0000 over an unknown fraction, which is the exact failure shape the
    // check family exists to refuse.
    const truncated_reader = async ({ weeks }) => {
      const lines = new Map()
      for (const week of weeks) {
        lines.set(`TEST-PSSR-900007|${week}`, 222.5)
      }
      return { lines, truncated: true }
    }

    const rows = await game_prop_line_value_rows({
      live_week: LIVE_WEEK,
      read_column_lines: truncated_reader
    })

    const unit = rows.find(
      (row) =>
        row.season_year === 2025 && row.season_type === 'REG' && row.week === 14
    )
    expect(unit.truncated_read).to.equal(true)
    expect(unit.denominator).to.equal(0)

    const result = classify_check_rows({ rows: [unit], check: VALUE_CHECK })
    expect(result.ungradeable).to.have.lengthOf(1)
    expect(result.gradeable).to.have.lengthOf(0)
    expect(result.findings).to.have.lengthOf(0)
  })
})
