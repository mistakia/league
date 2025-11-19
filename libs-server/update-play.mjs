import diff from 'deep-diff'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import is_main from './is-main.mjs'
import db from '#db'
import { normalize_game_clock } from './play-enum-utils.mjs'

const log = debug('update-play')
debug.enable('update-play')

const excluded_props = ['esbid', 'playId', 'updated']

// Fields that contain game clock values and should be normalized
const game_clock_fields = [
  'game_clock_start',
  'game_clock_end',
  'drive_game_clock_start',
  'drive_game_clock_end'
]

/**
 * Normalize game clock fields in both play_row and update objects
 * to ensure consistent comparison (prevent "2:00" vs "02:00" false positives)
 */
const normalize_clock_fields = (obj) => {
  if (!obj) return obj
  const normalized = { ...obj }
  for (const field of game_clock_fields) {
    if (normalized[field]) {
      normalized[field] = normalize_game_clock(normalized[field])
    }
  }
  return normalized
}

const update_play = async ({
  play_row,
  esbid,
  playId,
  update,
  ignore_conflicts = false
}) => {
  if (!play_row && esbid && playId) {
    const play_rows = await db('nfl_plays').where({ esbid, playId })
    play_row = play_rows[0]
  }

  if (!play_row) {
    return 0
  }

  // Normalize game clock fields in both objects before comparison
  const normalized_play_row = normalize_clock_fields(play_row)
  const normalized_update = normalize_clock_fields(update)

  const differences = diff(normalized_play_row, normalized_update)

  if (!differences) {
    return 0
  }

  const edits = differences.filter((d) => d.kind === 'E')
  if (!edits.length) {
    return 0
  }

  let changes = 0
  for (const edit of edits) {
    const prop = edit.path[0]

    const is_null = edit.rhs === null
    if (is_null) {
      continue
    }

    const is_undefined = edit.rhs === undefined
    if (is_undefined) {
      continue
    }

    const is_empty_string = edit.rhs === ''
    if (is_empty_string) {
      continue
    }

    if (excluded_props.includes(prop)) {
      log(`not allowed to update ${prop}`)
      continue
    }

    if (!ignore_conflicts && edit.lhs) {
      log(
        `conflict with existing value for ${prop}, esbid: ${play_row.esbid}, playId: ${play_row.playId}, existing: ${edit.lhs}, new: ${edit.rhs}`
      )
      continue
    }

    changes += 1
    log(
      `Updating play: ${play_row.esbid} - ${play_row.playId}, Field: ${prop}, Value: ${edit.rhs}`
    )

    const prev = edit.lhs
    if (prev) {
      await db('play_changelog')
        .insert({
          esbid: play_row.esbid,
          playId: play_row.playId,
          prop,
          prev,
          new: edit.rhs,
          timestamp: Math.round(Date.now() / 1000)
        })
        .onConflict(['esbid', 'playId', 'prop', 'timestamp'])
        .ignore()
    }

    await db('nfl_plays')
      .update({
        [prop]: edit.rhs
      })
      .where({
        esbid: play_row.esbid,
        playId: play_row.playId
      })
  }

  return changes
}

export default update_play

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .option('esbid', {
      describe: 'Game ID',
      type: 'string',
      demandOption: true
    })
    .option('playId', {
      describe: 'Play ID',
      type: 'string',
      demandOption: true
    })
    .help().argv
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()

    if (!argv.esbid || !argv.playId) {
      log('missing --esbid or --playId')
      process.exit()
    }

    const ignore = ['_', '$0', 'esbid', 'playId']
    const keys = Object.keys(argv).filter((key) => !ignore.includes(key))
    const update = {}
    keys.forEach((key) => {
      update[key] = argv[key]
    })

    const changes = await update_play({
      esbid: argv.esbid,
      playId: argv.playId,
      update
    })
    log(`play ${argv.esbid} updated, changes: ${changes}`)
    process.exit()
  } catch (err) {
    error = err
    log(error)
  }
}

if (is_main(import.meta.url)) {
  main()
}
