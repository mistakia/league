import db from '#db'
import { is_main } from '#libs-server'
import { current_season } from '#constants'
import {
  LEAGUE_SCOPED_TABLES,
  CLONED_BOARD_TABLES,
  wipe_league,
  clone_league_board
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
 * argument, never defaulted, and league 1 is refused unconditionally.
 *
 * usage:
 *   node scripts/clone-league.mjs --create --from 1
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

const main = async () => {
  const args = parse_args(process.argv.slice(2))

  if (!args.create && !args.sync) {
    throw new Error('one of --create or --sync is required')
  }
  if (!args.from) {
    throw new Error('--from <lid> is required')
  }

  // REFUSE LEAGUE 1 BEFORE OPENING A CONNECTION. wipe_league refuses it too,
  // but that check runs inside a transaction, so a mistyped --to failed with a
  // database error rather than a clear refusal -- and on a host that could not
  // reach the database it never got as far as refusing at all. The argument is
  // wrong on its face and should be rejected on its face.
  if (Number(args.to) === 1) {
    throw new Error(
      'refusing --to 1: league 1 is the live league running the real auction'
    )
  }

  // console rather than debug(): a dry-run plan is the script's OUTPUT, and a
  // plan nobody sees unless they set DEBUG is not a dry run. The debug logger
  // stays for internals.
  console.log(
    `league-scoped tables from the fixture reset list: ${LEAGUE_SCOPED_TABLES.length}`
  )
  console.log(`board tables copied: ${CLONED_BOARD_TABLES.join(', ')}`)

  if (args.sync) {
    if (!args.to) {
      throw new Error('--sync requires an explicit --to <lid>')
    }
    if (!args.execute) {
      console.log('DRY RUN. Re-run with --execute to apply.')
      console.log(
        `would wipe league ${args.to} across ${LEAGUE_SCOPED_TABLES.length} tables`
      )
      console.log(
        `would copy league ${args.from}'s board into league ${args.to}`
      )
      return
    }

    await db.transaction(async (trx) => {
      await wipe_league({ trx, lid: args.to })
      await clone_league_board({
        trx,
        from_lid: args.from,
        to_lid: args.to,
        season_year: current_season.year
      })
    })
    console.log(`synced league ${args.from} -> league ${args.to}`)
    return
  }

  throw new Error(
    '--create is not implemented yet; create the target league through the ' +
      'normal league-creation path, then --sync into it'
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
