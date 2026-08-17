/*
  Applies the hand-adjudicated player identity repairs owned by
  user:task/league/repair-player-creation-pipeline.md, with operator approval
  recorded 2026-08-17.

  Every write here is a case where an external provider or an older import was
  wrong and a human established the truth against two independent oracles
  (nflverse players.csv keyed on OUR OWN gsis_player_id, plus Pro-Football-
  Reference read via cloak-browser). The per-player evidence is in the task's
  plan body and observations.

  ## Why this is a script and not a .sql file

  Provenance. An earlier batch of fourteen adjudicated writes was applied as
  raw SQL and left NO player_changelog row, so months later nothing could
  establish who had decided them, against what, or whether they had landed at
  all -- two of them turned out never to have been applied while the task
  record asserted they were "verified by read-back". Going through updatePlayer
  is what makes each write self-documenting, because it refuses a changelog
  write with no `source`.

  ## The one thing updatePlayer cannot do

  It CANNOT clear a value. `nullable_props` is ['game_designation'] alone, so
  `if (is_null && !is_nullable) continue` silently drops a null for every other
  column -- including sleeper_player_id. The three clears below are therefore
  direct statements paired with an explicit record_changelog call, which is the
  only way to clear a field and keep the audit trail.

  ## Ordering is load-bearing

  Two of the sets are SWAPS: 8106 and 5834 are currently held by the wrong rows
  and must be freed before the correct rows can take them, or the second write
  collides with the unique index. Clears run first for that reason.
*/

import db from '#db'
import { updatePlayer, record_changelog } from '#libs-server'

const SOURCE = 'adhoc/2026-08-17-adjudicated-player-identity-repairs'

// Each converts a PERMANENT refusal into an automatic match on the next run:
// the row holds an ELDER NAMESAKE's birth date, so the modern player's real
// date disagrees with it forever and no name+birth-date rule can resolve him.
const date_of_birth_repairs = [
  {
    pid: 'KWAM-LASS-027179',
    date_of_birth: '1998-01-21',
    reason:
      'held the father Kwamie Lassiter (DB, rookie 1995, gsis 00-0009659); nflverse gives Kwamie Lassiter II, WR, Kansas, rookie 2022, gsis 00-0037420'
  },
  {
    pid: 'ROBE-BURN-015770',
    date_of_birth: '1998-09-25',
    reason:
      "held Bob Burns's date (RB, Georgia, 1974); nflverse gives Robert Burns, RB, Connecticut/Miami, rookie 2023, gsis 00-0038419"
  },
  {
    pid: 'JOHN-STEP-008190',
    date_of_birth: '1999-09-23',
    reason:
      'held the elder John Stephens (RB, Northwestern State, 1988); nflverse gives John Stephens Jr., TE, Louisiana-Lafayette/TCU, rookie 2023, gsis 00-0038741'
  },
  {
    pid: 'AARO-SMIT-027947',
    date_of_birth: '2002-08-12',
    reason:
      'sat on the 0000-00-00 placeholder; nflverse on our own gsis 00-0040407 gives Aaron Smith, South Carolina State LB, rookie 2026, SEA'
  }
]

// Each row holds a vendor id belonging to a DIFFERENT same-named human. In
// every case the gsis id and the descriptive fields agree with each other and
// disagree with the sleeper/sportradar block, so the verdicts follow gsis.
const sleeper_id_clears = [
  {
    pid: 'JORD-MURR-006621',
    previous_value: '8106',
    reason:
      'contamination from the North Texas OT; this row is the Hawaii TE, gsis 00-0038999'
  },
  {
    pid: 'SEAN-RYAN-027249',
    previous_value: '5834',
    reason:
      'contamination from the 2004 Boston College TE; this row is the Rutgers WR, gsis 00-0038455'
  },
  {
    pid: 'REGG-BROW-019194',
    previous_value: '12169',
    reason:
      'sleeper 12169 is a James Madison WR with no row here; this row is the 2005 Georgia WR, gsis 00-0023470'
  },
  {
    pid: 'ROBE-BURN-015770',
    previous_value: '11260',
    reason:
      'sleeper 11260 is a different Robert Burns (FB, Connecticut, CHI, no birth date); the correct entry for this human is 11060'
  }
]

