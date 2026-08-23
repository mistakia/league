import diff from 'deep-diff'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { format_nfl_status, format_nfl_injury_status } from '#libs-shared'
import { normalize_position } from '#libs-shared/constants/position-constants.mjs'
import is_main from './is-main.mjs'
import db from '#db'
import record_changelog from './record-changelog.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('update-player')
enable_debug_namespaces('update-player')

const excluded_props = ['pid', 'formatted_name']

// primary_position is the column every consumer groups and filters on, so an
// importer must opt in by name rather than through allow_protected_props --
// eight importers already pass that flag for external IDs.
const primary_position_prop = 'primary_position'

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
  'underdog_player_id',
  'fantasypoints_player_id'
]

const combine_protected_props = ['height_inches', 'weight_pounds']

const nullable_props = ['game_designation']

// Two values are the same verdict when they spell the same thing. `player`
// holds several logically-textual fields as varchar and several as integers,
// and an override stores the value as text, so the comparison is on the string
// form. NULL on both sides is a match: that is a CLEAR -- an override declaring
// the field should hold nothing.
const override_value_matches = (override_value, incoming_value) => {
  if (override_value == null && incoming_value == null) return true
  if (override_value == null || incoming_value == null) return false
  return String(override_value) === String(incoming_value)
}

/*
   player can be a string identifier or player db entry
*/

const updatePlayer = async ({
  player_row,
  pid,
  update,
  allow_protected_props = false,
  allow_primary_position_write = false,
  source = null,
  // Optional free text carried onto every player_changelog row this call
  // writes. record_changelog has always accepted it; nothing passed it until
  // overrides, where the adjudication's reason belongs in the trail beside the
  // value it explains.
  reason = null
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

  // A key that is not a real column on `player` produces no diff entry --
  // deep-diff has nothing on the row side to compare it against, so the value
  // is discarded with no error and nothing in the log, and a typo in a caller
  // is indistinguishable from a field that legitimately did not change. Checked
  // against the fetched row rather than information_schema, matching
  // set-player-field-override.mjs: the row is already in hand, it is always
  // exactly the live schema, and it is the same object diff() below compares
  // against.
  for (const key of Object.keys(update)) {
    if (!Object.prototype.hasOwnProperty.call(player_row, key)) {
      throw new Error(
        `updatePlayer: '${key}' is not a column on player (pid ${player_row.pid}) -- check for a typo against db/schema.postgres.sql`
      )
    }
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

  if (update.primary_position) {
    formatted_update.primary_position = normalize_position(
      update.primary_position
    )
  }

  if (update.secondary_position) {
    formatted_update.secondary_position = normalize_position(
      update.secondary_position
    )
  }

  const differences = diff(player_row, formatted_update)

  const edits = differences.filter((d) => d.kind === 'E')
  if (!edits.length) {
    return 0
  }

  // Human verdicts for THIS row, read once and only when there is something to
  // write. Every guard below is per-column-CLASS -- it knows that
  // sleeper_player_id is an external id, never that a person adjudicated one
  // specific value for one specific row. That is the axis this table adds, and
  // it is why the lookup cannot be folded into any of them.
  //
  // Fetched rather than cached: overrides change on human timescales but an
  // importer process can outlive one, and a stale cache here silently reverts a
  // verdict, which is the failure this whole mechanism exists to end.
  const override_rows = await db('player_field_override').where({
    pid: player_row.pid
  })
  const overrides = new Map(
    override_rows.map((row) => [row.column_name, row.override_value])
  )

  let changes = 0
  for (const edit of edits) {
    const prop = edit.path[0]

    if (excluded_props.includes(prop)) {
      log(`not allowed to update ${prop}`)
      continue
    }

    // An adjudicated field admits exactly ONE value, and the check sits ahead of
    // every class guard below because a human verdict outranks a class switch in
    // BOTH directions: it refuses writes the class guards allow (date_of_birth
    // is protected by nothing today), and it admits the one value a class guard
    // would refuse (the adjudicated id onto a row holding a contaminated one).
    const has_override = overrides.has(prop)

    if (has_override) {
      const override_value = overrides.get(prop)
      if (!override_value_matches(override_value, edit.rhs)) {
        log(
          `SKIP ${prop} on ${player_row.pid}: adjudicated override holds ${JSON.stringify(override_value)}, incoming ${JSON.stringify(edit.rhs)}. No allow_* flag lifts this -- revise the verdict through set_player_field_override.`
        )
        continue
      }
    } else {
      const is_null = edit.rhs == null
      const is_nullable = nullable_props.includes(prop)

      if (is_null && !is_nullable) {
        continue
      }

      // ignore empty dates
      if (edit.rhs === '0000-00-00') {
        continue
      }

      if (prop === primary_position_prop && !allow_primary_position_write) {
        log(
          `SKIP ${prop} on ${player_row.pid}: pass allow_primary_position_write=true to write it.`
        )
        continue
      }
    }

    if (protected_props.includes(prop) && !allow_protected_props) {
      // A clear cannot collide with anything, and it only reaches here through
      // an override -- the null guard above stops every other caller.
      if (edit.rhs != null) {
        const exists = await db('player').where(prop, edit.rhs).limit(1)
        if (exists.length) {
          log(
            `Player (${exists[0].pid}) has existing value (${edit.rhs}) for field (${prop})`
          )
          continue
        }
      }

      // Refuse to silently overwrite the same pid's existing-non-null
      // differing value -- guards against importers hijacking external IDs
      // when a name-fallback match lands on the wrong relative.
      //
      // An override IS the adjudication of that differing value, so it satisfies
      // this same-row guard. The cross-row check above is deliberately NOT
      // lifted: it protects a DIFFERENT row, and it is what mechanically
      // enforces the clear-before-set ordering when two rows swap contaminated
      // ids, which was documented only as prose until now.
      if (
        !has_override &&
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
      !has_override &&
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
    // `prev` alone would drop the trail for a write onto an EMPTY field, which
    // is most of an override's first customers -- twelve of the fourteen
    // sleeper_player_id repairs land on a null column. An adjudicated write with
    // no changelog row is the unattributed correction this mechanism exists to
    // end, so an override always records one. The condition is widened only for
    // overridden fields: making every importer log its null-to-value writes
    // would add tens of millions of rows to a 67.9M-row table for no verdict.
    if (prev || has_override) {
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
          source,
          reason
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
      allow_primary_position_write: true,
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
