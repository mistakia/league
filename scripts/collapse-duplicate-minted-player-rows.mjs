import fs from 'fs'

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, updatePlayer } from '#libs-server'
import { short_name_key } from '#libs-server/player-identity-collision-oracle.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('collapse-duplicate-minted-player-rows')
enable_debug_namespaces('collapse-duplicate-minted-player-rows,update-player')

/*
  Collapses a player row that repair-missing-player-gsis-ids MINTED onto the row
  for that same person which was already in the table.

  Why it was needed. The repair's attach ladder had two rungs, and a person who
  was in `player` with NO external identifier at all and NO gamelogs was
  invisible to both: the external-id rung had nothing to match, and the
  name-and-team-season rung needs `player_gamelogs`, which only exists once a
  play stat has already resolved. 70 of 689 mints landed on such a person. The
  third rung -- name plus exact birth date -- now sits in the classifier so this
  cannot recur, but it cannot undo rows already written, because the minted row
  now HOLDS the gsis id and so no longer appears as missing.

  Why a birth date is enough to decide. It is not being used to FIND the pair --
  the normalized short name does that -- it is being used to confirm one. Two
  people sharing a surname, a first initial and an exact date of birth, one of
  whom the feed independently places in the same era, is not a coincidence worth
  hedging against.

  This is a single-purpose destructive script naming its target explicitly,
  which is the shape db/guard-destructive-target.mjs asks for. That guard is not
  invoked: it exists to refuse DROP-scale operations against anything but a
  throwaway database, whereas this deletes named rows in production on purpose.
  The protection here is instead that every row is proven unreferenced first.

  Default is a dry run. --apply is required to write anything.
*/

/*
  Every table carrying a `pid` column, minus `player` itself. A minted row may
  only be deleted if NONE of them references it.

  Enumerated from information_schema at run time rather than listed, because the
  list is 140 tables long and a hand-written copy would silently stop covering a
  table added later -- which is the one failure mode that turns this from a
  correction into an orphaned foreign key.
*/
const get_pid_referencing_tables = async () => {
  const { rows } = await db.raw(
    `SELECT table_name FROM information_schema.columns
     WHERE column_name = 'pid' AND table_schema = 'public' AND table_name <> 'player'
     ORDER BY 1`
  )
  return rows.map((row) => row.table_name)
}

const find_references = async ({ pids, tables }) => {
  const references = new Map()
  for (const table of tables) {
    const { rows } = await db.raw(
      `SELECT pid, count(*) AS rows FROM "${table}"
       WHERE pid = ANY('{${pids.join(',')}}') GROUP BY 1`
    )
    for (const row of rows) {
      if (!references.has(row.pid)) references.set(row.pid, [])
      references.get(row.pid).push({ table, rows: Number(row.rows) })
    }
  }
  return references
}

const find_duplicate_pairs = async ({ minted_gsis_ids }) => {
  const { rows } = await db.raw(`WITH minted AS (
  SELECT pid, short_name, date_of_birth, gsis_player_id, esb_player_id,
         pfr_player_id, smart_player_id, gsis_it_player_id, height_inches,
         weight_pounds, college, nfl_draft_year,
         ${short_name_key('short_name')} AS name_key
  FROM player
  WHERE gsis_player_id = ANY('{${minted_gsis_ids.join(',')}}')
    AND date_of_birth IS NOT NULL AND date_of_birth::text NOT LIKE '0000%'
)
SELECT m.pid AS minted_pid, m.short_name, m.gsis_player_id, m.date_of_birth,
       m.esb_player_id, m.pfr_player_id, m.smart_player_id, m.gsis_it_player_id,
       m.height_inches, m.weight_pounds, m.college,
       i.pid AS incumbent_pid, i.short_name AS incumbent_short_name,
       i.height_inches AS incumbent_height, i.weight_pounds AS incumbent_weight,
       i.college AS incumbent_college, i.nfl_draft_year AS incumbent_draft_year
FROM minted m
JOIN player i ON i.pid <> m.pid AND i.primary_position <> 'DST'
  AND ${short_name_key('i.short_name')} = m.name_key
  AND i.date_of_birth = m.date_of_birth
  -- The incumbent must hold NO gsis id. One that already holds a different one
  -- is a contradiction this script has no standing to resolve.
  AND i.gsis_player_id IS NULL
ORDER BY m.short_name`)
  return rows
}

