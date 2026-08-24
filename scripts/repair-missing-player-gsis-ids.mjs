import fs from 'fs'

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season } from '#constants'
import { is_main, updatePlayer, createPlayer } from '#libs-server'
import { CREATE_PLAYER_REQUIRED_FIELDS } from '#libs-server/create-player.mjs'
import { load_source_records } from '#libs-server/player-identity-sources.mjs'
import {
  missing_gsis_ids_sql,
  collision_preflight_sql,
  external_id_attach_sql,
  birth_date_attach_sql
} from '#libs-server/player-identity-collision-oracle.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('repair-missing-player-gsis-ids')
enable_debug_namespaces(
  'repair-missing-player-gsis-ids,create-player,update-player'
)

/*
  Closes the gap where a gsis id appears in the stat ledger with no `player`
  row, by ATTACHING the id to the person's existing row wherever they are
  already in the table and MINTING only where they are demonstrably not.

  The order matters more than either step. Minting someone who is already in the
  table splits one career across two pids and manufactures exactly the conflated
  identity that scripts/audit-conflated-player-identity.mjs exists to unwind, so
  every id is put through the attach ladder first and only what survives it is
  eligible to be created.

  Nothing here is decided on a name. The two gsis-keyed sources both carry the
  person's OTHER identifiers, so an attach is settled by comparing ids against
  columns `player` already holds. The name is used in one place only -- as a
  VETO on an id match whose surname disagrees -- and never as the thing that
  makes a match.

  Default is a dry run. --apply is required to write anything.
*/

/*
  The tiers, strongest evidence first. A candidate lands in the first tier it
  qualifies for, and only ATTACH_HIGH and ATTACH_CORROBORATED are written.

  The dividing line is not how likely the match is to be right -- it is whether
  anything in the evidence CONTRADICTS it. A single hard id match with a
  matching surname and an incumbent holding no gsis id has nothing arguing
  against it. Everything below the line has something.
*/
export const DISPOSITION = {
  ATTACH_HIGH: 'attach_high',
  ATTACH_CORROBORATED: 'attach_corroborated',
  REVIEW_SURNAME_CONFLICT: 'review_surname_conflict',
  REVIEW_DUPLICATE_INCUMBENTS: 'review_duplicate_incumbents',
  REVIEW_GSIS_ID_CONFLICT: 'review_gsis_id_conflict',
  REVIEW_NAME_ONLY_MATCH: 'review_name_only_match',
  MINT_NEW: 'mint_new',
  RESIDUE_NO_SOURCE: 'residue_no_source',
  RESIDUE_INCOMPLETE_SOURCE: 'residue_incomplete_source'
}

const WRITABLE_ATTACH = new Set([
  DISPOSITION.ATTACH_HIGH,
  DISPOSITION.ATTACH_CORROBORATED
])

/*
  Surname comparison, used ONLY to veto an id match -- never to make one.

  It has to be forgiving, because the two sides record a surname differently and
  a false veto blocks a correct attach. `player` carries the generational suffix
  IN the surname (`Dean III`, `Lovett Sr.`) where the feed keeps it separate,
  and each side may hold a different half of a hyphenated name (`Lichtenhan`
  against `Christian-Lichtenhan`). All nine surname conflicts in the first run
  were one of those two shapes and every one was a correct attach.

  So it strips the suffix, drops punctuation, and accepts containment either
  way. What survives is a genuinely different surname sitting on a hard id
  match, which is worth stopping for.
*/
const surname_key = (value) =>
  value
    ? value
        .toLowerCase()
        .replace(/[ ,]+(jr|sr|ii|iii|iv|v)[.]?[ ]*$/, '')
        .replace(/[^a-z]/g, '')
    : null

const surnames_agree = (left, right) => {
  const a = surname_key(left)
  const b = surname_key(right)
  if (!a || !b) return true
  return a === b || a.includes(b) || b.includes(a)
}

