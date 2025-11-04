import dayjs from 'dayjs'
import { constants } from '#libs-shared'
import db from '#db'
import { is_main, report_job } from '#libs-server'
import debug from 'debug'
import { job_types } from '#libs-shared/job-constants.mjs'

import import_plays_nfl_v1 from '#scripts/import-plays-nfl-v1.mjs'

import process_matchups from '#scripts/process-matchups.mjs'
import process_playoffs from '#scripts/process-playoffs.mjs'
import update_stats_weekly from '#scripts/update-stats-weekly.mjs'
import calculate_league_careerlogs from '#scripts/calculate-league-careerlogs.mjs'
import process_market_results from '#scripts/process-market-results.mjs'

const log = debug('finalize-week')

const clear_live_plays = async () => {
  await db('nfl_plays_current_week').del()
  await db('nfl_play_stats_current_week').del()
}

const finalize_week = async () => {
  const day = dayjs().day()
  const week = Math.max(
    [2, 3].includes(day) ? constants.season.week - 1 : constants.season.week,
    1
  )

  log(`finalizing week ${week}`)

  // finalize plays
  await import_plays_nfl_v1({ week, force_update: true, ignore_cache: true })

  await update_stats_weekly()

  const lid = 1
  await process_matchups({ lid })
  await process_playoffs({ lid, year: constants.season.year })
  await calculate_league_careerlogs({ lid })
  await clear_live_plays()

  // Process market results after stats are updated
  log(`processing market results for week ${week}`)
  await process_market_results({
    year: constants.season.year,
    week,
    missing_only: false
  })
}

const main = async () => {
  debug.enable('finalize-week')
  let error
  try {
    await finalize_week()
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.FINALIZE_WEEK,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default finalize_week
