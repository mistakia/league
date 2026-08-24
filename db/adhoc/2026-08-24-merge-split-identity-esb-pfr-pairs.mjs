/*
  Eleven people who occupy two `player` rows each, where one row holds the
  `esb_player_id` and the other holds the `pfr_player_id`.

  ## The population, re-measured against production 2026-08-24

  Pairs of rows whose names match (on `formatted_name`, or on first and last
  name separately), where one row holds an esb id and NO pfr id and the other
  holds a pfr id and NO esb id:

    158  pairs in total
     11  both halves carry a real birth date and the two agree within 31 days
     62  both halves carry a real birth date and the two are further apart
     85  at least one half carries no birth date at all

  The 11 are this script. The 62 are different people -- a name collision is
  exactly what a namesake is -- and the 85 are the population that produced both
  prior incidents; neither is touched here.

  ## Why these eleven are one person each and not two

  Four independent lines agree on every pair, and no line dissents on any:

  - BIRTH DATE. The two halves land within 13 days of each other, which is
    source jitter between the NFL's own feed and pro-football-reference, not the
    decades a namesake pair sits apart.
  - IDENTIFIERS DO NOT COLLIDE. Across all eleven pairs and all 26 external id
    columns there is not ONE column where both halves hold a different value.
    The halves are complementary, which is what a split looks like; two people
    conflated into a shared shape would collide somewhere.
  - PRO-FOOTBALL-REFERENCE. Every pfr id was fetched and its page's birth date,
    college and draft slot were checked against BOTH halves. All eleven match,
    including the four draft slots the two halves independently agree on
    (Lofton 37th, Phillips 137th, Johnson 96th, Wilson 14th).
  - GAMELOG SEASONS. No pair holds two disjoint careers. Where both halves carry
    gamelogs the seasons are contiguous rather than an era apart -- Landon
    Johnson's 2004-2008 against 2009-2010 is one career cut in half, which is
    the failure being repaired.

  ## The contested fields, and why the merge cannot be left to decide them

  `merge_player_row_fields` breaks a two-value tie by longest string and largest
  number, and on a tie of EQUAL length it keeps the folded row's value. That is
  a shape rule. It decides four things wrongly here:

    primary_position    "CB" against "DB", "DE" against "LB"   -- equal length
    date_of_birth       two real dates                         -- equal length
    current_nfl_team    "PIT" against "INA"                    -- equal length
    nfl_draft_year      2009 against 2010                      -- largest wins

  So every contested field is written explicitly after the merge, under one
  rule: THE ESB HALF WINS. That half is the one carrying the gsis identity, the
  graded stat history, and a coherent roster_status/current_nfl_team pair (`CUT`
  by a named team, where the pfr half holds an empty status and `INA`). Splitting
  the difference per column would leave those two fields contradicting each
  other.

  The draft years are the case where the rule is not merely tidy. All four
  contested pairs are the esb half one year EARLIER, and Jason Phillips settles
  which reading is right: pro-football-reference has him drafted in the 5th round
  of the 2009 draft, the esb half says 2009 and the pfr half says 2010. The pfr
  half's value tracks a first season, not a draft class, and largest-number would
  take it every time.

  Two contested columns are deliberately NOT written:

  - `weight_pounds` (differs by 2-6 lb on six pairs) is combine-protected in
    updatePlayer, so a write from a non-combine source is skipped anyway. The
    merge's larger-number pick stands and the difference is immaterial.
  - `pfr_years_as_primary_starter` and the two `pfr_weighted_career_approximate_value`
    columns are not contested at all: the esb half holds 0, which the merge
    treats as absent, so the pfr half's real career value lands correctly.

  ## Which pid survives

  Whichever half more rows already point at, computed at run time. A pid is an
  opaque immutable serial that encodes no identity, so surviving the
  better-referenced half simply repoints fewer rows. On three pairs (Spann,
  Hazel, Cole) that is the PFR half despite the esb half holding the gsis id;
  the merge carries the identifiers across either way.

  Default is a dry run. --apply is required to write anything.
*/

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { updatePlayer } from '#libs-server'
import mergePlayer from '#libs-server/merge-player.mjs'
import {
  build_conflict_predicates,
  get_unique_key_columns
} from '#libs-server/update-player-id.mjs'
import { BIRTH_DATE_PLACEHOLDER } from '#libs-server/resolve-canonical-player.mjs'

