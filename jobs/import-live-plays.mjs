import debug from 'debug'

import { current_season } from '#constants'
import { wait } from '#libs-server'
import import_plays_nfl_v1 from '#scripts/import-plays-nfl-v1.mjs'

import update_stats_weekly from '#scripts/update-stats-weekly.mjs'

const log = debug('import-live-plays')

let live_plays_job_is_running = false

export default async function () {
  if (current_season.nfl_seas_type !== 'REG') {
    return
  }

  if (live_plays_job_is_running) {
    log('job already running')
    return
  }
  live_plays_job_is_running = true
  log('started new job')

  let all_games_skipped = false
  let loop_count = 0
  while (!all_games_skipped) {
    const throttle_timer = wait(60000)

    loop_count += 1
    log(`running import count: ${loop_count}`)
    try {
      all_games_skipped = await import_plays_nfl_v1({
        ignore_cache: true
      })
    } catch (error) {
      log(error)
    }

    // make sure its been 60 seconds
    await throttle_timer
  }

  await update_stats_weekly()

  live_plays_job_is_running = false
  log('job exiting')
}
