import fs from 'fs'

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, updatePlayer } from '#libs-server'
import mergePlayer from '#libs-server/merge-player.mjs'
import { BIRTH_DATE_PLACEHOLDER } from '#libs-server/resolve-canonical-player.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('merge-split-identity-player-rows')
enable_debug_namespaces(
  'merge-split-identity-player-rows,merge-player,update-player,update-player-id'
)

/*
  Merges the two `player` rows a single person is split across, for the ids
  repair-missing-player-gsis-ids holds back as `review_duplicate_incumbents`.

  What the held-back class actually is. The feed carries a person's gsis, esb
  and pfr ids together, and for these ids the esb and pfr halves reach DIFFERENT
  `player` rows. That is decidable evidence about one person and it is
  independent of names: whoever this is, the table holds them twice, and
  attaching the gsis id to either half would deepen the split rather than close
  it. The classifier is right to refuse them -- attaching is not the repair
  available here, merging is.

  Why this is not collapse-duplicate-minted-player-rows. That script deletes a
  row it has proven NOTHING references, which is safe precisely because there is
  no data to lose. Here both halves carry real references -- gamelogs, injuries,
  contracts, prospect scores, practice rows -- so the fold has to REPOINT them,
  which is what mergePlayer's update_player_id does. A person's career is split
  across the two halves; this reunites it.

  The one operation here is irreversible, so every pair is gated on evidence
  before it runs and the whole plan is printed before any write.

  Default is a dry run. --apply is required to write anything.
*/

/*
  A pair is merged only if NOTHING in the evidence contradicts it. These are
  refusals, not confidence scores -- a pair that trips any of them is reported
  and left alone for a human, which is the same disposition the classifier took.
*/
const REFUSAL = {
  NOT_A_PAIR: 'not_a_pair',
  INCUMBENT_HOLDS_GSIS: 'incumbent_holds_gsis',
  SURNAME_DISAGREES: 'surname_disagrees',
  DRAFT_YEAR_GAP: 'draft_year_gap',
  BIRTH_DATE_GAP: 'birth_date_gap'
}

const MAX_DRAFT_YEAR_GAP = 1
const MAX_BIRTH_DATE_GAP_DAYS = 31

const is_real_birth_date = (value) =>
  Boolean(value) && String(value) !== BIRTH_DATE_PLACEHOLDER

/*
  Surname comparison, matching the classifier's forgiving form: `player` carries
  the generational suffix IN the surname where the feed keeps it separate, and
  either side may hold one half of a hyphenated name. This is a VETO on a match
  the identifiers already made, never the thing that makes one.
*/
const surname_key = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[ ,]+(jr|sr|ii|iii|iv|v)\.?\s*$/i, '')
    .replace(/[^a-z]/g, '')