const SOURCE = 'adhoc/2026-08-24-merge-split-identity-esb-pfr-pairs'

/*
  The preconditions, one per pair. Written out rather than re-derived so that a
  row which has MOVED since the survey -- picked up a gsis id, lost an esb id,
  been merged by a sibling session -- is skipped rather than written. Every
  value below was read from production on 2026-08-24.
*/
const PAIRS = [
  {
    name: 'Chad Spann',
    esb_pid: 'CHAD-SPAN-002148',
    pfr_pid: 'CHAD-SPAN-006844',
    esb_player_id: 'SPA466616',
    gsis_player_id: '00-0028656',
    pfr_player_id: 'SpanCh00',
    esb_dob: '1988-08-04',
    pfr_dob: '1988-08-08',
    evidence:
      'pro-football-reference SpanCh00: born 1988-08-08, Northern Illinois, RB'
  },
  {
    name: 'Cornelius Anthony',
    esb_pid: 'CORN-ANTH-001279',
    pfr_pid: 'CORN-ANTH-019829',
    esb_player_id: 'ANT109929',
    gsis_player_id: '00-0019897',
    pfr_player_id: 'AnthCo20',
    esb_dob: '1978-07-03',
    pfr_dob: '1978-07-07',
    evidence:
      'pro-football-reference AnthCo20: born 1978-07-07, Texas A&M, LB, undrafted'
  },
  {
    name: 'Curtis Lofton',
    esb_pid: 'CURT-LOFT-011895',
    pfr_pid: 'CURT-LOFT-003822',
    esb_player_id: 'LOF267017',
    gsis_player_id: '00-0026177',
    pfr_player_id: 'LoftCu99',
    esb_dob: '1986-06-09',
    pfr_dob: '1986-06-02',
    evidence:
      'pro-football-reference LoftCu99: born 1986-06-02, Oklahoma, 2008 round 2, 37th overall -- the 37th matches both halves'
  },
  {
    name: 'Jason Phillips',
    esb_pid: 'JASO-PHIL-002567',
    pfr_pid: 'JASO-PHIL-004707',
    esb_player_id: 'PHI282255',
    gsis_player_id: '00-0026911',
    pfr_player_id: 'PhilJa99',
    esb_dob: '1986-02-14',
    pfr_dob: '1986-02-14',
    evidence:
      'pro-football-reference PhilJa99: born 1986-02-14 (identical on both halves), TCU, 2009 round 5, 137th overall -- the 137th matches both halves'
  },
  {
    name: 'Jonathan Stupar',
    esb_pid: 'JONA-STUP-002028',
    pfr_pid: 'JONA-STUP-010463',
    esb_player_id: 'STU615594',
    gsis_player_id: '00-0025864',
    pfr_player_id: 'StupJo00',
    esb_dob: '1984-07-24',
    pfr_dob: '1984-07-27',
    evidence:
      'pro-football-reference StupJo00: born 1984-07-27, Virginia, TE, undrafted'
  },
  {
    name: 'Jon Corto',
    esb_pid: 'JONX-CORT-002018',
    pfr_pid: 'JONX-CORT-018897',
    esb_player_id: 'COR782664',
    gsis_player_id: '00-0025764',
    pfr_player_id: 'CortJo20',
    esb_dob: '1984-09-03',
    pfr_dob: '1984-09-13',
    evidence:
      'pro-football-reference CortJo20: born 1984-09-13, Sacred Heart, DB, undrafted'
  },
  {
    name: 'Landon Johnson',
    esb_pid: 'LAND-JOHN-007771',
    pfr_pid: 'LAND-JOHN-018873',
    esb_player_id: 'JOH399476',
    gsis_player_id: '00-0022860',
    pfr_player_id: 'JohnLa20',
    esb_dob: '1981-03-13',
    pfr_dob: '1981-03-12',
    evidence:
      'pro-football-reference JohnLa20: born 1981-03-12, Purdue, 2004 round 3, 96th overall -- the 96th matches both halves, and the halves hold 2004-2008 and 2009-2010 gamelogs of one career'
  },
  {
    name: 'Marquice Cole',
    esb_pid: 'MARQ-COLE-002052',
    pfr_pid: 'MARQ-COLE-022509',
    esb_player_id: 'COL148683',
    gsis_player_id: '00-0024588',
    pfr_player_id: 'ColeMa01',
    esb_dob: '1983-11-01',
    pfr_dob: '1983-11-13',
    evidence:
      'pro-football-reference ColeMa01: born 1983-11-13, Northwestern, DB, undrafted'
  },
  {
    name: 'Paul Hazel',
    esb_pid: 'PAUL-HAZE-002211',
    pfr_pid: 'PAUL-HAZE-022861',
    esb_player_id: 'HAZ159741',
    gsis_player_id: '00-0029945',
    pfr_player_id: 'HazePa00',
    esb_dob: '1990-05-04',
    pfr_dob: '1990-05-09',
    evidence:
      'pro-football-reference HazePa00: born 1990-05-09, Western Michigan, LB, undrafted'
  },
  {
    name: 'Reinard Wilson',
    esb_pid: 'REIN-WILS-001110',
    pfr_pid: 'REIN-WILS-019216',
    esb_player_id: 'WIL718897',
    gsis_player_id: '00-0018054',
    pfr_player_id: 'WilsRe20',
    esb_dob: '1973-12-14',
    pfr_dob: '1973-12-17',
    evidence:
      'pro-football-reference WilsRe20: born 1973-12-17, Florida State, 1997 round 1, 14th overall -- the 14th is on the pfr half and the esb half is the same 1997 Florida State edge rusher'
  },
  {
    name: 'Terrence Edwards',
    esb_pid: 'TERR-EDWA-001465',
    pfr_pid: 'TERR-EDWA-023910',
    esb_player_id: 'EDW697776',
    gsis_player_id: '00-0021437',
    pfr_player_id: 'EdwaTe00',
    esb_dob: '1979-04-20',
    pfr_dob: '1979-04-29',
    evidence:
      'pro-football-reference EdwaTe00: born 1979-04-29, Georgia, WR, undrafted'
  }
]

