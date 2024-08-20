import dayjs from 'dayjs'
import { constants } from '#libs-shared'
import db from '#db'
import { isMain } from '#libs-server'
import debug from 'debug'
// import { job_types } from '#libs-shared/job-constants.mjs'

// import import_plays_nfl_v3 from '#scripts/import-plays-nfl-v3.mjs'
import import_plays_nfl_v1 from '#scripts/import-plays-nfl-v1.mjs'
import import_plays_ngs from '#scripts/import-plays-ngs.mjs'
import process_matchups from '#scripts/process-matchups.mjs'
import update_stats_weekly from '#scripts/update-stats-weekly.mjs'

const log = debug('finalize-week')

const clear_live_plays = async () => {
  await db('nfl_plays_current_week').del()
  await db('nfl_snaps_current_week').del()
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
  await import_plays_ngs({ week, force_update: true })
  await import_plays_nfl_v1({ week, force_update: true, ignore_cache: true })
  // await import_plays_nfl_v3({ week, ignore_cache: true, force_update: true })

  await update_stats_weekly()

  const lid = 1
  await process_matchups({ lid })

  await clear_live_plays()
}

const main = async () => {
  let error
  try {
    await finalize_week()
  } catch (err) {
    error = err
    log(error)
  }

  // TODO add job type
  // await db('jobs').insert({
  //   type: job_types.EXAMPLE,
  //   succ: error ? 0 : 1,
  //   reason: error ? error.message : null,
  //   timestamp: Math.round(Date.now() / 1000)
  // })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default finalize_week
