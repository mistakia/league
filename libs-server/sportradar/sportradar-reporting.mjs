/**
 * Reporting and summary utilities for Sportradar import
 */

import debug from 'debug'
import { is_sportradar_exclusive_field } from './sportradar-exclusive-fields.mjs'

const log = debug('import-plays-sportradar')

/**
 * Print import summary statistics
 */
export const print_import_summary = ({
  total_plays_processed,
  total_plays_matched,
  total_plays_updated,
  total_plays_multiple_matches = 0,
  unmatched_plays,
  multiple_match_plays = [],
  unmatched_reasons
}) => {
  log('\n=== Import Summary ===')
  log(`Total plays processed: ${total_plays_processed}`)
  log(`Plays matched: ${total_plays_matched}`)
  log(`Plays updated: ${total_plays_updated}`)
  log(`Plays with multiple matches: ${total_plays_multiple_matches}`)
  log(`Plays not matched: ${unmatched_plays.length}`)

  if (multiple_match_plays.length > 0) {
    log('\n⚠️  Multiple Match Errors:')
    log(
      'The following plays matched multiple records in the database. This indicates'
    )
    log('ambiguous match criteria and needs to be resolved.')
    multiple_match_plays.slice(0, 10).forEach((play) => {
      log(
        `  ${play.esbid} Q${play.qtr} ${play.clock} - ${play.description?.substring(0, 60)}`
      )
    })
    if (multiple_match_plays.length > 10) {
      log(`  ... and ${multiple_match_plays.length - 10} more`)
    }
  }

  if (Object.keys(unmatched_reasons).length > 0) {
    log('\nUnmatched plays by type:')
    Object.entries(unmatched_reasons)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        log(`  ${type}: ${count}`)
      })
  }

  if (unmatched_plays.length > 0 && unmatched_plays.length < 50) {
    log('\nUnmatched plays sample:')
    unmatched_plays.slice(0, 10).forEach((play) => {
      log(
        `  ${play.esbid} Q${play.qtr} ${play.clock} - ${play.description?.substring(0, 60)}`
      )
    })
  }
}

/**
 * Print detailed dry mode comparison for sample plays
 */
export const print_dry_mode_comparison = ({ sample_plays_by_type }) => {
  if (!sample_plays_by_type || Object.keys(sample_plays_by_type).length === 0) {
    return
  }

  log('\n\n' + '='.repeat(80))
  log('DRY MODE: Sample Play Comparisons by Type')
  log('='.repeat(80))

  const comparison_fields = [
    'sportradar_game_id',
    'sportradar_play_id',
    'sportradar_drive_id',
    'sportradar_play_type',
    'wall_clock',
    'qb_position',
    'starting_hash',
    'run_gap',
    'play_action',
    'screen_pass',
    'no_huddle',
    'run_play_option',
    'box_defenders',
    'pass_rushers',
    'blitz',
    'pocket_location',
    'left_tightends',
    'right_tightends',
    'fake_punt',
    'fake_field_goal',
    'route',
    'pocket_time',
    'yards_after_catch',
    'broken_tackles_rush',
    'broken_tackles_rec',
    'mbt',
    'kicker_sportradar_id',
    'punter_sportradar_id',
    'returner_sportradar_id',
    'penalty_player_sportradar_id',
    'incomplete_pass_type',
    'fg_result_detail',
    'punt_yds',
    'punt_hang_time',
    'kickoff_yds',
    'play_direction'
  ]

  for (const [play_type, sample] of Object.entries(sample_plays_by_type)) {
    log(`\n${'='.repeat(80)}`)
    log(`PLAY TYPE: ${play_type}`)
    log('='.repeat(80))
    log(`Description: ${sample.sportradar_play.description || 'N/A'}`)
    log(
      `Game: ${sample.db_play.esbid} | Q${sample.db_play.qtr} | ${sample.db_play.game_clock_start || 'N/A'}`
    )
    log(`Play ID: ${sample.db_play.playId}`)
    log('')

    const changes = []
    const no_changes = []

    for (const field of comparison_fields) {
      const existing_value = sample.db_play[field]
      const new_value = sample.mapped_play[field]

      // Skip if both are null/undefined
      if (
        (existing_value === null || existing_value === undefined) &&
        (new_value === null || new_value === undefined)
      ) {
        continue
      }

      // Check if value would change
      if (!values_are_equal(existing_value, new_value)) {
        changes.push({ field, existing: existing_value, new: new_value })
      } else if (new_value !== null && new_value !== undefined) {
        no_changes.push({ field, value: existing_value })
      }
    }

    if (changes.length > 0) {
      log('CHANGES THAT WOULD BE APPLIED:')
      log('-'.repeat(80))
      changes.forEach(({ field, existing, new: new_value }) => {
        const existing_str = format_value(existing)
        const new_str = format_value(new_value)
        log(`  ${field}:`)
        log(`    EXISTING: ${existing_str}`)
        log(`    NEW:      ${new_str}`)
      })
    }

    if (no_changes.length > 0) {
      log('')
      log('FIELDS THAT ALREADY MATCH:')
      log('-'.repeat(80))
      no_changes.forEach(({ field, value }) => {
        log(`  ${field}: ${format_value(value)}`)
      })
    }

    if (changes.length === 0 && no_changes.length === 0) {
      log('No Sportradar-specific fields populated for this play type.')
    }
  }

  log('\n' + '='.repeat(80))
  log('END OF DRY MODE OUTPUT')
  log('='.repeat(80) + '\n')
}