/*
  Combine-protected in updatePlayer, so an explicit write from this source would
  be silently skipped. Named here so the plan reports what it is NOT doing
  rather than printing a write that never happens.
*/
const COMBINE_PROTECTED = ['height_inches', 'weight_pounds']

// The DB trigger owns it; nothing here writes it.
const TRIGGER_OWNED = ['name_search_vector']

// Same emptiness rule merge_player_row_fields applies. It has to be the same
// one: a column the merge considered empty must not then be adjudicated as
// though it held a value.
const is_absent = (value) => !value || value === BIRTH_DATE_PLACEHOLDER

/*
  Every column that points at a player, enumerated at run time and matching the
  set `update_player_id` itself repoints -- the same `LIKE '%_pid' OR = 'pid'`
  predicate, so the audit cannot be counting a narrower set than the merge moves.
  Views are excluded: they carry the column but hold no rows of their own, and
  counting them would double every underlying table.
*/
const get_pid_columns = async () => {
  const { rows } = await db.raw(
    `SELECT c.table_name, c.column_name
     FROM information_schema.columns c
     JOIN information_schema.tables t
       ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE (c.column_name LIKE '%_pid' OR c.column_name = 'pid')
       AND c.table_schema = current_schema()
       AND t.table_type = 'BASE TABLE'
       AND c.table_name <> 'player'
     GROUP BY 1, 2
     ORDER BY 1, 2`
  )
  return rows
}

const reference_key = ({ table_name, column_name }) =>
  `${table_name}.${column_name}`

const count_references = async ({ pids, pid_columns }) => {
  const counts = new Map(pids.map((pid) => [pid, { total: 0, by_column: [] }]))
  for (const pid_column of pid_columns) {
    const rows = await db(pid_column.table_name)
      .whereIn(pid_column.column_name, pids)
      .select(`${pid_column.column_name} as pid`)
      .count('* as rows')
      .groupBy(pid_column.column_name)
    for (const row of rows) {
      const entry = counts.get(row.pid)
      entry.total += Number(row.rows)
      entry.by_column.push({
        key: reference_key(pid_column),
        pid_column,
        rows: Number(row.rows)
      })
    }
  }
  return counts
}

