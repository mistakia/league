import diff from 'deep-diff'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import is_main from './is-main.mjs'
import db from '#db'
import { normalize_game_clock } from './play-enum-utils.mjs'

const log = debug('update-play')
debug.enable('update-play')

const excluded_props = ['esbid', 'playId', 'updated']

// EPA/WPA cumulative fields where floating-point drift is expected
// Differences below the tolerance threshold are suppressed
const FLOAT_TOLERANCE = 0.01
const float_tolerance_fields = new Set([
  'epa',
  'qb_epa',
  'yac_epa',
  'comp_air_epa',
  'comp_yac_epa',
  'total_home_epa',
  'total_away_epa',
  'total_home_pass_epa',
  'total_away_pass_epa',
  'total_home_rush_epa',
  'total_away_rush_epa',
  'total_home_raw_air_epa',
  'total_away_raw_air_epa',
  'total_home_raw_yac_epa',
  'total_away_raw_yac_epa',
  'total_home_comp_air_epa',
  'total_away_comp_air_epa',
  'total_home_comp_yac_epa',
  'total_away_comp_yac_epa',
  'total_home_raw_air_wpa',
  'total_away_raw_air_wpa',
  'total_home_raw_yac_wpa',
  'total_away_raw_yac_wpa',
  'total_home_comp_air_wpa',
  'total_away_comp_air_wpa',
  'total_home_comp_yac_wpa',
  'total_away_comp_yac_wpa',
  'total_home_pass_wpa',
  'total_away_pass_wpa',
  'total_home_rush_wpa',
  'total_away_rush_wpa'
])

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
 */
const normalize_clock_fields = (obj) => {
  if (!obj) return obj
  const normalized = { ...obj }
  for (const field of game_clock_fields) {
    if (normalized[field]) {
      normalized[field] = normalize_game_clock(normalized[field])
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
 * @param {Object} params
 * @param {Object} params.play_row - Current play state from database
 * @param {Object} params.update - Fields to update
 * @param {boolean} params.overwrite_existing - Overwrite all existing values
 * @param {Array<string>} params.overwrite_fields - Specific fields to overwrite
 * @param {Set<string>} params.clearable_fields - Fields where a `null` rhs is a real clear
 *   (writes NULL + emits a changelog) when the existing `lhs` is a truthy, non-empty value.
 *   For every other prop, null/undefined/'' continue to be skipped.
 * @param {Set<string>} params.protected_fields - Fields owned by a more-authoritative
 *   source that the caller must never overwrite. A protected field may still be FILLED
 *   while empty, but an existing truthy value is never overwritten — even when
 *   `overwrite_existing` is true or the field is listed in `overwrite_fields`. Used by
 *   the Sportradar importer to protect FTN/nflfastR-owned fields. Default empty set
 *   preserves prior behavior for every other caller.
 * @returns {Object} { changelog_entries, field_updates, changes_count }
 */
export const compute_play_changes = ({
  play_row,
  update,
  overwrite_existing = false,
  overwrite_fields = [],
  clearable_fields = new Set(),
  protected_fields = new Set()
}) => {
  const changelog_entries = []
  const field_updates = {}
  let changes_count = 0

  if (!play_row) {
    return { changelog_entries, field_updates, changes_count }
  }

  // Normalize game clock fields in both objects before comparison
  const normalized_play_row = normalize_clock_fields(play_row)
  const normalized_update = normalize_clock_fields(update)

  const differences = diff(normalized_play_row, normalized_update)

  if (!differences) {
    return { changelog_entries, field_updates, changes_count }
  }

  const edits = differences.filter((d) => d.kind === 'E')
  if (!edits.length) {
    return { changelog_entries, field_updates, changes_count }
  }

  const timestamp = Math.round(Date.now() / 1000)

  for (const edit of edits) {
    const prop = edit.path[0]

    // Skip protected properties
    if (excluded_props.includes(prop)) {
      continue
    }

    const is_owned = clearable_fields.has(prop)
    const is_clear = is_owned && edit.rhs === null && Boolean(edit.lhs)

    // Skip null, undefined, or empty string values unless this is an opted-in
    // clear on a truthy lhs. Empty-string lhs is treated as already-empty: no
    // clear, no changelog.
    if (
      (edit.rhs === null || edit.rhs === undefined || edit.rhs === '') &&
      !is_clear
    ) {
      continue
    }

    // Skip EPA/WPA floating-point drift below tolerance
    if (
      float_tolerance_fields.has(prop) &&
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
    if (edit.lhs && !is_owned) {
      // Authority blocklist: a field owned by a more-authoritative source is
      // never overwritten once it holds a value — this takes precedence over
      // overwrite_existing AND overwrite_fields. Filling an empty field still
      // proceeds (the `edit.lhs` guard above is falsy in that case).
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

    // Collect changelog entry if there was a previous value
    if (edit.lhs) {
      changelog_entries.push({
        esbid: play_row.esbid,
        playId: play_row.playId,
        prop,
        prev: edit.lhs,
        new: edit.rhs,
        timestamp
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
 * @param {Object} play_row - Existing play record from database
 * @param {number} esbid - Game ID (alternative to play_row)
 * @param {number} playId - Play ID (alternative to play_row)
 * @param {Object} update - Field updates to apply
 * @param {boolean} overwrite_existing - If true, overwrite all existing values
 * @param {Array<string>} overwrite_fields - Specific fields to overwrite (e.g., ['game_clock_end', 'sec_rem_qtr'])
 * @param {Set<string>} protected_fields - Fields a more-authoritative source owns; never
 *   overwritten once set, even under overwrite_existing/overwrite_fields (fill-when-empty still allowed)
 * @returns {number} Number of fields changed
 */
const update_play = async ({
  play_row,
  esbid,
  playId,
  update,
  overwrite_existing = false,
  overwrite_fields = [],
  clearable_fields = new Set(),
  protected_fields = new Set()
}) => {
  if (!play_row && esbid && playId) {
    const play_rows = await db('nfl_plays').where({ esbid, playId })
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
      protected_fields
    })

  if (changes_count === 0) {
    return 0
  }

  // Batch changelog inserts
  if (changelog_entries.length > 0) {
    for (const entry of changelog_entries) {
      log(
        `Updating play: ${entry.esbid} - ${entry.playId}, Field: ${entry.prop}, Value: ${entry.new}`
      )
    }
    await db('play_changelog')
      .insert(changelog_entries)
      .onConflict(['esbid', 'playId', 'prop', 'timestamp'])
      .ignore()
  }

  // Batch play update
  if (Object.keys(field_updates).length > 0) {
    await db('nfl_plays')
      .update(field_updates)
      .where({ esbid: play_row.esbid, playId: play_row.playId })
  }

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
    .option('playId', {
      describe: 'Play ID',
      type: 'string',
      demandOption: true
    })
    .help().argv
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()

    if (!argv.esbid || !argv.playId) {
      log('missing --esbid or --playId')
      process.exit()
    }

    const ignore = ['_', '$0', 'esbid', 'playId']
    const keys = Object.keys(argv).filter((key) => !ignore.includes(key))
    const update = {}
    keys.forEach((key) => {
      update[key] = argv[key]
    })

    const changes = await update_play({
      esbid: argv.esbid,
      playId: argv.playId,
      update
    })
    log(`play ${argv.esbid} updated, changes: ${changes}`)
    process.exit()
  } catch (err) {
    error = err
    log(error)
  }
}

if (is_main(import.meta.url)) {
  main()
}
