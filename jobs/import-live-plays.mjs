import debug from 'debug'

import { constants } from '#libs-shared'
import { wait } from '#libs-server'
// import import_plays_nfl_v3 from '#scripts/import-plays-nfl-v3.mjs'
import import_plays_nfl_v1 from '#scripts/import-plays-nfl-v1.mjs'
// import import_plays_ngs from '#scripts/import-plays-ngs.mjs'
import update_stats_weekly from '#scripts/update-stats-weekly.mjs'

const log = debug('import-live-plays')

let live_plays_job_is_running = false

export default async function () {
  if (constants.season.nfl_seas_type !== 'REG') {
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
      // TODO not working currently for 2023
      // const all_games_skipped_nfl_v3 = await import_plays_nfl_v3({
      //   ignore_cache: true
      // })

      const all_games_skipped_vfl_v1 = await import_plays_nfl_v1({
        ignore_cache: true
      })

      // const all_games_skipped_ngs = await import_plays_ngs()

      all_games_skipped =
        /* all_games_skipped_nfl_v3 && all_games_skipped_ngs && */
        all_games_skipped_vfl_v1
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
