#!/usr/bin/env node

import { SleeperCollector } from './platform-collectors/sleeper-collector.mjs'
import { is_main } from '#libs-server'
import { load_platform_config } from '#libs-server/external-fantasy-leagues/utils/platform-config.mjs'
import {
  save_fixture,
  create_fixture_structure,
  normalize_response_type_for_path,
  get_response_types_from_config
} from './platform-collectors/fixture-utils.mjs'

/**
 * Collect Sleeper API responses and save as fixtures
 * @param {object} options - Collection options
 */
async function collect_sleeper_fixtures(options = {}) {
  console.log('\n=== Collecting Sleeper API Fixtures ===')

  const start_time = Date.now()

  try {
    // Load platform configuration
    const platform_config = await load_platform_config(options.config_path)
    const sleeper_config =
      platform_config.platforms?.sleeper || platform_config.sleeper

    if (!sleeper_config) {
      throw new Error('Sleeper configuration not found in platform config')
    }

    const response_types = get_response_types_from_config(sleeper_config)
    const league_id =
      sleeper_config.league_id ||
      sleeper_config.fixture_collection?.test_league_id

    // Override league_id if provided via command line
    if (options.league_id) {
      if (sleeper_config.fixture_collection) {
        sleeper_config.fixture_collection.test_league_id = options.league_id
      } else {
        sleeper_config.league_id = options.league_id
      }
    }

    if (!league_id) {
      throw new Error(
        'League ID is required. Provide it in config or via --league-id option'
      )
    }

    console.log(`League ID: ${league_id}`)
    console.log(
      `API Base URL: ${sleeper_config.api_config?.base_url || sleeper_config.api_base_url}`
    )
    console.log(`Response Types: ${response_types.join(', ')}`)

    // Initialize collector
    const collector = new SleeperCollector({
      anonymize: options.anonymize !== false, // Default to true
      validate: options.validate !== false, // Default to true
      save_to_fixtures: false // We'll handle saving manually
    })

    const results = {}
    const final_league_id =
      sleeper_config.league_id ||
      sleeper_config.fixture_collection?.test_league_id

    // Collect each response type
    for (const response_type_key of response_types) {
      const response_type = normalize_response_type_for_path(response_type_key)
      console.log(`\n--- Collecting ${response_type} ---`)

      try {
        let fixture_data

        switch (response_type_key) {
          case 'league':
            fixture_data =
              await collector.collect_league_config(final_league_id)
            break
          case 'users':
            fixture_data = await collector.collect_users(final_league_id)
            break
          case 'rosters':
            fixture_data = await collector.collect_rosters(final_league_id)
            break
          case 'transactions': {
            // Collect transactions for specified week (default: 1)
            const week = options.week || 1
            fixture_data = await collector.collect_transactions(
              final_league_id,
              week
            )
            break
          }
          case 'players':
            fixture_data = await collector.collect_players()
            break
          default:
            console.warn(
              `  ⚠ Unknown response type: ${response_type_key}, skipping...`
            )
            continue
        }

        if (fixture_data) {
          // Create standardized fixture structure
          const formatted_fixture = create_fixture_structure({
            platform: 'sleeper',
            response_type: response_type_key,
            data: fixture_data,
            options: {
              anonymized: options.anonymize !== false,
              league_id: final_league_id
            }
          })

          // Save fixture to appropriate location
          const fixture_path = `platform-responses/sleeper/${response_type}.json`
          await save_fixture(fixture_path, formatted_fixture)
          results[response_type] = { success: true, fixture_path }
        } else {
          console.warn(`  ⚠ No data received for ${response_type}`)
          results[response_type] = { success: false, error: 'No data received' }
        }
      } catch (error) {
        console.error(`  ✗ Failed to collect ${response_type}:`, error.message)
        results[response_type] = { success: false, error: error.message }
      }
    }

    const end_time = Date.now()
    const duration = ((end_time - start_time) / 1000).toFixed(2)

    // Summary
    console.log(`\n=== Collection Summary ===`)
    console.log(`Duration: ${duration}s`)
    console.log(`Results:`)

    let successful = 0
    let failed = 0

    for (const [response_type, result] of Object.entries(results)) {
      if (result.success) {
        console.log(`  ✓ ${response_type}: ${result.fixture_path}`)
        successful++
      } else {
        console.log(`  ✗ ${response_type}: ${result.error}`)
        failed++
      }
    }

    console.log(`\nSummary: ${successful} successful, ${failed} failed`)

    if (failed > 0) {
      process.exit(1)
    }
  } catch (error) {
    console.error('Collection failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2)

  const options = {}

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    switch (arg) {
      case '--config':
        options.config_path = args[++i]
        break
      case '--league-id':
        options.league_id = args[++i]
        break
      case '--week':
        options.week = parseInt(args[++i])
        break
      case '--no-anonymize':
        options.anonymize = false
        break
      case '--no-validate':
        options.validate = false
        break
      case '--help':
        console.log(`
Usage: node collect-sleeper-fixtures.mjs [options]

Options:
  --config <path>      Path to platform config file (default: libs-server/external-fantasy-leagues/external-platforms.json)
  --league-id <id>     League ID (overrides config value)
  --week <number>      Week number for transactions (default: 1)
  --no-anonymize       Disable data anonymization
  --no-validate        Disable data validation
  --help               Show this help message
`)
        process.exit(0)
        break
      default:
        console.error(`Unknown argument: ${arg}`)
        process.exit(1)
    }
  }

  await collect_sleeper_fixtures(options)
}

if (is_main(import.meta.url)) {
  main().catch(console.error)
}