const classify_candidate = ({
  source_record,
  external_matches,
  birth_date_matches,
  name_matches
}) => {
  if (!source_record) {
    return { disposition: DISPOSITION.RESIDUE_NO_SOURCE }
  }

  if (external_matches.length) {
    const incumbents = new Map()
    for (const match of external_matches) {
      if (!incumbents.has(match.incumbent_pid)) {
        incumbents.set(match.incumbent_pid, { ...match, matched_on: [] })
      }
      incumbents.get(match.incumbent_pid).matched_on.push(...match.matched_on)
    }

    if (incumbents.size > 1) {
      /*
        The feed's ids reach more than one player row. That is not ambiguity
        about who this person is -- it is evidence that `player` already holds
        two rows for them, each carrying a different subset of their ids. Ernie
        Sims is the shape: ERNE-SIMS-024567 matches on esb and ERNE-SIMS-024953
        on pfr.

        Attaching to one of them would leave the other behind and deepen the
        split, and merging two existing rows is the one operation here that
        cannot be undone. So these are reported and left alone.
      */
      return {
        disposition: DISPOSITION.REVIEW_DUPLICATE_INCUMBENTS,
        incumbents: [...incumbents.values()]
      }
    }

    const incumbent = [...incumbents.values()][0]

    if (incumbent.incumbent_gsis) {
      /*
        A hard id says this is the same person, and that person already holds a
        DIFFERENT gsis id. The feed cannot settle which is right, and neither
        branch is safe unattended: attaching would put two gsis ids on one
        person, and minting would put the SAME esb id on two rows. Both are the
        duplicate this task exists to avoid, so it stops here.
      */
      return { disposition: DISPOSITION.REVIEW_GSIS_ID_CONFLICT, incumbent }
    }

    if (
      !surnames_agree(source_record.last_name, incumbent.incumbent_last_name)
    ) {
      return { disposition: DISPOSITION.REVIEW_SURNAME_CONFLICT, incumbent }
    }

    const corroborated =
      new Set(incumbent.matched_on).size > 1 ||
      name_matches.some(
        (match) => match.incumbent_pid === incumbent.incumbent_pid
      )

    return {
      disposition: corroborated
        ? DISPOSITION.ATTACH_CORROBORATED
        : DISPOSITION.ATTACH_HIGH,
      incumbent
    }
  }

  /*
    No hard id reached a player row. Before minting, the birth-date rung asks
    whether this person is in the table with no identifiers at all -- the shape
    that neither of the other two rungs can see, and that duplicated 70 people
    the first time this ran.
  */
  if (birth_date_matches.length) {
    const incumbents = new Map(
      birth_date_matches.map((match) => [match.incumbent_pid, match])
    )
    if (incumbents.size > 1) {
      return {
        disposition: DISPOSITION.REVIEW_DUPLICATE_INCUMBENTS,
        incumbents: [...incumbents.values()]
      }
    }
    const incumbent = [...incumbents.values()][0]
    if (
      !surnames_agree(source_record.last_name, incumbent.incumbent_last_name)
    ) {
      return { disposition: DISPOSITION.REVIEW_SURNAME_CONFLICT, incumbent }
    }
    return { disposition: DISPOSITION.ATTACH_CORROBORATED, incumbent }
  }

  /*
    No hard id reached a player row, so a name match is all there is -- and a
    name match alone is not evidence. Where the two forms disagreed on which
    pid, the name form was wrong in all 12 cases.

    It still matters WHICH name match. If every incumbent it found already
    holds a different gsis id, they are all demonstrably other people and this
    id is free to mint. If one of them holds NO gsis id, the name is the only
    thing relating them and it could go either way, so that stops for a human.
  */
  const unresolved_name_match = name_matches.some(
    (match) => !match.incumbent_gsis
  )
  if (unresolved_name_match) {
    return { disposition: DISPOSITION.REVIEW_NAME_ONLY_MATCH, name_matches }
  }

  const missing_fields = CREATE_PLAYER_REQUIRED_FIELDS.filter(
    (field) => !build_player_data(source_record)[field]
  )
  if (missing_fields.length) {
    return {
      disposition: DISPOSITION.RESIDUE_INCOMPLETE_SOURCE,
      missing_fields
    }
  }

  return { disposition: DISPOSITION.MINT_NEW, name_matches }
}