/*
  How many of the folded pid's rows the repoint will REFUSE to move and then
  delete, per column, computed with the repoint's own rule.

  `update_player_id` repoints a row unless a unique key covering the pid column
  already holds an equivalent row under the survivor, and deletes whatever it
  could not move -- correct, because the survivor already has that row, but it
  means a merge does NOT conserve raw reference counts. Counting the blocked
  rows in advance is what turns "the sum did not match" from an unexplained
  discrepancy into a number that was predicted before the write.
*/
const count_blocked_rows = async ({ pid_column, current_pid, new_pid }) => {
  const { table_name, column_name } = pid_column
  const key_sets = await get_unique_key_columns({ table_name, column_name })
  if (!key_sets.length) return 0

  const predicates = build_conflict_predicates({
    table_name,
    column_name,
    key_sets
  })
  const { rows } = await db.raw(
    `SELECT count(*) AS count FROM "${table_name}" t
     WHERE t."${column_name}" = ? AND NOT (${predicates.join(' AND ')})`,
    [current_pid, ...predicates.map(() => new_pid)]
  )
  return Number(rows[0].count)
}

const assert_row = ({ row, pid, expected }) => {
  for (const [column, value] of Object.entries(expected)) {
    if (String(row[column] ?? '') !== String(value ?? '')) {
      throw new Error(
        `${pid}.${column} expected ${JSON.stringify(value)}, found ${JSON.stringify(row[column])}`
      )
    }
  }
}

/*
  Every column both halves hold a differing real value in. The esb half's value
  is the verdict; see the header for why.
*/
const contested_columns = ({ esb_row, pfr_row }) => {
  const contested = []
  for (const column of Object.keys(esb_row)) {
    if (column === 'pid') continue
    if (TRIGGER_OWNED.includes(column)) continue
    const esb_value = esb_row[column]
    const pfr_value = pfr_row[column]
    if (is_absent(esb_value) || is_absent(pfr_value)) continue
    if (String(esb_value) === String(pfr_value)) continue
    contested.push({
      column,
      esb_value,
      pfr_value,
      skipped: COMBINE_PROTECTED.includes(column)
    })
  }
  return contested
}

const build_plan = async ({ pair, references }) => {
  const esb_row = await db('player').where({ pid: pair.esb_pid }).first()
  const pfr_row = await db('player').where({ pid: pair.pfr_pid }).first()

  if (!esb_row || !pfr_row) {
    return { pair, skip: 'one or both rows are already gone' }
  }

  try {
    assert_row({
      row: esb_row,
      pid: pair.esb_pid,
      expected: {
        esb_player_id: pair.esb_player_id,
        gsis_player_id: pair.gsis_player_id,
        date_of_birth: pair.esb_dob,
        pfr_player_id: ''
      }
    })
    assert_row({
      row: pfr_row,
      pid: pair.pfr_pid,
      expected: {
        pfr_player_id: pair.pfr_player_id,
        date_of_birth: pair.pfr_dob,
        esb_player_id: '',
        gsis_player_id: ''
      }
    })
  } catch (err) {
    return {
      pair,
      skip: `the adjudication no longer describes this pair -- ${err.message}`
    }
  }

  const esb_references = references.get(pair.esb_pid)
  const pfr_references = references.get(pair.pfr_pid)
  const esb_survives = esb_references.total >= pfr_references.total
  const survivor_row = esb_survives ? esb_row : pfr_row
  const folded_row = esb_survives ? pfr_row : esb_row
  const folded_references = esb_survives ? pfr_references : esb_references

  const blocked = []
  for (const entry of folded_references.by_column) {
    const rows = await count_blocked_rows({
      pid_column: entry.pid_column,
      current_pid: folded_row.pid,
      new_pid: survivor_row.pid
    })
    if (rows) blocked.push({ key: entry.key, rows })
  }

  return {
    pair,
    esb_row,
    pfr_row,
    survivor_row,
    folded_row,
    before_references: {
      [pair.esb_pid]: esb_references,
      [pair.pfr_pid]: pfr_references
    },
    blocked,
    contested: contested_columns({ esb_row, pfr_row })
  }
}

