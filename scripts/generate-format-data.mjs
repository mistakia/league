#!/usr/bin/env node

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import is_main from '#libs-server/is-main.mjs'
import getLeague from '#libs-server/get-league.mjs'
import { constants } from '#libs-shared'
import { named_scoring_formats } from '#libs-shared/named-scoring-formats-generated.mjs'
import { named_league_formats } from '#libs-shared/named-league-formats-generated.mjs'

// Constants
const SCRIPT_CONFIG = {
  log_name: 'generate-format-data',
  script_delay: 500,
  format_delay: 1000,
  min_year_check: 2020
}

const log = debug(SCRIPT_CONFIG.log_name)
debug.enable(SCRIPT_CONFIG.log_name)

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Configuration for available generation scripts
const generation_scripts = {
  // Core format definitions
  core_formats: {
    script: 'generate-league-formats.mjs',
    description: 'Generate core league and scoring format definitions',
    args: [],
    dependencies: [],
    tables: ['league_formats', 'league_scoring_formats']
  },

  // Scoring format player data
  scoring_format_gamelogs: {
    script: 'generate-scoring-format-player-gamelogs.mjs',
    description: 'Generate scoring format player gamelogs',
    args: ['--scoring_format_hash', '{scoring_format_hash}', '--all'],
    dependencies: [],
    tables: ['scoring_format_player_gamelogs'],
    per_format: 'scoring'
  },

  scoring_format_seasonlogs: {
    script: 'generate-scoring-format-player-seasonlogs.mjs',
    description: 'Generate scoring format player seasonlogs',
    args: ['--scoring_format_hash', '{scoring_format_hash}', '--all'],
    dependencies: ['scoring_format_gamelogs'],
    tables: ['scoring_format_player_seasonlogs'],
    per_format: 'scoring'
  },

  scoring_format_careerlogs: {
    script: 'generate-scoring-format-player-careerlogs.mjs',
    description: 'Generate scoring format player careerlogs',
    args: ['--scoring_format_hash', '{scoring_format_hash}'],
    dependencies: ['scoring_format_seasonlogs'],
    tables: ['scoring_format_player_careerlogs'],
    per_format: 'scoring'
  },

  scoring_format_projections: {
    script: 'process-projections-for-scoring-format.mjs',
    description: 'Process projections for scoring format',
    args: ['--scoring_format_hash', '{scoring_format_hash}', '--all'],
    dependencies: [],
    tables: ['scoring_format_player_projection_points'],
    per_format: 'scoring'
  },

  // League format player data
  league_format_gamelogs: {
    script: 'generate-league-format-player-gamelogs.mjs',
    description: 'Generate league format player gamelogs',
    args: ['--league_format_hash', '{league_format_hash}', '--all'],
    dependencies: [
      'scoring_format_gamelogs',
      'scoring_format_seasonlogs',
      'scoring_format_careerlogs'
    ],
    tables: ['league_format_player_gamelogs'],
    per_format: 'league'
  },

  league_format_seasonlogs: {
    script: 'generate-league-format-player-seasonlogs.mjs',
    description: 'Generate league format player seasonlogs',
    args: ['--league_format_hash', '{league_format_hash}', '--all'],
    dependencies: ['league_format_gamelogs'],
    tables: ['league_format_player_seasonlogs'],
    per_format: 'league'
  },

  league_format_careerlogs: {
    script: 'generate-league-format-player-careerlogs.mjs',
    description: 'Generate league format player careerlogs',
    args: ['--league_format_hash', '{league_format_hash}'],
    dependencies: ['league_format_seasonlogs'],
    tables: ['league_format_player_careerlogs'],
    per_format: 'league'
  },

  league_format_projections: {
    script: 'process-projections-for-league-format.mjs',
    description: 'Process projections for league format',
    args: ['--league_format_hash', '{league_format_hash}', '--all'],
    dependencies: ['scoring_format_projections'],
    tables: ['league_format_player_projection_values'],
    per_format: 'league'
  },

  league_format_draft_values: {
    script: 'calculate-draft-pick-value.mjs',
    description: 'Calculate draft pick values for league format',
    args: ['--league_format_hash', '{league_format_hash}'],
    dependencies: ['league_format_careerlogs'],
    tables: ['league_format_draft_pick_value'],
    per_format: 'league'
  }
}

