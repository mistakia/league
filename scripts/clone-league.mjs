// NOTHING here may statically import `#db`. It reads LEAGUE_DB_* once at module
// load, and a static import hoists above every statement in this file --
// including the tunnel bootstrap in `resolve_db` below, which is what points it
// at production in the first place. `is_main` and the clone library are imported
// by their own module paths rather than through the `#libs-server` barrel for
// the same reason: the barrel pulls `#db`.
import is_main from '#libs-server/is-main.mjs'
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
 * HOW IT REACHES PRODUCTION. Production postgres is not reachable from a
 * laptop, so this used to die several seconds into its first query on a knex
 * pool timeout -- which read as the database being down rather than as the
 * target being unreachable, and made the re-sync recipe printed in
 * scripts/drive-auction-end-to-end.mjs's header unrunnable from the machine
 * that prints it. It now opens the same ssh tunnel that script does, through
 * the shared bootstrap in libs-server/production-db-tunnel.mjs. No NODE_ENV is
 * required: the target is named explicitly rather than inherited.
 *
 * usage:
 *   node scripts/clone-league.mjs --create --from 1 --execute
 *   node scripts/clone-league.mjs --sync --from 1 --to 2 --execute
 *   node scripts/clone-league.mjs --sync --from 1 --to 2 --execute --db-port 15433 --ssh-host league
 *
 * Dry run by default. Nothing is written without --execute.
 */

// `#config` picks its file from NODE_ENV and throws on config-undefined.json
// when it is unset, so a bare `node scripts/clone-league.mjs` used to die before
// it printed anything. Default rather than pin: the database target is named
// explicitly below whatever this says, and an operator who sets NODE_ENV
// deliberately -- production for the old recipe, test for the spec -- keeps it.
// Nothing above this line imports `#config`, directly or through a barrel.
process.env.NODE_ENV = process.env.NODE_ENV || 'development'

const parse_args = (argv) => {
  const args = { execute: false, db_port: 15433, ssh_host: 'league' }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--create') args.create = true
    else if (arg === '--sync') args.sync = true
    else if (arg === '--execute') args.execute = true
    else if (arg === '--from') args.from = Number(argv[++i])
    else if (arg === '--to') args.to = Number(argv[++i])
    else if (arg === '--name') args.name = argv[++i]
    else if (arg === '--db-port') args.db_port = Number(argv[++i])
    else if (arg === '--ssh-host') args.ssh_host = argv[++i]
    else throw new Error(`unknown argument: ${arg}`)
  }
  return args
}

/**
 * Import `#db` bound to the right database, and never before the environment
 * that decides which one has been set.
 *
 * Under NODE_ENV=test the runner has already pointed this process at a local
 * fixture database, and test/auction.clone-league.spec.mjs spawns this script
 * with that environment inherited. Opening a tunnel there would aim a spec at
 * production, so the bootstrap is skipped and `#db` is taken as the suite left
 * it. Everywhere else the target IS production, and saying so costs one ssh.
 */
const resolve_db = async ({ db_port, ssh_host }) => {
  if (process.env.NODE_ENV !== 'test') {
    const { open_production_db_tunnel } =
      await import('#libs-server/production-db-tunnel.mjs')
    const { database } = await open_production_db_tunnel({ db_port, ssh_host })
    console.log(
      `target: ${database} on production, over 127.0.0.1:${db_port} -> ${ssh_host}:5432`
    )
  }
  const { default: db } = await import('#db')
  // One cheap round trip, so an unreachable target fails HERE, naming the
  // target, rather than as a knex pool timeout inside the clone transaction
  // minutes later -- which is what it did before, and which reads as the
  // database being down rather than as this process never having had a route.
  await db.raw('select 1')
  return db
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

  // BEFORE the dry run, not after. A dry run's whole job is to answer "would
  // this work", and a plan printed by a process that cannot reach the database
  // answers a smaller question than the operator asked. Opening the tunnel here
  // makes an unreachable target a dry-run failure rather than a surprise
  // several minutes into the --execute run.
  const db = await resolve_db(args)

  // console rather than debug(): a dry-run plan is the script's OUTPUT, and a
  // plan nobody sees unless they set DEBUG is not a dry run. The debug logger
  // stays for internals.
  console.log(
    `league-scoped tables from the fixture reset list: ${LEAGUE_SCOPED_TABLES.length}`
  )
  console.log(`board tables copied: ${CLONED_BOARD_TABLES.join(', ')}`)
  console.log(
    "  narrowed -- users_teams: only the target league's commissioner is enrolled; every other team is left unowned"
  )
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

  // SAY SOMETHING WHILE IT WORKS. The copy takes minutes against a remote
  // database, and the first production run printed nothing between the table
  // plan and the summary -- so the operator could not tell it from a hang and
  // killed it. This repository's own rule is that a run silent for more than a
  // minute should be TREATED as a hang, and a script that requires the operator
  // to break that rule in order to use it is defective however correct its
  // writes are.
  const started_at = Date.now()
  const elapsed = () => `${Math.round((Date.now() - started_at) / 1000)}s`
  const on_progress = ({ phase, table, copied, total }) => {
    if (phase === 'plan') return console.log(`[${elapsed()}] resolving scope`)
    if (phase === 'count-source') {
      return console.log(`[${elapsed()}] counting league ${args.from}`)
    }
    if (phase === 'verify-source') {
      return console.log(
        `[${elapsed()}] verifying league ${args.from} unwritten`
      )
    }
    if (phase === 'wipe') {
      // Only the endpoints: 41 tables would otherwise bury the copy below it.
      if (copied === 0)
        return console.log(`[${elapsed()}] wiping ${total} tables`)
      if (copied === total)
        return console.log(`[${elapsed()}] wiped ${total} tables`)
      return
    }
    if (copied === 0) return console.log(`[${elapsed()}] ${table}: 0/${total}`)
    if (copied === total) {
      return console.log(`[${elapsed()}] ${table}: ${copied}/${total} done`)
    }
    console.log(`[${elapsed()}] ${table}: ${copied}/${total}`)
  }

  const result = await db.transaction((trx) =>
    clone_league({
      trx,
      from_lid: args.from,
      to_lid: args.sync ? args.to : undefined,
      season_year: current_season.year,
      name: args.name,
      on_progress
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
