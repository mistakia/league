import diff from 'deep-diff'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { format_nfl_status, format_nfl_injury_status } from '#libs-shared'
import is_main from './is-main.mjs'
import db from '#db'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('update-player')
debug.enable('update-player')

const excluded_props = ['pid', 'formatted', 'pos']

const protected_props = [
  'nfl_id',
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
  'keeptradecut_id',
  'mfl_id',
  'cbs_id',
  'swish_id',
  'rts_id',
  'pff_id',
  'otc_id',
  'fleaflicker_id',
  'fanduel_id',
  'draftkings_id',
  'cfbref_id'
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

  if (!player_row.pid) {
    throw new Error('Player row is missing pid')
  }

  const formatted_update = {
    ...update
  }

  if (update.nfl_status) {
    formatted_update.nfl_status = format_nfl_status(update.nfl_status)
  }

  if (update.injury_status) {
    formatted_update.injury_status = format_nfl_injury_status(
      update.injury_status
    )
  }

  const differences = diff(player_row, formatted_update)

  const edits = differences.filter((d) => d.kind === 'E')
  if (!edits.length) {
    return 0
  }

  let changes = 0
  for (const edit of edits) {
    const prop = edit.path[0]
    const is_null = !edit.rhs
    const is_nullable = nullable_props.includes(prop)

    if (is_null && !is_nullable) {
      continue
    }

    // ignore empty dates
    if (edit.rhs === '0000-00-00') {
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
      await db('player_changelog').insert({
        pid: player_row.pid,
        prop,
        prev,
        new: edit.rhs,
        timestamp: Math.round(Date.now() / 1000)
      })
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

/**
 * Example CLI usage:
 * node update-player.mjs --pid 1234 --fname "John" --lname "Doe" --pos "QB"
 *
 * This command will update the player with ID 1234, setting their first name to "John",
 * last name to "Doe", and position to "QB".
 */
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

if (is_main(import.meta.url)) {
  main()
}
