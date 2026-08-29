// The pre-deploy backtest user:guideline/nfl/league/points-added-valuation.md
// requires before any change to the valuation: a point-in-time board across
// every available season, reporting per-season gaps, sign consistency,
// positional shares and concentration.
//
// It lives HERE rather than in scratch because it imports the whole pricing
// pipeline. Its predecessor sat in scratch, drifted out of sync with two rounds
// of renames, and failed at import the next time the gate was run -- a rename
// that breaks it now breaks it visibly, next to the code that caused it.
//
// POINT-IN-TIME SOURCE. `projections_index` is current state with no timestamp
// column, so no as-of cutoff is expressible against it and its past-season
// week-w rows are each frozen at the week w was live. The weekly board is the
// newest row per (source_id, pid, week) in `projections_history` generated
// before that season's opening kickoff; the season-grain board is the newest
// row per (source_id, pid) in `season_projections_history` at the same cutoff.
//
// LOAD THE SEASON SERIES, NOT JUST THE WEEKS. `calculate_distributional_baselines`
// reads `points[season_aggregate_key]` through `get_player_week_total`, which
// returns null for a missing key -- so a board holding only numeric weeks
// prices NOBODY on the season board, silently and with no error.
//
// `current_week: 1` on the period pass, because a PRESEASON board's
// rest-of-season period is the whole season. The default floors to the live
// week and would score a partial season against a full realized one.
//
// Read-only. Writes nothing.
//
// Run with the league tunnel up:
//   NODE_ENV=production LEAGUE_DB_HOST=127.0.0.1 LEAGUE_DB_PORT=15432 \
//     node scripts/measure-preseason-valuation-backtest.mjs

import db from '#db'
import {
  calculate_season_projection_values,
  calculate_weekly_projection_values,
  calculate_player_period_values,
  calculatePoints,
  groupBy
} from '#libs-shared'
import {
  rest_of_season_aggregate_key,
  rest_of_season_net_aggregate_key,
  season_net_aggregate_key
} from '#libs-shared/calculate-player-period-values.mjs'
import { season_aggregate_key } from '#libs-shared/calculate-distributional-baselines.mjs'
import { all_projected_fantasy_stats, fantasy_positions } from '#constants'
import { get_league_format } from '#libs-server'

const LEAGUE_FORMAT_ID = 'genesis_10_team'
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025]

// Each projected aggregate is scored against ITS OWN realized counterpart.
// Pairing a positive-only projection against a signed realized figure measures
// the variant difference rather than the forecast.
const SCORED = [
  { key: rest_of_season_aggregate_key, realized: 'points_added_earned' },
  { key: rest_of_season_net_aggregate_key, realized: 'points_added_net' },
  { key: season_net_aggregate_key, realized: 'points_added_net' },
  { key: season_aggregate_key, realized: 'points_added_earned' }
]

// Source weighting is deliberately flat. `weightProjections` reads a per-user
// weights table that does not exist for a past season, and its unweighted
// branch is a plain mean over the sources present -- reimplemented here so the
// query can return one pre-averaged row per (pid, week).
const mean_projection_by_pid_week = (rows) => {
  const acc = new Map()
  for (const row of rows) {
    const key = `${row.pid}/${row.week}`
    let entry = acc.get(key)
    if (!entry) {
      entry = { pid: row.pid, week: row.week, sums: {}, counts: {} }
      acc.set(key, entry)
    }
    for (const stat of all_projected_fantasy_stats) {
      const value = row[stat]
      if (value === null || value === undefined) continue
      entry.sums[stat] = (entry.sums[stat] || 0) + Number(value)
      entry.counts[stat] = (entry.counts[stat] || 0) + 1
    }
  }

  const out = []
  for (const entry of acc.values()) {
    const projection = {}
    for (const stat of all_projected_fantasy_stats) {
      // A stat no source spoke to stays absent rather than becoming a zero --
      // averaging an absent opinion into the denominator would drag every
      // multi-source stat toward zero.
      projection[stat] = entry.counts[stat]
        ? entry.sums[stat] / entry.counts[stat]
        : null
    }
    out.push({ pid: entry.pid, week: entry.week, projection })
  }
  return out
}

