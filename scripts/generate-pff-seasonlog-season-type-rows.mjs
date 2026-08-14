// Derive the REG and POST rows of pff_player_seasonlogs from the game-level PFF
// archive. The REGPO row is PFF's own season-level value and is written by the
// three importers; this script splits its `routes` across season types and
// writes nothing else.
//
// WHY THIS IS A DERIVATION AND NOT A SUM.
//
// The obvious implementation -- sum `routes` out of the game-level
// receiving/summary facet, grouped by nfl_games.season_type -- is wrong for
// roughly 45% of players, and wrong quietly. PFF's game-level receiving facet
// lists only players with at least one TARGET in that game (verified in the raw
// archive: facet/game/receiving_summary/28474.json holds 13 rows, minimum
// targets 1, and Jahan Dotson is absent from a game he played). Every route run
// in a game where a player was not targeted is therefore missing, and the naive
// sum undercounts -- Dotson's 2025 sums to 360 against a stored 437.
//
// The offense/summary facet has no such gate (every offensive player, every
// game), but its `snap_counts_pass_route` is a DIFFERENT measure: it equals
// snap_counts_total_pass for a receiver, so it counts pass snaps rather than
// routes and cannot supply the value. What it can do is say which games a
// player appeared in with route-eligible snaps, which is what identifies the
// games the receiving facet omitted.
//
// So the stored REGPO value is treated as the trusted total and each season
// type is derived from whichever side is complete:
//
//   - no postseason games at all -> REG is the whole combined value
//   - both sides complete        -> sum both, and require the sum to equal REGPO
//   - one side complete          -> that side is the sum, the other is REGPO minus it
//   - gaps on both sides         -> write nothing for that player-season
//
// REG + POST therefore equals REGPO on every row this script writes, by
// construction rather than by hope, and a player-season it cannot resolve gets
// no scoped row rather than an undercounted one.
//
// No changelog rows are recorded: these are derived values recomputed in full
// on every run, not curated ones settled by a source.
//
// Usage:
//   NODE_ENV=production LEAGUE_DB_HOST=127.0.0.1 LEAGUE_DB_PORT=15432 \
//     node scripts/generate-pff-seasonlog-season-type-rows.mjs --all --dry-run

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { is_main, batch_insert } from '#libs-server'
import db from '#db'

const initialize_cli = () =>
  yargs(hideBin(process.argv))
    .option('year', {
      type: 'string',
      describe: 'Comma-separated season years'
    })
    .option('all', {
      type: 'boolean',
      describe: 'Every season with archive data'
    })
    .option('dry-run', { type: 'boolean' }).argv

