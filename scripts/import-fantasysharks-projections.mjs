import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { current_season, external_data_sources } from '#constants'
import {
  is_main,
  find_player_row,
  report_job,
  fetch_with_retry,
  check_projections_index_floor,
  check_season_projections_floor,
  save_projections,
  projection_periods
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import:projections')
enable_debug_namespaces('import:projections,get-player,fetch')

const run = async ({ season = false, dry = false } = {}) => {
  const URL = season
    ? 'https://www.fantasysharks.com/apps/Projections/SeasonProjections.php?pos=ALL&format=json&l=2'
    : 'https://www.fantasysharks.com/apps/Projections/WeeklyProjections.php?pos=ALL&format=json'
  const period = season ? projection_periods.SEASON : projection_periods.WEEK
  const week = current_season.active_fantasy_week
  const year = current_season.year
  const generated_at = new Date()
  // do not pull in any projections after the season has ended
  if (current_season.week > current_season.nfl_final_week) {
    return { skipped: true }
  }

  log(URL)
  const data = await fetch_with_retry({
    url: URL,
    use_proxy: true,
    response_type: 'json'
  })
  const missing = []

  const createEntry = (item) => ({
    // passing
    passing_interceptions: item.Int,
    passing_touchdowns: item.PassTD,
    passing_yards: item.PassYards,
    passing_completions: item.Comp,

    // rushing
    rushing_attempts: item.Att,
    rushing_yards: item.RushYards,
    rushing_touchdowns: item.RushTD,
    fumbles_lost: item.Fum,

    // receiving
    receptions: item.Rec,
    receiving_yards: item.RecYards,
    receiving_touchdowns: item.RecTD
  })

  const inserts = []

  for (const item of data) {
    const { Team, Pos, Name } = item
    const n = Name.split(',')
    const fname = n.pop().trim()
    const lname = n.shift().trim()
    const fullname = `${fname} ${lname}`
    let player_row
    const params = { name: fullname, team: Team, pos: Pos }
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

    const entry = createEntry(item)
    inserts.push({ pid: player_row.pid, ...entry })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`)
  )

  if (dry) {
    log(inserts[0])
    return
  }

  if (inserts.length) {
    // remove any existing projections in index not included in this set
    await save_projections({
      period,
      inserts,
      source_id: external_data_sources.FANTASY_SHARKS,
      season_year: year,
      week,
      generated_at
    })
  }

  return {
    skipped: false,
    season_year: year,
    week,
    source_id: external_data_sources.FANTASY_SHARKS,
    season_type: 'REG'
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const result = await run({ season: argv.season, dry: argv.dry })
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
    job_type: job_types.PROJECTIONS_FANTASYSHARKS,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default run
