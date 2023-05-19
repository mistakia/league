import debug from 'debug'

import { constants } from '#common'
import { wait } from '#utils'
import import_plays_nfl from '#scripts/import-plays-nfl.mjs'
import import_plays_ngs from '#scripts/import-plays-ngs.mjs'
import update_stats_weekly from '#scripts/update-stats-weekly.mjs'

const log = debug('import-live-plays')

let live_plays_job_is_running = false

export default async function () {
  if (constants.season.week > constants.season.nflFinalWeek) {
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
    const throttle_timer = wait(30000)

    loop_count += 1
    log(`running import count: ${loop_count}`)
    try {
      const all_games_skipped_nfl = await import_plays_nfl({
        ignore_cache: true
      })

      const all_games_skipped_ngs = await import_plays_ngs()

      all_games_skipped = all_games_skipped_nfl && all_games_skipped_ngs
    } catch (error) {
      log(error)
    }

    // make sure its been 30 seconds
    await throttle_timer
  }

  await update_stats_weekly()

  live_plays_job_is_running = false
  log('job exiting')
}
