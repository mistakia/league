import diff from 'deep-diff'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import isMain from './is-main.mjs'
import db from '#db'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('update-player')
debug.enable('update-player')

const excluded_props = ['pid', 'formatted', 'pos']

const protected_props = [
  'nflid',
  'esbid',
  'gsisid',
  'gsispid',
  'gsisItId',
  'sleeper_id',
  'rotoworld_id',
  'rotowire_id',
  'sportradar_id',
  'espn_id',
  'fantasy_data_id',
  'yahoo_id',
  'keeptradecut_id'
]

const nullable_props = ['injury_status']

/*
   player can be a string identifier or player db entry
*/

const updatePlayer = async ({ player_row, pid, update }) => {
  if (!player_row && (typeof pid === 'string' || pid instanceof String)) {
    const player_rows = await db('player').where({ pid })
    player_row = player_rows[0]
  }

  if (!player_row) {
    return 0
  }

  const differences = diff(player_row, update)

  const edits = differences.filter((d) => d.kind === 'E')
  if (!edits.length) {
    return 0
  }

  let changes = 0
  for (const edit of edits) {
    const prop = edit.path[0]
    const isNull = !edit.rhs
    const isNullable = nullable_props.includes(prop)

    if (isNull && !isNullable) {
      continue
    }

    if (excluded_props.includes(prop)) {
      log(`not allowed to update ${prop}`)
      continue
    }

    if (protected_props.includes(prop)) {
      const exists = await db('player').where(prop, edit.rhs).limit(1)
      if (exists.length) {
        log(
          `Player (${exists[0].pid}) has existing value (${edit.rhs}) for field (${prop})`
        )
        continue
      }
    }

    changes += 1
    log(
      `Updating player: ${player_row.pid}, Field: ${prop}, Value: ${edit.rhs}`
    )

    const prev = edit.lhs
    if (prev) {
      await db('player_changelog')
        .insert({
          pid: player_row.pid,
          prop,
          prev,
          new: edit.rhs,
          timestamp: Math.round(Date.now() / 1000)
        })
        .onConflict()
        .ignore()
    }

    await db('player')
      .update({
        [prop]: edit.rhs
      })
      .where({
        pid: player_row.pid
      })
  }

  return changes
}

export default updatePlayer

const main = async () => {
  let error
  try {
    if (!argv.pid) {
      log('missing --pid')
      process.exit()
    }

    const ignore = ['_', '$0', 'pid']
    const keys = Object.keys(argv).filter((key) => !ignore.includes(key))
    const update = {}
    keys.forEach((key) => {
      update[key] = argv[key]
    })

    const changes = await updatePlayer({ pid: argv.pid, update })
    log(`player ${argv.pid} updated, changes: ${changes}`)
    process.exit()
  } catch (err) {
    error = err
    log(error)
  }
}

if (isMain(import.meta.url)) {
  main()
}