const describe_plan = (plan) => {
  const { pair } = plan
  console.log(`\n${pair.name} — ${pair.gsis_player_id} / ${pair.pfr_player_id}`)
  if (plan.skip) {
    console.log(`  SKIPPED: ${plan.skip}`)
    return
  }
  const survivor_references =
    plan.before_references[plan.survivor_row.pid].total
  const folded = plan.before_references[plan.folded_row.pid]
  console.log(`  keep ${plan.survivor_row.pid} (${survivor_references} refs)`)
  console.log(`  fold ${plan.folded_row.pid} (${folded.total} refs)`)
  if (folded.by_column.length) {
    console.log(
      `  repointing ${folded.by_column.map((entry) => `${entry.key}(${entry.rows})`).join(', ')}`
    )
  }
  for (const entry of plan.blocked) {
    console.log(
      `  DROPPED as duplicate ${entry.key}(${entry.rows}) — a unique key already holds the equivalent row under the survivor`
    )
  }
  for (const entry of plan.contested) {
    console.log(
      `  ${entry.skipped ? 'NOT WRITTEN (combine-protected)' : 'write'} ${entry.column} = ${JSON.stringify(entry.esb_value)} (pfr half holds ${JSON.stringify(entry.pfr_value)})`
    )
  }
  console.log(`  evidence: ${pair.evidence}`)
}

/*
  The audit, run against what the database actually holds afterwards rather than
  against what the merge believed it was doing. Three invariants, each failing in
  a different direction:

  - UNION OF VALUES. For every column either half held a value in, the survivor
    must still hold one of those two values -- not an absence, and not a third
    value the merge invented. This is what catches a real value losing a
    tie-break to a sentinel.
  - REFERENCE CONSERVATION. Per table, every row that pointed at either half must
    now point at the survivor. `player_changelog` may GROW, because the merge and
    the explicit writes both record there; every other table must land on the
    exact sum.
  - NO SURVIVING FOLD. The folded pid must be gone from `player` and referenced
    by nothing.

  Plus the two things this repair specifically asserts: the survivor holds every
  identifier both halves held, and every contested column holds the adjudicated
  value.
*/
const audit = async ({ plans, pid_columns }) => {
  const failures = []

  for (const plan of plans) {
    const { pair } = plan
    const survivor = await db('player')
      .where({ pid: plan.survivor_row.pid })
      .first()
    if (!survivor) {
      failures.push(`${plan.survivor_row.pid} is gone after its own merge`)
      continue
    }

    const adjudicated = new Set(
      plan.contested
        .filter((entry) => !entry.skipped)
        .map((entry) => entry.column)
    )

    for (const column of Object.keys(plan.survivor_row)) {
      if (column === 'pid' || TRIGGER_OWNED.includes(column)) continue
      const candidates = [plan.esb_row[column], plan.pfr_row[column]].filter(
        (value) => !is_absent(value)
      )
      if (!candidates.length) continue

      const after = survivor[column]
      if (is_absent(after)) {
        failures.push(
          `${survivor.pid}.${column} lost its value — held ${JSON.stringify(candidates)}, now ${JSON.stringify(after)}`
        )
        continue
      }
      if (!candidates.some((value) => String(value) === String(after))) {
        failures.push(
          `${survivor.pid}.${column} holds ${JSON.stringify(after)}, which neither half held (${JSON.stringify(candidates)})`
        )
      }
      if (
        adjudicated.has(column) &&
        String(after) !== String(plan.esb_row[column])
      ) {
        failures.push(
          `${survivor.pid}.${column} holds ${JSON.stringify(after)}, but the adjudicated value is ${JSON.stringify(plan.esb_row[column])}`
        )
      }
    }

    for (const [column, expected] of [
      ['gsis_player_id', pair.gsis_player_id],
      ['esb_player_id', pair.esb_player_id],
      ['pfr_player_id', pair.pfr_player_id]
    ]) {
      if (survivor[column] !== expected) {
        failures.push(
          `${survivor.pid}.${column} holds ${JSON.stringify(survivor[column])}, expected ${JSON.stringify(expected)}`
        )
      }
    }

    const folded = await db('player')
      .where({ pid: plan.folded_row.pid })
      .first()
    if (folded) failures.push(`${plan.folded_row.pid} survived its own fold`)
  }

  const pids = plans.flatMap((plan) => [
    plan.survivor_row.pid,
    plan.folded_row.pid
  ])
  const after_references = await count_references({ pids, pid_columns })

  for (const plan of plans) {
    const orphaned = after_references.get(plan.folded_row.pid)
    if (orphaned.total > 0) {
      failures.push(
        `${plan.folded_row.pid} is still referenced by ${orphaned.by_column.map((entry) => `${entry.key}(${entry.rows})`).join(', ')}`
      )
    }

    const expected = new Map()
    for (const before of Object.values(plan.before_references)) {
      for (const entry of before.by_column) {
        expected.set(entry.key, (expected.get(entry.key) || 0) + entry.rows)
      }
    }
    // The rows a unique key refused to move, counted before the write. Without
    // subtracting exactly these, the expectation is wrong by a number nobody
    // predicted, and a real loss would hide behind the same discrepancy.
    for (const entry of plan.blocked) {
      expected.set(entry.key, expected.get(entry.key) - entry.rows)
    }
    const landed = new Map(
      after_references
        .get(plan.survivor_row.pid)
        .by_column.map((entry) => [entry.key, entry.rows])
    )

    for (const [key, rows] of expected) {
      const found = landed.get(key) || 0
      // The merge and the contested-field write both record here, so this one
      // may grow.
      if (key === 'player_changelog.pid') {
        if (found < rows) {
          failures.push(
            `${plan.survivor_row.pid} lost changelog rows: ${rows} before, ${found} after`
          )
        }
        continue
      }
      if (found !== rows) {
        failures.push(
          `${plan.survivor_row.pid} reference count changed in ${key}: expected ${rows}, found ${found}`
        )
      }
    }
  }

  return failures
}

