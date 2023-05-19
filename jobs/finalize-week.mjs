import dayjs from 'dayjs'
import { constants } from '#common'
import db from '#db'

import import_plays_nfl from '#scripts/import-plays-nfl.mjs'
import import_plays_ngs from '#scripts/import-plays-ngs.mjs'
import process_matchups from '#scripts/process-matchups.mjs'
import update_stats_weekly from '#scripts/update-stats-weekly.mjs'

const clear_live_plays = async () => {
  await db('nfl_plays_current_week').del()
  await db('nfl_snaps_current_week').del()
  await db('nfl_play_stats_current_week').del()
}

export default async function () {
  const day = dayjs().day()
  const week = Math.max(
    [2, 3].includes(day) ? constants.season.week - 1 : constants.season.week,
    1
  )

  // finalize plays
  await import_plays_ngs({ week, force_update: true })
  await import_plays_nfl({ week, ignore_cache: true, force_update: true })

  await update_stats_weekly()

  const lid = 1
  await process_matchups({ lid })

  await clear_live_plays()
}
