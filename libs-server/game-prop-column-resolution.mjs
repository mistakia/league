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
// The oracle is direct LINE EQUALITY, one unit per (season_year, season_type,
// week). A player with an unambiguous base line for the week that the column
// also resolved is COMPARED: the rendered line must equal the base line.
// numerator/denominator is the agreement ratio over compared players, min_rate
// 1.0.
//
// This replaced a DIFFERENTIAL over adjacent week pairs, which asked only
// whether the column agreed with the base about which weeks CHANGED. That is
// strictly weaker and it fails in the direction that looks like health: a column
// rendering every line one point high, or the right ladder rung from the wrong
// market, moves in step with the base and the differential grades it 1.0000.
// Equality subsumes it -- a broadcast still reads 0/N, because a broadcast line
// cannot equal the base in more than one week -- and it needs no pairing, so a
// season's first week is gradeable instead of waiting for a second.
//
// Cells where the base tables disagree with THEMSELVES are excluded rather than
// guessed: a (pid, week) with duplicate markets carrying different lines — the
// player path collapses them with a DISTINCT ON whose winner is storage order —
// has no reference line, so it joins the scan only once a week has exactly one
// distinct line. The DISTINCT ON dedup is the player-path half the
// item-4 note flagged as unported to the team path; for the player path the
// column is designed around it, and this exclusion is what keeps the reference
// honest about what "the line" means.
//
// WHY CI CANNOT ASK THIS. CI's throwaway Postgres holds no betting markets at
// all, so a comparison against real markets has nothing to read in CI; only a
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

  // A read that came back exactly at the limit was CUT, and the rows past the
  // cut are unknown rather than absent. Grading a prefix would report the
  // agreement rate of the alphabetical head of the season as though it were the
  // season -- a clean 1.0000 over whatever fraction survived the limit, which is
  // the failure shape this whole check family exists to refuse. The caller turns
  // this into a refusal to grade rather than trying to compensate for it.
  return { lines, truncated: data_view_results.length >= SEASON_RESULT_LIMIT }
}

/**
 * Reads what the SHIPPED column rendered, keyed `pid|week`. `truncated` says the
 * read came back at the result limit, so the rows past the cut are unknown
 * rather than absent and the caller must refuse to grade rather than grade the
 * prefix.
 *
 * @callback read_column_lines_fn
 * @param {object} args
 * @param {number} args.season_year
 * @param {string} args.season_type
 * @param {Array<number>} args.weeks
 * @returns {Promise<{lines: Map<string, number>, truncated: boolean}>}
 */

/**
 * Line-value rows for the check betting-market-game-prop-line-value: one row
 * per (season_year, season_type, week), graded on whether the column renders
 * the line the base tables hold.
 *
 * @param {object} [args]
 * @param {{year: number, seas_type: string, week: number}} [args.live_week]
 * @param {number} [args.seasons_of_history]
 * @param {read_column_lines_fn} [args.read_column_lines] Seam for the spec, so
 *   the failing arms drive this function rather than asserting hand-built
 *   numerator and denominator literals.
 * @returns {Promise<Array<Record<string, any>>>}
 */
export const game_prop_line_value_rows = async ({
  live_week = current_nfl_week_params(),
  seasons_of_history = 1,
  read_column_lines = column_lines_for_weeks
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

    const { lines: column_lines, truncated } = await read_column_lines({
      season_year: year,
      season_type,
      weeks: weeks.map(({ week }) => week)
    })

    for (const { week, lines: reference_week } of weeks) {
      // A truncated read makes every week of that season un-answerable, not
      // merely the weeks past the cut: the limit is applied to the season-wide
      // result, so which week lost rows is unknown. Report the whole season as
      // NOT EXERCISED rather than grading the part that survived.
      if (truncated) {
        rows.push({
          season_year: year,
          season_type,
          week,
          numerator: 0,
          denominator: 0,
          compared_players: 0,
          truncated_read: true
        })
        continue
      }

      // COMPARED is a player with an unambiguous base line for the week that the
      // shipped column also resolved. A player the column dropped belongs to the
      // resolution check: it has no rendered line to compare, and grading its
      // absence here would double-report one defect from two angles.
      const compared = [...reference_week.keys()].filter((pid) =>
        column_lines.has(`${pid}|${week}`)
      )

      const wrong = compared.filter(
        (pid) => column_lines.get(`${pid}|${week}`) !== reference_week.get(pid)
      )

      rows.push({
        season_year: year,
        season_type,
        week,
        numerator: compared.length - wrong.length,
        denominator: compared.length,
        compared_players: compared.length,
        wrong_players: wrong.length
      })
    }
  }

  return rows
}
