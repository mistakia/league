#!/usr/bin/env node

import { SleeperCollector } from './platform-collectors/sleeper-collector.mjs'
import { EspnCollector } from './platform-collectors/espn-collector.mjs'
import { YahooCollector } from './platform-collectors/yahoo-collector.mjs'
import { MflCollector } from './platform-collectors/mfl-collector.mjs'
import { is_main } from '#libs-server'
import {
  save_fixture,
  create_fixture_structure,
  normalize_response_type_for_path
} from './platform-collectors/fixture-utils.mjs'

/**
 * Main script for collecting API responses from external fantasy platforms
 * Generates fixtures for testing with real platform data
 */

const COLLECTORS = {
  sleeper: SleeperCollector,
  espn: EspnCollector,
  yahoo: YahooCollector,
  mfl: MflCollector
  // Additional collectors can be added here:
  // cbs: CbsCollector,
  // ffpc: FfpcCollector,
  // nffc: NffcCollector,
  // fantrax: FantraxCollector,
  // fleaflicker: FleaflickerCollector,
  // nfl: NflCollector,
  // rtsports: RtsportsCollector
}

/**
 * Collect responses for a specific platform
 * @param {string} platform - Platform name
 * @param {string} league_id - Platform-specific league identifier
 * @param {object} options - Collection options
 */
