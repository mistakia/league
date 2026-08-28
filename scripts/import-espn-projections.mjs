import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season, external_data_sources } from '#constants'
import {
  is_main,
  find_player_row,
  report_job,
  espn,
  fetch_with_retry,
  check_projections_index_floor,
  record_projection_history
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import:projections')
enable_debug_namespaces('import:projections,get-player,fetch')

const generated_at = new Date()

const run = async ({
  week,
  season_totals = false,
  year = current_season.year,
  dry_run = false
}) => {
  // do not pull in any projections after the season has ended
  if (current_season.week > current_season.nfl_final_week) {
    return { skipped: true }
  }

  const URL =
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leaguedefaults/3?view=kona_player_info` +
    (season_totals ? '&seasonTotals=true' : '')
  log(URL)

  const headers = {
    'x-fantasy-filter': season_totals
      ? `{"players":{"filterStatsForExternalIds":{"value":[${year}]},"filterSlotIds":{"value":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,23,24]},"filterStatsForSourceIds":{"value":[1]},"useFullProjectionTable":{"value":true},"sortAppliedStatTotal":{"sortAsc":false,"sortPriority":2,"value":"10${year}"},"sortDraftRanks":{"sortPriority":3,"sortAsc":true,"value":"PPR"},"sortPercOwned":{"sortPriority":4,"sortAsc":false},"limit":900,"filterRanksForSlotIds":{"value":[0,2,4,6,17,16]},"filterStatsForTopScoringPeriodIds":{"value":2,"additionalValue":["00${year}","10${year}","02${year}"]}}}`
      : '{"players":{}}'
  }
  log(headers)

  const data = await fetch_with_retry({
    url: URL,
    headers,
    use_proxy: true,
    response_type: 'json'
  })
  const inserts = []
  const missing = []
  for (const item of data.players) {
    const name = item.player.fullName
    const team = espn.teamId[item.player.proTeamId]
    const pos = espn.positionId[item.player.defaultPositionId]
    const params = {
      name,
      teams: [team],
      pos,
      ignore_retired: year === current_season.year
    }
    let player_row

    // TODO cleanup
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

    // Skip players without stats data from ESPN
    if (!item.player.stats || !Array.isArray(item.player.stats)) {
      log(`Skipping ${name} - no stats data available from ESPN`)
      continue
    }

    const projections = item.player.stats.find(
      (s) =>
        s.scoringPeriodId === week &&
        s.seasonId === year &&
        (season_totals || s.statSplitTypeId === 1)
    )
    if (!projections) continue
    const data = espn.stats(projections.stats)

    inserts.push({
      pid: player_row.pid,
      season_year: year,
      week,
      season_type: 'REG',
      source_id: external_data_sources.ESPN,
      ...data
    })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.teams.join(', ')}`)
  )

  if (dry_run) {
    log(inserts[0])
    return
  }

  if (inserts.length) {
    // remove any existing projections in index not included in this set
    await db('projections_index')
      .where({
        season_year: year,
        week,
        source_id: external_data_sources.ESPN,
        season_type: 'REG'
      })
      .whereNotIn(
        'pid',
        inserts.map((i) => i.pid)
      )
      .del()

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
    await record_projection_history({ inserts, generated_at })
  }

  return {
    skipped: false,
    season_year: year,
    week,
    source_id: external_data_sources.ESPN,
    season_type: 'REG'
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const week = argv.season ? 0 : current_season.active_fantasy_week
    const result = await run({
      week,
      season_totals: argv.season,
      year: argv.year,
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
    job_type: job_types.PROJECTIONS_ESPN,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