// One row per (pid, season_year) carrying each season type's game-level route
// sum, how many of that type's games the receiving facet omitted, how many
// games of that type the player appeared in at all, and the stored combined
// value the split has to reconcile to.
const derivation_query = `
WITH facet_routes AS (
  SELECT
    f.pid,
    f.esbid,
    coalesce(
      max(CASE WHEN f.facet = 'receiving/summary'
               THEN (f.facet_payload->>'routes')::int END),
      max(CASE WHEN f.facet = 'rushing/summary'
               THEN (f.facet_payload->>'routes')::int END)
    ) AS routes
  FROM pff_player_facet_gamelogs f
  WHERE f.facet IN ('receiving/summary', 'rushing/summary')
  GROUP BY 1, 2
),
appearances AS (
  SELECT
    pid,
    esbid,
    max((facet_payload->>'snap_counts_pass_route')::int) AS route_snaps
  FROM pff_player_facet_gamelogs
  WHERE facet = 'offense/summary'
  GROUP BY 1, 2
),
player_games AS (
  SELECT
    coalesce(r.pid, a.pid) AS pid,
    coalesce(r.esbid, a.esbid) AS esbid,
    r.routes,
    coalesce(a.route_snaps, 0) AS route_snaps
  FROM facet_routes r
  FULL OUTER JOIN appearances a ON a.pid = r.pid AND a.esbid = r.esbid
),
scoped AS (
  SELECT
    pg.pid,
    g.season_year,
    g.season_type,
    sum(coalesce(pg.routes, 0)) AS routes,
    count(*) FILTER (WHERE pg.routes IS NULL AND pg.route_snaps > 0) AS missing_games,
    count(*) AS games
  FROM player_games pg
  JOIN nfl_games g ON pg.esbid = g.esbid::varchar
  WHERE g.season_type IN ('REG', 'POST')
  GROUP BY 1, 2, 3
),
per_player AS (
  SELECT
    pid,
    season_year,
    coalesce(sum(routes) FILTER (WHERE season_type = 'REG'), 0) AS reg_routes,
    coalesce(sum(missing_games) FILTER (WHERE season_type = 'REG'), 0) AS reg_missing,
    coalesce(sum(games) FILTER (WHERE season_type = 'REG'), 0) AS reg_games,
    coalesce(sum(routes) FILTER (WHERE season_type = 'POST'), 0) AS post_routes,
    coalesce(sum(missing_games) FILTER (WHERE season_type = 'POST'), 0) AS post_missing,
    coalesce(sum(games) FILTER (WHERE season_type = 'POST'), 0) AS post_games
  FROM scoped
  GROUP BY 1, 2
)
SELECT p.*, s.routes AS combined_routes
FROM per_player p
JOIN pff_player_seasonlogs s
  ON s.pid = p.pid
 AND s.season_year = p.season_year
 AND s.season_type = 'REGPO'
WHERE s.routes IS NOT NULL
`

// Resolve one player-season into the scoped rows it supports, or into the
// reason it supports none. Returns { rows, resolution }.
export const resolve_season_type_split = (row) => {
  const reg_routes = Number(row.reg_routes)
  const post_routes = Number(row.post_routes)
  const combined = Number(row.combined_routes)
  const reg_games = Number(row.reg_games)
  const post_games = Number(row.post_games)
  const reg_complete = Number(row.reg_missing) === 0
  const post_complete = Number(row.post_missing) === 0

  const emit = (resolution, values) => {
    const rows = []
    for (const [season_type, routes] of Object.entries(values)) {
      if (routes < 0) return { rows: [], resolution: 'negative_remainder' }
      rows.push({
        pid: row.pid,
        season_year: Number(row.season_year),
        season_type,
        routes
      })
    }
    return { rows, resolution }
  }

  // A player with no postseason games ran every one of his routes in the
  // regular season, so the combined value IS the regular-season value -- true
  // whatever the receiving facet omitted, which is what makes this the widest
  // class by a long way.
  if (post_games === 0) {
    if (reg_games === 0) return { rows: [], resolution: 'no_games' }
    return emit('no_postseason', { REG: combined })
  }

  if (reg_games === 0) {
    return emit('no_regular_season', { POST: combined })
  }

  if (reg_complete && post_complete) {
    if (reg_routes + post_routes !== combined) {
      return { rows: [], resolution: 'unreconciled' }
    }
    return emit('both_complete', { REG: reg_routes, POST: post_routes })
  }

  if (reg_complete) {
    return emit('regular_season_complete', {
      REG: reg_routes,
      POST: combined - reg_routes
    })
  }

  if (post_complete) {
    return emit('postseason_complete', {
      REG: combined - post_routes,
      POST: post_routes
    })
  }

  return { rows: [], resolution: 'gaps_on_both_sides' }
}

