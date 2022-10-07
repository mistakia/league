import debug from 'debug'
import cron from 'node-cron'

import { wait } from '#utils'
import db from '#db'
import import_plays_nfl from './scripts/import-plays-nfl.mjs'
import import_plays_ngs from './scripts/import-plays-ngs.mjs'

const log = debug('worker')
debug.enable('worker,import-plays-nfl,import-plays-ngs')

let is_running = false

const clear_live_plays = async () => {
  await db('nfl_plays_current_week').del()
  await db('nfl_snaps_current_week').del()
  await db('nfl_play_stats_current_week').del()
}

const import_live_plays = async () => {
  if (is_running) {
    log('job already running')
    return
  }
  is_running = true
  log('started new job')

  let all_games_skipped = false
  let loop_count = 0
  while (!all_games_skipped) {
    const throttle_timer = wait(30000)

    loop_count += 1
    log(`running import count: ${loop_count}`)
    try {
      const all_games_skipped_nfl = await import_plays_nfl({
        bypass_cache: true
      })

      const all_games_skipped_ngs = await import_plays_ngs()

      all_games_skipped = all_games_skipped_nfl && all_games_skipped_ngs
    } catch (error) {
      log(error)
    }

    await throttle_timer
    // make sure its been 30 seconds
  }

  is_running = false
  log('job exiting')
}

// monday
cron.schedule('*/1 20-23 * 1,2,9-12 1', import_live_plays)

// wednesday
cron.schedule('0 0 * 1,2,9-12 3', clear_live_plays)

// thursday
cron.schedule('*/1 20-23 * 1,2,9-12 4', import_live_plays)

// sunday
cron.schedule('*/1 9-23 * 1,2,9-12 7', import_live_plays)
