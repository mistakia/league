import db from '#db'
import { bookmaker_constants } from '#libs-shared'
import {
  current_nfl_week_params,
  format_nfl_week_identifier
} from '#libs-shared/nfl-week-identifier.mjs'
import get_data_view_results from '#libs-server/get-data-view-results.mjs'

/*
  Does the player game-prop data-view column actually RESOLVE the game-prop
  markets the database holds?

  WHY THIS IS NOT A GATE. league 6e724c02c turned ON an inner `nfl_games` join
  for six player game-prop columns that previously emitted none at any clock.
  Structurally that change is covered in CI by
  test/data-views.betting-market-grain.spec.mjs, which asserts every one of the
  six emits the join under four clocks. What no test can assert is the half that
  needs real markets: that the join RESOLVES rather than annihilating the row
  set. CI runs against a throwaway Postgres holding no betting-market data at
  all, so the only place the question can be asked is production, on the weekly
  data-check run -- and the arrival of game props is a standing DATA condition
  reached with no code change, which is the registry's own dividing line.

  WHY THE REFERENCE IS HAND-WRITTEN SQL. The players the column resolves come
  from the SHIPPED column, executed through get_data_view_results -- the same
  path the API takes, the same builder, the same join. The players it OUGHT to
  resolve come from the query below, which reads the base tables directly and
  never touches a column definition. Deriving both from the column would grade
  the column against itself.

  WHY THE MEASURE IS AN INTERSECTION OVER A UNION. `min_rate` is one-sided, and
  the obvious measure -- resolved players over reference players -- is wrong in
  the direction this check exists for. Losing the nfl_games join does not empty
  a game-grain column; it makes it SEASON-WIDE, resolving every passer in the
  year instead of the week's thirty. That reads as a rate of 10.0, which clears
  a floor of 1.0 in silence. Grading the intersection over the union makes 1.0
  mean the two sets are IDENTICAL: a player the column dropped and a player the
  column invented both enlarge the union and leave the intersection alone, so
  either direction falls below the floor.

  WHY NOT EXERCISED IS THE POINT. Before real game props land for a season, the
  reference finds nothing for the live week and the unit carries a denominator
  of 0. classify_check_rows reports a zero-denominator row as UN-GRADEABLE, not
  clean -- so the state the operator sees is "not exercised", never a pass. The
  live unit is emitted unconditionally for exactly that reason: were it derived
  only from the markets that exist, a season with no props would be ABSENT from
  the scan, which reads as silence rather than as a question not yet answerable.

  WHY THE PRIOR SEASON IS IN SCOPE. It is what makes the check non-vacuous
  today. A detector whose whole population is a season that has not started
  cannot be shown to work, and the first run that could tell you anything is the
  first run that matters. Grading the previous season alongside the current one
  proves the join resolves in production on every weekly run, against a
  population large enough to see a break -- the 2025 corpus grades 21 week-units
  at 4 to 33 players each.
*/

// The column under test, and the params that select a population large enough
// to grade. GAME_PASSING_YARDS / FANDUEL / CLOSE / OVER are the column's own
// defaults for a player game prop; naming them here rather than relying on the
// default keeps the reference query and the column pointed at one population
// even if a default moves.
const COLUMN_ID = 'player_game_prop_line_from_betting_markets'
const MARKET_TYPE = bookmaker_constants.player_prop_types.GAME_PASSING_YARDS
const SOURCE_ID = bookmaker_constants.bookmakers.FANDUEL
const TIME_TYPE = bookmaker_constants.time_type.CLOSE
const SELECTION_TYPE = bookmaker_constants.selection_type.OVER

// Every player the reference finds must come back, so the limit only has to
// exceed the largest population the corpus can produce. The widest week
// measured is 33.
const RESULT_LIMIT = 500

const QUERY_TIMEOUT = 60000

/**
 * The population the column MUST resolve, per week, read off the base tables.
 *
 * The `player` join is not incidental: the column inner-joins its CTE to
 * `player` on the selection pid, so a selection naming a pid we do not carry is
 * one the column cannot return and must not be graded against.
 *
 * @param {object} args
 * @param {number} args.from_season_year - earliest season to read
 * @returns {Promise<Array<{season_year: number, season_type: string, week: number, pids: Set<string>}>>}
 */