/*
  secondary_position and position_depth are synthesized from the single position
  the feed carries, matching what scripts/import-players-nfl.mjs already does --
  so the effective mint gate is position, height and weight, not seven fields.

  date_of_birth is deliberately allowed to be null. It is neither required by
  createPlayer nor NOT NULL on `player`, and a null birth date is an absence.
  What must never be written is `0000-00-00`, the sentinel that reads as data.
*/
const build_player_data = (source_record) => ({
  first_name: source_record.first_name,
  last_name: source_record.last_name,
  primary_position: source_record.position,
  secondary_position: source_record.position,
  position_depth: source_record.position,
  height_inches: source_record.height_inches,
  weight_pounds: source_record.weight_pounds,
  gsis_player_id: source_record.gsis_player_id,
  esb_player_id: source_record.esb_id,
  pfr_player_id: source_record.pfr_id,
  smart_player_id: source_record.smart_id,
  gsis_it_player_id: source_record.gsis_it_id,
  date_of_birth: source_record.date_of_birth || null,
  college: source_record.college || null
})

const load_missing_ids = async () => {
  const { rows } = await db.raw(`WITH missing AS (
  ${missing_gsis_ids_sql}
)
SELECT gsis_player_id,
  array_agg(DISTINCT player_name) AS ledger_names,
  sum(stat_rows) AS stat_rows,
  sum(stat_rows) FILTER (WHERE season_type <> 'PRE') AS graded_stat_rows,
  min(season_year) AS first_season,
  max(season_year) AS last_season,
  bool_or(season_type <> 'PRE') AS is_graded
FROM missing GROUP BY 1`)
  return rows
}

const build_dispositions = async ({ source_records }) => {
  const missing = await load_missing_ids()
  log(
    `${missing.length} missing gsis ids, ${missing.filter((row) => row.is_graded).length} graded`
  )

  const feed = missing
    .filter((row) => source_records.has(row.gsis_player_id))
    .map((row) => source_records.get(row.gsis_player_id))
  log(`${feed.length} of them are covered by a gsis-keyed source`)

  const external_by_id = new Map()
  if (feed.length) {
    const { rows } = await db.raw(external_id_attach_sql(feed))
    for (const row of rows) {
      if (!external_by_id.has(row.gsis_player_id)) {
        external_by_id.set(row.gsis_player_id, [])
      }
      external_by_id.get(row.gsis_player_id).push(row)
    }
  }

  const birth_date_by_id = new Map()
  if (feed.length) {
    const { rows } = await db.raw(birth_date_attach_sql(feed))
    for (const row of rows) {
      if (!birth_date_by_id.has(row.gsis_player_id)) {
        birth_date_by_id.set(row.gsis_player_id, [])
      }
      birth_date_by_id.get(row.gsis_player_id).push(row)
    }
  }

  const { rows: name_rows } = await db.raw(collision_preflight_sql())
  const name_by_id = new Map()
  for (const row of name_rows) {
    if (!name_by_id.has(row.gsis_player_id))
      name_by_id.set(row.gsis_player_id, [])
    name_by_id.get(row.gsis_player_id).push(row)
  }

  return missing.map((row) => ({
    ...row,
    source_record: source_records.get(row.gsis_player_id) || null,
    ...classify_candidate({
      source_record: source_records.get(row.gsis_player_id) || null,
      external_matches: external_by_id.get(row.gsis_player_id) || [],
      birth_date_matches: birth_date_by_id.get(row.gsis_player_id) || [],
      name_matches: name_by_id.get(row.gsis_player_id) || []
    })
  }))
}

