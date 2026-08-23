import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, updatePlayer } from '#libs-server'
import { decode_smart_player_id } from '#libs-server/resolve-play-stat-player.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'
// import { job_types } from '#libs-shared/job-.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('update-player-gsispid')
enable_debug_namespaces('update-player-gsispid,update-player')

/**
 * Refuse a `smart_player_id` that encodes a DIFFERENT player's gsis id.
 *
 * `smart_player_id` is not an independent identifier -- it is a UUID template
 * with a `gsis_player_id` hex-embedded in it, and 10,483 of the 10,897 player
 * rows carrying one encode that row's own gsis id. So a value decoding to
 * someone else's gsis id is corrupt by construction, and writing it hands this
 * player another player's identity.
 *
 * This script assigns by majority vote over `nfl_play_stats`, and it clears the
 * value off whatever player currently holds it before assigning -- so without
 * this guard one bad majority moves an identity between two player rows. It is
 * not what originally produced the 36 corrupt rows repaired in
 * `db/adhoc/2026-08-04-clear-stolen-smart-player-id-encodings.sql` (24 of them
 * have no play-stat evidence to vote from at all), but it WOULD have rewritten
 * 10 of them on its next run, which is enough to make the repair temporary.
 */
const encodes_foreign_identity = ({ value, gsis_player_id }) => {
  const decoded = decode_smart_player_id(value)
  return Boolean(decoded) && decoded !== gsis_player_id
}

const updatePlayerGsispid = async ({ dry = false } = {}) => {
  const query = db('nfl_play_stats')
    .select(
      'player.pid',
      'nfl_play_stats.gsis_player_id',
      'nfl_play_stats.smart_player_id',
      'player.smart_player_id as player_gsispid',
      'player.gsis_player_id as player_gsisid'
    )
    .leftJoin(
      'player',
      'player.gsis_player_id',
      'nfl_play_stats.gsis_player_id'
    )
    .whereNotNull('nfl_play_stats.player_name')
    .whereNotNull('nfl_play_stats.gsis_player_id')
    .groupBy(
      'nfl_play_stats.smart_player_id',
      'player.pid',
      'nfl_play_stats.gsis_player_id',
      'player.smart_player_id',
      'player.gsis_player_id'
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
        if (play_stat.player_gsispid !== play_stat.smart_player_id) {
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
    for (const {
      pid,
      gsis_player_id,
      player_gsispid
    } of result_join_gsisid.mismatch) {
      const results = await db('nfl_play_stats')
        .count('* as count')
        .select('smart_player_id')
        .where({ gsis_player_id })
        .groupBy('smart_player_id')
        .orderBy('count', 'desc')
      const value = results[0].smart_player_id

      if (value === player_gsispid) {
        // skip, player gsispid matches most common pairing with play_stats, mismatch likely amonst play_stats
        continue
      }

      if (encodes_foreign_identity({ value, gsis_player_id })) {
        log(
          `refusing smart_player_id for ${pid}: ${value} encodes ${decode_smart_player_id(value)}, not ${gsis_player_id}`
        )
        continue
      }

      // clear any duplicates
      await db('player')
        .update({ smart_player_id: null })
        .where({ smart_player_id: value })
      await updatePlayer({
        pid,
        update: { smart_player_id: value },
        source: 'nflverse'
      })
    }
  }

  if (!dry && result_join_gsisid.update.length) {
    for (const {
      pid,
      gsis_player_id,
      player_gsispid
    } of result_join_gsisid.update) {
      const results = await db('nfl_play_stats')
        .count('* as count')
        .select('smart_player_id')
        .where({ gsis_player_id })
        .groupBy('smart_player_id')
        .orderBy('count', 'desc')
      const value = results[0].smart_player_id

      if (value === player_gsispid) {
        // skip, player gsispid matches most common pairing with play_stats, mismatch likely amonst play_stats
        continue
      }

      if (encodes_foreign_identity({ value, gsis_player_id })) {
        log(
          `refusing smart_player_id for ${pid}: ${value} encodes ${decode_smart_player_id(value)}, not ${gsis_player_id}`
        )
        continue
      }

      // clear any duplicates
      await db('player')
        .update({ smart_player_id: null })
        .where({ smart_player_id: value })
      await updatePlayer({
        pid,
        update: { smart_player_id: value },
        source: 'nflverse'
      })
    }
  }

  if (result_join_gsisid.missing_player.length) {
    const gsisids = result_join_gsisid.missing_player.map(
      (r) => r.gsis_player_id
    )
    const missing_play_stats = await db('nfl_play_stats')
      .select(
        'player.pid',
        'nfl_play_stats.gsis_player_id',
        'nfl_play_stats.smart_player_id',
        'player.smart_player_id as player_gsispid',
        'player.gsis_player_id as player_gsisid'
      )
      .leftJoin(
        'player',
        'player.smart_player_id',
        'nfl_play_stats.smart_player_id'
      )
      .whereNotNull('nfl_play_stats.player_name')
      .whereNotNull('nfl_play_stats.smart_player_id')
      .whereIn('nfl_play_stats.gsis_player_id', gsisids)
      .groupBy(
        'nfl_play_stats.gsis_player_id',
        'player.pid',
        'nfl_play_stats.smart_player_id',
        'player.smart_player_id',
        'player.gsis_player_id'
      )

    for (const play_stat of missing_play_stats) {
      if (play_stat.pid) {
        if (play_stat.player_gsisid) {
          if (play_stat.player_gsisid !== play_stat.gsis_player_id) {
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
        smart_player_id,
        player_gsisid
      } of result_join_gsispid.update) {
        const results = await db('nfl_play_stats')
          .count('* as count')
          .select('gsis_player_id')
          .where({ smart_player_id })
          .groupBy('gsis_player_id')
          .orderBy('count', 'desc')
        const value = results[0].gsis_player_id

        if (value === player_gsisid) {
          // skip, player gsisid matches most common pairing with play_stats, mismatch likely amonst play_stats
          continue
        }

        // clear any duplicates
        await db('player')
          .update({ gsis_player_id: null })
          .where({ gsis_player_id: value })
        await updatePlayer({
          pid,
          update: { gsis_player_id: value },
          source: 'nflverse'
        })
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