const reference_population = async ({ from_season_year }) => {
  const { rows } = await db.raw(
    `
    select
      m.season_year,
      g.season_type,
      g.week,
      array_agg(distinct s.selection_pid) as pids
    from prop_markets_index m
    join prop_market_selections_index s
      on s.source_id = m.source_id
     and s.source_market_id = m.source_market_id
     and s.time_type = m.time_type
    join nfl_games g
      on g.esbid = m.esbid
     and g.season_year = m.season_year
    join player p on p.pid = s.selection_pid
    where m.market_type = ?
      and m.time_type = ?
      and m.source_id = ?
      and s.selection_type = ?
      and s.selection_metric_line is not null
      and m.season_year >= ?
      and g.week is not null
    group by 1, 2, 3
    `,
    [MARKET_TYPE, TIME_TYPE, SOURCE_ID, SELECTION_TYPE, from_season_year]
  )

  return rows.map((/** @type {Record<string, any>} */ row) => ({
    season_year: Number(row.season_year),
    season_type: row.season_type,
    week: Number(row.week),
    pids: new Set(row.pids)
  }))
}

/**
 * How many players the SHIPPED column returns for one week.
 *
 * Executed through the default export rather than the builder, because a query
 * that builds and a query a real server accepts are different claims. The
 * `IS NOT NULL` where filter is what keeps this a count of RESOLVED players
 * rather than a page of the player table.
 *
 * @param {object} args
 * @param {number} args.season_year
 * @param {string} args.season_type
 * @param {number} args.week
 * @returns {Promise<Set<string>>} distinct players the column resolved
 */
const column_resolved_players = async ({ season_year, season_type, week }) => {
  const params = {
    year: season_year,
    seas_type: season_type,
    week,
    market_type: MARKET_TYPE,
    source_id: SOURCE_ID,
    time_type: TIME_TYPE,
    selection_type: SELECTION_TYPE
  }

  const { data_view_results } = await get_data_view_results({
    columns: [{ column_id: COLUMN_ID, params }],
    where: [
      {
        column_id: COLUMN_ID,
        params,
        operator: 'IS NOT NULL',
        value: null
      }
    ],
    sort: [{ column_id: 'player_name', desc: false }],
    limit: RESULT_LIMIT,
    calculate_total_count: false,
    timeout: QUERY_TIMEOUT
  })

  return new Set(data_view_results.map((row) => row.pid))
}

/**
 * One row per week the game-prop column is answerable for, plus the live week
 * whether or not it is answerable yet.
 *
 * @param {object} [args]
 * @param {{year: number, seas_type: string, week: number}} [args.live_week] -
 *   the week a column with no explicit param resolves to. Injectable so the
 *   spec can drive a clock without mocking the whole date.
 * @param {number} [args.seasons_of_history] - how many prior seasons to grade
 * @returns {Promise<Array<Record<string, any>>>}
 */
export const game_prop_column_resolution_rows = async ({
  live_week = current_nfl_week_params(),
  seasons_of_history = 1
} = {}) => {
  const reference = await reference_population({
    from_season_year: live_week.year - seasons_of_history
  })

  const units = reference.map((row) => ({ ...row, is_live_week: false }))

  // The live week is emitted even when the reference found nothing for it. A
  // season with no props yet must be PRESENT in the report as un-gradeable; if
  // it were merely absent, a column that never resolves anything would read
  // exactly like a healthy one.
  const live_unit = units.find(
    (row) =>
      row.season_year === live_week.year &&
      row.season_type === live_week.seas_type &&
      row.week === live_week.week
  )

  if (live_unit) {
    live_unit.is_live_week = true
  } else {
    units.push({
      season_year: live_week.year,
      season_type: live_week.seas_type,
      week: live_week.week,
      pids: new Set(),
      is_live_week: true
    })
  }

  const rows = []
  for (const unit of units) {
    const { pids, ...grain } = unit

    // A unit whose reference population is empty is un-gradeable by contract,
    // so executing the column for it would buy nothing but a query.
    if (!pids.size) {
      rows.push({ ...grain, numerator: 0, denominator: 0, resolved: 0 })
      continue
    }

    const resolved = await column_resolved_players(grain)

    // TWO-SIDED, inside a one-sided threshold. `min_rate` compares
    // numerator/denominator against a floor, so grading resolved-against-
    // reference would pass a column resolving TEN TIMES the players it should
    // -- which is not hypothetical, it is the exact defect 6e724c02c repaired.
    // Losing the nfl_games join does not empty a game-prop column, it makes it
    // season-wide, and a rate of 10.0 clears a floor of 1.0 without a murmur.
    //
    // Grading the INTERSECTION over the UNION makes 1.0 mean set equality: a
    // player missing from the column and a player the column invented both
    // enlarge the union while leaving the intersection where it was, so either
    // direction falls below the floor.
    const intersection = [...pids].filter((pid) => resolved.has(pid)).length
    const union = new Set([...pids, ...resolved]).size

    rows.push({
      ...grain,
      numerator: intersection,
      denominator: union,
      reference_players: pids.size,
      resolved_players: resolved.size
    })
  }

  return rows
}

