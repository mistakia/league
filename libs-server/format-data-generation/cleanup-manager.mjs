// Cleanup manager module
// Handle orphaned data cleanup functionality

import db from '#db'
import { named_scoring_formats } from '#libs-shared/named-scoring-formats-generated.mjs'
import { named_league_formats } from '#libs-shared/named-league-formats-generated.mjs'

import {
  check_scoring_format_removal_safety,
  check_league_format_removal_safety
} from './data-checker.mjs'

/**
 * Get tables and hash column for format type
 * @param {Object} params - Parameters object
 * @param {string} params.format_type - Type of format ('league' or 'scoring')
 * @returns {Object} Tables configuration
 */
const get_format_tables = ({ format_type }) => {
  if (format_type === 'league') {
    return {
      hash_column: 'league_format_hash',
      tables: [
        'league_format_draft_pick_value',
        'league_format_player_projection_values',
        'league_format_player_careerlogs',
        'league_format_player_seasonlogs',
        'league_format_player_gamelogs'
      ]
    }
  } else {
    return {
      hash_column: 'scoring_format_hash',
      tables: [
        'scoring_format_player_projection_points',
        'scoring_format_player_careerlogs',
        'scoring_format_player_seasonlogs',
        'scoring_format_player_gamelogs'
      ]
    }
  }
}

/**
 * Remove format data from database
 * @param {Object} params - Parameters object
 * @param {string} params.format_hash - Format hash to remove
 * @param {string} params.format_type - Type of format ('league' or 'scoring')
 * @param {Object} [params.options={}] - Options object
 * @param {boolean} [params.options.dry_run=false] - Whether to perform dry run
 * @returns {Promise<Object>} Removal counts by table
 */
export const remove_format_data = async ({
  format_hash,
  format_type,
  options = {}
}) => {
  const { dry_run = false } = options
  const { tables, hash_column } = get_format_tables({ format_type })
  const removal_counts = {}

  for (const table of tables) {
    try {
      if (dry_run) {
        const count = await db(table)
          .where(hash_column, format_hash)
          .count('* as count')
          .first()
        removal_counts[table] = count.count
      } else {
        const deleted_count = await db(table)
          .where(hash_column, format_hash)
          .del()
        removal_counts[table] = deleted_count
      }
    } catch (error) {
      console.warn(
        `Warning: Could not ${dry_run ? 'check' : 'remove'} data from ${table}: ${error.message}`
      )
      removal_counts[table] = 0
    }
  }

  return removal_counts
}

/**
 * Discover all format hashes in the database
 * @returns {Promise<{scoring: Set, league: Set}>} Format hashes by type
 */
export const discover_all_format_hashes = async () => {
  const scoring_tables = [
    'scoring_format_player_gamelogs',
    'scoring_format_player_seasonlogs',
    'scoring_format_player_careerlogs',
    'scoring_format_player_projection_points'
  ]

  const league_tables = [
    'league_format_player_gamelogs',
    'league_format_player_seasonlogs',
    'league_format_player_careerlogs',
    'league_format_player_projection_values',
    'league_format_draft_pick_value'
  ]

  const scoring_hashes = new Set()
  const league_hashes = new Set()

  // Discover scoring format hashes
  for (const table of scoring_tables) {
    try {
      const hashes = await db(table)
        .distinct('scoring_format_hash')
        .whereNotNull('scoring_format_hash')
        .pluck('scoring_format_hash')
      hashes.forEach((hash) => scoring_hashes.add(hash))
    } catch (error) {
      console.warn(`Could not scan table ${table}: ${error.message}`)
    }
  }

  // Discover league format hashes
  for (const table of league_tables) {
    try {
      const hashes = await db(table)
        .distinct('league_format_hash')
        .whereNotNull('league_format_hash')
        .pluck('league_format_hash')
      hashes.forEach((hash) => league_hashes.add(hash))
    } catch (error) {
      console.warn(`Could not scan table ${table}: ${error.message}`)
    }
  }

  return { scoring: scoring_hashes, league: league_hashes }
}

/**
 * Check if format hashes are actively used
 * @param {Object} params - Parameters object
 * @param {Set} params.league_hashes - League format hashes to check
 * @returns {Promise<{active_in_seasons: Set}>} Active usage information
 */
export const check_active_usage = async ({ league_hashes }) => {
  const active_in_seasons = new Set()

  // Check active seasons - leagues table doesn't have league_format_hash
  try {
    const active_seasons = await db('seasons')
      .whereIn('league_format_hash', Array.from(league_hashes))
      .whereNotNull('league_format_hash')
      .pluck('league_format_hash')
    active_seasons.forEach((hash) => active_in_seasons.add(hash))
  } catch (error) {
    console.warn(`Could not check seasons table: ${error.message}`)
  }

  return { active_in_seasons }
}

/**
 * Check if scoring format is referenced by league formats
 * @param {Object} params - Parameters object
 * @param {string} params.scoring_hash - Scoring format hash to check
 * @returns {Promise<boolean>}
 */
