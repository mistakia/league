import debug from 'debug'

import db from '#db'
import { isMain } from '#libs-server'

const log = debug('calculate-play-yardline')
debug.enable('calculate-play-yardline')

const calculate_play_yardline = async () => {
  const timestamp = Math.round(new Date() / 1000)
  const plays = await db('nfl_plays')
    .select('playId', 'esbid', 'ydl_num', 'ydl_side', 'pos_team', 'year')
    .whereNull('ydl_100')
    .whereNotNull('ydl_num')
  log(`loaded ${plays.length} with missing ydl_100`)

  const inserts = []
  for (const { playId, esbid, ydl_num, ydl_side, pos_team, year } of plays) {
    let ydl_100

    if (ydl_num === 50) {
      ydl_100 = 50
    } else if (ydl_side && pos_team) {
      ydl_100 = ydl_side === pos_team ? 100 - ydl_num : ydl_num
    }

    if (ydl_100) {
      inserts.push({
        year,
        playId,
        esbid,
        ydl_100,
        updated: timestamp
      })
    }
  }

  if (inserts.length) {
    await db('nfl_plays').insert(inserts).onConflict().merge()
    log(`Updated ${inserts.length} play yardlines`)
  }
}

const main = async () => {
  let error
  try {
    await calculate_play_yardline()
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default calculate_play_yardline