const apply_attaches = async ({ dispositions, dry_run }) => {
  const attaches = dispositions.filter((row) =>
    WRITABLE_ATTACH.has(row.disposition)
  )
  const stats = { attempted: attaches.length, written: 0, no_change: 0 }

  for (const row of attaches) {
    if (dry_run) continue
    const reason = `identity repair: gsis id ${row.gsis_player_id} attached on ${row.incumbent.matched_on.join('+')} from ${row.source_record.sources.join('+')} (${row.disposition})`
    const changes = await updatePlayer({
      pid: row.incumbent.incumbent_pid,
      update: { gsis_player_id: row.gsis_player_id },
      allow_protected_props: true,
      source: 'repair-missing-player-gsis-ids',
      reason
    })
    if (changes > 0) stats.written += 1
    else stats.no_change += 1
  }

  return stats
}

const apply_mints = async ({ dispositions, dry_run }) => {
  const mints = dispositions.filter(
    (row) => row.disposition === DISPOSITION.MINT_NEW
  )
  const stats = { attempted: mints.length, created: 0, refused_or_failed: 0 }

  for (const row of mints) {
    if (dry_run) continue
    const created = await createPlayer(build_player_data(row.source_record))
    // createPlayer returns null for BOTH a refusal and a write failure, which
    // its own docstring flags as un-gradeable. The refusal predicate is
    // evaluated ahead of the call in classify_candidate, so anything null here
    // is a failure rather than a skip.
    if (created) stats.created += 1
    else stats.refused_or_failed += 1
  }

  return stats
}

/*
  The no-duplicates gate, and the reason this can run without per-candidate
  review.

  Every external id space is single-valued per person, so any value held by two
  `player` rows is a duplicate by construction. All four counts are 0 today, and
  this asserts they are still 0 afterwards -- which is what makes an unattended
  attach safe: the run cannot introduce a duplicate without this going red.
*/
const IDENTITY_COLUMNS = [
  'gsis_player_id',
  'esb_player_id',
  'pfr_player_id',
  'smart_player_id',
  'gsis_it_player_id'
]

const check_no_duplicate_identities = async ({
  columns = IDENTITY_COLUMNS
} = {}) => {
  const findings = []
  for (const column of columns) {
    const { rows } = await db.raw(
      `SELECT ${column} AS value, count(*) AS rows, array_agg(pid) AS pids
       FROM player WHERE ${column} IS NOT NULL AND primary_position <> 'DST'
       GROUP BY 1 HAVING count(*) > 1`
    )
    log(`${column}: ${rows.length} value(s) held by more than one player row`)
    for (const row of rows.slice(0, 10)) {
      log(`  ${row.value} -> ${row.pids.join(', ')}`)
    }
    if (rows.length) findings.push({ column, rows })
  }
  return findings
}

/*
  A player row carrying a gsis id but no position, height or weight is the
  bare-bones shape the operator ruled out. Nothing here creates one -- the mint
  gate refuses first -- and this asserts that stayed true.
*/
const BARE_BONES_PREDICATE = `gsis_player_id IS NOT NULL AND primary_position <> 'DST'
       AND (primary_position IS NULL OR height_inches IS NULL OR weight_pounds IS NULL)`

const check_no_bare_bones_rows = async ({ source = 'player' } = {}) => {
  const { rows } = await db.raw(
    `SELECT count(*) AS bare_bones FROM ${source} WHERE ${BARE_BONES_PREDICATE}`
  )
  return Number(rows[0].bare_bones)
}