const sleeper_id_sets = [
  // The two swap targets -- these take the ids freed immediately above.
  {
    pid: 'JORD-MURR-000108',
    sleeper_player_id: '8106',
    reason: 'North Texas OT, 1997-05-17, Coppell TX -- sleeper 8106 IS this row'
  },
  {
    pid: 'SEAN-RYAN-001783',
    sleeper_player_id: '5834',
    reason: 'Boston College TE, 1980-03-27 -- sleeper 5834 IS this row'
  },
  // The correct links for the two contaminated rows.
  {
    pid: 'JORD-MURR-006621',
    sleeper_player_id: '11493',
    reason: 'Hawaii TE, 2000-04-20, gsis 00-0038999'
  },
  {
    pid: 'SEAN-RYAN-027249',
    sleeper_player_id: '11387',
    reason: 'Rutgers WR, 1999-01-21, gsis 00-0038455'
  },
  {
    pid: 'ROBE-BURN-015770',
    sleeper_player_id: '11060',
    reason: 'UConn RB, 1998-09-25, gsis 00-0038419'
  },
  // Confirmed SAME verdicts whose rows were never linked, so every run
  // re-derives their identity from scratch and re-enters them as candidates.
  {
    pid: 'GRIF-HEBE-000948',
    sleeper_player_id: '11224',
    reason: 'Louisiana Tech TE, rookie 2023, gsis 00-0038760'
  },
  {
    pid: 'JESS-MATT-017444',
    sleeper_player_id: '11452',
    reason: 'San Diego State WR, rookie 2023, gsis 00-0038726'
  },
  {
    pid: 'KEIL-HARR-002651',
    sleeper_player_id: '11190',
    reason: 'Oklahoma Baptist WR, rookie 2023, gsis 00-0038926'
  },
  {
    pid: 'TERR-BYNU-027186',
    sleeper_player_id: '11115',
    reason: 'USC/Washington WR, rookie 2023, gsis 00-0038860'
  },
  {
    pid: 'THYR-PITT-010328',
    sleeper_player_id: '11266',
    reason: 'Delaware WR, rookie 2023, gsis 00-0038427'
  },
  {
    pid: 'MAXX-BRED-001713',
    sleeper_player_id: '13516',
    reason: 'Michigan, 2026 5th round 159th overall, gsis 00-0041081'
  }
]

/*
  Positions, all three carrying the same consequence: the draft board groups
  players into fantasy-position buckets by primary_position
  (app/views/pages/draft/draft.js), so a row at a non-fantasy position renders
  in NO bucket. Note the server-side draft eligibility check
  (api/routes/leagues/draft.mjs) tests only nfl_draft_year, so these players
  were always draftable by id -- what was broken is discoverability.
*/
const position_repairs = [
  {
    pid: 'JORD-MURR-006621',
    primary_position: 'TE',
    reason:
      "held T, the North Texas OT's position, alongside his sleeper id; this row is the Hawaii TE"
  },
  {
    pid: 'SEAN-RYAN-027249',
    primary_position: 'WR',
    reason:
      "held TE, the elder Boston College TE's position; this row is the Rutgers WR"
  },
  {
    pid: 'MAXX-BRED-001713',
    primary_position: 'TE',
    secondary_position: 'FB',
    reason:
      'held FB, which is outside fantasy_positions and so rendered in no draft-board bucket; Minnesota and Sleeper both carry him at TE and nflverse at RB, so FB is the outlier. FB retained as secondary.'
  }
]

const read_row = async (pid) => db('player').where({ pid }).first()

