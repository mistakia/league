import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import {
  find_player_row,
  is_main,
  report_job,
  four_for_four,
  check_projections_index_floor
} from '#libs-server'
import { current_season, external_data_sources } from '#constants'
import db from '#db'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('import:projections')
debug.enable('import:projections,get-player,4for4')

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
  const week = is_regular_season_projection ? 0 : current_season.nfl_seas_week
  const seas_type =
    week === 0
      ? 'REG'
      : current_season.nfl_seas_type === 'POST'
        ? 'POST'
        : 'REG'

  const data = await four_for_four.get_4for4_projections({
    year,
    week,
    seas_type,
    is_regular_season_projection,
    ignore_cache: true
  })

  const inserts = []
  const missing = []

  const first_item = data[0]

  // Weekly projections include a Week column; season-long projections (week 0)
  // legitimately do not, and item.Week is unused for season inserts. Only
  // enforce the guard for weekly imports -- otherwise --season always throws
  // 'No Week column found in data' on valid season CSV (regression from 594f7824
  // which turned this log-and-continue check into a throw).
  if (!is_regular_season_projection && !first_item?.Week) {
    throw new Error('No Week column found in data')
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
    inserts.push({
      pid: player_row.pid,
      season_year: year,
      week,
      season_type: seas_type,
      sourceid: external_data_sources['4FOR4'],
      ...proj
    })
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
    // remove any existing projections in index not included in this set
    await db('projections_index')
      .where({
        season_year: year,
        week,
        sourceid: external_data_sources['4FOR4'],
        season_type: seas_type
      })
      .whereNotIn(
        'pid',
        inserts.map((i) => i.pid)
      )
      .del()

    log(
      `Inserting ${inserts.length} projections for week ${week} into database`
    )
    await db('projections_index')
      .insert(inserts)
      .onConflict([
        'sourceid',
        'pid',
        'userid',
        'week',
        'season_year',
        'season_type'
      ])
      .merge()
    await db('projections').insert(inserts.map((i) => ({ ...i, generated_at })))
  }

  return {
    skipped: false,
    year,
    week,
    sourceid: external_data_sources['4FOR4'],
    seas_type
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
      await check_projections_index_floor(result)
    }
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.PROJECTIONS_4FOR4,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