/**
 * Execute a script with arguments
 * @param {string} script_name - Name of the script to execute
 * @param {string[]} args - Arguments to pass to the script
 * @returns {Promise<void>}
 */
const execute_script = (script_name, args = []) => {
  return new Promise((resolve, reject) => {
    const script_path = path.join(__dirname, script_name)
    console.log(`\nExecuting: node ${script_name} ${args.join(' ')}`)

    const child = spawn('node', [script_path, ...args], {
      stdio: 'inherit',
      cwd: path.dirname(__dirname)
    })

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`Completed: ${script_name}`)
        // Add a small delay to allow connections to properly close
        setTimeout(resolve, SCRIPT_CONFIG.script_delay)
      } else {
        console.error(`Failed: ${script_name} (exit code ${code})`)
        reject(new Error(`Script ${script_name} failed with exit code ${code}`))
      }
    })

    child.on('error', (error) => {
      console.error(`Error executing ${script_name}:`, error.message)
      reject(error)
    })
  })
}

/**
 * Check if a script file exists
 * @param {string} script_name - Name of the script to check
 * @returns {Promise<boolean>}
 */
const script_exists = async (script_name) => {
  try {
    const script_path = path.join(__dirname, script_name)
    const { access } = await import('fs/promises')
    await access(script_path)
    return true
  } catch {
    return false
  }
}

/**
 * Check if a format exists in the database
 * @param {string} format_hash - Hash of the format to check
 * @param {string} format_type - Type of format ('scoring' or 'league')
 * @returns {Promise<boolean>}
 */
const check_format_exists = async (format_hash, format_type) => {
  try {
    if (format_type === 'scoring') {
      const result = await db('league_scoring_formats')
        .where('scoring_format_hash', format_hash)
        .first()
      return !!result
    } else if (format_type === 'league') {
      const result = await db('league_formats')
        .where('league_format_hash', format_hash)
        .first()
      return !!result
    }
    return false
  } catch (error) {
    console.warn(`Warning: Could not check format existence: ${error.message}`)
    return true // Assume it exists to proceed
  }
}

/**
 * Build query conditions based on step type
 * @param {Object} query - Database query object
 * @param {string} step_name - Name of the generation step
 * @returns {Object} Modified query object
 */
const build_step_query_conditions = (query, step_name) => {
  if (step_name.includes('gamelogs')) {
    return query.limit(1)
  } else if (step_name.includes('seasonlogs')) {
    // Check if we have data for recent years
    return query.where('year', '>=', SCRIPT_CONFIG.min_year_check).limit(1)
  } else if (step_name.includes('careerlogs')) {
    return query.limit(1)
  } else if (step_name.includes('projections')) {
    // Check for projections using the last year with stats
    return query.where('year', constants.season.stats_season_year).limit(1)
  } else if (step_name === 'league_format_draft_values') {
    return query.limit(1)
  }
  return query
}

/**
 * Check if data exists for a format in a specific table
 * @param {Object} params - Parameters object
 * @param {string} params.format_hash - Hash of the format
 * @param {string} params.format_type - Type of format ('scoring' or 'league')
 * @param {string} params.step_name - Name of the generation step
 * @returns {Promise<boolean>}
 */
const check_format_data_exists = async ({
  format_hash,
  format_type,
  step_name
}) => {
  const config = generation_scripts[step_name]
  if (!config || !config.tables || config.tables.length === 0) {
    return false
  }

  try {
    // Check the primary table for this step
    const table_name = config.tables[0]
    const hash_column =
      format_type === 'scoring' ? 'scoring_format_hash' : 'league_format_hash'

    // Build base query and apply step-specific conditions
    let query = db(table_name).where(hash_column, format_hash)
    query = build_step_query_conditions(query, step_name)

    const result = await query.first()
    return !!result
  } catch (error) {
    // Table might not exist or other DB error
    console.debug(
      `Could not check data existence for ${step_name}: ${error.message}`
    )
    return false
  }
}

/**
 * Check if a step should be skipped based on options
 * @param {string} step_name - Name of the step
 * @param {Object} options - Options object
 * @returns {boolean}
 */
const should_skip_step = (step_name, options) => {
  const { skip_steps = [], only_steps = [] } = options

  if (skip_steps.includes(step_name)) {
    console.log(`Skipping step: ${step_name}`)
    return true
  }

  if (only_steps.length > 0 && !only_steps.includes(step_name)) {
    console.log(`Skipping step (not in onlySteps): ${step_name}`)
    return true
  }

  return false
}

