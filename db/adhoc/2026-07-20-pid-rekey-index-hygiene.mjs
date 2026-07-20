// Post-cutover index hygiene (live, CREATE/DROP INDEX CONCURRENTLY — cannot run in
// yarn db:exec's single transaction).
//
// The cutover RENAME COLUMN pid -> legacy_pid dragged the old pid indexes onto
// legacy_pid, leaving:
//   - idx_24798_pid            UNIQUE(legacy_pid)                       [redundant]
//   - player_legacy_pid_key    UNIQUE(legacy_pid)                       [keep]
//   - idx_player_pid_incl_pos_fname_lname  (legacy_pid) INCLUDE(pos,fname,lname)
//   - idx_player_pid_pos                   (legacy_pid, pos)
// The covering/pos pair were pid-keyed performance indexes that now index the wrong
// (demoted) column. This restores them onto the active pid and drops the redundant
// legacy_pid UNIQUE, so legacy_pid keeps exactly one unique index for old-pid
// resolution.
//
// Run:  PGOPTIONS='-c statement_timeout=0' NODE_ENV=production \
//         node db/adhoc/2026-07-20-pid-rekey-index-hygiene.mjs
//
// Idempotent: uses IF EXISTS / IF NOT EXISTS, sweeps any leftover *_new temp index
// (an interrupted CREATE CONCURRENTLY leaves an INVALID index), and verifies
// indisvalid after each build.

import db from '#db'

const log = (m) => console.log(`[index-hygiene] ${m}`)

async function exec(sql) {
  log(sql.replace(/\s+/g, ' ').trim())
  await db.raw(sql)
}

async function assert_valid(index_name) {
  const { rows } = await db.raw(
    `SELECT i.relname, ix.indisvalid, ix.indisready
       FROM pg_index ix JOIN pg_class i ON i.oid = ix.indexrelid
      WHERE i.relname = ?`,
    [index_name]
  )
  if (!rows.length) throw new Error(`missing index ${index_name} after create`)
  if (!rows[0].indisvalid || !rows[0].indisready) {
    throw new Error(`index ${index_name} is INVALID/not-ready — investigate`)
  }
  log(`  verified ${index_name} valid`)
}

async function rebuild_on_pid(final_name, create_body) {
  const tmp = `${final_name}_new`
  // sweep any leftover temp from an interrupted prior run
  await exec(`DROP INDEX CONCURRENTLY IF EXISTS ${tmp}`)
  await exec(`CREATE INDEX CONCURRENTLY ${tmp} ${create_body}`)
  await assert_valid(tmp)
  await exec(`DROP INDEX CONCURRENTLY IF EXISTS ${final_name}`)
  await exec(`ALTER INDEX ${tmp} RENAME TO ${final_name}`)
  await assert_valid(final_name)
}

async function main() {
  // 1. Drop the redundant UNIQUE on legacy_pid (keep player_legacy_pid_key).
  await exec(`DROP INDEX CONCURRENTLY IF EXISTS idx_24798_pid`)

  // 2. Rebuild the covering index on the active pid.
  await rebuild_on_pid(
    'idx_player_pid_incl_pos_fname_lname',
    'ON public.player USING btree (pid) INCLUDE (pos, fname, lname)'
  )

  // 3. Rebuild the (pid, pos) index on the active pid.
  await rebuild_on_pid(
    'idx_player_pid_pos',
    'ON public.player USING btree (pid, pos)'
  )

  // Final report.
  const { rows } = await db.raw(
    `SELECT i.relname AS index_name, pg_get_indexdef(ix.indexrelid) AS def
       FROM pg_index ix
       JOIN pg_class t ON t.oid = ix.indrelid
       JOIN pg_class i ON i.oid = ix.indexrelid
      WHERE t.relname = 'player'
        AND (i.relname IN ('player_pkey','player_legacy_pid_key','idx_24798_pid',
                           'idx_player_pid_incl_pos_fname_lname','idx_player_pid_pos'))
      ORDER BY i.relname`
  )
  log('final pid/legacy_pid index state:')
  for (const r of rows) log(`  ${r.def}`)
}

main()
  .then(() => db.destroy())
  .catch(async (e) => {
    console.error('[index-hygiene] FAILED:', e.message)
    await db.destroy()
    process.exit(1)
  })
