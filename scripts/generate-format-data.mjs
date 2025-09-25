#!/usr/bin/env node

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import is_main from '#libs-server/is-main.mjs'
import report_job from '#libs-server/report-job.mjs'
import { constants } from '#libs-shared'
import { named_scoring_formats } from '#libs-shared/named-scoring-formats-generated.mjs'
import { named_league_formats } from '#libs-shared/named-league-formats-generated.mjs'

import {
  SCRIPT_CONFIG,
  generation_scripts,
  STEP_CONFIGURATION,
  resolve_format_hash,
  execute_script,
  script_exists,
  process_format_type,
  process_single_format,
  cleanup_orphaned_data
} from '#libs-server/format-data-generation/index.mjs'

const log = debug(SCRIPT_CONFIG.log_name)
debug.enable(SCRIPT_CONFIG.log_name)

/**
 * Generate core format definitions
 * @param {Object} options - Options object
 */
const generate_core_formats = async (options) => {
  console.log(`\n${'='.repeat(80)}`)
  console.log('GENERATING CORE FORMAT DEFINITIONS')
  console.log(`${'='.repeat(80)}`)

  const core_exists = await script_exists({
    script_name: generation_scripts.core_formats.script
  })

  if (core_exists && !options.dry_run) {
    await execute_script({
      script_name: generation_scripts.core_formats.script,
      args: []
    })
  } else if (!core_exists) {
    console.log(
      `Core format script not found: ${generation_scripts.core_formats.script}`
    )
  } else {
    console.log(`DRY RUN: Would generate core formats`)
  }
}

/**
 * Generate data for all formats
 * @param {Object} [options={}] - Options object
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

    case 'single': {
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
 * Main function with error handling and job reporting
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
