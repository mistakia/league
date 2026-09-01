import db from '#db'
import { is_main } from '#libs-server'
import { current_season } from '#constants'
import {
  LEAGUE_SCOPED_TABLES,
  CLONED_BOARD_TABLES,
  NOT_CLONED_REASONS,
  clone_league
} from '#libs-server/clone-league.mjs'

/**
 * Create or re-sync a hosted, read-write copy of a league.
 *
 * WHY THIS EXISTS. Everything a manager actually touches in election mode --
 * setting a maximum, declining, watching the outstanding list shrink, seeing a
 * settlement land -- can only be verified against a league you can write to.
 * League 1 is the real auction, so it is not that league. This makes a second
 * one, repeatably, from league 1's own shape.
 *
 * WHY IT WRITES TO PRODUCTION AND IS NOT COVERED BY THE DESTRUCTIVE GUARD.
 * db/guard-destructive-target.mjs refuses destructive work outside a small set
 * of test databases, and says in its own header that a genuine
 * destructive-against-production need "should get its own single-purpose script
 * that names the target as an explicit argument, not a bypass flag threaded
 * through here." This is that script. The target league id is a required
 * argument for --sync, never defaulted, and league 1 is refused unconditionally.
 *
 * usage:
 *   node scripts/clone-league.mjs --create --from 1 --execute
 *   node scripts/clone-league.mjs --sync --from 1 --to 2 --execute
 *
 * Dry run by default. Nothing is written without --execute.
 */

const parse_args = (argv) => {
  const args = { execute: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--create') args.create = true
    else if (arg === '--sync') args.sync = true
    else if (arg === '--execute') args.execute = true
    else if (arg === '--from') args.from = Number(argv[++i])
    else if (arg === '--to') args.to = Number(argv[++i])
    else if (arg === '--name') args.name = argv[++i]
    else throw new Error(`unknown argument: ${arg}`)
  }
  return args
}

export const validate_args = (args) => {
  if (args.create && args.sync) {
    throw new Error('--create and --sync are different verbs; pick one')
  }
  if (!args.create && !args.sync) {
    throw new Error('one of --create or --sync is required')
  }
  if (!args.from) {
    throw new Error('--from <lid> is required')
  }
  if (args.sync && !args.to) {
    throw new Error('--sync requires an explicit --to <lid>')
  }
  if (args.create && args.to !== undefined) {
    throw new Error('--create allocates the target league id; drop --to')
  }
  // REFUSE LEAGUE 1 BEFORE OPENING A CONNECTION. clone_league refuses it too,
  // but that check runs inside a transaction, so a mistyped --to failed with a
  // database error rather than a clear refusal -- and on a host that could not
  // reach the database it never got as far as refusing at all. The argument is
  // wrong on its face and should be rejected on its face.
  if (Number(args.to) === 1) {
    throw new Error(
      'refusing --to 1: league 1 is the live league running the real auction'
    )
  }
  return args
}

const main = async () => {
  const args = validate_args(parse_args(process.argv.slice(2)))

  // console rather than debug(): a dry-run plan is the script's OUTPUT, and a
  // plan nobody sees unless they set DEBUG is not a dry run. The debug logger
  // stays for internals.
  console.log(
    `league-scoped tables from the fixture reset list: ${LEAGUE_SCOPED_TABLES.length}`
  )
  console.log(`board tables copied: ${CLONED_BOARD_TABLES.join(', ')}`)
  for (const [table, reason] of Object.entries(NOT_CLONED_REASONS)) {
    console.log(`  not copied -- ${table}: ${reason}`)
  }

  if (!args.execute) {
    console.log('DRY RUN. Re-run with --execute to apply.')
    if (args.sync) {
      console.log(
        `would wipe league ${args.to} across ${LEAGUE_SCOPED_TABLES.length} tables`
      )
      console.log(`would re-copy league ${args.from} into league ${args.to}`)
    } else {
      console.log(
        `would create a new hosted league from league ${args.from} at season ${current_season.year}`
      )
    }
    return
  }

  const result = await db.transaction((trx) =>
    clone_league({
      trx,
      from_lid: args.from,
      to_lid: args.sync ? args.to : undefined,
      season_year: current_season.year,
      name: args.name
    })
  )

  for (const [table, count] of Object.entries(result.copied)) {
    console.log(`copied ${table}: ${count}`)
  }

  // Say which configuration the copy is running under. A sync re-copies the
  // BOARD and keeps the target's own league and season rows, because a mirror
  // differs from its source on purpose -- election mode on, free agency period
  // already open -- and re-copying would silently undo exactly the settings that
  // make it walkable. That is invisible from the row counts above, so it is
  // stated, along with every column where the two now disagree.
  if (result.configuration_preserved) {
    console.log(`kept league ${result.lid}'s own league and season settings`)
    console.log(
      result.configuration_drift.length
        ? `differs from league ${args.from} at: ${result.configuration_drift.join(', ')}`
        : `identical to league ${args.from}'s settings`
    )
  }
  console.log(
    args.sync
      ? `synced league ${args.from} -> league ${result.lid}`
      : `created league ${result.lid} from league ${args.from}`
  )
  console.log(
    `re-sync it with: node scripts/clone-league.mjs --sync --from ${args.from} --to ${result.lid} --execute`
  )
}

if (is_main(import.meta.url)) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