/**
 * Print comprehensive collision summary
 */
export const print_collision_summary = ({ all_collisions }) => {
  if (!all_collisions || all_collisions.length === 0) {
    log('\n\n' + '='.repeat(80))
    log('NO COLLISIONS DETECTED')
    log('All Sportradar fields either match existing data or fill NULL values.')
    log('='.repeat(80) + '\n')
    return
  }

  // Separate exclusive vs non-exclusive collisions
  const exclusive_collisions = all_collisions.filter((c) =>
    is_sportradar_exclusive_field(c.field)
  )
  const non_exclusive_collisions = all_collisions.filter(
    (c) => !is_sportradar_exclusive_field(c.field)
  )

  log('\n\n' + '='.repeat(80))
  log(
    'COLLISION SUMMARY: Field Differences Between Existing Data and Sportradar'
  )
  log('='.repeat(80))
  log(`Total collisions detected: ${all_collisions.length}`)
  log(`  Sportradar-exclusive fields: ${exclusive_collisions.length}`)
  log(
    `  Shared fields (also in FTN/nflfastR): ${non_exclusive_collisions.length}`
  )
  log('')

  // Group collisions by field
  const collisions_by_field = {}
  for (const collision of all_collisions) {
    if (!collisions_by_field[collision.field]) {
      collisions_by_field[collision.field] = []
    }
    collisions_by_field[collision.field].push(collision)
  }

  // Sort fields by collision count (descending)
  const sorted_fields = Object.entries(collisions_by_field).sort(
    (a, b) => b[1].length - a[1].length
  )

  log('COLLISIONS BY FIELD (sorted by frequency):')
  log('-'.repeat(80))

  for (const [field, collisions] of sorted_fields) {
    log(`\n${field}: ${collisions.length} collisions`)

    // Show value distribution
    const value_pairs = {}
    for (const c of collisions) {
      const pair_key = `${format_value(c.existing)} → ${format_value(c.new)}`
      value_pairs[pair_key] = (value_pairs[pair_key] || 0) + 1
    }

    // Sort by frequency and show top 5
    const sorted_pairs = Object.entries(value_pairs).sort((a, b) => b[1] - a[1])
    const display_count = Math.min(5, sorted_pairs.length)

    for (let i = 0; i < display_count; i++) {
      const [pair, count] = sorted_pairs[i]
      log(`  ${pair} (${count}x)`)
    }

    if (sorted_pairs.length > 5) {
      log(`  ... and ${sorted_pairs.length - 5} more value patterns`)
    }

    // Show example plays
    log(`  Example plays:`)
    const examples = collisions.slice(0, 3)
    for (const ex of examples) {
      // For timing fields, show existing vs new values in the description
      const timing_note = [
        'sec_rem_qtr',
        'sec_rem_half',
        'sec_rem_gm'
      ].includes(field)
        ? ` [${ex.existing} → ${ex.new}]`
        : ''
      const sportradar_info =
        ex.play_info.sportradar_game_id && ex.play_info.sportradar_play_id
          ? ` [SR Game: ${ex.play_info.sportradar_game_id}, SR Play: ${ex.play_info.sportradar_play_id}]`
          : ''
      log(
        `    ${ex.play_info.esbid} Play ${ex.play_info.playId} Q${ex.play_info.qtr} - ${ex.play_info.description || 'N/A'}${timing_note}${sportradar_info}`
      )
    }
  }

  log('\n' + '='.repeat(80))
  log('COLLISION ANALYSIS COMPLETE')
  log('='.repeat(80))

  // Categorize collisions
  print_collision_categorization({
    all_collisions,
    exclusive_collisions,
    non_exclusive_collisions
  })
}

