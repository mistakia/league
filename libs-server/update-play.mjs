import diff from 'deep-diff'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import isMain from './is-main.mjs'
import db from '#db'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('update-play')
debug.enable('update-play')

const excluded_props = ['esbid', 'playId', 'updated']

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

  const differences = diff(play_row, update)

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

    const is_null = !edit.rhs
    if (is_null) {
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
    log(`Updating play: ${play_row.esbid}, Field: ${prop}, Value: ${edit.rhs}`)

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

const main = async () => {
  let error
  try {
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

if (isMain(import.meta.url)) {
  main()
}