/**
 * Prepare script arguments by replacing placeholders
 * @param {string[]} args - Original arguments
 * @param {string} format_hash - Format hash to use for placeholders
 * @returns {string[]} Processed arguments
 */
const prepare_script_args = (args, format_hash) => {
  return args.map((arg) => {
    if (arg === '{scoring_format_hash}') return format_hash
    if (arg === '{league_format_hash}') return format_hash
    return arg
  })
}

/**
 * Handle step execution error
 * @param {Error} error - The error that occurred
 * @param {string} step_name - Name of the step that failed
 * @param {string} format_name - Name of the format being processed
 * @param {Object} options - Options object
 */
const handle_step_error = (error, step_name, format_name, options) => {
  console.error(`Failed to execute step ${step_name}:`, error.message)

  // Skip format data generation errors but show warning
  if (
    error.message.includes('not found') ||
    error.message.includes('missing or invalid') ||
    error.message.includes('undefined')
  ) {
    console.log(
      `Skipping ${step_name} for ${format_name} - format may need to be generated first`
    )
    if (!options.continue_on_error) {
      // Skip this step but continue with format
    }
  } else if (!options.continue_on_error) {
    throw error
  }
}

/**
 * Execute a single generation step
 * @param {string} step_name - Name of the step
 * @param {string} format_name - Name of the format
 * @param {string} format_hash - Hash of the format
 * @param {string} format_type - Type of format
 * @param {Object} options - Options object
 */
const execute_generation_step = async (
  step_name,
  format_name,
  format_hash,
  format_type,
  options
) => {
  const config = generation_scripts[step_name]
  if (!config) {
    console.log(`Unknown step: ${step_name}`)
    return
  }

  // Check if script exists
  const exists = await script_exists(config.script)
  if (!exists) {
    console.log(`Script not found: ${config.script}`)
    return
  }

  console.log(`\nStep: ${step_name}`)
  console.log(`   Description: ${config.description}`)
  console.log(`   Tables: ${config.tables.join(', ')}`)

  if (options.dry_run) {
    console.log(`   DRY RUN: Would execute ${config.script}`)
    return
  }

  try {
    const args = prepare_script_args(config.args, format_hash)
    await execute_script(config.script, args)
  } catch (error) {
    handle_step_error(error, step_name, format_name, options)
  }
}

/**
 * Generate data for a specific format
 * @param {string} format_name - Name of the format
 * @param {string} format_hash - Hash of the format
 * @param {string} format_type - Type of format ('scoring' or 'league')
 * @param {string[]} steps - Array of step names to execute
 * @param {Object} options - Options object
 */
const generate_format_data = async (
  format_name,
  format_hash,
  format_type,
  steps,
  options = {}
) => {
  console.log(`\n${'='.repeat(80)}`)
  console.log(
    `GENERATING DATA FOR ${format_type.toUpperCase()} FORMAT: ${format_name}`
  )
  console.log(`Hash: ${format_hash}`)
  console.log(`${'='.repeat(80)}`)

  // Check if format exists in database first
  const format_exists = await check_format_exists(format_hash, format_type)
  if (!format_exists) {
    console.log(
      `Format ${format_name} (${format_hash}) not found in database - skipping`
    )
    return
  }

  const { only_missing = false } = options

  for (const step_name of steps) {
    // Check if step should be skipped
    if (should_skip_step(step_name, options)) {
      continue
    }

    // Check if data already exists when only_missing is enabled
    if (only_missing) {
      const data_exists = await check_format_data_exists({
        format_hash,
        format_type,
        step_name
      })

      if (data_exists) {
        console.log(`Skipping step ${step_name}: Data already exists`)
        continue
      }
    }

    await execute_generation_step(
      step_name,
      format_name,
      format_hash,
      format_type,
      options
    )
  }
}

// Step execution order configuration
const STEP_CONFIGURATION = {
  scoring_steps: [
    'scoring_format_gamelogs',
    'scoring_format_seasonlogs',
    'scoring_format_careerlogs',
    'scoring_format_projections'
  ],
  league_steps: [
    'league_format_gamelogs',
    'league_format_seasonlogs',
    'league_format_careerlogs',
    'league_format_projections',
    'league_format_draft_values'
  ]
}

