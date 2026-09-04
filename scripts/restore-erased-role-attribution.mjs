import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { is_main } from '#libs-server'
import {
  erased_role_attribution_by_play_type,
  erased_role_attribution_restore_rows,
  target_gsis_survivor_restore_rows
} from '#libs-server/erased-role-attribution.mjs'
import db from '#db'
import { chunk_array } from '#libs-shared/chunk.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

// Healer for the role-attribution-erased check. A nullified (NOPL) or
// two-point (CONV) play that once carried a passer, and now holds neither a
// _pid nor a _gsis, is unreachable by enrichment: with no surviving _gsis
// there is nothing left to resolve from, so re-running process-plays cannot
// recover it. play_changelog.previous_value is the only place the identity
// still exists, which is why this script exists at all.
//
// It imports the detector's predicate rather than re-spelling it, per the
// contract in libs-server/erased-role-attribution.mjs -- detector and healer
// must not be able to drift.
//
// STRICTLY ADDITIVE. It writes only where BOTH columns are null and refuses
// any row whose two changelog values disagree with each other. Clearing a
// _gsis to make the role-pid residual monitor green is the failure mode the
// erased check was built to catch, and a healer that could do so would be the
// same bug wearing a repair's name.
//
// It runs a SECOND, separately counted pass over the target-family
// gsis-survivor class: rows whose _pid was destroyed while the _gsis survived,
// which the erased predicate cannot see because it requires both columns null.
// Those rows are unreachable by re-running process-plays too -- process-plays
// is what re-clears them -- so a data-only patch does not hold and the repair
// has to live here.
const log = debug('restore-erased-role-attribution')
enable_debug_namespaces('restore-erased-role-attribution')

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .option('dry', { type: 'boolean', default: false })
    .parse()

  const before = await erased_role_attribution_by_play_type()
  for (const row of before) {
    log(
      `before: ${row.play_type} scanned=${row.scanned} erased=${row.erased} resolvable=${row.resolvable} restored=${row.restored}`
    )
  }

  const rows = await erased_role_attribution_restore_rows()
  log(`${rows.length} erased row(s) to consider`)

  // The changelog holds both columns independently, so they can in principle
  // disagree. Resolve the pid against `player` and require the gsis it carries
  // to match the changelog's gsis: agreement of two independently stored
  // values is the evidence that the restore is the original attribution rather
  // than a half-remembered one. Anything that fails is reported, never
  // guessed at.
  const players = await db('player').select('pid', 'gsis_player_id')
  const gsis_by_pid = new Map(players.map((p) => [p.pid, p.gsis_player_id]))

  const restorable = []
  const unrestorable = []
  for (const row of rows) {
    if (!row.previous_pid || !row.previous_gsis) {
      unrestorable.push({ row, reason: 'changelog missing a previous value' })
      continue
    }
    if (!gsis_by_pid.has(row.previous_pid)) {
      unrestorable.push({ row, reason: 'previous pid has no player row' })
      continue
    }
    if (gsis_by_pid.get(row.previous_pid) !== row.previous_gsis) {
      unrestorable.push({ row, reason: 'previous pid and gsis disagree' })
      continue
    }
    restorable.push(row)
  }

  log(`${restorable.length} restorable, ${unrestorable.length} not`)
  for (const { row, reason } of unrestorable) {
    log(`  SKIP ${row.esbid}/${row.play_id} (${row.play_type}): ${reason}`)
  }

  if (!argv.dry && restorable.length) {
    for (const part of chunk_array({ items: restorable, chunk_size: 500 })) {
      await db.transaction(async (trx) => {
        for (const row of part) {
          await trx('nfl_plays')
            .where({ esbid: row.esbid, play_id: row.play_id })
            // Re-assert both nulls in the predicate so a concurrent writer
            // that repopulated the row between the read and this update is
            // not overwritten by a stale changelog value.
            .whereNull('passer_pid')
            .whereNull('passer_gsis_player_id')
            .update({
              passer_pid: row.previous_pid,
              passer_gsis_player_id: row.previous_gsis
            })
        }
      })
    }
  }

  log(
    `${restorable.length} row(s) ${argv.dry ? 'WOULD be' : ''} restored${argv.dry ? '' : ''}`
  )

  // ---------------------------------------------------------------------------
  // GSIS-SURVIVOR PASS (target family)
  //
  // Counted separately from the erased pass above and never folded into its
  // totals: the two classes have different evidence and different risk, so a
  // combined number would hide which one moved. See the predicate's docstring
  // for why this one is safe outside the NOPL/CONV scope.
  // ---------------------------------------------------------------------------
  const survivor_rows = await target_gsis_survivor_restore_rows()
  log(`gsis-survivor: ${survivor_rows.length} target row(s) to consider`)

  const survivor_restorable = []
  const survivor_unrestorable = []
  for (const row of survivor_rows) {
    if (!row.previous_pid) {
      survivor_unrestorable.push({
        row,
        reason: 'changelog holds no previous pid'
      })
      continue
    }
    if (!gsis_by_pid.has(row.previous_pid)) {
      survivor_unrestorable.push({
        row,
        reason: 'previous pid has no player row'
      })
      continue
    }
    if (gsis_by_pid.get(row.previous_pid) !== row.live_gsis) {
      survivor_unrestorable.push({
        row,
        reason: `previous pid resolves to ${gsis_by_pid.get(row.previous_pid)}, row holds ${row.live_gsis}`
      })
      continue
    }
    survivor_restorable.push(row)
  }

  log(
    `gsis-survivor: ${survivor_restorable.length} restorable, ${survivor_unrestorable.length} not`
  )
  for (const row of survivor_restorable) {
    log(
      `  gsis-survivor RESTORE ${row.esbid}/${row.play_id} (${row.play_type}, ${row.season_year} ${row.season_type}): target_pid <- ${row.previous_pid} (gsis ${row.live_gsis})`
    )
  }
  for (const { row, reason } of survivor_unrestorable) {
    log(`  gsis-survivor SKIP ${row.esbid}/${row.play_id}: ${reason}`)
  }

  if (!argv.dry && survivor_restorable.length) {
    for (const part of chunk_array({
      items: survivor_restorable,
      chunk_size: 500
    })) {
      await db.transaction(async (trx) => {
        for (const row of part) {
          await trx('nfl_plays')
            .where({ esbid: row.esbid, play_id: row.play_id })
            // Re-assert the read state: still unresolved, and still holding the
            // same gsis the agreement check was made against. A concurrent
            // writer that repopulated the pid or moved the gsis wins.
            .whereNull('target_pid')
            .where('target_gsis_player_id', row.live_gsis)
            // The pid ONLY. This healer must never write a `_gsis`.
            .update({ target_pid: row.previous_pid })
        }
      })
    }
  }

  if (!argv.dry) {
    const after = await erased_role_attribution_by_play_type()
    for (const row of after) {
      log(
        `after: ${row.play_type} scanned=${row.scanned} erased=${row.erased} resolvable=${row.resolvable} restored=${row.restored}`
      )
    }
  }

  process.exit(0)
}

if (is_main(import.meta.url)) {
  main()
}
