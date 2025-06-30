#!/usr/bin/env node

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { constants } from '#libs-shared'
import { named_scoring_formats } from '#libs-shared/named-scoring-formats-generated.mjs'
import { named_league_formats } from '#libs-shared/named-league-formats-generated.mjs'

const log = debug('generate-format-data')
debug.enable('generate-format-data')

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

// Execute a script with arguments
const execute_script = (script_name, args = []) => {
  return new Promise((resolve, reject) => {
    const script_path = path.join(__dirname, script_name)
    console.log(`\n🔄 Executing: node ${script_name} ${args.join(' ')}`)

    const child = spawn('node', [script_path, ...args], {
      stdio: 'inherit',
      cwd: path.dirname(__dirname)
    })

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Completed: ${script_name}`)
        // Add a small delay to allow connections to properly close
        setTimeout(resolve, 500)
      } else {
        console.error(`❌ Failed: ${script_name} (exit code ${code})`)
        reject(new Error(`Script ${script_name} failed with exit code ${code}`))
      }
    })

    child.on('error', (error) => {
      console.error(`❌ Error executing ${script_name}:`, error.message)
      reject(error)
    })
  })
}

// Check if a script file exists
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

// Check if a format exists in the database
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

// Check if data exists for a format in a specific table
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

    // Special handling for different table structures
    let query = db(table_name).where(hash_column, format_hash)

    // Add additional checks based on the step type
    if (step_name.includes('gamelogs')) {
      query = query.limit(1)
    } else if (step_name.includes('seasonlogs')) {
      // Check if we have data for recent years
      query = query.where('year', '>=', 2020).limit(1)
    } else if (step_name.includes('careerlogs')) {
      query = query.limit(1)
    } else if (step_name.includes('projections')) {
      // Check for projections using the last year with stats
      query = query.where('year', constants.season.stats_season_year).limit(1)
    } else if (step_name === 'league_format_draft_values') {
      query = query.limit(1)
    }

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

// Generate data for a specific format
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
      `⚠️  Format ${format_name} (${format_hash}) not found in database - skipping`
    )
    return
  }

  const {
    skip_steps = [],
    only_steps = [],
    dry_run = false,
    only_missing = false
  } = options

  for (const step_name of steps) {
    // Skip if this step should be skipped
    if (skip_steps.includes(step_name)) {
      console.log(`⏭️  Skipping step: ${step_name}`)
      continue
    }

    // Skip if we're only running specific steps and this isn't one of them
    if (only_steps.length > 0 && !only_steps.includes(step_name)) {
      console.log(`⏭️  Skipping step (not in onlySteps): ${step_name}`)
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
        console.log(`⏭️  Skipping step ${step_name}: Data already exists`)
        continue
      }
    }

    const config = generation_scripts[step_name]
    if (!config) {
      console.log(`⚠️  Unknown step: ${step_name}`)
      continue
    }

    // Check if script exists
    const exists = await script_exists(config.script)
    if (!exists) {
      console.log(`❌ Script not found: ${config.script}`)
      continue
    }

    console.log(`\n📋 Step: ${step_name}`)
    console.log(`   Description: ${config.description}`)
    console.log(`   Tables: ${config.tables.join(', ')}`)

    if (dry_run) {
      console.log(`   🏃 DRY RUN: Would execute ${config.script}`)
      continue
    }

    try {
      // Prepare arguments by replacing placeholders
      const args = config.args.map((arg) => {
        if (arg === '{scoring_format_hash}') return format_hash
        if (arg === '{league_format_hash}') return format_hash
        return arg
      })

      await execute_script(config.script, args)
    } catch (error) {
      console.error(`❌ Failed to execute step ${step_name}:`, error.message)

      // Skip format data generation errors but show warning
      if (
        error.message.includes('not found') ||
        error.message.includes('missing or invalid') ||
        error.message.includes('undefined')
      ) {
        console.log(
          `⚠️  Skipping ${step_name} for ${format_name} - format may need to be generated first`
        )
        if (!options.continue_on_error) {
          continue // Skip this step but continue with format
        }
      } else if (!options.continue_on_error) {
        throw error
      }
    }
  }
}

// Generate data for all formats
const generate_all_formats = async (options = {}) => {
  const {
    format_types = ['scoring', 'league'],
    dry_run = false,
    only_missing = false
  } = options

  // Step execution order
  const scoring_steps = [
    'scoring_format_gamelogs',
    'scoring_format_seasonlogs',
    'scoring_format_careerlogs',
    'scoring_format_projections'
  ]

  const league_steps = [
    'league_format_gamelogs',
    'league_format_seasonlogs',
    'league_format_careerlogs',
    'league_format_projections',
    'league_format_draft_values'
  ]

  console.log('🚀 STARTING FORMAT DATA GENERATION')
  console.log(`Formats to process: ${format_types.join(', ')}`)
  console.log(`Dry run: ${dry_run}`)
  console.log(`Only missing data: ${only_missing}`)

  // Generate core formats first if needed
  if (!options.skip_core_formats) {
    console.log(`\n${'='.repeat(80)}`)
    console.log('GENERATING CORE FORMAT DEFINITIONS')
    console.log(`${'='.repeat(80)}`)

    const core_exists = await script_exists(
      generation_scripts.core_formats.script
    )
    if (core_exists && !dry_run) {
      await execute_script(generation_scripts.core_formats.script)
    } else if (!core_exists) {
      console.log(
        `❌ Core format script not found: ${generation_scripts.core_formats.script}`
      )
    } else {
      console.log(`🏃 DRY RUN: Would generate core formats`)
    }
  }

  // Process scoring formats
  if (format_types.includes('scoring')) {
    console.log(
      `\n🎯 Processing ${Object.keys(named_scoring_formats).length} scoring formats...`
    )

    for (const [format_name, format_data] of Object.entries(
      named_scoring_formats
    )) {
      if (
        options.formats &&
        options.formats.length > 0 &&
        !options.formats.includes(format_name)
      ) {
        console.log(
          `⏭️  Skipping format: ${format_name} (not in format filter)`
        )
        continue
      }

      await generate_format_data(
        format_name,
        format_data.hash,
        'scoring',
        scoring_steps,
        options
      )
      
      // Add a small delay between formats to prevent connection exhaustion
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  // Process league formats (depends on scoring formats being done)
  if (format_types.includes('league')) {
    console.log(
      `\n🏟️  Processing ${Object.keys(named_league_formats).length} league formats...`
    )

    for (const [format_name, format_data] of Object.entries(
      named_league_formats
    )) {
      if (
        options.formats &&
        options.formats.length > 0 &&
        !options.formats.includes(format_name)
      ) {
        console.log(
          `⏭️  Skipping format: ${format_name} (not in format filter)`
        )
        continue
      }

      await generate_format_data(
        format_name,
        format_data.hash,
        'league',
        league_steps,
        options
      )
      
      // Add a small delay between formats to prevent connection exhaustion
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  console.log(`\n✨ FORMAT DATA GENERATION COMPLETE!`)

  // Close database connection
  try {
    await db.destroy()
  } catch (error) {
    console.warn('Warning: Could not close database connection:', error.message)
  }
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
  ).argv

// Parse command line arguments
const parse_args = () => {
  const options = {
    dry_run: argv['dry-run'],
    continue_on_error: argv['continue-on-error'],
    skip_core_formats: argv['skip-core-formats'],
    format_types: ['scoring', 'league'],
    formats: argv.formats || [],
    skip_steps: argv['skip-steps'] || [],
    only_steps: argv['only-steps'] || [],
    only_missing: argv['only-missing']
  }

  // Handle format type options
  if (argv['scoring-only']) {
    options.format_types = ['scoring']
  } else if (argv['league-only']) {
    options.format_types = ['league']
  }

  return { action: 'generate', options }
}

// Main script function
const script = async () => {
  const { options } = parse_args()
  await generate_all_formats(options)
}

// Main function
const main = async () => {
  let error
  try {
    await script()
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.PROCESS_PROJECTIONS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default script
