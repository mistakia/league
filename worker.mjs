import debug from 'debug'
import cron from 'node-cron'
import dayjs from 'dayjs'

import { constants } from '#common'
import { wait } from '#utils'
import db from '#db'
import import_plays_nfl from './scripts/import-plays-nfl.mjs'
import import_plays_ngs from './scripts/import-plays-ngs.mjs'
import process_play_stats from './scripts/process-play-stats.mjs'
import generate_league_player from './scripts/generate-league-player.mjs'
import generate_league_player_gamelogs from './scripts/generate-league-player-gamelogs.mjs'
import generate_league_player_regular_seasonlogs from './scripts/generate-league-player-regular-seasonlogs.mjs'
import process_matchups from './scripts/process-matchups.mjs'

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

    // make sure its been 30 seconds
    await throttle_timer
  }

  is_running = false
  log('job exiting')
}

const update_stats = async ({ week }) => {
  const lid = 1

  // process play stats / generate player_gamelogs
  await process_play_stats({ week })

  await generate_league_player_gamelogs({ week, lid })
  await generate_league_player_regular_seasonlogs({ lid })

  // TODO generate player_seasonlogs

  await generate_league_player({ lid })
}

const finalize_week = async () => {
  const day = dayjs().day()
  const week = Math.max(
    [2, 3].includes(day) ? constants.season.week - 1 : constants.season.week,
    1
  )

  // finalize plays
  await import_plays_ngs({ week, force_update: true })
  await import_plays_nfl({ week, bypass_cache: true, force_update: true })

  await update_stats({ week })

  const lid = 1
  await process_matchups({ lid })

  await clear_live_plays()
}

// monday
cron.schedule('*/1 20-23 * 1,2,9-12 1', import_live_plays)

// tuesday
cron.schedule('0 0 * 1,2,9-12 2', finalize_week)

// wednesday
cron.schedule('0 0 * 1,2,9-12 3', finalize_week)

// thursday
cron.schedule('*/1 20-23 * 1,2,9-12 4', import_live_plays)

// sunday
cron.schedule('*/1 9-23 * 1,2,9-12 7', import_live_plays)
