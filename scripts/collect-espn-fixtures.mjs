#!/usr/bin/env node

import { EspnCollector } from './platform-collectors/espn-collector.mjs'
import { is_main } from '#libs-server'
import { load_platform_config } from '#libs-server/external-fantasy-leagues/utils/platform-config.mjs'
import {
  save_fixture,
  create_fixture_structure,
  normalize_response_type_for_path,
  get_response_types_from_config
} from './platform-collectors/fixture-utils.mjs'

/**
 * Collect ESPN API responses and save as fixtures
 * @param {object} options - Collection options
 */
async function collect_espn_fixtures(options = {}) {
  console.log('\n=== Collecting ESPN API Fixtures ===')

  const start_time = Date.now()

  try {
    // Load platform configuration
    const platform_config = await load_platform_config(options.config_path)
    const espn_config = platform_config.platforms?.espn || platform_config.espn

    if (!espn_config) {
      throw new Error('ESPN configuration not found in platform config')
    }

    // Override league_id if provided via command line
    if (options.league_id) {
      if (espn_config.fixture_collection) {
        espn_config.fixture_collection.test_league_id = options.league_id
      } else {
        espn_config.league_id = options.league_id
      }
    }

    const season_year = options.season_year || new Date().getFullYear()
    const response_types = get_response_types_from_config(espn_config)

    console.log(
      `League ID: ${espn_config.league_id || espn_config.fixture_collection?.test_league_id}`
    )
    console.log(
      `API Base URL: ${espn_config.api_config?.base_url || 'https://fantasy.espn.com/apis/v3/games/ffl'}`
    )
    console.log(`Response Types: ${response_types.join(', ')}`)
    console.log(`Season Year: ${season_year}`)

    // Initialize collector
    const collector = new EspnCollector({
      anonymize: options.anonymize !== false, // Default to true
      validate: options.validate !== false, // Default to true
      save_to_fixtures: false // We'll handle saving manually
    })

    // Authenticate if credentials provided
    if (espn_config.credentials) {
      const auth_success = await collector.authenticate(espn_config.credentials)
      if (!auth_success) {
        console.warn(
          'ESPN authentication failed - only public leagues will be accessible'
        )
      }
    } else if (options.espn_s2 && options.swid) {
      const auth_success = await collector.authenticate({
        espn_s2: options.espn_s2,
        swid: options.swid
      })
      if (!auth_success) {
        console.warn('ESPN authentication failed with provided credentials')
      }
    } else {
      console.warn(
        'No ESPN credentials provided - only public leagues will be accessible'
      )
    }

    const results = {}
    const league_id =
      espn_config.league_id || espn_config.fixture_collection?.test_league_id

    if (!league_id) {
      throw new Error(
        'League ID is required. Provide it in config or via --league-id option'
      )
    }

    // Collect each response type
    for (const response_type_key of response_types) {
      const response_type = normalize_response_type_for_path(response_type_key)
      console.log(`\n--- Collecting ${response_type} ---`)

      try {
        let fixture_data

        switch (response_type_key) {
          case 'league':
            fixture_data = await collector.collect_league_config(
              league_id,
              season_year
            )
            break
          case 'teams':
          case 'rosters':
            fixture_data = await collector.collect_rosters(
              league_id,
              season_year
            )
            break
          case 'transactions':
            fixture_data = await collector.collect_transactions(
              league_id,
              season_year
            )
            break
          case 'players':
            fixture_data = await collector.collect_players(
              league_id,
              season_year
            )
            break
          case 'draft':
            fixture_data = await collector.collect_draft_data(
              league_id,
              season_year
            )
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
            platform: 'espn',
            response_type: response_type_key,
            data: fixture_data,
            options: {
              anonymized: options.anonymize !== false,
              season_year,
              league_id
            }
          })

          // Save fixture to appropriate location
          const fixture_path = `platform-responses/espn/${response_type}.json`
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
      case '--season-year':
        options.season_year = parseInt(args[++i])
        break
      case '--espn-s2':
        options.espn_s2 = args[++i]
        break
      case '--swid':
        options.swid = args[++i]
        break
      case '--league-id':
        options.league_id = args[++i]
        break
      case '--no-anonymize':
        options.anonymize = false
        break
      case '--no-validate':
        options.validate = false
        break
      case '--help':
        console.log(`
Usage: node collect-espn-fixtures.mjs [options]

Options:
  --config <path>        Path to platform config file (default: libs-server/external-fantasy-leagues/external-platforms.json)
  --season-year <year>   Season year (default: current year)
  --league-id <id>       League ID (overrides config value)
  --espn-s2 <cookie>     ESPN S2 session cookie for private leagues
  --swid <cookie>        ESPN SWID identifier cookie for private leagues
  --no-anonymize         Disable data anonymization
  --no-validate          Disable data validation
  --help                 Show this help message

Authentication:
  ESPN requires cookies for private leagues. You can provide them via:
  1. Command line: --espn-s2 <value> --swid <value>
  2. Platform config file under espn.credentials
  
  To get these cookies:
  1. Log into ESPN Fantasy in your browser
  2. Open Developer Tools > Application > Cookies
  3. Find 'espn_s2' and 'SWID' values for fantasy.espn.com
`)
        process.exit(0)
        break
      default:
        console.error(`Unknown argument: ${arg}`)
        process.exit(1)
    }
  }

  await collect_espn_fixtures(options)
}

if (is_main(import.meta.url)) {
  main().catch(console.error)
}
