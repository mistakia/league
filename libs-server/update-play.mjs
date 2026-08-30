import diff from 'deep-diff'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import is_main from './is-main.mjs'
import db from '#db'
import record_changelog from './record-changelog.mjs'
import { normalize_game_clock } from './play-enum-utils.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('update-play')
enable_debug_namespaces('update-play')

const excluded_props = ['esbid', 'play_id', 'updated']

// Every EPA and WPA column in nfl_plays holds a recomputed model output, so a
// re-import carries floating-point drift that is not a real change. Matching on
// the name rather than enumerating the columns covers the per-play values
// (epa, air_epa, yac_wpa, ...) and the running totals alike, and keeps any EPA
// or WPA column added later covered without a second list to maintain.
const FLOAT_TOLERANCE = 0.01
const is_float_tolerance_field = (field_name) =>
  /(^|_)(epa|wpa)$/.test(field_name)

// `false` and `0` are values the row actually holds. A truthiness test reads
// them as empty, which lets a lower-authority source overwrite them past both
// the overwrite gate and the protected-field blocklist, and writes them with no
// changelog row. An empty string is treated as already-empty.
const has_existing_value = (value) =>
  value !== null && value !== undefined && value !== ''

// Fields that contain game clock values and should be normalized
const game_clock_fields = [
  'game_clock_start',
  'game_clock_end',
  'drive_game_clock_start',
  'drive_game_clock_end'
]

/**
 * Normalize game clock fields in both play_row and update objects
 * to ensure consistent comparison (prevent "2:00" vs "02:00" false positives)
 *
 * @param {object} obj - play row or update object
 * @param {object} options
 * @param {boolean} options.keep_unparsable - true for the stored row: a clock
 *   `normalize_game_clock` rejects (non-`MM:SS`, minutes > 15) is left as
 *   stored, so it still diffs as the existing value it is instead of reading as
 *   empty. False for the incoming update: a malformed source clock becomes null
 *   and is skipped rather than written.
 */
const normalize_clock_fields = (obj, { keep_unparsable }) => {
  if (!obj) return obj
  const normalized = { ...obj }
  for (const field of game_clock_fields) {
    if (normalized[field]) {
      const normalized_clock = normalize_game_clock(normalized[field])
      if (normalized_clock !== null) {
        normalized[field] = normalized_clock
      } else if (!keep_unparsable) {
        normalized[field] = null
      }
    }
  }
  return normalized
}

/**
 * Determines if a field update should be allowed when there's an existing value
 * @param {string} field_name - The field being updated
 * @param {boolean} overwrite_existing - If true, allow all updates
 * @param {Array<string>} overwrite_fields - Specific fields to overwrite
 * @returns {boolean} True if update should proceed
 */
const should_overwrite_field = (
  field_name,
  overwrite_existing,
  overwrite_fields
) => {
  // Priority 1: Global overwrite_existing flag overwrites everything
  if (overwrite_existing) {
    return true
  }

  // Priority 2: Specific field in overwrite_fields list
  if (overwrite_fields.length > 0 && overwrite_fields.includes(field_name)) {
    return true
  }

  // Default: Don't overwrite existing values
  return false
}

/**
 * Compute changes for a play without executing database operations.
 * Returns collections for batch processing.
 *
 * @param {object} params
 * @param {object} params.play_row - Current play state from database. MUST be a full
 *   row (`select *` from nfl_plays): only `E` (edit) diffs are applied, so a prop
 *   present in `update` but absent from `play_row` diffs as `N` and is ignored. That
 *   is what keeps a non-column key in `update` from reaching the UPDATE statement.
 * @param {object} params.update - Fields to update
 * @param {boolean} params.overwrite_existing - Overwrite all existing values
 * @param {Array<string>} params.overwrite_fields - Specific fields to overwrite
 * @param {Set<string>} params.clearable_fields - Fields where a `null` rhs is a real clear
 *   (writes NULL + emits a changelog) when the `lhs` is an existing, non-empty value.
 *   For every other prop, null/undefined/'' continue to be skipped.
 * @param {Set<string>} params.protected_fields - Fields owned by a more-authoritative
 *   source that the caller must never overwrite. A protected field may still be FILLED
 *   while empty, but an existing value — including `false` and `0` — is never
 *   overwritten, even when `overwrite_existing` is true or the field is listed in
 *   `overwrite_fields`. Used by the Sportradar importer to protect FTN/nflfastR-owned
 *   fields. Default empty set preserves prior behavior for every other caller.
 * @param {string} params.source - Provenance recorded on every changelog entry
 * @returns {object} { changelog_entries, field_updates, changes_count }
 */