/**
 * Print collision categorization (exclusive vs shared fields)
 */
const print_collision_categorization = ({
  all_collisions,
  exclusive_collisions,
  non_exclusive_collisions
}) => {
  log('\n\nCOLLISION CATEGORIZATION BY FIELD TYPE:')
  log('-'.repeat(80))

  log(
    `Sportradar-exclusive fields (safe to overwrite): ${exclusive_collisions.length}`
  )
  if (exclusive_collisions.length > 0) {
    const exclusive_fields = [
      ...new Set(exclusive_collisions.map((c) => c.field))
    ]
    log(`  Fields: ${exclusive_fields.slice(0, 10).join(', ')}`)
    if (exclusive_fields.length > 10) {
      log(`  ... and ${exclusive_fields.length - 10} more`)
    }
  }

  log(
    `\nShared fields (also in FTN/NGS/nflfastR): ${non_exclusive_collisions.length}`
  )
  if (non_exclusive_collisions.length > 0) {
    const shared_fields = [
      ...new Set(non_exclusive_collisions.map((c) => c.field))
    ]
    log(`  Fields: ${shared_fields.join(', ')}`)
    log(
      '  Note: These fields may have better data from other sources (FTN/NGS/nflfastR)'
    )
  }

  // Additional categorization for shared fields
  const expected_minor_diffs = [
    'box_defenders',
    'route',
    'yards_after_catch',
    'pass_rushers'
  ]

  const expected_shared_collisions = non_exclusive_collisions.filter((c) =>
    expected_minor_diffs.includes(c.field)
  )

  if (expected_shared_collisions.length > 0) {
    log(
      `\n  Expected differences (different methodologies): ${expected_shared_collisions.length}`
    )
    log(
      `    Fields: ${expected_minor_diffs.filter((f) => expected_shared_collisions.some((c) => c.field === f)).join(', ')}`
    )
  }

  log('\n' + '='.repeat(80) + '\n')
}

/**
 * Compare two values for equality, with special handling for Date objects
 */
const values_are_equal = (existing, new_value) => {
  // Handle null/undefined
  if (existing === new_value) return true
  if (existing === null || existing === undefined) return false
  if (new_value === null || new_value === undefined) return false

  // Handle Date objects - compare timestamps
  if (existing instanceof Date && new_value instanceof Date) {
    return existing.getTime() === new_value.getTime()
  }

  // Handle one Date, one string (shouldn't happen but be safe)
  if (existing instanceof Date && typeof new_value === 'string') {
    return existing.toISOString() === new_value
  }
  if (typeof existing === 'string' && new_value instanceof Date) {
    return existing === new_value.toISOString()
  }

  // Default comparison
  return existing === new_value
}

/**
 * Format a value for display
 */
const format_value = (value) => {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * Track collision if existing non-null value differs from new value
 */
export const should_track_collision = ({
  field,
  existing_value,
  new_value
}) => {
  // Skip if new value is null, undefined, or empty string
  if (new_value === null || new_value === undefined || new_value === '') {
    return false
  }

  // Skip excluded fields
  const excluded_fields = [
    'esbid',
    'playId',
    'year',
    'week',
    'updated',
    'sequence', // Different methodology
    'catchable_ball' // Different methodology
  ]
  if (excluded_fields.includes(field)) {
    return false
  }

  // Skip NULL→value transitions (data enrichment, not conflicts)
  if (
    existing_value === null ||
    existing_value === undefined ||
    existing_value === ''
  ) {
    return false
  }

  return true
}