/**
 * Generate core format definitions
 * @param {Object} options - Options object
 */
const generate_core_formats = async (options) => {
  console.log(`\n${'='.repeat(80)}`)
  console.log('GENERATING CORE FORMAT DEFINITIONS')
  console.log(`${'='.repeat(80)}`)

  const core_exists = await script_exists(
    generation_scripts.core_formats.script
  )

  if (core_exists && !options.dry_run) {
    await execute_script(generation_scripts.core_formats.script)
  } else if (!core_exists) {
    console.log(
      `Core format script not found: ${generation_scripts.core_formats.script}`
    )
  } else {
    console.log(`DRY RUN: Would generate core formats`)
  }
}

/**
 * Check if format should be processed based on filter
 * @param {string} format_name - Name of the format
 * @param {string[]} format_filter - Array of format names to include
 * @returns {boolean}
 */
const should_process_format = (format_name, format_filter) => {
  if (!format_filter || format_filter.length === 0) {
    return true
  }

  if (!format_filter.includes(format_name)) {
    console.log(`Skipping format: ${format_name} (not in format filter)`)
    return false
  }

  return true
}

/**
 * Process formats of a specific type
 * @param {string} format_type - Type of format ('scoring' or 'league')
 * @param {Object} formats - Object containing format data
 * @param {string[]} steps - Array of step names to execute
 * @param {Object} options - Options object
 */
const process_format_type = async (format_type, formats, steps, options) => {
  const format_count = Object.keys(formats).length
  console.log(`\nProcessing ${format_count} ${format_type} formats...`)

  for (const [format_name, format_data] of Object.entries(formats)) {
    if (!should_process_format(format_name, options.formats)) {
      continue
    }

    await generate_format_data(
      format_name,
      format_data.hash,
      format_type,
      steps,
      options
    )

    // Add a small delay between formats to prevent connection exhaustion
    await new Promise((resolve) =>
      setTimeout(resolve, SCRIPT_CONFIG.format_delay)
    )
  }
}

/**
 * Resolve format hash from various input parameters
 * @param {Object} params - Input parameters
 * @param {string} params.hash - Direct format hash
 * @param {number} params.lid - League ID
 * @param {string} params.format - Named format
 * @param {number} params.year - Year for league lookup (optional)
 * @returns {Promise<{hash: string, name: string, type: string}>}
 */
const resolve_format_hash = async ({ hash, lid, format, year }) => {
  // Direct hash provided
  if (hash) {
    // Check if it's a league or scoring format
    const league_format = await db('league_formats')
      .where('league_format_hash', hash)
      .first()
    if (league_format) {
      return { hash, name: `hash-${hash.slice(0, 8)}`, type: 'league' }
    }

    const scoring_format = await db('league_scoring_formats')
      .where('scoring_format_hash', hash)
      .first()
    if (scoring_format) {
      return { hash, name: `hash-${hash.slice(0, 8)}`, type: 'scoring' }
    }

    throw new Error(`Format hash '${hash}' not found in database`)
  }

  // League ID provided
  if (lid !== undefined) {
    const league = await getLeague({ lid, year })
    if (!league || !league.league_format_hash) {
      throw new Error(`No league format found for league ID ${lid}`)
    }
    return {
      hash: league.league_format_hash,
      name: `league-${lid}`,
      type: 'league'
    }
  }

  // Named format provided
  if (format) {
    // Check league formats first
    if (named_league_formats[format]) {
      return {
        hash: named_league_formats[format].hash,
        name: format,
        type: 'league'
      }
    }

    // Check scoring formats
    if (named_scoring_formats[format]) {
      return {
        hash: named_scoring_formats[format].hash,
        name: format,
        type: 'scoring'
      }
    }

    throw new Error(`Named format '${format}' not found`)
  }

  throw new Error('Must provide --hash, --lid, or --format parameter')
}

/**
 * Check if format data removal is safe
 * @param {string} format_hash - Format hash to check
 * @returns {Promise<boolean>}
 */
const check_removal_safety = async (format_hash) => {
  const active_season_count = await db('seasons')
    .where('league_format_hash', format_hash)
    .count('* as count')
    .first()

  return active_season_count.count === 0
}