async function collect_platform_responses(platform, league_id, options = {}) {
  console.log(`\n=== Collecting responses for ${platform.toUpperCase()} ===`)
  console.log(`League ID: ${league_id}`)
  console.log(`Options:`, JSON.stringify(options, null, 2))

  const start_time = Date.now()

  try {
    // Validate platform
    const CollectorClass = COLLECTORS[platform]
    if (!CollectorClass) {
      const available_platforms = Object.keys(COLLECTORS).join(', ')
      throw new Error(
        `No collector available for platform: ${platform}. Available platforms: ${available_platforms}`
      )
    }

    // Initialize collector
    const collector = new CollectorClass({
      anonymize: options.anonymize !== false, // Default to true
      validate: options.validate !== false, // Default to true
      save_to_fixtures: options.save !== false // Default to true
    })

    // Get platform info for logging
    const platform_info = collector.get_platform_info()
    console.log(`Platform Info:`)
    console.log(`  Base URL: ${platform_info.base_url}`)
    console.log(
      `  Authentication: ${platform_info.supports_authentication ? 'Required' : 'Not required'}`
    )
    console.log(
      `  Implementation Status: ${platform_info.implementation_status || 'production'}`
    )

    // Handle authentication
    if (platform_info.supports_authentication) {
      if (!options.credentials) {
        console.warn(
          `Warning: ${platform} requires authentication but no credentials provided`
        )
        console.warn(
          `Required credentials:`,
          platform_info.required_credentials
        )
      } else {
        console.log('Authenticating with platform...')
        try {
          const auth_success = await collector.authenticate(options.credentials)
          if (!auth_success) {
            throw new Error(`Authentication failed for ${platform}`)
          }
          console.log('Authentication successful')
        } catch (auth_error) {
          console.error('Authentication failed:', auth_error.message)
          throw auth_error
        }
      }
    } else {
      console.log('No authentication required for this platform')
    }

    // Validate league ID format if possible
    if (options.validate_league_id !== false) {
      console.log(`Validating league ID format for ${platform}...`)
      // Basic validation - could be enhanced per platform
      if (!league_id || league_id.toString().trim() === '') {
        throw new Error('League ID is required and cannot be empty')
      }
    }

    // Collect responses with detailed progress
    console.log(`Starting data collection for league: ${league_id}`)
    const collection_start = Date.now()

    const responses = {}
    const errors = {}

    // Standard response types to collect
    // Note: These map to config keys, which will be normalized for file paths
    const response_types = ['league', 'rosters', 'players', 'transactions']

    for (const response_type_key of response_types) {
      const response_type = normalize_response_type_for_path(response_type_key)
      try {
        console.log(`  Collecting ${response_type}...`)

        // Map response type to collector method name
        // Handle special case: 'league' -> 'collect_league_config'
        const method_name =
          response_type_key === 'league'
            ? 'collect_league_config'
            : `collect_${response_type_key}`

        if (typeof collector[method_name] === 'function') {
          const data = await collector[method_name](league_id)

          // Create standardized fixture structure
          const fixture_data = create_fixture_structure({
            platform,
            response_type: response_type_key,
            data,
            options: {
              anonymized: options.anonymize !== false,
              league_id
            }
          })

          // Save fixture if requested
          if (options.save !== false) {
            const fixture_path = `platform-responses/${platform}/${response_type}.json`
            await save_fixture(fixture_path, fixture_data, {
              log_success: false
            })
          }

          responses[response_type] = data
          console.log(`  ${response_type} collected successfully`)
        } else {
          console.log(
            `  ${response_type} collection not implemented for ${platform}`
          )
          responses[response_type] = { error: 'Not implemented', data: null }
        }

        // Add small delay between requests to be respectful
        if (options.request_delay) {
          await new Promise((resolve) =>
            setTimeout(resolve, options.request_delay)
          )
        }
      } catch (error) {
        console.error(`  Failed to collect ${response_type}:`, error.message)
        errors[response_type] = {
          error: error.message,
          timestamp: new Date().toISOString()
        }
        responses[response_type] = { error: error.message, data: null }
      }
    }

    const collection_time = Date.now() - collection_start
    console.log(`Data collection completed in ${collection_time}ms`)

    // Collect edge cases if requested
    let edge_cases = null
    if (options.include_edge_cases) {
      console.log('Collecting edge cases...')
      try {
        edge_cases = await collector.collect_edge_cases(league_id)
        await save_fixture(`edge-cases/${platform}-edge-cases.json`, edge_cases)
        console.log(`Edge cases saved for ${platform}`)
      } catch (error) {
        console.warn(`Failed to collect edge cases: ${error.message}`)
        errors.edge_cases = {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }
    }

    // Generate comprehensive summary
    const execution_time = Date.now() - start_time
    const summary = {
      platform,
      league_id,
      execution_time_ms: execution_time,
      timestamp: new Date().toISOString(),
      platform_info,
      collection_results: {
        total_response_types: response_types.length,
        successful_collections: Object.keys(responses).filter(
          (key) => !responses[key]?.error
        ).length,
        failed_collections: Object.keys(errors).length,
        response_types_collected: Object.keys(responses).filter(
          (key) => !responses[key]?.error
        ),
        errors
      },
      options_used: options,
      edge_cases: edge_cases
        ? { collected: true, count: edge_cases.edge_cases?.length || 0 }
        : { collected: false }
    }

    console.log('\n=== Collection Summary ===')
    console.log(`  Platform: ${platform.toUpperCase()}`)
    console.log(`  League ID: ${league_id}`)
    console.log(`  Execution Time: ${execution_time}ms`)
    console.log(
      `  Successful Collections: ${summary.collection_results.successful_collections}/${summary.collection_results.total_response_types}`
    )
    if (Object.keys(errors).length > 0) {
      console.log(`  Errors: ${Object.keys(errors).length}`)
      console.log(`  Failed Response Types: ${Object.keys(errors).join(', ')}`)
    }

    // Save detailed summary
    await save_fixture(
      `collection-summaries/${platform}-${league_id}-${Date.now()}.json`,
      summary
    )
    console.log(`Summary saved to collection-summaries/`)

    return {
      success: true,
      platform,
      league_id,
      responses,
      summary,
      execution_time_ms: execution_time,
      errors
    }
  } catch (error) {
    const execution_time = Date.now() - start_time
    console.error(`Collection failed for ${platform}:`, error.message)

    const error_summary = {
      success: false,
      platform,
      league_id,
      error: error.message,
      execution_time_ms: execution_time,
      timestamp: new Date().toISOString(),
      options_used: options
    }

    // Save error summary
    try {
      await save_fixture(
        `collection-summaries/${platform}-${league_id}-error-${Date.now()}.json`,
        error_summary
      )
    } catch (save_error) {
      console.error('Failed to save error summary:', save_error.message)
    }

    throw error
  }
}

/**
 * Collect responses for multiple platforms
 * @param {object} config - Configuration object with platform/league mappings
 * @param {object} options - Global collection options
 */
async function collect_multiple_platforms(config, options = {}) {
  const results = []

  for (const [platform, league_configs] of Object.entries(config)) {
    if (!Array.isArray(league_configs)) {
      console.warn(`Skipping ${platform}: configuration should be an array`)
      continue
    }

    for (const league_config of league_configs) {
      try {
        const result = await collect_platform_responses(
          platform,
          league_config.league_id,
          {
            ...options,
            ...league_config.options
          }
        )
        results.push(result)

        // Add delay between collections to be respectful of APIs
        if (options.delay_between_collections) {
          console.log(
            `Waiting ${options.delay_between_collections}ms before next collection...`
          )
          await new Promise((resolve) =>
            setTimeout(resolve, options.delay_between_collections)
          )
        }
      } catch (error) {
        console.error(
          `Failed to collect for ${platform} league ${league_config.league_id}:`,
          error.message
        )
        results.push({
          platform,
          league_id: league_config.league_id,
          error: error.message
        })
      }
    }
  }

  return results
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log(`
Usage: node collect-platform-responses.mjs [command] [options]

Commands:
  single <platform> <league_id>     - Collect responses for single league
  batch <config_file>              - Collect responses for multiple leagues from config file
  platforms                        - List available platforms with implementation status
  validate <platform> <league_id>  - Test platform connection without collecting data
  example-config                   - Generate example configuration file
  help                            - Show this help message

Options:
  --no-anonymize                  - Skip data anonymization
  --no-validate                   - Skip response validation  
  --no-save                       - Don't save fixtures (just print to console)
  --include-edge-cases            - Collect edge case scenarios
  --delay <ms>                    - Delay between collections (default: 1000)
  --request-delay <ms>            - Delay between individual API requests (default: 0)
  --credentials-file <file>       - JSON file with platform credentials
  --output-dir <dir>              - Custom output directory for fixtures
  --verbose                       - Enable verbose logging
  --dry-run                       - Show what would be collected without making API calls

Examples:
  node collect-platform-responses.mjs single sleeper 123456789
  node collect-platform-responses.mjs single espn 987654 --credentials-file ./creds.json
  node collect-platform-responses.mjs batch ./collection-config.json --include-edge-cases --delay 2000
  node collect-platform-responses.mjs validate sleeper 123456789
  node collect-platform-responses.mjs platforms
  node collect-platform-responses.mjs example-config > config-template.json
`)
    return
  }

  const command = args[0]
  const options = {
    anonymize: !args.includes('--no-anonymize'),
    validate: !args.includes('--no-validate'),
    save: !args.includes('--no-save'),
    include_edge_cases: args.includes('--include-edge-cases'),
    delay_between_collections: 1000,
    request_delay: 0,
    verbose: args.includes('--verbose'),
    dry_run: args.includes('--dry-run')
  }

  // Parse numeric options
  const parse_option = (option_name, default_value = 0) => {
    const index = args.indexOf(`--${option_name}`)
    if (index !== -1 && args[index + 1]) {
      const value = parseInt(args[index + 1], 10)
      return isNaN(value) ? default_value : value
    }
    return default_value
  }

  options.delay_between_collections = parse_option('delay', 1000)
  options.request_delay = parse_option('request-delay', 0)

  // Parse file options
  const parse_file_option = (option_name) => {
    const index = args.indexOf(`--${option_name}`)
    return index !== -1 && args[index + 1] ? args[index + 1] : null
  }

  const credentials_file = parse_file_option('credentials-file')
  const output_dir = parse_file_option('output-dir')

  // Load credentials if provided
  if (credentials_file) {
    try {
      const { readFileSync } = await import('fs')
      options.credentials = JSON.parse(readFileSync(credentials_file, 'utf8'))
      if (options.verbose) {
        console.log(`Loaded credentials from: ${credentials_file}`)
      }
    } catch (error) {
      console.error(`Failed to load credentials file: ${error.message}`)
      process.exit(1)
    }
  }

  // Set custom output directory
  if (output_dir) {
    // This would need to be passed to the save_fixture function
    options.output_dir = output_dir
    if (options.verbose) {
      console.log(`Using custom output directory: ${output_dir}`)
    }
  }

  try {
    switch (command) {
      case 'single': {
        if (args.length < 3) {
          console.error('Usage: single <platform> <league_id>')
          process.exit(1)
        }

        const platform = args[1]
        const league_id = args[2]

        const result = await collect_platform_responses(
          platform,
          league_id,
          options
        )
        console.log('\n=== Final Result ===')
        console.log(JSON.stringify(result, null, 2))
        break
      }

      case 'batch': {
        if (args.length < 2) {
          console.error('Usage: batch <config_file>')
          process.exit(1)
        }

        const config_file = args[1]
        const { readFileSync } = await import('fs')
        const config = JSON.parse(readFileSync(config_file, 'utf8'))

        const results = await collect_multiple_platforms(config, options)
        console.log('\n=== Batch Collection Results ===')
        console.log(JSON.stringify(results, null, 2))
        break
      }

      case 'platforms': {
        console.log('Available platforms:\n')
        for (const platform of Object.keys(COLLECTORS)) {
          const CollectorClass = COLLECTORS[platform]
          const temp_collector = new CollectorClass()
          const info = temp_collector.get_platform_info?.() || { platform }

          console.log(`${platform.toUpperCase()}`)
          console.log(
            `   Status: ${info.implementation_status || 'production'}`
          )
          console.log(
            `   Authentication: ${info.supports_authentication ? 'Required' : 'Not required'}`
          )
          console.log(`   Base URL: ${info.base_url}`)
          if (info.rate_limits) {
            console.log(
              `   Rate Limits: ${info.rate_limits.requests_per_minute || info.rate_limits.requests_per_hour || 'Unknown'} req/min`
            )
          }
          if (
            info.implementation_notes &&
            info.implementation_notes.length > 0
          ) {
            console.log(`   Notes: ${info.implementation_notes[0]}`)
          }
          console.log('')
        }
        break
      }

      case 'validate': {
        if (args.length < 3) {
          console.error('Usage: validate <platform> <league_id>')
          process.exit(1)
        }

        const platform = args[1]
        const league_id = args[2]

        console.log(
          `Validating connection to ${platform} league ${league_id}...`
        )

        // Dry run collection to test connectivity
        const validation_options = {
          ...options,
          save: false,
          dry_run: true,
          validate_league_id: true
        }

        try {
          const result = await collect_platform_responses(
            platform,
            league_id,
            validation_options
          )
          console.log('Validation successful!')
          console.log(`Platform: ${result.platform}`)
          console.log(`League ID: ${result.league_id}`)
          console.log(`Execution Time: ${result.execution_time_ms}ms`)
        } catch (error) {
          console.error('Validation failed:', error.message)
          process.exit(1)
        }
        break
      }

      case 'example-config': {
        console.log('# Example configuration file for batch collection')
        console.log('# Save this as config.json and modify as needed')
        console.log('')
        console.log(JSON.stringify(EXAMPLE_CONFIG, null, 2))
        break
      }

      case 'help': {
        // Re-show help message
        console.log(`
Usage: node collect-platform-responses.mjs [command] [options]

Commands:
  single <platform> <league_id>     - Collect responses for single league
  batch <config_file>              - Collect responses for multiple leagues from config file
  platforms                        - List available platforms with implementation status
  validate <platform> <league_id>  - Test platform connection without collecting data
  example-config                   - Generate example configuration file
  help                            - Show this help message

Options:
  --no-anonymize                  - Skip data anonymization
  --no-validate                   - Skip response validation  
  --no-save                       - Don't save fixtures (just print to console)
  --include-edge-cases            - Collect edge case scenarios
  --delay <ms>                    - Delay between collections (default: 1000)
  --request-delay <ms>            - Delay between individual API requests (default: 0)
  --credentials-file <file>       - JSON file with platform credentials
  --output-dir <dir>              - Custom output directory for fixtures
  --verbose                       - Enable verbose logging
  --dry-run                       - Show what would be collected without making API calls

Examples:
  node collect-platform-responses.mjs single sleeper 123456789
  node collect-platform-responses.mjs single espn 987654 --credentials-file ./creds.json
  node collect-platform-responses.mjs batch ./collection-config.json --include-edge-cases --delay 2000
  node collect-platform-responses.mjs validate sleeper 123456789
  node collect-platform-responses.mjs platforms
  node collect-platform-responses.mjs example-config > config-template.json
`)
        break
      }

      default:
        console.error(`Unknown command: ${command}`)
        console.error('Use "help" command to see available commands')
        process.exit(1)
    }
  } catch (error) {
    console.error('Collection failed:', error.message)
    if (options.validate) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

// Example configuration file format for batch collection
export const EXAMPLE_CONFIG = {
  sleeper: [
    {
      league_id: '123456789',
      options: {
        anonymize: true,
        include_edge_cases: true
      }
    }
  ],
  espn: [
    {
      league_id: '987654321',
      options: {
        credentials: {
          swid: 'your-swid',
          espn_s2: 'your-espn-s2'
        }
      }
    }
  ]
}

if (is_main(import.meta.url)) {
  main().catch(console.error)
}
