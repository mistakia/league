/*
  Companion to 2026-08-17-apply-adjudicated-player-identity-repairs.mjs, which
  applied 22 writes and left only 11 in player_changelog.

  ## The gap, which is a defect in updatePlayer rather than in that script

  `libs-server/update-player.mjs:186-188` guards its changelog write on
  `const prev = edit.lhs; if (prev) { ... }`. A FIRST-TIME FILL therefore records
  nothing: `prev` is null, the guard is falsy, the column is written and no audit
  row exists. So updatePlayer records an OVERWRITE and is silent on an
  establishment -- which is backwards for provenance, since a first fill is
  exactly the write that creates a link nobody can later falsify. All eleven
  sleeper_player_id sets in that run were null -> value and vanished this way.

  This is the same class of failure the parent task exists to remove, one layer
  down: a write that succeeds while its record does not. It is recorded on
  user:task/league/design-durable-external-provider-overrides.md, which owns the
  fix; correcting updatePlayer's guard is not in this script's scope, because it
  changes changelog volume for every writer in the repo.

  This file only backfills the eleven missing rows, so the audit trail for the
  operator-approved batch is complete. Reasons are copied verbatim from the
  applying script.
*/

import db from '#db'
import { record_changelog } from '#libs-server'

const SOURCE = 'adhoc/2026-08-17-adjudicated-player-identity-repairs'

const first_fill_writes = [
  {
    pid: 'JORD-MURR-000108',
    new_value: '8106',
    reason: 'North Texas OT, 1997-05-17, Coppell TX -- sleeper 8106 IS this row'
  },
  {
    pid: 'SEAN-RYAN-001783',
    new_value: '5834',
    reason: 'Boston College TE, 1980-03-27 -- sleeper 5834 IS this row'
  },
  {
    pid: 'JORD-MURR-006621',
    new_value: '11493',
    reason: 'Hawaii TE, 2000-04-20, gsis 00-0038999'
  },
  {
    pid: 'SEAN-RYAN-027249',
    new_value: '11387',
    reason: 'Rutgers WR, 1999-01-21, gsis 00-0038455'
  },
  {
    pid: 'ROBE-BURN-015770',
    new_value: '11060',
    reason: 'UConn RB, 1998-09-25, gsis 00-0038419'
  },
  {
    pid: 'GRIF-HEBE-000948',
    new_value: '11224',
    reason: 'Louisiana Tech TE, rookie 2023, gsis 00-0038760'
  },
  {
    pid: 'JESS-MATT-017444',
    new_value: '11452',
    reason: 'San Diego State WR, rookie 2023, gsis 00-0038726'
  },
  {
    pid: 'KEIL-HARR-002651',
    new_value: '11190',
    reason: 'Oklahoma Baptist WR, rookie 2023, gsis 00-0038926'
  },
  {
    pid: 'TERR-BYNU-027186',
    new_value: '11115',
    reason: 'USC/Washington WR, rookie 2023, gsis 00-0038860'
  },
  {
    pid: 'THYR-PITT-010328',
    new_value: '11266',
    reason: 'Delaware WR, rookie 2023, gsis 00-0038427'
  },
  {
    pid: 'MAXX-BRED-001713',
    new_value: '13516',
    reason: 'Michigan, 2026 5th round 159th overall, gsis 00-0041081'
  }
]

const main = async () => {
  let recorded = 0
  let skipped = 0

  for (const write of first_fill_writes) {
    // Only record what the database actually holds -- a changelog row asserting
    // a write that did not land is worse than a missing one, which is the whole
    // lesson of this batch.
    const player_row = await db('player').where({ pid: write.pid }).first()
    if (!player_row) {
      console.log(`SKIP ${write.pid}: no such row`)
      skipped += 1
      continue
    }
    if (String(player_row.sleeper_player_id) !== String(write.new_value)) {
      console.log(
        `SKIP ${write.pid}: holds ${player_row.sleeper_player_id}, not ${write.new_value}`
      )
      skipped += 1
      continue
    }

    /*
      Keyed on new_value, NOT on (pid, column_name, source) alone. Three of
      these pids also carry a CLEAR from the same batch and the same source, so
      the coarser predicate matched the clear and silently skipped the set --
      leaving exactly the rows this script exists to record unrecorded, which is
      the defect it is repairing, reproduced in its own dedup.
    */
    const existing = await db('player_changelog')
      .where({
        pid: write.pid,
        column_name: 'sleeper_player_id',
        source: SOURCE,
        new_value: write.new_value
      })
      .first()
    if (existing) {
      console.log(`SKIP ${write.pid}: already recorded`)
      skipped += 1
      continue
    }

    await record_changelog({
      table: 'player_changelog',
      rows: {
        pid: write.pid,
        column_name: 'sleeper_player_id',
        previous_value: null,
        new_value: write.new_value,
        source: SOURCE,
        reason: write.reason,
        changed_at: new Date()
      }
    })
    console.log(
      `RECORDED ${write.pid} sleeper_player_id null -> ${write.new_value}`
    )
    recorded += 1
  }

  const total = await db('player_changelog')
    .where({ source: SOURCE })
    .count('* as count')
    .first()
  console.log(`\nrecorded ${recorded}, skipped ${skipped}`)
  console.log(`player_changelog rows for this batch: ${total.count}`)

  await db.destroy()
  process.exit(0)
}

main()