const load_preseason_board = async ({
  year,
  opener,
  final_week,
  league_format
}) => {
  const { rows } = await db.raw(
    `
    SELECT DISTINCT ON (source_id, pid, week) *
    FROM projections_history
    WHERE season_year = ?
      AND season_type = 'REG'
      AND week BETWEEN 1 AND ?
      AND generated_at < ?
    ORDER BY source_id, pid, week, generated_at DESC
    `,
    [year, final_week, opener]
  )

  // `<=` rather than `<` matches the guideline's as-of read. The table is
  // stored change-only, which is lossless here: the row a cutoff selects is the
  // last value CHANGE at or before it either way.
  const { rows: season_rows } = await db.raw(
    `
    SELECT DISTINCT ON (source_id, pid) *
    FROM season_projections_history
    WHERE season_year = ?
      AND generated_at <= ?
    ORDER BY source_id, pid, generated_at DESC
    `,
    [year, opener]
  )

  const averaged = mean_projection_by_pid_week(rows)
  const season_averaged = mean_projection_by_pid_week(
    season_rows.map((row) => ({ ...row, week: season_aggregate_key }))
  )

  const pids = [
    ...new Set([
      ...averaged.map((r) => r.pid),
      ...season_averaged.map((r) => r.pid)
    ])
  ]
  const players = await db('player')
    .select('pid', 'primary_position')
    .whereIn('pid', pids)
    .whereIn('primary_position', fantasy_positions)

  const by_pid = groupBy([...averaged, ...season_averaged], 'pid')
  return players.map((player) => {
    const projection = {}
    const points = {}
    for (const row of by_pid[player.pid] || []) {
      projection[row.week] = row.projection
      points[row.week] = calculatePoints({
        stats: row.projection,
        position: player.primary_position,
        league: league_format,
        use_projected_stats: true
      })
    }
    return { ...player, projection, points, pts_added: {}, market_salary: {} }
  })
}

const round = (n, places = 4) =>
  Number.isFinite(n) ? Number(n.toFixed(places)) : null

const summarize = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  const sum = sorted.reduce((a, b) => a + b, 0)
  return {
    n,
    mean: round(n ? sum / n : 0),
    median: round(n ? sorted[Math.floor(n / 2)] : 0)
  }
}

const spearman = (pairs) => {
  const n = pairs.length
  if (n < 2) return null
  const rank = (get) => {
    const order = [...pairs].sort((a, b) => get(b) - get(a))
    const ranks = new Map()
    order.forEach((p, i) => ranks.set(p, i + 1))
    return ranks
  }
  const rx = rank((p) => p.projected)
  const ry = rank((p) => p.realized)
  let d2 = 0
  for (const p of pairs) {
    const d = rx.get(p) - ry.get(p)
    d2 += d * d
  }
  return round(1 - (6 * d2) / (n * (n * n - 1)))
}

const positional_shares = (players, key) => {
  const totals = {}
  let all = 0
  for (const player of players) {
    const value = Math.max(player.pts_added[key] || 0, 0)
    totals[player.primary_position] =
      (totals[player.primary_position] || 0) + value
    all += value
  }
  const out = {}
  for (const position of fantasy_positions) {
    out[position] = round(all ? (100 * (totals[position] || 0)) / all : 0, 2)
  }
  return out
}

const concentration = (players, key) => {
  const salaries = players
    .map((p) => p.market_salary?.[key] || 0)
    .sort((a, b) => b - a)
  const total = salaries.reduce((a, b) => a + b, 0)
  const top = (n) =>
    total ? (100 * salaries.slice(0, n).reduce((a, b) => a + b, 0)) / total : 0
  return {
    priced: salaries.filter((s) => s > 0).length,
    total_dollars: total,
    top_salary: salaries[0] || 0,
    top_24_share: round(top(24), 2),
    top_50_share: round(top(50), 2)
  }
}