const generate_pff_seasonlog_season_type_rows = async ({
  years = null,
  dry_run = false
} = {}) => {
  const params = []
  let sql = derivation_query
  if (years && years.length) {
    sql += ` AND p.season_year = ANY(?)`
    params.push(years)
  }
  sql += ' ORDER BY p.season_year, p.pid'

  const { rows: player_seasons } = await db.raw(sql, params)

  const stats = {
    player_seasons: player_seasons.length,
    resolutions: {},
    rows_by_season_type: { REG: 0, POST: 0 },
    rows_by_season: {}
  }

  const rows_to_write = []
  for (const player_season of player_seasons) {
    const { rows, resolution } = resolve_season_type_split(player_season)
    stats.resolutions[resolution] = (stats.resolutions[resolution] || 0) + 1
    for (const row of rows) {
      stats.rows_by_season_type[row.season_type] += 1
      const key = `${row.season_year}_${row.season_type}`
      stats.rows_by_season[key] = (stats.rows_by_season[key] || 0) + 1
      rows_to_write.push(row)
    }
  }

  // The invariant the whole derivation exists to hold. It cannot fail given the
  // branches above, which is exactly why it is asserted here rather than
  // trusted: a future branch that breaks it must fail the run rather than write
  // a season type that does not add up.
  const combined_by_player_season = new Map(
    player_seasons.map((row) => [
      `${row.pid}_${row.season_year}`,
      Number(row.combined_routes)
    ])
  )
  const written_by_player_season = new Map()
  for (const row of rows_to_write) {
    const key = `${row.pid}_${row.season_year}`
    written_by_player_season.set(
      key,
      (written_by_player_season.get(key) || 0) + row.routes
    )
  }
  const violations = []
  for (const [key, total] of written_by_player_season) {
    if (total !== combined_by_player_season.get(key)) {
      violations.push({
        key,
        total,
        combined: combined_by_player_season.get(key)
      })
    }
  }

  if (!dry_run && rows_to_write.length) {
    await batch_insert({
      items: rows_to_write,
      save: (batch) =>
        db('pff_player_seasonlogs')
          .insert(batch)
          .onConflict(['pid', 'season_year', 'season_type'])
          .merge(['routes']),
      batch_size: 1000
    })
  }

  return { stats, violations, rows_written: dry_run ? 0 : rows_to_write.length }
}

const main = async () => {
  let exit_code = 0
  try {
    const argv = initialize_cli()
    if (!argv.year && !argv.all) {
      throw new Error('pass --year <years> or --all')
    }
    const years = argv.year
      ? argv.year.split(',').map((value) => Number(value.trim()))
      : null

    const { stats, violations, rows_written } =
      await generate_pff_seasonlog_season_type_rows({
        years,
        dry_run: Boolean(argv['dry-run'])
      })

    // console.log rather than debug: this output IS the oracle, and a debug
    // namespace is a runtime negotiation with the whole ESM import graph.
    console.log(`player_seasons_read: ${stats.player_seasons}`)
    for (const [resolution, count] of Object.entries(
      stats.resolutions
    ).sort()) {
      console.log(`resolution ${resolution}: ${count}`)
    }
    console.log(
      `rows REG: ${stats.rows_by_season_type.REG} POST: ${stats.rows_by_season_type.POST}`
    )
    for (const [key, count] of Object.entries(stats.rows_by_season).sort()) {
      console.log(`season_rows ${key}: ${count}`)
    }
    console.log(`rows_written: ${rows_written}`)

    if (violations.length) {
      exit_code = 1
      console.error(
        `REG + POST does not equal REGPO on ${violations.length} player-seasons`
      )
      for (const violation of violations.slice(0, 10)) {
        console.error(
          `  ${violation.key}: written ${violation.total} against combined ${violation.combined}`
        )
      }
    }

    if (stats.player_seasons === 0) {
      exit_code = 1
      console.error(
        'no player-seasons read -- pff_player_facet_gamelogs, nfl_games or the REGPO routes backfill is missing'
      )
    }
  } catch (error) {
    exit_code = 1
    console.error(error)
  }

  await db.destroy()
  process.exit(exit_code)
}

if (is_main(import.meta.url)) {
  main()
}

export default generate_pff_seasonlog_season_type_rows