// ---------------------------------------------------------------------------
// The VALUE dimension: does the column render per-week lines, or does it
// broadcast one week's line onto every week?
//
// This is the second way a week-scoped column can lie, and the resolution check
// cannot see it. A CTE pinned to the first requested week resolves the SAME
// players every week, so the player SET is exact and `betting-market-game-prop-
// column-resolution` grades it 1.0000 while every week renders the first week's
// line. That was the shape of the live report the week-scope migration fixed
// (fc4a84ca0): every player's 2024 prop line identical across weeks 1 and 2.
//
// The oracle is the DIFFERENTIAL, one unit per adjacent week pair (week, week+1)
// inside a season. A player in both weeks with an unambiguous base line in each
// is COMPARED: the column must agree with the base on whether the two lines
// differ. numerator/denominator is the agreement ratio over compared players,
// min_rate 1.0, so a broadcast reads 0/1 per pair. The one-sided reading of the
// task ("lines differ where the base tables say they differ") is symmetric here:
// a player the base says is equal but the column renders different is as much a
// value bug as the broadcast, and agreement catches both because it requires
// column-diff to equal ref-diff.
//
// Cells where the base tables disagree with THEMSELVES are excluded rather than
// guessed: a (pid, week) with duplicate markets carrying different lines — the
// player path collapses them with a DISTINCT ON whose winner is storage order —
// has no reference line, so it joins the differential scan only once a week has
// exactly one distinct line. The DISTINCT ON dedup is the player-path half the
// item-4 note flagged as unported to the team path; for the player path the
// column is designed around it, and this exclusion is what keeps the reference
// honest about what "the line" means.
//
// WHY CI CANNOT ASK THIS. CI's throwaway Postgres holds no betting markets at
// all, so a differential over real markets has nothing to compare in CI; only a
// weekly production run — where each season's markets ARE the population — can
// grade it. The spec drives the same function against a seeded two-week universe
// to prove the oracle red-capable.
// ---------------------------------------------------------------------------

// One player-week is in the scan only when the base holds exactly one distinct
// line for it. `having count(distinct line) = 1` is the exclusion: duplicate
// same-week markets with different lines have no unambiguous reference, and the
// player path's DISTINCT ON dedup does not promise which line survives.
const reference_lines = async ({ from_season_year }) => {
  const { rows } = await db.raw(
    `
    select season_year, season_type, week, pid, min(line) as line
    from (
      select
        m.season_year,
        g.season_type,
        g.week,
        s.selection_pid as pid,
        s.selection_metric_line as line
      from prop_markets_index m
      join prop_market_selections_index s
        on s.source_id = m.source_id
       and s.source_market_id = m.source_market_id
       and s.time_type = m.time_type
      join nfl_games g
        on g.esbid = m.esbid
       and g.season_year = m.season_year
      join player p on p.pid = s.selection_pid
      where m.market_type = ?
        and m.time_type = ?
        and m.source_id = ?
        and s.selection_type = ?
        and s.selection_metric_line is not null
        and m.season_year >= ?
        and g.week is not null
    ) src
    group by season_year, season_type, week, pid
    having count(distinct line) = 1
    `,
    [MARKET_TYPE, TIME_TYPE, SOURCE_ID, SELECTION_TYPE, from_season_year]
  )

  // `year|seas_type|week` -> Map(pid -> line)
  const by_week = new Map()
  for (const row of rows) {
    const key = `${row.season_year}|${row.season_type}|${row.week}`
    if (!by_week.has(key)) by_week.set(key, new Map())
    by_week.get(key).set(String(row.pid), Number(row.line))
  }
  return by_week
}

/**
 * The line the SHIPPED column renders per (pid, week) across one season's
 * weeks. ONE request per season rather than one per week: 17 separate requests
 * would each pin their own pair, which is not the shape a real data view uses
 * and would hide a broadcaster that keyed on request rather than on week.
 *
 * The limit has to cover a whole season's population, not a single week's. The
 * player-prop corpus peaks around 33 passers in one week, so RESULT_LIMIT is
 * sized to a week; the widest season measured is under a thousand rows, well
 * inside the API's hard 2000 cap.
 */
const SEASON_RESULT_LIMIT = 2000

