#!/usr/bin/env node
/**
 * CLI tool for fetching external league data using production adapters
 *
 * NOTE: This script uses the production adapters (libs-server/external-fantasy-leagues/adapters/)
 * which transform platform data into canonical format. This is different from the collectors
 * in this directory, which are used to collect raw API responses for test fixtures.
 *
 * Use this script when you need to:
 * - Fetch and transform external league data for production use
 * - Test adapter functionality
 * - Debug canonical format transformations
 *
 * Use collectors (collect-*-fixtures.mjs) when you need to:
 * - Collect raw platform API responses for test fixtures
 * - Generate anonymized test data
 * - Update fixture files for testing
 */
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import {
  fetch_external_league_data,
  get_supported_platforms
} from '#libs-server/external-fantasy-leagues/index.mjs'

function print_json(data) {
  const json_text = JSON.stringify(data, null, 2)
  console.log(json_text)
}

async function main() {
  // Suppress noisy logs from adapters to keep stdout as pure JSON
  const original_log = console.log
  const original_warn = console.warn
  const original_error = console.error
  console.log = (..._args) => {}
  console.warn = (..._args) => {}

  const argv = yargs(hideBin(process.argv))
    .scriptName('fetch-external-league')
    .usage('$0 --platform <name> --league <id> [options]')
    .option('platform', {
      type: 'string',
      demandOption: true,
      describe: 'external platform (sleeper, espn)'
    })
    .option('league', {
      type: 'string',
      demandOption: true,
      describe: 'external league id'
    })
    .option('week', { type: 'number', describe: 'week number to fetch' })
    .option('year', { type: 'number', describe: 'season year override' })
    .option('include_players', { type: 'boolean', default: true })
    .option('include_transactions', { type: 'boolean', default: true })
    .option('espn_s2', {
      type: 'string',
      describe: 'espn s2 cookie (for private leagues)'
    })
    .option('swid', {
      type: 'string',
      describe: 'espn swid cookie (for private leagues)'
    })
    .help()
    .alias('h', 'help')
    .parseSync()

  const supported = get_supported_platforms()
  const platform_name = argv.platform.toLowerCase()
  if (!supported.includes(platform_name)) {
    // restore logging for error
    console.log = original_log
    console.warn = original_warn
    console.error = original_error
    throw new Error(
      `unsupported platform: ${argv.platform}. supported: ${supported.join(', ')}`
    )
  }

  const credentials = {}
  if (platform_name === 'espn') {
    if (argv.espn_s2 && argv.swid) {
      credentials.espn_s2 = argv.espn_s2
      credentials.swid = argv.swid
    }
  }

  const fetch_options = {
    week: argv.week,
    year: argv.year,
    include_players: argv.include_players,
    include_transactions: argv.include_transactions
  }

  const result = await fetch_external_league_data({
    platform: platform_name,
    external_league_id: argv.league,
    credentials,
    config: fetch_options
  })

  // restore logging and then print the JSON result
  console.log = original_log
  console.warn = original_warn
  console.error = original_error

  print_json(result)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