export const compute_play_changes = ({
  play_row,
  update,
  overwrite_existing = false,
  overwrite_fields = [],
  clearable_fields = new Set(),
  protected_fields = new Set(),
  source = null
}) => {
  const changelog_entries = []
  const field_updates = {}
  let changes_count = 0

  if (!play_row) {
    return { changelog_entries, field_updates, changes_count }
  }

  // Normalize game clock fields in both objects before comparison
  const normalized_play_row = normalize_clock_fields(play_row, {
    keep_unparsable: true
  })
  const normalized_update = normalize_clock_fields(update, {
    keep_unparsable: false
  })

  const differences = diff(normalized_play_row, normalized_update)

  if (!differences) {
    return { changelog_entries, field_updates, changes_count }
  }

  const edits = differences.filter((d) => d.kind === 'E')
  if (!edits.length) {
    return { changelog_entries, field_updates, changes_count }
  }

  const changed_at = new Date()

  for (const edit of edits) {
    const prop = edit.path[0]

    // Skip protected properties
    if (excluded_props.includes(prop)) {
      continue
    }

    const is_owned = clearable_fields.has(prop)
    const is_clear =
      is_owned && edit.rhs === null && has_existing_value(edit.lhs)

    // Skip null, undefined, or empty string values unless this is an opted-in
    // clear on an lhs that holds a value. Empty-string lhs is treated as
    // already-empty: no clear, no changelog.
    if (
      (edit.rhs === null || edit.rhs === undefined || edit.rhs === '') &&
      !is_clear
    ) {
      continue
    }

    // Skip EPA/WPA floating-point drift below tolerance
    if (
      is_float_tolerance_field(prop) &&
      typeof edit.lhs === 'number' &&
      typeof edit.rhs === 'number' &&
      Math.abs(edit.lhs - edit.rhs) < FLOAT_TOLERANCE
    ) {
      continue
    }

    // Handle conflicts - when there's already a value in the database.
    // Opting a prop into clearable_fields means enrichment owns the column:
    // both clears (rhs=null) and overwrites (rhs=newValue, lhs=oldValue)
    // bypass the overwrite gate. Default empty set preserves the prior
    // skip-existing behavior for sportradar / manual-CLI callers.
    if (has_existing_value(edit.lhs) && !is_owned) {
      // Authority blocklist: a field owned by a more-authoritative source is
      // never overwritten once it holds a value — this takes precedence over
      // overwrite_existing AND overwrite_fields. Filling an empty field still
      // proceeds (the guard above is false in that case).
      if (protected_fields.has(prop)) {
        continue
      }

      const can_overwrite = should_overwrite_field(
        prop,
        overwrite_existing,
        overwrite_fields
      )

      if (!can_overwrite) {
        continue
      }
    }

    changes_count += 1
    field_updates[prop] = edit.rhs

    // Collect changelog entry if there was a previous value. `previous_value`
    // comes off the raw row rather than the diff, so a game clock reads as the
    // column actually holds it instead of as its normalized comparison form.
    if (has_existing_value(edit.lhs)) {
      changelog_entries.push({
        esbid: play_row.esbid,
        play_id: play_row.play_id,
        column_name: prop,
        previous_value: play_row[prop],
        new_value: edit.rhs,
        source,
        changed_at
      })
    }
  }

  return { changelog_entries, field_updates, changes_count }
}

