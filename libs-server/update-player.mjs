import diff from 'deep-diff'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { format_nfl_status, format_nfl_injury_status } from '#libs-shared'
import is_main from './is-main.mjs'
import db from '#db'
import record_changelog from './record-changelog.mjs'

const log = debug('update-player')
debug.enable('update-player')

const excluded_props = ['pid', 'formatted_name', 'primary_position']

const protected_props = [
  'nfl_player_id',
  'esb_player_id',
  'gsis_player_id',
  'smart_player_id',
  'gsis_it_player_id',
  'sleeper_player_id',
  'rotoworld_player_id',
  'rotowire_player_id',
  'sportradar_player_id',
  'espn_player_id',
  'fantasy_data_player_id',
  'yahoo_player_id',
  'keeptradecut_player_id',
  'mfl_player_id',
  'cbs_player_id',
  'swish_player_id',
  'rts_player_id',
  'pff_player_id',
  'otc_player_id',
  'fleaflicker_player_id',
  'fanduel_player_id',
  'draftkings_player_id',
  'fantasylabs_player_id',
  'cfbref_player_id',
  'underdog_player_id'
]

const combine_protected_props = ['height_inches', 'weight_pounds']

const nullable_props = ['game_designation']

/*
   player can be a string identifier or player db entry
*/

const updatePlayer = async ({
  player_row,
  pid,
  update,
  allow_protected_props = false,
  source = null
}) => {
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

  if (update.roster_status) {
    formatted_update.roster_status = format_nfl_status(update.roster_status)
  }

  if (update.game_designation) {
    formatted_update.game_designation = format_nfl_injury_status(
      update.game_designation
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
    const is_null = edit.rhs == null
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

    if (protected_props.includes(prop) && !allow_protected_props) {
      const exists = await db('player').where(prop, edit.rhs).limit(1)
      if (exists.length) {
        log(
          `Player (${exists[0].pid}) has existing value (${edit.rhs}) for field (${prop})`
        )
        continue
      }

      // Refuse to silently overwrite the same pid's existing-non-null
      // differing value -- guards against importers hijacking external IDs
      // when a name-fallback match lands on the wrong relative.
      if (
        player_row[prop] != null &&
        String(player_row[prop]) !== String(edit.rhs)
      ) {
        log(
          `SKIP ${prop} overwrite on ${player_row.pid}: existing=${player_row[prop]} incoming=${edit.rhs}. Use allow_protected_props=true to force.`
        )
        continue
      }
    }

    if (
      combine_protected_props.includes(prop) &&
      source !== 'combine' &&
      player_row[prop] !== null &&
      player_row[prop] !== undefined &&
      player_row[prop] !== 0
    ) {
      log(
        `Skipping ${prop} update for player ${player_row.pid}: combine value exists (${player_row[prop]})`
      )
      continue
    }

    changes += 1
    log(
      `Updating player: ${player_row.pid}, Field: ${prop}, Value: ${edit.rhs}`
    )

    const prev = edit.lhs
    if (prev) {
      if (!source) {
        throw new Error(
          `updatePlayer: source is required to record a player_changelog entry (pid ${player_row.pid}, field ${prop})`
        )
      }
      await record_changelog({
        table: 'player_changelog',
        rows: {
          pid: player_row.pid,
          column_name: prop,
          previous_value: prev,
          new_value: edit.rhs,
          source
        }
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

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .option('pid', {
      describe: 'Player ID',
      type: 'string',
      demandOption: true
    })
    .help().argv
}

/**
 * Example CLI usage:
 * node update-player.mjs --pid 1234 --first_name "John" --last_name "Doe" --primary_position "QB"
 *
 * This command will update the player with ID 1234, setting their first name to "John",
 * last name to "Doe", and position to "QB".
 */
const main = async () => {
  let error
  try {
    const argv = initialize_cli()

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

    const changes = await updatePlayer({
      pid: argv.pid,
      update,
      source: 'manual'
    })
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