/*
  The `0000-00-00` sentinel reads as data where a null reads as an absence, and
  nothing this run creates may carry one.

  Scoped to the gsis ids this run MINTED, not to the rows it attached to. 282 of
  the 334 attach targets already carry the sentinel, written years ago by four
  other mint paths -- checking those would fail the gate on a pre-existing
  condition this run neither caused nor touched. Auditing that population is a
  standalone exercise and is deliberately out of scope here.
*/
const check_no_placeholder_birth_dates = async ({ gsis_player_ids }) => {
  if (!gsis_player_ids.length) return 0
  const { rows } = await db.raw(
    `SELECT count(*) AS sentinels FROM player
     WHERE gsis_player_id = ANY('{${gsis_player_ids.join(',')}}')
       AND date_of_birth::text LIKE '0000%'`
  )
  log(
    `rows minted by this run carrying the 0000-00-00 sentinel: ${rows[0].sentinels}`
  )
  return Number(rows[0].sentinels)
}

const report = ({ dispositions, output_path }) => {
  const buckets = {}
  for (const row of dispositions) {
    buckets[row.disposition] ||= { total: 0, graded: 0, graded_stat_rows: 0 }
    buckets[row.disposition].total += 1
    if (row.is_graded) {
      buckets[row.disposition].graded += 1
      buckets[row.disposition].graded_stat_rows += Number(
        row.graded_stat_rows || 0
      )
    }
  }
  for (const [disposition, counts] of Object.entries(buckets).sort(
    (a, b) => b[1].total - a[1].total
  )) {
    log(
      `  ${disposition}: ${counts.total} (${counts.graded} graded, ${counts.graded_stat_rows} graded stat rows)`
    )
  }

  const total = Object.values(buckets).reduce(
    (sum, counts) => sum + counts.total,
    0
  )
  log(`partition covers ${total} of ${dispositions.length} ids`)

  if (output_path) {
    fs.writeFileSync(output_path, JSON.stringify(dispositions, null, 1))
    log(`wrote full dispositions to ${output_path}`)
  }
  return buckets
}

/*
  Proves the three integrity checks can REPORT before any of them is trusted.

  A check that cannot fail is indistinguishable from a clean result, and it
  fails in the direction that looks like success -- which for this run would be
  "no duplicates were created" from a query that could never have found one.

  Each control feeds the same query shape an input known to violate it, using
  data already in the table so nothing has to be written:

  - the duplicate check runs over `last_name`, which is shared by design
  - the bare-bones check runs over rows holding NO gsis id, where incomplete
    rows do exist
  - the sentinel check runs over the attach targets, 282 of which already carry
    `0000-00-00` from mint paths that predate this script

  All three must come back non-zero. If any comes back clean, the corresponding
  real check is not evidence of anything.
*/
const verify_integrity_gates_can_fail = async () => {
  const duplicate_control = await check_no_duplicate_identities({
    columns: ['last_name']
  })
  /*
    The bare-bones predicate cannot be falsified against live data, because no
    row in `player` has a null height -- which is the very property the check
    asserts. Running it over the table and calling a zero a pass would be
    circular, so it runs over a synthetic pair instead: one deliberately bare
    row and one complete one, through the IDENTICAL predicate. It must find
    exactly the bare one.
  */
  const bare_bones_control = await check_no_bare_bones_rows({
    source: `(VALUES
      ('bare', 'QB', NULL::int, NULL::int, '00-0000001'),
      ('complete', 'QB', 74, 220, '00-0000002')
    ) AS synthetic (pid, primary_position, height_inches, weight_pounds, gsis_player_id)`
  })
  /*
    The sentinel control reads the table directly rather than the run's own
    attach targets. Deriving it from the run made it go vacuous the moment a
    re-run had nothing left to attach -- a control whose input can empty out is
    not a control, and it reported CANNOT FAIL exactly when the run was cleanest.
    `0000-00-00` rows predate this work by years and are not going anywhere.
  */
  const { rows: sentinel_rows } = await db.raw(
    `SELECT count(*) AS sentinels FROM player
     WHERE date_of_birth::text LIKE '0000%' AND primary_position <> 'DST'`
  )
  const sentinel_control = Number(sentinel_rows[0].sentinels)

  const assertions = [
    [
      'duplicate check reports on a column with known duplicates',
      duplicate_control.length > 0
    ],
    [
      'bare-bones check reports on rows known to be incomplete',
      bare_bones_control > 0
    ],
    [
      'sentinel check reports on rows known to carry 0000-00-00',
      sentinel_control > 0
    ]
  ]
  for (const [description, passed] of assertions) {
    log(`  ${passed ? 'RED as required' : 'CANNOT FAIL'} — ${description}`)
  }
  return assertions.every(([, passed]) => passed)
}

