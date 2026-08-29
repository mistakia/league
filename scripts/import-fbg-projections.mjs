import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season, external_data_sources } from '#constants'
import {
  is_main,
  find_player_row,
  report_job,
  fetch_with_retry,
  check_projections_index_floor,
  record_projection_history,
  projection_periods
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import:projections')
enable_debug_namespaces('import:projections,get-player,fetch')
const week = current_season.active_fantasy_week

const format_projection = (stats) => ({
  passing_yards: stats.pyd,
  passing_attempts: stats.att,
  passing_completions: stats.cmp,
  passing_touchdowns: stats.ptd,
  passing_interceptions: stats.icp,

  rushing_attempts: stats.rsh,
  rushing_yards: stats.rshyd,
  rushing_touchdowns: stats.rshtd,

  fumbles_lost: stats.fum,

  receptions: stats.rec,
  receiving_yards: stats.recyd,
  receiving_touchdowns: stats.rectd
})

const generated_at = new Date()

const run = async ({ dry_run = false } = {}) => {
  // do not pull in any projections after the season has ended
  if (current_season.week > current_season.nfl_final_week) {
    return { skipped: true }
  }

  if (!current_season.week) {
    log('No projections available for current week')
    return { skipped: true }
  }

  const config_row = await db('config').where({ key: 'fbg_config' }).first()
  const fbg_config = config_row.config_value

  if (!fbg_config) {
    throw new Error('fbg_config not found')
  }

  // fetch players
  const players_url = `${fbg_config.data_url}/NFLPlayers.json`
  log(`fetching players from ${players_url}`)
  const fbg_players = await fetch_with_retry({
    url: players_url,
    use_proxy: true,
    response_type: 'json'
  })

  const projections_url = `${fbg_config.data_url}/WeeklyProjections-${current_season.year}-${current_season.week}.json`
  log(`fetching projections from ${projections_url}`)
  const data = await fetch_with_retry({
    url: projections_url,
    use_proxy: true,
    response_type: 'json'
  })

  // if no projections or 404 exit
  const projectors = {
    2: external_data_sources.FBG_DAVID_DODDS,
    41: external_data_sources.FBG_BOB_HENRY,
    50: external_data_sources.FBG_JASON_WOOD,
    53: external_data_sources.FBG_MAURILE_TREMBLAY,
    107: external_data_sources.FBG_SIGMUND_BLOOM,
    996: external_data_sources.FBG_CONSENSUS
  }

  const missing = []
  const inserts = []
  for (const item of data) {
    if (item.type !== 'off') continue

    const projector = projectors[item.projector]
    if (!projector) continue

    const player_id_index = {}

    for (const fbgId in item.projections) {
      const fbg_player_projection = item.projections[fbgId]

      // ignore players with no projections, empty array
      if (
        Array.isArray(fbg_player_projection) &&
        !fbg_player_projection.length
      ) {
        continue
      }

      const fbg_player = fbg_players.find((p) => p.id === fbgId)
      if (!fbg_player) {
        log(`could not find ${fbgId} in players set`)
        continue
      }

      let player_row

      const params = {
        name: `${fbg_player.first} ${fbg_player.last}`,
        team: fbg_player.team_id,
        pos: fbg_player.pos
      }

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

      const proj = format_projection(fbg_player_projection)

      // ignore if all the values are undefined or null
      if (Object.values(proj).every((v) => v === undefined || v === null)) {
        continue
      }

      if (player_id_index[player_row.pid]) {
        log(`duplicate player: ${player_row.pid}`, {
          ...params,
          ...player_id_index[player_row.pid]
        })
        continue
      }

      player_id_index[player_row.pid] = params

      inserts.push({
        pid: player_row.pid,
        season_year: current_season.year,
        week,
        season_type: 'REG',
        source_id: projector,
        ...proj
      })
    }
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
    await db('projections_index')
      .insert(inserts)
      .onConflict([
        'source_id',
        'pid',
        'user_id',
        'week',
        'season_year',
        'season_type'
      ])
      .merge()
    await record_projection_history({
      inserts,
      period: projection_periods.WEEK,
      generated_at
    })
  }

  return {
    skipped: false,
    season_year: current_season.year,
    week,
    sourceids: Object.values(projectors),
    season_type: 'REG'
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const result = await run({ dry_run: argv.dry })
    if (result && !result.skipped && !argv.dry) {
      await check_projections_index_floor(result)
    }
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.PROJECTIONS_FBG,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
