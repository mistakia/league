import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import {
  find_player_row,
  is_main,
  report_job,
  four_for_four,
  check_projections_index_floor,
  check_season_projections_floor,
  save_projections,
  projection_periods
} from '#libs-server'
import { current_season, external_data_sources } from '#constants'
import { job_types } from '#libs-shared/job-constants.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('import:projections')
enable_debug_namespaces('import:projections,get-player,4for4')

const generated_at = new Date()

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const get_projection = (stats) => ({
  passing_yards: Number(stats['Pass Yds']) || null,
  passing_attempts: Number(stats['Pass Att']) || null,
  passing_completions: stats.Comp
    ? Number(stats.Comp)
    : Number(stats['Pass Comp']) || null,
  passing_touchdowns: Number(stats['Pass TD']) || null,
  passing_interceptions: Number(stats.INT) || null,

  rushing_attempts: Number(stats['Rush Att']) || null,
  rushing_yards: Number(stats['Rush Yds']) || null,
  rushing_touchdowns: Number(stats['Rush TD']) || null,

  fumbles_lost: Number(stats.Fum) || null,

  receptions: Number(stats.Rec) || null,
  receiving_yards: Number(stats['Rec Yds']) || null,
  receiving_touchdowns: Number(stats['Rec TD']) || null,

  field_goals_made: Number(stats.FG) || null,
  extra_points_made: Number(stats.XP) || null
})

const run = async ({
  is_regular_season_projection = false,
  dry_run = false
}) => {
  // do not pull in any projections after the season has ended
  if (current_season.now.isAfter(current_season.end)) {
    log('Season has ended, skipping')
    return { skipped: true }
  }

  const year = current_season.year
  const period = is_regular_season_projection
    ? projection_periods.SEASON
    : projection_periods.WEEK
  // A season-long projection is REG by construction -- the season table has no
  // season_type column to hold anything else.
  const seas_type =
    is_regular_season_projection || current_season.nfl_seas_type !== 'POST'
      ? 'REG'
      : 'POST'
  // In POST, 4for4 numbers the playoff rounds and nfl_seas_week is the counter
  // that matches -- it is what the POST rows already in projections_index hold.
  // Everywhere else the question is which fantasy week is next up, and
  // nfl_seas_week answers it wrong in PRESEASON: it names the week AFTER the one
  // being played, so the 2026-09-02 run labelled its rows week 3 while every
  // other source wrote week 1. During the regular season the two agree, which is
  // why the historical rows look clean and only a preseason run exposes it.
  const week =
    seas_type === 'POST'
      ? current_season.nfl_seas_week
      : current_season.active_fantasy_week

  const data = await four_for_four.get_4for4_projections({
    season_year: year,
    week,
    season_type: seas_type,
    is_regular_season_projection,
    ignore_cache: true
  })

  const inserts = []
  const missing = []

  const first_item = data[0]

  // Weekly projections include a Week column; season-long projections
  // legitimately do not, and item.Week is unused for season inserts. Only
  // enforce the guard for weekly imports -- otherwise --season always throws
  // 'No Week column found in data' on valid season CSV (regression from 594f7824
  // which turned this log-and-continue check into a throw).
  if (!is_regular_season_projection && !first_item?.Week) {
    throw new Error('No Week column found in data')
  }

  // The weekly endpoint is a SINGLE url out of config -- `week` never reaches
  // it, it only labels the write -- so 4for4 answers with whatever board it
  // currently publishes and this script cannot tell that it is not ours unless
  // it reads the coordinate the rows carry. On 2026-09-02 that board was still
  // the prior postseason's (Season 2026, Week 22, 21 rows, empty Opp) and the
  // locally-derived week wrote it into the new season under a week nobody asked
  // for. Deriving the week correctly makes that WORSE, not better: it would have
  // landed a stale Super Bowl board on week 1.
  //
  // The feed's Week is continuous across the season -- 22 is a playoff round,
  // not a fantasy week -- so during REG it equals the fantasy week directly. The
  // POST mapping is not asserted here because nothing in hand pins it.
  if (!is_regular_season_projection && seas_type === 'REG') {
    const feed_year = Number(first_item.Season)
    const feed_week = Number(first_item.Week)
    if (feed_year !== year || feed_week !== week) {
      // Not a failure: 4for4 has not published our week yet. Writing this board
      // under our coordinate would be worse than importing nothing.
      console.log(
        `4for4 is publishing season ${feed_year} week ${feed_week}; this run wants season ${year} week ${week}. Nothing to import, skipping`
      )
      return { skipped: true, unpublished: true }
    }
  }

  for (const item of data) {
    const params = {
      name: item.Player,
      team: item.Team,
      pos: item.Pos
    }

    let player_row
    try {
      player_row = await find_player_row(params)
      if (!player_row) {
        missing.push(params)
        continue
      }
    } catch (err) {
      console.log(err)
      missing.push(params)
      continue
    }

    const proj = get_projection(item)
    inserts.push({ pid: player_row.pid, ...proj })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`)
  )

  if (dry_run) {
    log(`${inserts.length} projections`)
    log(inserts[0])
    return
  }

  if (inserts.length) {
    log(`Inserting ${inserts.length} projections into database`)
    await save_projections({
      period,
      inserts,
      source_id: external_data_sources['4FOR4'],
      season_year: year,
      week,
      season_type: seas_type,
      generated_at
    })
  }

  return {
    skipped: false,
    season_year: year,
    week,
    source_id: external_data_sources['4FOR4'],
    season_type: seas_type
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const result = await run({
      is_regular_season_projection: argv.season,
      dry_run: argv.dry
    })
    if (result && !result.skipped && !argv.dry) {
      await (argv.season
        ? check_season_projections_floor(result)
        : check_projections_index_floor(result))
    }
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.PROJECTIONS_4FOR4,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default run