const surnames_agree = (left, right) => {
  const a = surname_key(left)
  const b = surname_key(right)
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

const days_between = (left, right) =>
  Math.abs(new Date(left) - new Date(right)) / 86400000

/*
  Every table carrying a `pid` column, minus `player` itself. Enumerated at run
  time rather than listed, for the same reason
  collapse-duplicate-minted-player-rows enumerates it: a hand-written copy
  silently stops covering a table added later.
*/
const get_pid_referencing_tables = async () => {
  const { rows } = await db.raw(
    `SELECT table_name FROM information_schema.columns
     WHERE column_name = 'pid' AND table_schema = 'public' AND table_name <> 'player'
     ORDER BY 1`
  )
  return rows.map((row) => row.table_name)
}

const count_references = async ({ pids, tables }) => {
  const counts = new Map(pids.map((pid) => [pid, { total: 0, by_table: [] }]))
  for (const table of tables) {
    const { rows } = await db.raw(
      `SELECT pid, count(*) AS rows FROM "${table}"
       WHERE pid = ANY('{${pids.join(',')}}') GROUP BY 1`
    )
    for (const row of rows) {
      const entry = counts.get(row.pid)
      entry.total += Number(row.rows)
      entry.by_table.push({ table, rows: Number(row.rows) })
    }
  }
  return counts
}

const load_player_rows = async ({ pids }) => {
  const rows = await db('player').whereIn('pid', pids)
  return new Map(rows.map((row) => [row.pid, row]))
}

/*
  Which half survives is a question about churn, not about identity. A pid is an
  opaque immutable serial (generate-player-id.mjs), so neither half is more
  canonical than the other and the merged row inherits both halves' values
  either way. Keeping the more-referenced half simply repoints fewer rows.
*/
const choose_survivor = ({ rows, references }) => {
  const [left, right] = rows
  const left_total = references.get(left.pid).total
  const right_total = references.get(right.pid).total
  if (left_total !== right_total) {
    return left_total > right_total ? [left, right] : [right, left]
  }
  return left.pid < right.pid ? [left, right] : [right, left]
}

const evaluate_pair = ({ disposition, rows, references }) => {
  const plan = {
    gsis_player_id: disposition.gsis_player_id,
    ledger_names: disposition.ledger_names,
    graded_stat_rows: Number(disposition.graded_stat_rows || 0),
    source_record: disposition.source_record,
    pids: disposition.incumbents.map((row) => row.incumbent_pid)
  }

  if (disposition.incumbents.length !== 2 || rows.length !== 2) {
    return { ...plan, refusal: REFUSAL.NOT_A_PAIR }
  }

  const holds_gsis = rows.filter((row) => row.gsis_player_id)
  if (holds_gsis.length) {
    // The father/son class: two rows each holding their OWN gsis id are two
    // people, and one of them is holding an external id that belongs to the
    // other. That is an id swap, not a merge, and it is not this script's.
    return {
      ...plan,
      refusal: REFUSAL.INCUMBENT_HOLDS_GSIS,
      detail: holds_gsis
        .map((row) => `${row.pid}=${row.gsis_player_id}`)
        .join(', ')
    }
  }

  const [left, right] = rows
  if (!surnames_agree(left.last_name, right.last_name)) {
    return {
      ...plan,
      refusal: REFUSAL.SURNAME_DISAGREES,
      detail: `${left.last_name} against ${right.last_name}`
    }
  }

  if (left.nfl_draft_year && right.nfl_draft_year) {
    const gap = Math.abs(left.nfl_draft_year - right.nfl_draft_year)
    if (gap > MAX_DRAFT_YEAR_GAP) {
      return {
        ...plan,
        refusal: REFUSAL.DRAFT_YEAR_GAP,
        detail: `${left.nfl_draft_year} against ${right.nfl_draft_year}`
      }
    }
  }

  /*
    Vacuous for the population this was written for and deliberately kept
    anyway. In every one of the ten held-back pairs exactly one half carries the
    `0000-00-00` sentinel, so there is no second real date to compare against
    and the gate cannot fire. It is here for the pairs where both halves DO
    carry a real date, which is the case where two rows a surname and an era
    apart would otherwise merge unchallenged.
  */
  if (
    is_real_birth_date(left.date_of_birth) &&
    is_real_birth_date(right.date_of_birth)
  ) {
    const gap = days_between(left.date_of_birth, right.date_of_birth)
    if (gap > MAX_BIRTH_DATE_GAP_DAYS) {
      return {
        ...plan,
        refusal: REFUSAL.BIRTH_DATE_GAP,
        detail: `${left.date_of_birth} against ${right.date_of_birth} (${Math.round(gap)} days)`
      }
    }
  }

  const [survivor, folded] = choose_survivor({ rows, references })
  return {
    ...plan,
    survivor_pid: survivor.pid,
    folded_pid: folded.pid,
    survivor_references: references.get(survivor.pid).total,
    folded_references: references.get(folded.pid).total,
    folded_reference_tables: references.get(folded.pid).by_table,
    survivor_row: survivor,
    folded_row: folded
  }
}

/*
  The identifiers the feed carries but neither half held. The merge itself moves
  whatever each half already had; this closes the gap that made the id missing
  in the first place, which is the whole point of the repair.
*/
const build_identifier_update = ({ plan }) => {
  const source = plan.source_record
  const merged = { ...plan.folded_row, ...plan.survivor_row }
  const update = { gsis_player_id: plan.gsis_player_id }

  const columns = {
    esb_player_id: source.esb_id,
    pfr_player_id: source.pfr_id,
    smart_player_id: source.smart_id,
    gsis_it_player_id: source.gsis_it_id
  }
  for (const [column, value] of Object.entries(columns)) {
    if (value && !merged[column]) update[column] = value
  }

  return update
}

const describe_plan = (plan) => {
  const source = plan.source_record
  log(
    `${plan.gsis_player_id} ${source.first_name} ${source.last_name} (${source.position}, ${source.college}) — ${plan.graded_stat_rows} graded stat rows, ledger names ${plan.ledger_names.join('/')}`
  )
  if (plan.refusal) {
    log(`  REFUSED ${plan.refusal}${plan.detail ? ` — ${plan.detail}` : ''}`)
    return
  }
  log(
    `  keep ${plan.survivor_pid} (${plan.survivor_references} refs, dob ${plan.survivor_row.date_of_birth}, esb ${plan.survivor_row.esb_player_id || '-'}, pfr ${plan.survivor_row.pfr_player_id || '-'})`
  )
  log(
    `  fold ${plan.folded_pid} (${plan.folded_references} refs, dob ${plan.folded_row.date_of_birth}, esb ${plan.folded_row.esb_player_id || '-'}, pfr ${plan.folded_row.pfr_player_id || '-'})`
  )
  if (plan.folded_reference_tables.length) {
    log(
      `  repointing ${plan.folded_reference_tables.map((r) => `${r.table}(${r.rows})`).join(', ')}`
    )
  }
}

/*
  Read back what the merge actually produced, rather than trusting that it did
  what it was asked. The sentinel assertion is the one that matters: it is the
  value this whole repair class is forbidden to write, and until
  merge-player.mjs was fixed the merge could produce it from two rows where
  neither half was wrong.
*/
const verify_merged_rows = async ({ plans }) => {
  const failures = []
  for (const plan of plans) {
    const [row] = await db('player').where('pid', plan.survivor_pid)
    if (!row) {
      failures.push(`${plan.survivor_pid} is gone after its own merge`)
      continue
    }
    if (row.gsis_player_id !== plan.gsis_player_id) {
      failures.push(
        `${plan.survivor_pid} holds gsis ${row.gsis_player_id}, expected ${plan.gsis_player_id}`
      )
    }
    if (!is_real_birth_date(row.date_of_birth)) {
      failures.push(
        `${plan.survivor_pid} carries birth date ${row.date_of_birth}`
      )
    }
    const [folded] = await db('player').where('pid', plan.folded_pid)
    if (folded) failures.push(`${plan.folded_pid} survived its own fold`)
  }
  return failures
}

const merge_split_identity_player_rows = async ({
  dispositions_path,
  apply = false
}) => {
  const dry_run = !apply
  log(dry_run ? 'DRY RUN — nothing will be written' : 'APPLYING writes')

  const dispositions = JSON.parse(fs.readFileSync(dispositions_path, 'utf8'))
  const held = dispositions.filter(
    (row) => row.disposition === 'review_duplicate_incumbents'
  )
  log(`${held.length} ids held back as review_duplicate_incumbents`)
  if (!held.length) return { merged: 0, refused: 0 }

  const pids = held.flatMap((row) =>
    row.incumbents.map((incumbent) => incumbent.incumbent_pid)
  )
  const player_rows = await load_player_rows({ pids })
  const tables = await get_pid_referencing_tables()
  log(`counting references across ${tables.length} pid-carrying tables`)
  const references = await count_references({ pids, tables })

  const plans = held.map((disposition) =>
    evaluate_pair({
      disposition,
      rows: disposition.incumbents
        .map((incumbent) => player_rows.get(incumbent.incumbent_pid))
        .filter(Boolean),
      references
    })
  )

  for (const plan of plans) describe_plan(plan)

  const mergeable = plans.filter((plan) => !plan.refusal)
  const refused = plans.filter((plan) => plan.refusal)
  log(`${mergeable.length} mergeable, ${refused.length} refused`)

  const stats = { merged: 0, refused: refused.length }
  if (dry_run) {
    log('dry run — stopping before any write')
    return { ...stats, merged: mergeable.length, would_merge: mergeable.length }
  }

  for (const plan of mergeable) {
    await mergePlayer({
      update_player_row: plan.survivor_row,
      remove_player_row: plan.folded_row
    })
    await updatePlayer({
      pid: plan.survivor_pid,
      update: build_identifier_update({ plan }),
      allow_protected_props: true,
      source: 'merge-split-identity-player-rows',
      reason: `identity repair: merged split rows ${plan.survivor_pid} and ${plan.folded_pid} for gsis id ${plan.gsis_player_id}, decided on the feed's esb and pfr ids reaching both halves`
    })
    stats.merged += 1
  }

  const failures = await verify_merged_rows({ plans: mergeable })
  if (failures.length) {
    for (const failure of failures) log(`POST-MERGE FAILURE — ${failure}`)
    throw new Error(`${failures.length} merged rows failed verification`)
  }
  log(`post-merge verification passed for ${mergeable.length} rows`)

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
      .option('apply', {
        type: 'boolean',
        default: false,
        describe: 'perform the merges; omit for a dry run'
      }).argv

    await merge_split_identity_player_rows({
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

export default merge_split_identity_player_rows
export { evaluate_pair, surnames_agree, REFUSAL }