/**
 * Get tables and hash column for format type
 * @param {string} format_type - Type of format ('league' or 'scoring')
 * @returns {Object} Tables configuration
 */
const get_format_tables = (format_type) => {
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
 * @param {string} format_hash - Format hash to remove
 * @param {string} format_type - Type of format ('league' or 'scoring')
 * @param {Object} options - Options object
 * @returns {Promise<Object>} Removal counts by table
 */
const remove_format_data = async (format_hash, format_type, options = {}) => {
  const { dry_run = false } = options
  const { tables, hash_column } = get_format_tables(format_type)
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
 * Process a single format (generate or remove data)
 * @param {Object} params - Parameters object
 * @param {string} params.hash - Format hash
 * @param {string} params.name - Format name
 * @param {string} params.type - Format type ('league' or 'scoring')
 * @param {Object} options - Options object
 */
const process_single_format = async ({ hash, name, type }, options = {}) => {
  const { remove = false, dry_run = false } = options

  console.log(`\n${'='.repeat(80)}`)
  console.log(
    `${remove ? 'REMOVING' : 'GENERATING'} DATA FOR ${type.toUpperCase()} FORMAT: ${name}`
  )
  console.log(`Hash: ${hash}`)
  console.log(`${'='.repeat(80)}`)

  if (remove) {
    // Check if removal is safe
    if (type === 'league') {
      const is_safe = await check_removal_safety(hash)
      if (!is_safe) {
        throw new Error(
          `Cannot remove format '${hash}' - it is in use by active seasons`
        )
      }
    }

    // Remove data
    const removal_counts = await remove_format_data(hash, type, { dry_run })

    if (dry_run) {
      console.log('DRY RUN - No data was actually removed')
      console.log('The following data would be removed:')
    } else {
      console.log('Successfully removed format data')
      console.log('The following data was removed:')
    }

    for (const [table, count] of Object.entries(removal_counts)) {
      if (count > 0) {
        console.log(`  - ${table}: ${count} rows`)
      }
    }
  } else {
    // Generate data
    const steps =
      type === 'scoring'
        ? STEP_CONFIGURATION.scoring_steps
        : STEP_CONFIGURATION.league_steps

    // If it's a league format, also ensure the associated scoring format data exists
    if (type === 'league') {
      const league_format = await db('league_formats')
        .leftJoin(
          'league_scoring_formats',
          'league_formats.scoring_format_hash',
          'league_scoring_formats.scoring_format_hash'
        )
        .where('league_format_hash', hash)
        .first()

      if (league_format && league_format.scoring_format_hash) {
        console.log(
          `\nEnsuring scoring format data exists: ${league_format.scoring_format_hash}`
        )

        // Generate scoring format data first if needed
        await generate_format_data(
          `scoring-${league_format.scoring_format_hash.slice(0, 8)}`,
          league_format.scoring_format_hash,
          'scoring',
          STEP_CONFIGURATION.scoring_steps,
          options
        )
      }
    }

    // Generate format data
    await generate_format_data(name, hash, type, steps, options)
  }

  console.log(`\n${remove ? 'REMOVAL' : 'GENERATION'} COMPLETE FOR ${name}!`)
}

/**
 * Discover all format hashes across all format data tables
 * @returns {Promise<{scoring: Set, league: Set}>}
 */
const discover_all_format_hashes = async () => {
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
 * @param {Set} league_hashes - League format hashes to check
 * @returns {Promise<{active_in_leagues: Set, active_in_seasons: Set}>}
 */
const check_active_usage = async (league_hashes) => {
  const active_in_leagues = new Set()
  const active_in_seasons = new Set()

  // Check active leagues
  try {
    const active_leagues = await db('leagues')
      .whereIn('league_format_hash', Array.from(league_hashes))
      .whereNotNull('league_format_hash')
      .pluck('league_format_hash')
    active_leagues.forEach((hash) => active_in_leagues.add(hash))
  } catch (error) {
    console.warn(`Could not check leagues table: ${error.message}`)
  }

  // Check active seasons
  try {
    const active_seasons = await db('seasons')
      .whereIn('league_format_hash', Array.from(league_hashes))
      .whereNotNull('league_format_hash')
      .pluck('league_format_hash')
    active_seasons.forEach((hash) => active_in_seasons.add(hash))
  } catch (error) {
    console.warn(`Could not check seasons table: ${error.message}`)
  }

  return { active_in_leagues, active_in_seasons }
}

/**
 * Check if scoring format is referenced by league formats
 * @param {string} scoring_hash - Scoring format hash to check
 * @param {Set} league_hashes - Set of all league format hashes
 * @returns {Promise<boolean>}
 */
const is_scoring_format_referenced = async (scoring_hash, league_hashes) => {
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
 * Classify formats as orphaned or active
 * @returns {Promise<Object>} Classification results
 */
const classify_format_orphans = async () => {
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
  const { active_in_leagues, active_in_seasons } = await check_active_usage(
    league
  )

  // Classify scoring formats
  const orphaned_scoring = []
  for (const hash of scoring) {
    if (named_scoring_hashes.has(hash)) {
      continue // Skip named formats
    }
    const is_referenced = await is_scoring_format_referenced(hash, league)
    if (!is_referenced) {
      orphaned_scoring.push(hash)
    }
  }

  // Classify league formats
  const orphaned_league = Array.from(league).filter(
    (hash) =>
      !named_league_hashes.has(hash) &&
      !active_in_leagues.has(hash) &&
      !active_in_seasons.has(hash)
  )

  return {
    all_formats: { scoring, league },
    named_formats: { scoring: named_scoring_hashes, league: named_league_hashes },
    active_usage: { active_in_leagues, active_in_seasons },
    orphaned: { scoring: orphaned_scoring, league: orphaned_league }
  }
}

/**
 * Enhanced safety check before removal
 * @param {string} format_hash - Format hash to check
 * @param {string} format_type - Type of format
 * @returns {Promise<{safe: boolean, reasons: string[]}>}
 */
const enhanced_safety_check = async (format_hash, format_type) => {
  const reasons = []

  // Check if it's a named format
  if (format_type === 'scoring' && named_scoring_formats) {
    const is_named = Object.values(named_scoring_formats).some(
      (f) => f.hash === format_hash
    )
    if (is_named) reasons.push('Format is a named scoring format')
  }

  if (format_type === 'league' && named_league_formats) {
    const is_named = Object.values(named_league_formats).some(
      (f) => f.hash === format_hash
    )
    if (is_named) reasons.push('Format is a named league format')
  }

  // Check active usage in leagues
  try {
    const league_usage = await db('leagues')
      .where('league_format_hash', format_hash)
      .count('* as count')
      .first()
    if (league_usage && league_usage.count > 0) {
      reasons.push(`Used by ${league_usage.count} active leagues`)
    }
  } catch (error) {
    console.warn(`Could not check league usage: ${error.message}`)
  }

  // Check active usage in seasons
  try {
    const season_usage = await db('seasons')
      .where('league_format_hash', format_hash)
      .count('* as count')
      .first()
    if (season_usage && season_usage.count > 0) {
      reasons.push(`Used by ${season_usage.count} active seasons`)
    }
  } catch (error) {
    console.warn(`Could not check season usage: ${error.message}`)
  }

  // For scoring formats, check if used by league formats
  if (format_type === 'scoring') {
    try {
      const league_format_usage = await db('league_formats')
        .where('scoring_format_hash', format_hash)
        .count('* as count')
        .first()
      if (league_format_usage && league_format_usage.count > 0) {
        reasons.push(`Used by ${league_format_usage.count} league formats`)
      }
    } catch (error) {
      console.warn(`Could not check league format usage: ${error.message}`)
    }
  }

  return {
    safe: reasons.length === 0,
    reasons
  }
}

/**
 * Enhanced orphaned data cleanup
 * @param {Object} options - Options object
 */
const cleanup_orphaned_data = async (options = {}) => {
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
    `- Active in leagues: ${classification.active_usage.active_in_leagues.size}`
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
    const safety_check = await enhanced_safety_check(league_hash, 'league')

    if (!safety_check.safe) {
      console.log(`\nSkipping league format ${league_hash}:`)
      safety_check.reasons.forEach((reason) => console.log(`  - ${reason}`))
      continue
    }

    console.log(
      `\n${dry_run ? 'Would remove' : 'Removing'} orphaned league format: ${league_hash}`
    )

    const removal_counts = await remove_format_data(league_hash, 'league', {
      dry_run
    })

    for (const [table, count] of Object.entries(removal_counts)) {
      if (count > 0) {
        console.log(`  - ${table}: ${count} rows`)
        total_removed += count
      }
    }

    // Also remove from league_formats table (only for truly orphaned formats)
    if (!dry_run) {
      try {
        const deleted = await db('league_formats')
          .where('league_format_hash', league_hash)
          .del()
        if (deleted > 0) {
          console.log(`  - league_formats: ${deleted} row(s)`)
          total_removed += deleted
        }
      } catch (error) {
        console.warn(`Could not remove from league_formats: ${error.message}`)
      }
    }
  }

  // Process orphaned scoring formats
  for (const scoring_hash of classification.orphaned.scoring) {
    const safety_check = await enhanced_safety_check(scoring_hash, 'scoring')

    if (!safety_check.safe) {
      console.log(`\nSkipping scoring format ${scoring_hash}:`)
      safety_check.reasons.forEach((reason) => console.log(`  - ${reason}`))
      continue
    }

    console.log(
      `\n${dry_run ? 'Would remove' : 'Removing'} orphaned scoring format: ${scoring_hash}`
    )

    const removal_counts = await remove_format_data(scoring_hash, 'scoring', {
      dry_run
    })

    for (const [table, count] of Object.entries(removal_counts)) {
      if (count > 0) {
        console.log(`  - ${table}: ${count} rows`)
        total_removed += count
      }
    }

    // Also remove from league_scoring_formats table (only for truly orphaned formats)
    if (!dry_run) {
      try {
        const deleted = await db('league_scoring_formats')
          .where('scoring_format_hash', scoring_hash)
          .del()
        if (deleted > 0) {
          console.log(`  - league_scoring_formats: ${deleted} row(s)`)
          total_removed += deleted
        }
      } catch (error) {
        console.warn(
          `Could not remove from league_scoring_formats: ${error.message}`
        )
      }
    }
  }

  console.log(`\nENHANCED CLEANUP COMPLETE!`)
  console.log(
    `Total ${dry_run ? 'would be removed' : 'removed'}: ${total_removed} rows`
  )
}

/**
 * Generate data for all formats
 * @param {Object} options - Options object
 */
const generate_all_formats = async (options = {}) => {
  const {
    format_types = ['scoring', 'league'],
    dry_run = false,
    only_missing = false
  } = options

  console.log('STARTING FORMAT DATA GENERATION')
  console.log(`Formats to process: ${format_types.join(', ')}`)
  console.log(`Dry run: ${dry_run}`)
  console.log(`Only missing data: ${only_missing}`)

  // Generate core formats first if needed
  if (!options.skip_core_formats) {
    await generate_core_formats(options)
  }

  // Process scoring formats
  if (format_types.includes('scoring')) {
    await process_format_type(
      'scoring',
      named_scoring_formats,
      STEP_CONFIGURATION.scoring_steps,
      options
    )
  }

  // Process league formats (depends on scoring formats being done)
  if (format_types.includes('league')) {
    await process_format_type(
      'league',
      named_league_formats,
      STEP_CONFIGURATION.league_steps,
      options
    )
  }

  console.log(`\nFORMAT DATA GENERATION COMPLETE!`)
}

// Configure yargs
const argv = yargs(hideBin(process.argv))
  .option('dry-run', {
    type: 'boolean',
    default: false,
    describe: 'Preview what would be executed without running'
  })
  .option('continue-on-error', {
    type: 'boolean',
    default: false,
    describe: 'Continue processing even if some steps fail'
  })
  .option('skip-core-formats', {
    type: 'boolean',
    default: false,
    describe: 'Skip generating core format definitions'
  })
  .option('scoring-only', {
    type: 'boolean',
    default: false,
    describe: 'Only process scoring formats'
  })
  .option('league-only', {
    type: 'boolean',
    default: false,
    describe: 'Only process league formats'
  })
  .option('all-formats', {
    type: 'boolean',
    default: true,
    describe: 'Generate data for all scoring and league formats'
  })
  .option('formats', {
    type: 'string',
    describe: 'Only process specific formats (comma-separated)',
    coerce: (arg) => (arg ? arg.split(',') : [])
  })
  .option('skip-steps', {
    type: 'string',
    describe: 'Skip specific generation steps (comma-separated)',
    coerce: (arg) => (arg ? arg.split(',') : [])
  })
  .option('only-steps', {
    type: 'string',
    describe: 'Only run specific generation steps (comma-separated)',
    coerce: (arg) => (arg ? arg.split(',') : [])
  })
  .option('only-missing', {
    type: 'boolean',
    default: true,
    describe: 'Only generate missing data (skip if data already exists)'
  })
  .option('hash', {
    type: 'string',
    describe: 'Process specific league format hash'
  })
  .option('lid', {
    type: 'number',
    describe: 'Process format for specific league ID'
  })
  .option('format', {
    type: 'string',
    describe: 'Process specific named format (e.g., ppr_12_team)'
  })
  .option('remove', {
    type: 'boolean',
    default: false,
    describe: 'Remove data instead of generating it'
  })
  .option('cleanup-orphaned', {
    type: 'boolean',
    default: false,
    describe: 'Remove data for unused format hashes'
  })
  .help()
  .alias('help', 'h')
  .example('$0', 'Generate all format data (full run)')
  .example('$0 --dry-run', 'Preview what would be generated')
  .example('$0 --scoring-only', 'Only generate scoring format data')
  .example(
    '$0 --formats standard,half_ppr,ppr',
    'Only generate data for specific formats'
  )
  .example(
    '$0 --skip-steps scoring_format_gamelogs,league_format_gamelogs',
    'Skip expensive steps like gamelogs'
  )
  .example(
    '$0 --only-steps scoring_format_projections,league_format_projections',
    'Only run projection processing'
  )
  .example(
    '$0 --no-only-missing',
    'Regenerate all data even if it already exists'
  )
  .example(
    '$0 --only-missing --formats standard,ppr',
    'Generate only missing data for specific formats'
  )
  .example('$0 --lid 1', 'Generate data for league ID 1')
  .example('$0 --hash abc123def', 'Generate data for specific format hash')
  .example('$0 --format ppr_12_team', 'Generate data for named format')
  .example(
    '$0 --remove --hash abc123def --dry-run',
    'Preview removal of format data'
  )
  .example('$0 --cleanup-orphaned', 'Remove data for unused format hashes').argv

/**
 * Parse command line arguments and return options
 * @returns {Object} Parsed arguments with action and options
 */
const parse_args = () => {
  // Check for single format parameters
  const has_single_format = argv.hash || argv.lid !== undefined || argv.format

  // Validate parameter combinations
  if (has_single_format) {
    const param_count = [argv.hash, argv.lid, argv.format].filter(
      (p) => p !== undefined && p !== null
    ).length
    if (param_count > 1) {
      throw new Error(
        'Cannot specify multiple format parameters (--hash, --lid, --format)'
      )
    }
  }

  if (argv.remove && !has_single_format && !argv['cleanup-orphaned']) {
    throw new Error('--remove requires --hash, --lid, or --format parameter')
  }

  const options = {
    dry_run: argv['dry-run'],
    continue_on_error: argv['continue-on-error'],
    skip_core_formats: argv['skip-core-formats'],
    format_types: ['scoring', 'league'],
    formats: argv.formats || [],
    skip_steps: argv['skip-steps'] || [],
    only_steps: argv['only-steps'] || [],
    only_missing: argv['only-missing'],
    // New options
    hash: argv.hash,
    lid: argv.lid,
    format: argv.format,
    remove: argv.remove,
    cleanup_orphaned: argv['cleanup-orphaned']
  }

  // Handle format type options
  if (argv['scoring-only']) {
    options.format_types = ['scoring']
  } else if (argv['league-only']) {
    options.format_types = ['league']
  }

  // Determine action
  if (options.cleanup_orphaned) {
    return { action: 'cleanup', options }
  } else if (has_single_format) {
    return { action: 'single', options }
  } else {
    return { action: 'batch', options }
  }
}

/**
 * Main script function
 */
const script = async () => {
  const { action, options } = parse_args()

  switch (action) {
    case 'cleanup':
      await cleanup_orphaned_data(options)
      break

    case 'single':
      {
        // Resolve format hash from parameters
        const format_info = await resolve_format_hash({
          hash: options.hash,
          lid: options.lid,
          format: options.format,
          year: constants.season.year
        })

        await process_single_format(format_info, options)
        break
      }

    case 'batch':
    default:
      await generate_all_formats(options)
      break
  }
}

/**
 * Main function with error handling
 */
const main = async () => {
  let error
  try {
    await script()
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default script