const main = async () => {
  let applied = 0
  let skipped = 0

  // console.log rather than debug: this is a one-shot repair whose log IS its
  // audit trail, and namespace enablement is a runtime negotiation with the
  // whole ESM import graph.
  console.log('=== date_of_birth repairs ===')
  for (const repair of date_of_birth_repairs) {
    const player_row = await read_row(repair.pid)
    if (!player_row) {
      console.log(`SKIP ${repair.pid}: no such row`)
      skipped += 1
      continue
    }
    const changes = await updatePlayer({
      player_row,
      update: { date_of_birth: repair.date_of_birth },
      source: SOURCE
    })
    console.log(
      `${changes ? 'WROTE' : 'NO-OP'} ${repair.pid} date_of_birth ${player_row.date_of_birth} -> ${repair.date_of_birth}`
    )
    changes ? (applied += 1) : (skipped += 1)
  }

  /*
    Clears run BEFORE sets so the two swapped ids are free. Direct statement
    plus an explicit changelog row, because updatePlayer drops a null for any
    column outside nullable_props -- see the header.
  */
  console.log('=== sleeper_player_id clears ===')
  for (const clear of sleeper_id_clears) {
    const updated = await db('player')
      .where({ pid: clear.pid, sleeper_player_id: clear.previous_value })
      .update({ sleeper_player_id: null })

    if (!updated) {
      console.log(
        `SKIP ${clear.pid}: did not hold ${clear.previous_value} (already cleared, or changed under us)`
      )
      skipped += 1
      continue
    }

    await record_changelog({
      table: 'player_changelog',
      rows: {
        pid: clear.pid,
        column_name: 'sleeper_player_id',
        previous_value: clear.previous_value,
        new_value: null,
        source: SOURCE,
        reason: clear.reason,
        changed_at: new Date()
      }
    })
    console.log(
      `CLEARED ${clear.pid} sleeper_player_id ${clear.previous_value} -> null`
    )
    applied += 1
  }

  console.log('=== sleeper_player_id sets ===')
  for (const set of sleeper_id_sets) {
    const player_row = await read_row(set.pid)
    if (!player_row) {
      console.log(`SKIP ${set.pid}: no such row`)
      skipped += 1
      continue
    }

    // Guard the swaps explicitly rather than trusting the ordering above: a
    // collision here would be a unique-index violation mid-run.
    const holder = await db('player')
      .where({ sleeper_player_id: set.sleeper_player_id })
      .whereNot({ pid: set.pid })
      .first()
    if (holder) {
      console.log(
        `SKIP ${set.pid}: sleeper ${set.sleeper_player_id} is held by ${holder.pid}`
      )
      skipped += 1
      continue
    }

    // allow_protected_props because sleeper_player_id is a protected prop and
    // the guard refuses an overwrite of a differing non-null value. Every id
    // here is hand-adjudicated, which is exactly the case the flag exists for.
    const changes = await updatePlayer({
      player_row,
      update: { sleeper_player_id: set.sleeper_player_id },
      allow_protected_props: true,
      source: SOURCE
    })
    console.log(
      `${changes ? 'WROTE' : 'NO-OP'} ${set.pid} sleeper_player_id ${player_row.sleeper_player_id} -> ${set.sleeper_player_id}`
    )
    changes ? (applied += 1) : (skipped += 1)
  }

  console.log('=== position repairs ===')
  for (const repair of position_repairs) {
    const player_row = await read_row(repair.pid)
    if (!player_row) {
      console.log(`SKIP ${repair.pid}: no such row`)
      skipped += 1
      continue
    }
    const update = { primary_position: repair.primary_position }
    if (repair.secondary_position) {
      update.secondary_position = repair.secondary_position
    }
    const changes = await updatePlayer({
      player_row,
      update,
      allow_primary_position_write: true,
      source: SOURCE
    })
    console.log(
      `${changes ? 'WROTE' : 'NO-OP'} ${repair.pid} primary_position ${player_row.primary_position} -> ${repair.primary_position}`
    )
    changes ? (applied += 1) : (skipped += 1)
  }

  console.log(`\napplied ${applied}, skipped ${skipped}`)

  // Read-back, because the whole reason this script exists is that an earlier
  // batch was reported applied and was not.
  console.log('\n=== read-back ===')
  const pids = [
    ...new Set([
      ...date_of_birth_repairs.map((r) => r.pid),
      ...sleeper_id_clears.map((r) => r.pid),
      ...sleeper_id_sets.map((r) => r.pid),
      ...position_repairs.map((r) => r.pid)
    ])
  ].sort()
  const rows = await db('player')
    .whereIn('pid', pids)
    .select(
      'pid',
      'formatted_name',
      'primary_position',
      'secondary_position',
      'date_of_birth',
      'sleeper_player_id'
    )
    .orderBy('pid')
  for (const row of rows) {
    console.log(
      `${row.pid} | ${row.formatted_name} | ${row.primary_position}/${row.secondary_position} | dob ${row.date_of_birth} | sleeper ${row.sleeper_player_id}`
    )
  }

  await db.destroy()
  process.exit(0)
}

// Called bare: is_main compares process.argv[1] VERBATIM, so a relative-path
// invocation of a db/ script silently does nothing and exits 0.
main()
