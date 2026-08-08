import debug from 'debug'

import db from '#db'
import { is_main } from '#libs-server'

const log = debug('calculate-play-yardline')
debug.enable('calculate-play-yardline')

const calculate_play_yardline = async () => {
  const timestamp = new Date()
  const plays = await db('nfl_plays')
    .select(
      'play_id',
      'esbid',
      'ydl_num',
      'ydl_side',
      'possession_nfl_team',
      'season_year'
    )
    .whereNull('ydl_100')
    .whereNotNull('ydl_num')
  log(`loaded ${plays.length} with missing ydl_100`)

  const inserts = []
  for (const {
    play_id: playId,
    esbid,
    ydl_num,
    ydl_side,
    possession_nfl_team: pos_team,
    season_year: year
  } of plays) {
    let ydl_100

    if (ydl_num === 50) {
      ydl_100 = 50
    } else if (ydl_side && pos_team) {
      ydl_100 = ydl_side === pos_team ? 100 - ydl_num : ydl_num
    }

    if (ydl_100) {
      inserts.push({
        season_year: year,
        play_id: playId,
        esbid,
        ydl_100,
        updated: timestamp
      })
    }
  }

  if (inserts.length) {
    await db('nfl_plays')
      .insert(inserts)
      .onConflict(['esbid', 'play_id'])
      .merge()
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

if (is_main(import.meta.url)) {
  main()
}

export default calculate_play_yardline
