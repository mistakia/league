import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
// import { constants } from '#common'
import { isMain, updatePlayer } from '#utils'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('update-player-gsispid')
debug.enable('update-player-gsispid,update-player')

const updatePlayerGsispid = async () => {
  const query = db('nfl_play_stats')
    .select(
      'player.pid',
      'nfl_play_stats.gsisId',
      'nfl_play_stats.gsispid',
      'player.gsispid as player_gsispid',
      'player.gsisid as player_gsisid'
    )
    .leftJoin('player', 'player.gsisid', 'nfl_play_stats.gsisId')
    .whereNotNull('nfl_play_stats.playerName')
    .whereNotNull('nfl_play_stats.gsisId')
    .groupBy('nfl_play_stats.gsispid')

  log(query.toString())

  const play_stats = await query

  const result = {
    missing_player: [],
    mismatch: [],
    update: [],
    correct: []
  }

  for (const play_stat of play_stats) {
    if (play_stat.pid) {
      if (play_stat.player_gsispid) {
        if (play_stat.player_gsispid !== play_stat.gsispid) {
          result.mismatch.push(play_stat)
        } else {
          result.correct.push(play_stat)
        }
      } else {
        result.update.push(play_stat)
      }
    } else {
      result.missing_player.push(play_stat)
    }
  }

  if (result.mismatch.length) {
    for (const { pid, gsisId, player_gsispid } of result.mismatch) {
      const results = await db('nfl_play_stats')
        .count('* as count')
        .select('gsispId')
        .where({ gsisid: gsisId })
        .groupBy('gsispId')
        .orderBy('count', 'desc')
      const value = results[0].gsispId

      if (value === player_gsispid) {
        // skip, player gsispid matches most common pairing with play_stats, mismatch likely amonst play_stats
        continue
      }

      // clear any duplicates
      await db('player').update({ gsispid: null }).where({ gsispid: value })
      await updatePlayer({ pid, update: { gsispid: value } })
    }
  }

  if (result.update.length) {
    for (const { pid, gsispid } of result.update) {
      await updatePlayer({ pid, update: { gsispid } })
    }
  }

  log(`missing: ${result.missing_player.length}`)
  log(`mismatch: ${result.mismatch.length}`)
  log(`updated: ${result.update.length}`)
  log(`correct: ${result.correct.length}`)
  log(`total: ${play_stats.length}`)
}

const main = async () => {
  let error
  try {
    await updatePlayerGsispid()
  } catch (err) {
    error = err
    log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.EXAMPLE,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default updatePlayerGsispid