/**
 * Update play data in the database with conflict resolution
 *
 * Conflict Resolution Priority:
 * 0. protected_fields → NEVER overwritten once set (beats 1 and 2 below)
 * 1. overwrite_existing=true → Overwrites ALL non-protected fields
 * 2. overwrite_fields=['field1', 'field2'] → Overwrites ONLY specified fields
 * 3. Default → Skip updates for fields with existing values
 *
 * @param {object} play_row - Existing play record from database
 * @param {number} esbid - Game ID (alternative to play_row)
 * @param {number} play_id - Play ID (alternative to play_row)
 * @param {object} update - Field updates to apply
 * @param {boolean} overwrite_existing - If true, overwrite all existing values
 * @param {Array<string>} overwrite_fields - Specific fields to overwrite (e.g., ['game_clock_end', 'seconds_remaining_quarter'])
 * @param {Set<string>} protected_fields - Fields a more-authoritative source owns; never
 *   overwritten once set, even under overwrite_existing/overwrite_fields (fill-when-empty still allowed)
 * @param {string} source - Provenance for the changelog; required on every call
 * @returns {number} Number of fields changed
 */
const update_play = async ({
  play_row,
  esbid,
  play_id,
  update,
  overwrite_existing = false,
  overwrite_fields = [],
  clearable_fields = new Set(),
  protected_fields = new Set(),
  source = null
}) => {
  // Checked up front rather than at the changelog write: whether a run produces
  // a changelog entry depends on the data, so a deferred check lets a
  // source-less caller pass on a fill-only run and throw on the next one.
  if (!source) {
    throw new Error(
      'update_play: source is required to attribute play_changelog entries'
    )
  }

  if (!play_row && esbid && play_id) {
    const play_rows = await db('nfl_plays').where({ esbid, play_id })
    play_row = play_rows[0]
  }

  if (!play_row) {
    return 0
  }

  const { changelog_entries, field_updates, changes_count } =
    compute_play_changes({
      play_row,
      update,
      overwrite_existing,
      overwrite_fields,
      clearable_fields,
      protected_fields,
      source
    })

  if (changes_count === 0) {
    return 0
  }

  for (const entry of changelog_entries) {
    log(
      `Updating play: ${entry.esbid} - ${entry.play_id}, Field: ${entry.column_name}, Value: ${entry.new_value}`
    )
  }

  // One transaction: an audit row asserting a change the update never landed is
  // worse than no audit row at all.
  await db.transaction(async (trx) => {
    if (changelog_entries.length > 0) {
      await record_changelog({
        table: 'play_changelog',
        rows: changelog_entries,
        trx
      })
    }

    await trx('nfl_plays')
      .update(field_updates)
      .where({ esbid: play_row.esbid, play_id: play_row.play_id })
  })

  return changes_count
}

export default update_play

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .option('esbid', {
      describe: 'Game ID',
      type: 'string',
      demandOption: true
    })
    .option('play_id', {
      describe: 'Play ID',
      type: 'string',
      demandOption: true
    })
    .help().argv
}

const main = async () => {
  try {
    const argv = initialize_cli()

    if (!argv.esbid || !argv.play_id) {
      throw new Error('missing --esbid or --play_id')
    }

    // Every remaining flag becomes a column write, so a typo or a flag this CLI
    // does not declare would otherwise reach the UPDATE statement as a column.
    const ignore = ['_', '$0', 'esbid', 'play_id']
    const update_keys = Object.keys(argv).filter((key) => !ignore.includes(key))
    const column_info = await db('nfl_plays').columnInfo()
    const unknown_columns = update_keys.filter((key) => !column_info[key])
    if (unknown_columns.length) {
      throw new Error(
        `not nfl_plays columns: ${unknown_columns.join(', ')} — this CLI writes one column per flag`
      )
    }

    const update = {}
    for (const key of update_keys) {
      update[key] = argv[key]
    }

    const changes = await update_play({
      esbid: argv.esbid,
      play_id: argv.play_id,
      update,
      source: 'manual'
    })
    log(`play ${argv.esbid} updated, changes: ${changes}`)
    process.exit()
  } catch (err) {
    log(err)
    process.exit(1)
  }
}

if (is_main(import.meta.url)) {
  main()
}