const collapse_duplicate_minted_player_rows = async ({
  dispositions_path,
  apply = false
}) => {
  const dry_run = !apply
  log(dry_run ? 'DRY RUN — nothing will be written' : 'APPLYING writes')

  const dispositions = JSON.parse(fs.readFileSync(dispositions_path, 'utf8'))
  const minted_gsis_ids = dispositions
    .filter((row) => row.disposition === 'mint_new')
    .map((row) => row.gsis_player_id)
  log(`${minted_gsis_ids.length} gsis ids were minted by the repair run`)

  const pairs = await find_duplicate_pairs({ minted_gsis_ids })
  log(
    `${pairs.length} minted rows duplicate an existing row on name and birth date`
  )
  if (!pairs.length) return { collapsed: 0, skipped: 0 }

  const tables = await get_pid_referencing_tables()
  log(`checking ${tables.length} pid-carrying tables for references`)
  const references = await find_references({
    pids: pairs.map((pair) => pair.minted_pid),
    tables
  })

  const stats = { collapsed: 0, skipped: 0 }
  for (const pair of pairs) {
    const referenced = references.get(pair.minted_pid)
    if (referenced) {
      log(
        `SKIP ${pair.minted_pid} — referenced by ${referenced.map((r) => `${r.table}(${r.rows})`).join(', ')}`
      )
      stats.skipped += 1
      continue
    }

    log(
      `collapse ${pair.minted_pid} (${pair.short_name}, ${pair.date_of_birth}) -> ${pair.incumbent_pid}`
    )
    if (dry_run) {
      stats.collapsed += 1
      continue
    }

    // The identifiers move to the incumbent, and the biographical fields only
    // fill where the incumbent has none -- this corrects an identity, it does
    // not restate a row another importer owns.
    const update = {
      gsis_player_id: pair.gsis_player_id,
      esb_player_id: pair.esb_player_id,
      pfr_player_id: pair.pfr_player_id,
      smart_player_id: pair.smart_player_id,
      gsis_it_player_id: pair.gsis_it_player_id
    }
    if (!pair.incumbent_height && pair.height_inches) {
      update.height_inches = pair.height_inches
    }
    if (!pair.incumbent_weight && pair.weight_pounds) {
      update.weight_pounds = pair.weight_pounds
    }
    if (!pair.incumbent_college && pair.college) update.college = pair.college
    for (const key of Object.keys(update)) {
      if (update[key] === null || update[key] === undefined) delete update[key]
    }

    // The minted row is deleted FIRST. Both rows would otherwise hold the same
    // esb id for the duration of the update, and a concurrent reader would see
    // the duplicate this whole exercise exists to prevent.
    await db('player').where({ pid: pair.minted_pid }).del()
    await updatePlayer({
      pid: pair.incumbent_pid,
      update,
      allow_protected_props: true,
      source: 'collapse-duplicate-minted-player-rows',
      reason: `collapsed duplicate minted row ${pair.minted_pid}, matched on short name and birth date ${pair.date_of_birth}`
    })
    stats.collapsed += 1
  }

  log('result: %o', stats)
  return stats
}

const main = async () => {
  let error
  try {
    const argv = yargs(hideBin(process.argv))
      .option('dispositions_path', {
        type: 'string',
        demandOption: true,
        describe:
          'the JSON written by repair-missing-player-gsis-ids --output_path'
      })
      .option('apply', { type: 'boolean', default: false }).argv

    await collapse_duplicate_minted_player_rows({
      dispositions_path: argv.dispositions_path,
      apply: argv.apply
    })
  } catch (err) {
    error = err
    log(error)
  }

  await db.destroy()
  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default collapse_duplicate_minted_player_rows