const repair_missing_player_gsis_ids = async ({
  apply = false,
  output_path,
  include_nfl_pro = true,
  nfl_pro_last_season = current_season.year,
  include_weekly_rosters = true,
  weekly_roster_last_season = current_season.year
} = {}) => {
  const dry_run = !apply
  log(dry_run ? 'DRY RUN — nothing will be written' : 'APPLYING writes')

  const duplicates_before = await check_no_duplicate_identities()
  if (duplicates_before.length) {
    throw new Error(
      'player already holds duplicate external ids — resolve those before running an identity repair'
    )
  }

  const source_records = await load_source_records({
    include_nfl_pro,
    nfl_pro_last_season,
    include_weekly_rosters,
    weekly_roster_last_season
  })
  log(`${source_records.size} gsis-keyed source records loaded`)

  const dispositions = await build_dispositions({ source_records })
  const buckets = report({ dispositions, output_path })

  if (!(await verify_integrity_gates_can_fail())) {
    throw new Error(
      'an integrity check could not be made to report — its clean result is not evidence'
    )
  }

  const attach_stats = await apply_attaches({ dispositions, dry_run })
  log('attaches: %o', attach_stats)
  const mint_stats = await apply_mints({ dispositions, dry_run })
  log('mints: %o', mint_stats)

  const duplicates_after = await check_no_duplicate_identities()
  const bare_bones = await check_no_bare_bones_rows()
  log(`bare-bones rows carrying a gsis id: ${bare_bones}`)
  const minted_gsis_ids = dispositions
    .filter((row) => row.disposition === DISPOSITION.MINT_NEW)
    .map((row) => row.gsis_player_id)
  const sentinels = await check_no_placeholder_birth_dates({
    gsis_player_ids: minted_gsis_ids
  })

  if (duplicates_after.length || bare_bones > 0 || sentinels > 0) {
    throw new Error(
      'post-run integrity gate FAILED — duplicate identities, bare-bones rows or placeholder birth dates are present'
    )
  }
  log('post-run integrity gate passed')

  return { buckets, attach_stats, mint_stats }
}

const main = async () => {
  let error
  try {
    const argv = yargs(hideBin(process.argv))
      .option('apply', {
        type: 'boolean',
        default: false,
        describe: 'write the attaches and mints; omit for a dry run'
      })
      .option('output_path', {
        type: 'string',
        describe: 'write the full per-id dispositions as JSON to this path'
      })
      .option('include_nfl_pro', { type: 'boolean', default: true })
      .option('nfl_pro_last_season', {
        type: 'number',
        default: current_season.year
      })
      .option('include_weekly_rosters', { type: 'boolean', default: true })
      .option('weekly_roster_last_season', {
        type: 'number',
        default: current_season.year
      }).argv

    await repair_missing_player_gsis_ids({
      apply: argv.apply,
      output_path: argv.output_path,
      include_nfl_pro: argv.include_nfl_pro,
      nfl_pro_last_season: argv.nfl_pro_last_season,
      include_weekly_rosters: argv.include_weekly_rosters,
      weekly_roster_last_season: argv.weekly_roster_last_season
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

export default repair_missing_player_gsis_ids
export { classify_candidate, build_player_data, surname_key }
