import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main } from '#libs-server'
import mergePlayer from '#libs-server/merge-player.mjs'
import { is_real_birth_date } from '#libs-server/player-birth-date.mjs'
import { find_duplicate_person_row_pairs } from '#libs-server/duplicate-person-row-pairs.mjs'
import {
  get_pid_referencing_tables,
  count_references,
  choose_survivor_by_reference_count
} from '#libs-server/player-pid-references.mjs'
import { audit_player_row_merges } from '#libs-server/audit-player-row-merge.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('merge-duplicate-person-rows')
enable_debug_namespaces(
  'merge-duplicate-person-rows,merge-player,update-player,update-player-id'
)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PARKED_PATH = path.join(__dirname, '..', 'db', 'checks', 'parked.json')
const CHECK_ID = 'duplicate-person-rows'

/*
  Closes the `duplicate-person-rows` check: one person occupying both a legacy
  row carrying their real biography and a newer row carrying their external
  identifiers and the `0000-00-00` birth-date sentinel.

  How the split happens. The legacy row is the older of the two -- these carry a
  `player_changelog` entry renaming a short pid (`MS-5820`) to the current form
  in March 2023, and hold a real date of birth, college and draft year but no
  external identifier. The identified row was minted LATER by an importer
  carrying gsis and esb ids and NGS prospect scores but no birth date, which
  could not match the row already sitting there and created a second one beside
  it.

  Why this is not merge-split-identity-player-rows. That script repairs pairs
  where NEITHER half holds a gsis id and the feed carries one reaching both, so
  it refuses outright when an incumbent holds one -- which is every pair here,
  by construction. The two classes share their mechanics and nothing else: the
  fold, the survivor choice and the no-data-loss audit are the same primitives,
  and both live in libs-server so neither script owns them.

  Why this is not a sixth dated dedupe round. The class RECURS BY CONSTRUCTION
  and the check that grades it says so: repairing corrupt birth dates in one
  round makes further pairs agree on a date they had never agreed on, so each
  one-shot repair mints the next round's findings. This is re-runnable, reads
  the same predicate the check reads, and respects the same parked file.

  The one operation here is irreversible, so every pair is gated on evidence
  before it runs and the whole plan is printed before any write.

  Default is a dry run. --apply is required to write anything.
*/

/*
  A pair is merged only if NOTHING in the evidence contradicts it. These are
  refusals, not confidence scores -- a pair that trips any of them is reported
  and left alone for a human, which is the disposition the check prescribes.
*/
const REFUSAL = {
  NOT_ONE_TWIN: 'not_one_twin',
  TWIN_HOLDS_REAL_BIRTH_DATE: 'twin_holds_real_birth_date',
  SHELL_BIRTH_DATE_UNKNOWN: 'shell_birth_date_unknown',
  DRAFT_YEAR_GAP: 'draft_year_gap'
}

const MAX_DRAFT_YEAR_GAP = 1

/**
 * The pids parked in db/checks/parked.json as adjudicated non-duplicates.
 *
 * Read from the same file the check runner suppresses on, so a pair a human
 * ruled on cannot be re-proposed here. Most findings in this class are NOT
 * duplicates -- fathers, sons and namesakes sit in the same predicate -- and
 * the parked file is where that adjudication lives.
 *
 * @param {{ read_file?: (file_path: string) => string }} [params]
 * @returns {Set<string>}
 */
export const load_parked_shell_pids = ({
  read_file = (file_path) => fs.readFileSync(file_path, 'utf8')
} = {}) =>
  new Set(
    JSON.parse(read_file(PARKED_PATH))
      .filter((row) => row.check_id === CHECK_ID)
      .map((row) => row.grain.pid)
  )

/**
 * Decide one shell against the twins sharing its name.
 *
 * @param {{ shell_pid: string, pairs: Array<Record<string, any>>, rows: Map<string, Record<string, any>>, references: Map<string, any> }} params
 * @returns {Record<string, any>}
 */
