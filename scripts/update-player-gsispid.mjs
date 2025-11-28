import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, updatePlayer } from '#libs-server'
// import { job_types } from '#libs-shared/job-.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('update-player-gsispid')
debug.enable('update-player-gsispid,update-player')

const updatePlayerGsispid = async ({ dry = false } = {}) => {
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
    .groupBy(
      'nfl_play_stats.gsispid',
      'player.pid',
      'nfl_play_stats.gsisId',
      'player.gsispid',
      'player.gsisid'
    )

  log(query.toString())

  const play_stats = await query

  const result_join_gsisid = {
    missing_player: [],
    mismatch: [],
    update: [],
    correct: []
  }

  const result_join_gsispid = {
    missing_player: [],
    mismatch: [],
    update: [],
    correct: []
  }

  for (const play_stat of play_stats) {
    if (play_stat.pid) {
      if (play_stat.player_gsispid) {
        if (play_stat.player_gsispid !== play_stat.gsispid) {
          result_join_gsisid.mismatch.push(play_stat)
        } else {
          result_join_gsisid.correct.push(play_stat)
        }
      } else {
        result_join_gsisid.update.push(play_stat)
      }
    } else {
      result_join_gsisid.missing_player.push(play_stat)
    }
  }

  if (!dry && result_join_gsisid.mismatch.length) {
    for (const { pid, gsisId, player_gsispid } of result_join_gsisid.mismatch) {
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

  if (!dry && result_join_gsisid.update.length) {
    for (const { pid, gsisId, player_gsispid } of result_join_gsisid.update) {
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

  if (result_join_gsisid.missing_player.length) {
    const gsisids = result_join_gsisid.missing_player.map((r) => r.gsisId)
    const missing_play_stats = await db('nfl_play_stats')
      .select(
        'player.pid',
        'nfl_play_stats.gsisId',
        'nfl_play_stats.gsispid',
        'player.gsispid as player_gsispid',
        'player.gsisid as player_gsisid'
      )
      .leftJoin('player', 'player.gsispid', 'nfl_play_stats.gsispid')
      .whereNotNull('nfl_play_stats.playerName')
      .whereNotNull('nfl_play_stats.gsispid')
      .whereIn('nfl_play_stats.gsisId', gsisids)
      .groupBy(
        'nfl_play_stats.gsisId',
        'player.pid',
        'nfl_play_stats.gsispid',
        'player.gsispid',
        'player.gsisid'
      )

    for (const play_stat of missing_play_stats) {
      if (play_stat.pid) {
        if (play_stat.player_gsisid) {
          if (play_stat.player_gsisid !== play_stat.gsisId) {
            result_join_gsispid.mismatch.push(play_stat)
          } else {
            result_join_gsispid.correct.push(play_stat)
          }
        } else {
          result_join_gsispid.update.push(play_stat)
        }
      } else {
        result_join_gsispid.missing_player.push(play_stat)
      }
    }

    if (!dry && result_join_gsispid.update.length) {
      for (const {
        pid,
        gsispid,
        player_gsisid
      } of result_join_gsispid.update) {
        const results = await db('nfl_play_stats')
          .count('* as count')
          .select('gsisId')
          .where({ gsispid })
          .groupBy('gsisId')
          .orderBy('count', 'desc')
        const value = results[0].gsisId

        if (value === player_gsisid) {
          // skip, player gsisid matches most common pairing with play_stats, mismatch likely amonst play_stats
          continue
        }

        // clear any duplicates
        await db('player').update({ gsisid: null }).where({ gsisid: value })
        await updatePlayer({ pid, update: { gsisid: value } })
      }
    }
  }

  log(`missing (join gsisid): ${result_join_gsisid.missing_player.length}`)
  log(`mismatch (join gsisid): ${result_join_gsisid.mismatch.length}`)
  log(`updated (join gsisid): ${result_join_gsisid.update.length}`)
  log(`correct (join gsisid): ${result_join_gsisid.correct.length}`)

  log(`missing (join gsispid): ${result_join_gsispid.missing_player.length}`)
  log(`mismatch (join gsispid): ${result_join_gsispid.mismatch.length}`)
  log(`updated (join gsispid): ${result_join_gsispid.update.length}`)
  log(`correct (join gsispid): ${result_join_gsispid.correct.length}`)

  log(`total: ${play_stats.length}`)
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    await updatePlayerGsispid({ dry: argv.dry })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default updatePlayerGsispid
