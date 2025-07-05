#!/usr/bin/env node

import path from 'path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import debug from 'debug'

import {
  load_data_view_test_queries,
  get_data_view_results_query,
  is_main,
  update_test_file
} from '#libs-server'

const log = debug('update-test-queries')

/**
 * Update test query files with new expected_query values
 */
const main = async () => {
  try {
    const options = parse_arguments()

    log('Loading test cases...')
    const all_test_cases = await load_data_view_test_queries()

    if (all_test_cases.length === 0) {
      console.log('No test cases found')
      process.exit(0)
    }

    // Find the specific test case
    const target_filename = path.basename(options.file)
    const test_case = all_test_cases.find(
      (test_case) => test_case.filename === target_filename
    )

    if (!test_case) {
      console.log(`No test case found with filename: ${target_filename}`)
      process.exit(1)
    }

    console.log(`Processing: ${test_case.name}`)
    console.log(`File: ${test_case.filename}`)

    if (!options.confirmed) {
      console.log('\nDry run mode - file will not be modified')
      console.log('Use --confirmed to actually update the file')
    }

    try {
      // Generate the actual query
      const { query } = await get_data_view_results_query(test_case.request)
      const actual_query = query.toString()

      // Check if query differs from expected
      if (actual_query === test_case.expected_query) {
        console.log('\n✓ Query matches - no update needed')
        process.exit(0)
      }

      console.log('\n→ Query differs - update needed')

      // Update the file if confirmed
      if (options.confirmed) {
        await update_test_file(test_case.filename, actual_query)
        console.log('\n✓ File updated successfully')
      } else {
        console.log('\nRun with --confirmed to apply the update')
      }
    } catch (error) {
      console.error(`\n✗ Error processing ${test_case.name}: ${error.message}`)
      process.exit(1)
    }
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

/**
 * Parse command line arguments
 */
const parse_arguments = () => {
  return yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]')
    .option('file', {
      alias: 'f',
      type: 'string',
      required: true,
      description: 'Update a specific test file (provide path or filename)'
    })
    .option('confirmed', {
      alias: 'c',
      type: 'boolean',
      description: 'Actually update the file (default is dry run)'
    })
    .help()
    .alias('help', 'h')
    .example(
      '$0 --file create-a-keeptradecut-query.json --confirmed',
      'Update a specific test file'
    )
    .example(
      '$0 --file create-a-keeptradecut-query.json',
      'Dry run - show what would be updated without making changes'
    ).argv
}

if (is_main(import.meta.url)) {
  debug.enable('update-test-queries')
  main().catch(console.error)
}