export const evaluate_shell = ({ shell_pid, pairs, rows, references }) => {
  const plan = {
    shell_pid,
    formatted_name: pairs[0].formatted_name,
    twin_pids: pairs.map((pair) => pair.twin_pid)
  }

  /*
    Two rows both qualifying as the twin means the name is shared by at least
    three rows, and picking one would be a guess about which person the shell
    is. The check reports the shell once however many twins it has, so this is
    reachable from real data rather than defensive.
  */
  if (pairs.length !== 1) {
    return { ...plan, refusal: REFUSAL.NOT_ONE_TWIN }
  }

  const [pair] = pairs
  const shell_row = rows.get(shell_pid)
  const twin_row = rows.get(pair.twin_pid)

  /*
    THE discriminating gate, and the reason this class can be repaired at all.

    A twin carrying a REAL birth date is the father/son and namesake class: the
    two rows are different people whose dates sit an era apart, and merging them
    would fuse a father into his son. Of the 43 pairs standing when this was
    written, 17 were exactly that and are parked. The remaining 26 all carry the
    sentinel on the twin, which is not a date to disagree with -- so the shell's
    real date is uncontested rather than merely unchallenged.

    Note this refuses on ANY real twin date, not on a wide gap. A twin date
    within days of the shell's would mean the split has some other cause and the
    evidence here does not settle it.
  */
  if (is_real_birth_date(twin_row.date_of_birth)) {
    return {
      ...plan,
      refusal: REFUSAL.TWIN_HOLDS_REAL_BIRTH_DATE,
      detail: `${shell_row.date_of_birth} against ${twin_row.date_of_birth}`
    }
  }

  /*
    The repair carries the shell's date onto the survivor, so a shell with no
    real date of its own has nothing to contribute and the merge would leave the
    sentinel standing -- which the audit then fails on. Refuse it here, where the
    reason is legible, rather than after the write.
  */
  if (!is_real_birth_date(shell_row.date_of_birth)) {
    return {
      ...plan,
      refusal: REFUSAL.SHELL_BIRTH_DATE_UNKNOWN,
      detail: `${shell_row.date_of_birth}`
    }
  }

  /*
    Corroboration rather than discrimination. The check's repair note warns that
    `nfl_draft_year` is corrupt on exactly these rows and cannot decide a pair on
    its own -- but where both halves carry one, an era-wide disagreement still
    contradicts the merge, and on all 26 mergeable pairs the two agree exactly.
  */
  if (shell_row.nfl_draft_year && twin_row.nfl_draft_year) {
    const gap = Math.abs(shell_row.nfl_draft_year - twin_row.nfl_draft_year)
    if (gap > MAX_DRAFT_YEAR_GAP) {
      return {
        ...plan,
        refusal: REFUSAL.DRAFT_YEAR_GAP,
        detail: `${shell_row.nfl_draft_year} against ${twin_row.nfl_draft_year}`
      }
    }
  }

  const [survivor, folded] = choose_survivor_by_reference_count({
    rows: [shell_row, twin_row],
    references
  })

  return {
    ...plan,
    twin_pid: pair.twin_pid,
    survivor_pid: survivor.pid,
    folded_pid: folded.pid,
    survivor_row: survivor,
    folded_row: folded,
    survivor_references: references.get(survivor.pid).total,
    folded_references: references.get(folded.pid).total,
    folded_reference_tables: references.get(folded.pid).by_table,
    // The pre-merge counts the audit compares against afterwards. Captured here
    // because after the merge there is no way to recover what they were.
    before_references: references,
    /*
      Nothing is written after the fold: the twin already holds the identifiers
      and mergePlayer's field merge carries the shell's biography across, so
      every column is subject to the union-of-values check with no exemptions.
    */
    deliberate_columns: []
  }
}

const describe_plan = (plan) => {
  log(`${plan.formatted_name} (shell ${plan.shell_pid})`)
  if (plan.refusal) {
    log(`  REFUSED ${plan.refusal}${plan.detail ? ` — ${plan.detail}` : ''}`)
    return
  }
  log(
    `  keep ${plan.survivor_pid} (${plan.survivor_references} refs, dob ${plan.survivor_row.date_of_birth}, gsis ${plan.survivor_row.gsis_player_id || '-'})`
  )
  log(
    `  fold ${plan.folded_pid} (${plan.folded_references} refs, dob ${plan.folded_row.date_of_birth}, gsis ${plan.folded_row.gsis_player_id || '-'})`
  )
  if (plan.folded_reference_tables.length) {
    log(
      `  repointing ${plan.folded_reference_tables.map((row) => `${row.table}(${row.rows})`).join(', ')}`
    )
  }
}

const merge_duplicate_person_rows = async ({ apply = false } = {}) => {
  const dry_run = !apply
  log(dry_run ? 'DRY RUN — nothing will be written' : 'APPLYING writes')

  const all_pairs = await find_duplicate_person_row_pairs()
  const parked = load_parked_shell_pids()
  const pairs = all_pairs.filter((pair) => !parked.has(pair.shell_pid))
  log(
    `${all_pairs.length} candidate pairs, ${parked.size} parked shells, ${pairs.length} to adjudicate`
  )
  if (!pairs.length) return { merged: 0, refused: 0 }

  const by_shell = new Map()
  for (const pair of pairs) {
    if (!by_shell.has(pair.shell_pid)) by_shell.set(pair.shell_pid, [])
    by_shell.get(pair.shell_pid).push(pair)
  }

  const pids = [
    ...new Set(pairs.flatMap((pair) => [pair.shell_pid, pair.twin_pid]))
  ]
  const player_rows = await db('player').whereIn('pid', pids)
  const rows = new Map(player_rows.map((row) => [row.pid, row]))

  const tables = await get_pid_referencing_tables()
  log(`counting references across ${tables.length} pid-carrying tables`)
  const references = await count_references({ pids, tables })

  const plans = [...by_shell].map(([shell_pid, shell_pairs]) =>
    evaluate_shell({ shell_pid, pairs: shell_pairs, rows, references })
  )

  for (const plan of plans) describe_plan(plan)

  const mergeable = plans.filter((plan) => !plan.refusal)
  const refused = plans.filter((plan) => plan.refusal)
  log(`${mergeable.length} mergeable, ${refused.length} refused`)

  const stats = { merged: 0, refused: refused.length }
  if (dry_run) {
    log('dry run — stopping before any write')
    return { ...stats, would_merge: mergeable.length }
  }

  for (const plan of mergeable) {
    await mergePlayer({
      update_player_row: plan.survivor_row,
      remove_player_row: plan.folded_row
    })
    stats.merged += 1
  }

  const failures = await audit_player_row_merges({ plans: mergeable, tables })
  if (failures.length) {
    for (const failure of failures) log(`POST-MERGE FAILURE — ${failure}`)
    throw new Error(`${failures.length} merged rows failed the audit`)
  }
  log(
    `audit passed for ${mergeable.length} merges — no column lost a value, every reference repointed`
  )

  log('result: %o', stats)
  return stats
}

const main = async () => {
  let error
  try {
    const argv = yargs(hideBin(process.argv)).option('apply', {
      type: 'boolean',
      default: false,
      describe: 'perform the merges; omit for a dry run'
    }).argv

    await merge_duplicate_person_rows({ apply: argv.apply })
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

export default merge_duplicate_person_rows
export { REFUSAL }