const main = async () => {
  const argv = yargs(hideBin(process.argv)).option('apply', {
    type: 'boolean',
    default: false,
    describe: 'perform the merges; omit for a dry run'
  }).argv

  const pid_columns = await get_pid_columns()
  console.log(
    `counting references across ${pid_columns.length} pid-carrying columns`
  )

  const pids = PAIRS.flatMap((pair) => [pair.esb_pid, pair.pfr_pid])
  const references = await count_references({ pids, pid_columns })

  const plans = []
  for (const pair of PAIRS) {
    plans.push(await build_plan({ pair, references }))
  }
  for (const plan of plans) describe_plan(plan)

  const mergeable = plans.filter((plan) => !plan.skip)
  console.log(
    `\n${mergeable.length} mergeable, ${plans.length - mergeable.length} skipped`
  )

  if (!argv.apply) {
    console.log('DRY RUN — nothing written. Pass --apply to write.')
    await db.destroy()
    process.exit(0)
  }

  for (const plan of mergeable) {
    const { pair } = plan
    const reason = `identity repair: ${pair.esb_pid} and ${pair.pfr_pid} are one person, ${pair.name} — the halves hold complementary identifiers with no collision in any of the 26 external id columns, birth dates agreeing within days, and ${pair.evidence}`

    await mergePlayer({
      update_player_row: plan.survivor_row,
      remove_player_row: plan.folded_row
    })
    console.log(`merged ${plan.folded_row.pid} into ${plan.survivor_row.pid}`)

    const update = {}
    for (const entry of plan.contested) {
      if (entry.skipped) continue
      update[entry.column] = entry.esb_value
    }
    if (Object.keys(update).length) {
      const changes = await updatePlayer({
        pid: plan.survivor_row.pid,
        update,
        // No contested column is a protected external id -- the halves do not
        // collide on any of them -- so only the primary_position opt-in is needed.
        allow_primary_position_write: true,
        source: SOURCE,
        reason
      })
      console.log(
        `  ${changes} contested field(s) written on ${plan.survivor_row.pid}`
      )
    }
  }

  const failures = await audit({ plans: mergeable, pid_columns })
  if (failures.length) {
    for (const failure of failures) console.log(`AUDIT FAILURE — ${failure}`)
    throw new Error(`${failures.length} audit failures`)
  }
  console.log(
    `\naudit passed for ${mergeable.length} merges — no column lost a value, every reference repointed, every contested field holds its adjudicated value`
  )

  await db.destroy()
  process.exit(0)
}

main().catch(async (err) => {
  console.error(err.message)
  await db.destroy()
  process.exit(1)
})
