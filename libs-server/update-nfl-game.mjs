import diff from 'deep-diff'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import is_main from './is-main.mjs'
import db from '#db'

const log = debug('update-nfl-game')
debug.enable('update-nfl-game')

const excluded_column_names = ['esbid', 'updated']

const update_nfl_game = async ({
  game_row,
  esbid,
  update,
  overwrite_existing = false
}) => {
  if (!game_row && esbid) {
    game_row = await db('nfl_games').where({ esbid }).first()
  }

  if (!game_row) {
    return 0
  }

  const differences = diff(game_row, update)

  const edits = differences.filter((d) => d.kind === 'E')
  if (!edits.length) {
    return 0
  }

  let changes = 0
  for (const edit of edits) {
    const column_name = edit.path[0]

    if (excluded_column_names.includes(column_name)) {
      log(`not allowed to update ${column_name}`)
      continue
    }

    if (!overwrite_existing && edit.lhs) {
      log(
        `conflict with existing value for ${column_name}, esbid: ${game_row.esbid}, existing: ${edit.lhs}, new: ${edit.rhs}`
      )
      continue
    }

    changes += 1
    log(
      `Updating game: ${game_row.esbid}, Field: ${column_name}, Value: ${edit.rhs}`
    )

    const prev = edit.lhs
    if (prev) {
      await db('nfl_games_changelog').insert({
        esbid: game_row.esbid,
        column_name,
        prev,
        new: edit.rhs,
        timestamp: Math.round(Date.now() / 1000)
      })
    }

    await db('nfl_games')
      .update({
        [column_name]: edit.rhs
      })
      .where({
        esbid: game_row.esbid
      })
  }

  return changes
}

export default update_nfl_game

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .option('esbid', {
      describe: 'Game ID',
      type: 'string',
      demandOption: true
    })
    .help().argv
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()

    if (!argv.esbid) {
      log('missing --esbid')
      process.exit()
    }

    const ignore = ['_', '$0', 'esbid']
    const keys = Object.keys(argv).filter((key) => !ignore.includes(key))
    const update = {}
    keys.forEach((key) => {
      update[key] = argv[key]
    })

    const changes = await update_nfl_game({
      esbid: argv.esbid,
      update
    })
    log(`game ${argv.esbid} updated, changes: ${changes}`)
    process.exit()
  } catch (err) {
    error = err
    log(error)
  }
}

if (is_main(import.meta.url)) {
  main()
}