// Top of the board, by the league-rules season positive board -- the aggregate
// generate-tag-board.mjs prices franchise, rookie and RFA tags from.
const top_of_board = async ({ players, key, limit = 15 }) => {
  const ranked = [...players]
    .filter((p) => (p.market_salary?.[key] || 0) > 0)
    .sort((a, b) => (b.market_salary[key] || 0) - (a.market_salary[key] || 0))
    .slice(0, limit)
  if (!ranked.length) return []
  const names = await db('player')
    .select('pid', 'first_name', 'last_name')
    .whereIn(
      'pid',
      ranked.map((p) => p.pid)
    )
  const by_pid = new Map(
    names.map((n) => [n.pid, `${n.first_name} ${n.last_name}`])
  )
  return ranked.map((p) => ({
    name: by_pid.get(p.pid) || p.pid,
    pos: p.primary_position,
    salary: p.market_salary[key],
    pts_added: round(p.pts_added[key] || 0, 2)
  }))
}

const run_year = async ({ year, league_format }) => {
  const game_window = await db('nfl_games')
    .where({ season_year: year, season_type: 'REG' })
    .min('kickoff_at as opener')
    .max('week as final_week')
    .first()

  const { opener, final_week } = game_window
  const players = await load_preseason_board({
    year,
    opener,
    final_week,
    league_format
  })

  calculate_season_projection_values({ players, league: league_format })
  for (let week = 1; week <= final_week; week++) {
    calculate_weekly_projection_values({ players, league: league_format, week })
  }
  calculate_player_period_values({
    players,
    league: league_format,
    current_week: 1
  })

  const realized_rows = await db('league_format_player_seasonlogs')
    .select('pid', 'points_added_earned', 'points_added_net')
    .where({ season_year: year, league_format_id: LEAGUE_FORMAT_ID })
  const realized_by_pid = new Map(realized_rows.map((r) => [r.pid, r]))

  const report = {
    year,
    final_week,
    board_size: players.length,
    opener: opener instanceof Date ? opener.toISOString() : String(opener),
    variants: {}
  }

  for (const { key, realized: realized_column } of SCORED) {
    const matched = []
    for (const player of players) {
      const realized = realized_by_pid.get(player.pid)
      if (!realized) continue
      matched.push({
        pid: player.pid,
        projected: player.pts_added[key] || 0,
        realized: Number(realized[realized_column])
      })
    }
    const gaps = matched.map((p) => p.projected - p.realized)
    report.variants[key] = {
      scored_against: realized_column,
      matched: matched.length,
      gap: summarize(gaps),
      projected_total: round(
        matched.reduce((a, p) => a + p.projected, 0),
        2
      ),
      realized_total: round(
        matched.reduce((a, p) => a + p.realized, 0),
        2
      ),
      spearman: spearman(matched),
      shares: positional_shares(players, key),
      concentration: concentration(players, key)
    }
  }

  report.top_of_board = {
    [season_aggregate_key]: await top_of_board({
      players,
      key: season_aggregate_key
    })
  }

  return report
}

const main = async () => {
  const league_format = await get_league_format({
    league_format_id: LEAGUE_FORMAT_ID
  })
  if (!league_format) throw new Error(`format ${LEAGUE_FORMAT_ID} not found`)

  const reports = []
  for (const year of YEARS) {
    const report = await run_year({ year, league_format })
    reports.push(report)
    console.log(`--- ${year} ---`)
    console.log(JSON.stringify(report, null, 2))
  }

  console.log('=== SIGN CONSISTENCY ===')
  for (const { key } of SCORED) {
    const means = reports.map((r) => r.variants[key].gap.mean)
    const positive = means.filter((m) => m > 0).length
    console.log(
      `${key}: mean gap positive in ${positive}/${means.length} seasons; ` +
        `per-season mean gap ${means.map((m) => m.toFixed(1)).join(', ')}`
    )
  }

  await db.destroy()
  process.exit(0)
}

main()