const column_lines_for_weeks = async ({ season_year, season_type, weeks }) => {
  const identifiers = weeks.map((week) =>
    format_nfl_week_identifier({
      year: season_year,
      seas_type: season_type,
      week
    })
  )

  const params = {
    market_type: MARKET_TYPE,
    source_id: SOURCE_ID,
    time_type: TIME_TYPE,
    selection_type: SELECTION_TYPE,
    single_nfl_week_id: identifiers
  }

  const { data_view_results } = await get_data_view_results({
    columns: [{ column_id: COLUMN_ID, params }],
    where: [
      {
        column_id: COLUMN_ID,
        params,
        operator: 'IS NOT NULL',
        value: null
      }
    ],
    row_axes: ['year', 'week'],
    sort: [{ column_id: 'player_name', desc: false }],
    limit: SEASON_RESULT_LIMIT,
    calculate_total_count: false,
    timeout: QUERY_TIMEOUT
  })

  // `pid|week` -> rendered line. The alias is the single requested column's
  // output name (the `_0` positional suffix the data-view runtime appends).
  const lines = new Map()
  for (const row of data_view_results) {
    lines.set(
      `${row.pid}|${row.week}`,
      Number(row.game_prop_line_betting_market_0)
    )
  }
  return lines
}

/**
 * Line-differential rows for the NEW check betting-market-game-prop-line-
 * differential: one row per adjacent week pair per (season_year, season_type),
 * graded on agreement.
 *
 * @param {object} [args]
 * @param {{year: number, seas_type: string, week: number}} [args.live_week]
 * @param {number} [args.seasons_of_history]
 * @returns {Promise<Array<Record<string, any>>>}
 */
export const game_prop_line_differential_rows = async ({
  live_week = current_nfl_week_params(),
  seasons_of_history = 1
} = {}) => {
  const reference = await reference_lines({
    from_season_year: live_week.year - seasons_of_history
  })

  // Group the weeks by (season_year, season_type), in week order.
  const seasons = new Map()
  for (const [key, lines] of reference) {
    const [season_year, season_type, week] = key.split('|')
    const season_key = `${season_year}|${season_type}`
    if (!seasons.has(season_key)) seasons.set(season_key, [])
    seasons.get(season_key).push({ week: Number(week), lines })
  }
  for (const weeks of seasons.values()) {
    weeks.sort((a, b) => a.week - b.week)
  }

  const rows = []
  for (const [season_key, weeks] of seasons) {
    const [season_year, season_type] = season_key.split('|')
    const year = Number(season_year)

    // Adjacent pairs — (week, week+1) within one season and season type. The
    // postseason restarts at week 1, but within a single season_type the
    // sequence is contiguous.
    const pairs = []
    for (let i = 0; i < weeks.length - 1; i++) {
      if (weeks[i + 1].week === weeks[i].week + 1) {
        pairs.push([weeks[i], weeks[i + 1]])
      }
    }

    if (!pairs.length) {
      // A season in the scan with no adjacent pair yet exists to report as
      // NOT EXERCISED, never as a pass: the differential cannot answer when the
      // season has not produced two adjacent weeks.
      rows.push({
        season_year: year,
        season_type,
        week_b: null,
        numerator: 0,
        denominator: 0
      })
      continue
    }

    const column_lines = await column_lines_for_weeks({
      season_year: year,
      season_type,
      weeks: weeks.map(({ week }) => week)
    })

    for (const [
      { week: week_a, lines: lines_a },
      { week: week_b, lines: lines_b }
    ] of pairs) {
      // COMPARED is a player with an unambiguous base line in BOTH weeks that
      // the shipped column actually resolved in both weeks. A player the column
      // dropped from a week belongs to the resolution check, not this one; it
      // has no rendered line to compare, and grading absence here would
      // double-report the same defect from two angles.
      const compared = [...lines_a.keys()].filter(
        (pid) =>
          lines_b.has(pid) &&
          column_lines.has(`${pid}|${week_a}`) &&
          column_lines.has(`${pid}|${week_b}`)
      )

      const disagrees = compared.filter((pid) => {
        const ref_diff = lines_a.get(pid) !== lines_b.get(pid)
        const col_diff =
          column_lines.get(`${pid}|${week_a}`) !==
          column_lines.get(`${pid}|${week_b}`)
        return ref_diff !== col_diff
      })

      rows.push({
        season_year: year,
        season_type,
        week_a,
        week_b,
        numerator: compared.length - disagrees.length,
        denominator: compared.length,
        compared_players: compared.length,
        disagrees_players: disagrees.length
      })
    }
  }

  return rows
}