const is_scoring_format_referenced = async ({ scoring_hash }) => {
  try {
    const referenced = await db('league_formats')
      .where('scoring_format_hash', scoring_hash)
      .first()
    return !!referenced
  } catch (error) {
    console.warn(`Could not check scoring format references: ${error.message}`)
    return true // Assume referenced to be safe
  }
}

/**
 * Classify format orphans
 * @returns {Promise<Object>} Classification of all formats
 */
export const classify_format_orphans = async () => {
  // Discover all format hashes
  const { scoring, league } = await discover_all_format_hashes()

  // Get named formats (fresh lookup)
  const named_scoring_hashes = new Set(
    Object.values(named_scoring_formats).map((f) => f.hash)
  )
  const named_league_hashes = new Set(
    Object.values(named_league_formats).map((f) => f.hash)
  )

  // Check active usage
  const { active_in_seasons } = await check_active_usage({
    league_hashes: league
  })

  // Classify scoring formats
  const orphaned_scoring = []
  for (const hash of scoring) {
    if (named_scoring_hashes.has(hash)) {
      continue // Skip named formats
    }
    const is_referenced = await is_scoring_format_referenced({
      scoring_hash: hash
    })
    if (!is_referenced) {
      orphaned_scoring.push(hash)
    }
  }

  // Classify league formats
  const orphaned_league = Array.from(league).filter(
    (hash) => !named_league_hashes.has(hash) && !active_in_seasons.has(hash)
  )

  return {
    all_formats: { scoring, league },
    named_formats: {
      scoring: named_scoring_hashes,
      league: named_league_hashes
    },
    active_usage: { active_in_seasons },
    orphaned: { scoring: orphaned_scoring, league: orphaned_league }
  }
}

/**
 * Enhanced orphaned data cleanup
 * @param {Object} [options={}] - Options object
 * @param {boolean} [options.dry_run=false] - Whether to perform dry run
 */
export const cleanup_orphaned_data = async (options = {}) => {
  const { dry_run = false } = options

  console.log(`\n${'='.repeat(80)}`)
  console.log('ENHANCED ORPHANED FORMAT DATA CLEANUP')
  console.log(`${'='.repeat(80)}`)

  // Classify all formats
  const classification = await classify_format_orphans()

  console.log(`\nFormat Discovery Summary:`)
  console.log(
    `- Total scoring formats found: ${classification.all_formats.scoring.size}`
  )
  console.log(
    `- Total league formats found: ${classification.all_formats.league.size}`
  )
  console.log(
    `- Named scoring formats: ${classification.named_formats.scoring.size}`
  )
  console.log(
    `- Named league formats: ${classification.named_formats.league.size}`
  )
  console.log(
    `- Active in seasons: ${classification.active_usage.active_in_seasons.size}`
  )
  console.log(
    `- Orphaned scoring formats: ${classification.orphaned.scoring.length}`
  )
  console.log(
    `- Orphaned league formats: ${classification.orphaned.league.length}`
  )

  let total_removed = 0

  // Process orphaned league formats
  for (const league_hash of classification.orphaned.league) {
    const safety_check = await check_league_format_removal_safety({
      format_hash: league_hash
    })

    if (!safety_check.safe) {
      console.log(`\nSkipping league format ${league_hash}:`)
      safety_check.reasons.forEach((reason) => console.log(`  - ${reason}`))
      continue
    }

    console.log(
      `\n${dry_run ? 'Would remove' : 'Removing'} orphaned league format: ${league_hash}`
    )

    const removal_counts = await remove_format_data({
      format_hash: league_hash,
      format_type: 'league',
      options: { dry_run }
    })

    for (const [table, count] of Object.entries(removal_counts)) {
      if (count > 0) {
        console.log(`  - ${table}: ${count} rows`)
        total_removed += count
      }
    }
  }

  // Process orphaned scoring formats
  for (const scoring_hash of classification.orphaned.scoring) {
    const safety_check = await check_scoring_format_removal_safety({
      format_hash: scoring_hash
    })

    if (!safety_check.safe) {
      console.log(`\nSkipping scoring format ${scoring_hash}:`)
      safety_check.reasons.forEach((reason) => console.log(`  - ${reason}`))
      continue
    }

    console.log(
      `\n${dry_run ? 'Would remove' : 'Removing'} orphaned scoring format: ${scoring_hash}`
    )

    const removal_counts = await remove_format_data({
      format_hash: scoring_hash,
      format_type: 'scoring',
      options: { dry_run }
    })

    for (const [table, count] of Object.entries(removal_counts)) {
      if (count > 0) {
        console.log(`  - ${table}: ${count} rows`)
        total_removed += count
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log(`Cleanup Summary:`)
  console.log(
    `- Total orphaned league formats: ${classification.orphaned.league.length}`
  )
  console.log(
    `- Total orphaned scoring formats: ${classification.orphaned.scoring.length}`
  )
  console.log(
    `- Total rows ${dry_run ? 'that would be' : ''} removed: ${total_removed}`
  )
  console.log(`${'='.repeat(80)}`)
}
