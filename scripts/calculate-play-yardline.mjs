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
      'yard_line_num',
      'yard_line_side',
      'possession_nfl_team',
      'season_year'
    )
    .whereNull('yard_line_100')
    .whereNotNull('yard_line_num')
  log(`loaded ${plays.length} with missing yard_line_100`)

  const inserts = []
  for (const {
    play_id: playId,
    esbid,
    yard_line_num,
    yard_line_side,
    possession_nfl_team: pos_team,
    season_year: year
  } of plays) {
    let yard_line_100

    if (yard_line_num === 50) {
      yard_line_100 = 50
    } else if (yard_line_side && pos_team) {
      yard_line_100 =
        yard_line_side === pos_team ? 100 - yard_line_num : yard_line_num
    }

    if (yard_line_100) {
      inserts.push({
        season_year: year,
        play_id: playId,
        esbid,
        yard_line_100,
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
