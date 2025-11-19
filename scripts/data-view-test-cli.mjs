#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { get_data_view_results_query } from '#libs-server/get-data-view-results.mjs'
import { load_data_view_test_queries_sync } from '#libs-server/load-test-cases.mjs'
import { process_expected_query } from '#libs-server/process-expected-query.mjs'
import is_main from '#libs-server/is-main.mjs'
import {
  format_sql,
  normalize_sql_for_comparison
} from '#libs-server/format-sql.mjs'
import { compare_queries } from '#test/utils/index.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Standard SQL formatting options for beautification
const SQL_FORMAT_OPTIONS = {
  parser: 'sql',
  language: 'postgresql',
  keywordCase: 'upper',
  printWidth: 80,
  expressionWidth: 50,
  linesBetweenQueries: 2
}

// Simple diff function without external dependencies
function simple_diff(str1, str2) {
  const lines1 = str1.split('\n')
  const lines2 = str2.split('\n')
  const result = []

  let i = 0
  let j = 0

  while (i < lines1.length || j < lines2.length) {
    if (i >= lines1.length) {
      // Rest of lines2 are additions
      while (j < lines2.length) {
        result.push({ type: 'add', line: lines2[j] })
        j++
      }
    } else if (j >= lines2.length) {
      // Rest of lines1 are deletions
      while (i < lines1.length) {
        result.push({ type: 'remove', line: lines1[i] })
        i++
      }
    } else if (lines1[i] === lines2[j]) {
      result.push({ type: 'same', line: lines1[i] })
      i++
      j++
    } else {
      // Try to find matching lines nearby
      let found = false

      // Check if current line2 exists shortly ahead in lines1
      for (let k = 1; k <= 3 && i + k < lines1.length; k++) {
        if (lines1[i + k] === lines2[j]) {
          // Mark intervening lines as removed
          for (let m = 0; m < k; m++) {
            result.push({ type: 'remove', line: lines1[i + m] })
          }
          i += k
          found = true
          break
        }
      }

      if (!found) {
        // Check if current line1 exists shortly ahead in lines2
        for (let k = 1; k <= 3 && j + k < lines2.length; k++) {
          if (lines2[j + k] === lines1[i]) {
            // Mark intervening lines as added
            for (let m = 0; m < k; m++) {
              result.push({ type: 'add', line: lines2[j + m] })
            }
            j += k
            found = true
            break
          }
        }
      }

      if (!found) {
        // Simple replacement
        result.push({ type: 'remove', line: lines1[i] })
        result.push({ type: 'add', line: lines2[j] })
        i++
        j++
      }
    }
  }

  return result
}

async function show_diff(actual_query, expected_query) {
  const actual_normalized = normalize_sql_for_comparison(actual_query)
  const expected_normalized = normalize_sql_for_comparison(expected_query)

  const actual_beautified = await format_sql(
    actual_normalized,
    SQL_FORMAT_OPTIONS
  )
  const expected_beautified = await format_sql(
    expected_normalized,
    SQL_FORMAT_OPTIONS
  )

  console.log('\n\x1b[1m=== SQL Query Diff ===\x1b[0m\n')

  const diff = simple_diff(expected_beautified, actual_beautified)

  diff.forEach(({ type, line }) => {
    if (type === 'add') {
      console.log('\x1b[32m+ ' + line + '\x1b[0m')
    } else if (type === 'remove') {
      console.log('\x1b[31m- ' + line + '\x1b[0m')
    } else {
      console.log('\x1b[90m  ' + line + '\x1b[0m')
    }
  })

  console.log('\n')
}

async function load_test_case(test_path) {
  const full_path = path.resolve(test_path)

  if (!fs.existsSync(full_path)) {
    throw new Error(`Test file not found: ${full_path}`)
  }

  const content = fs.readFileSync(full_path, 'utf8')
  return JSON.parse(content)
}

async function update_test_case(test_path, updated_query) {
  const full_path = path.resolve(test_path)
  const test_case = await load_test_case(test_path)

  test_case.expected_query = updated_query

  fs.writeFileSync(full_path, JSON.stringify(test_case, null, 2) + '\n')
  console.log('\x1b[32m✓ Updated expected query in ' + test_path + '\x1b[0m')
}

async function run_test_case(test_path, options = {}) {
  const test_case = await load_test_case(test_path)

  console.log(
    '\n\x1b[1mRunning test: ' +
      (test_case.name || path.basename(test_path)) +
      '\x1b[0m'
  )
  if (test_case.description) {
    console.log('\x1b[90mDescription: ' + test_case.description + '\x1b[0m')
  }

  try {
    // Generate the actual query
    const { query } = await get_data_view_results_query(test_case.request)
    const actual_query = query.toString()

    if (options.showQuery || options.beautify) {
      console.log('\n\x1b[1m=== Generated Query ===\x1b[0m\n')
      const output = options.beautify
        ? await format_sql(actual_query, SQL_FORMAT_OPTIONS)
        : actual_query
      console.log(output)
    }

    if (test_case.expected_query) {
      const expected_query = process_expected_query(test_case.expected_query)

      if (options.showExpected || options.beautify) {
        console.log('\n\x1b[1m=== Expected Query ===\x1b[0m\n')
        const output = options.beautify
          ? await format_sql(expected_query, SQL_FORMAT_OPTIONS)
          : expected_query
        console.log(output)
      }

      if (options.diff) {
        await show_diff(actual_query, expected_query)
      }

      // Check if queries match
      let queries_match = false
      try {
        compare_queries(actual_query, expected_query)
        console.log('\n\x1b[32m✓ Queries match!\x1b[0m')
        queries_match = true
      } catch (err) {
        console.log('\n\x1b[31m✗ Queries do not match\x1b[0m')
        if (!options.diff) {
          console.log('\x1b[33mUse --diff to see the differences\x1b[0m')
        }

        if (options.update) {
          console.log('\n\x1b[33mUpdating expected query...\x1b[0m')
          await update_test_case(test_path, actual_query)
        }
      }

      return { query: actual_query, success: queries_match }
    } else {
      console.log('\n\x1b[33mNo expected query defined in test case\x1b[0m')

      if (options.update) {
        console.log('\x1b[33mAdding expected query to test case...\x1b[0m')
        await update_test_case(test_path, actual_query)
      }

      return { query: actual_query, success: true }
    }
  } catch (error) {
    console.log('\n\x1b[31m✗ Error: ' + error.message + '\x1b[0m')
    if (options.verbose) {
      console.error(error.stack)
    }
    throw error
  }
}

async function create_test_case(test_path, request) {
  const full_path = path.resolve(test_path)

  if (fs.existsSync(full_path)) {
    throw new Error(`Test file already exists: ${full_path}`)
  }

  // Generate the query to include as expected
  const { query } = await get_data_view_results_query(request)
  const actual_query = query.toString()

  const test_case = {
    name: path.basename(test_path, '.json').replace(/-/g, ' '),
    description: 'Auto-generated test case',
    request,
    expected_query: actual_query,
    tags: [],
    timeout_ms: 35000
  }

  // Ensure directory exists
  const dir = path.dirname(full_path)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  fs.writeFileSync(full_path, JSON.stringify(test_case, null, 2) + '\n')
  console.log('\x1b[32m✓ Created test case: ' + test_path + '\x1b[0m')

  return test_case
}

// CLI Main Function
async function main() {
  const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 [test-file] [options]')
    .command(
      '$0 [test-file]',
      'Run or debug a data view test case',
      (yargs) => {
        yargs.positional('test-file', {
          describe: 'Path to the test JSON file',
          type: 'string'
        })
      }
    )
    .option('beautify', {
      alias: 'b',
      type: 'boolean',
      description: 'Show beautified SQL queries'
    })
    .option('diff', {
      alias: 'd',
      type: 'boolean',
      description: 'Show diff between actual and expected queries'
    })
    .option('update', {
      alias: 'u',
      type: 'boolean',
      description: 'Update the expected query in the test file'
    })
    .option('show-query', {
      alias: 'q',
      type: 'boolean',
      description: 'Show the generated query'
    })
    .option('show-expected', {
      alias: 'e',
      type: 'boolean',
      description: 'Show the expected query'
    })
    .option('create', {
      alias: 'c',
      type: 'boolean',
      description: 'Create a new test case (requires --request)'
    })
    .option('request', {
      alias: 'r',
      type: 'string',
      description: 'JSON request for creating a new test case'
    })
    .option('verbose', {
      alias: 'v',
      type: 'boolean',
      description: 'Show verbose error output'
    })
    .option('all', {
      alias: 'a',
      type: 'boolean',
      description: 'Run all test cases'
    })
    .example(
      '$0 test/data-view-queries/player-career-year.json --beautify --diff',
      'Show beautified diff for a test'
    )
    .example(
      '$0 test/data-view-queries/player-career-year.json --update',
      'Update expected query in test file'
    )
    .example(
      '$0 test/data-view-queries/new-test.json --create --request \'{"columns":["player_name"]}\'',
      'Create a new test case'
    )
    .help('h')
    .alias('h', 'help').argv

  try {
    let exit_code = 0

    if (argv.all) {
      // Run all test cases
      const test_cases = load_data_view_test_queries_sync()
      console.log(
        '\x1b[1mRunning ' + test_cases.length + ' test cases...\x1b[0m\n'
      )

      let passed = 0
      let failed = 0

      for (const test_case of test_cases) {
        const test_path = path.join(
          __dirname,
          '../test/data-view-queries',
          test_case.filename
        )
        try {
          const result = await run_test_case(test_path, argv)
          if (result.success) {
            passed++
          } else {
            failed++
          }
        } catch (err) {
          failed++
          if (!argv.verbose) {
            console.log(
              '\x1b[90mUse --verbose for detailed error output\x1b[0m'
            )
          }
        }
      }

      console.log('\n\x1b[1m=== Summary ===\x1b[0m')
      console.log('\x1b[32mPassed: ' + passed + '\x1b[0m')
      if (failed > 0) {
        console.log('\x1b[31mFailed: ' + failed + '\x1b[0m')
        exit_code = 1
      }
    } else if (argv.create) {
      // Create a new test case
      if (!argv.testFile) {
        console.error(
          '\x1b[31mError: Test file path is required for --create\x1b[0m'
        )
        process.exit(1)
      }

      if (!argv.request) {
        console.error(
          '\x1b[31mError: --request is required for --create\x1b[0m'
        )
        process.exit(1)
      }

      const request = JSON.parse(argv.request)
      await create_test_case(argv.testFile, request)
    } else if (argv.testFile) {
      // Run a specific test case
      try {
        const result = await run_test_case(argv.testFile, argv)
        if (!result.success) {
          exit_code = 1
        }
      } catch (error) {
        // Error already logged in run_test_case
        exit_code = 1
      }
    } else {
      // Show help if no arguments
      console.log('Usage: data-view-test-cli [test-file] [options]')
      console.log('\nOptions:')
      console.log('  --beautify, -b      Show beautified SQL queries')
      console.log(
        '  --diff, -d          Show diff between actual and expected queries'
      )
      console.log(
        '  --update, -u        Update the expected query in the test file'
      )
      console.log('  --show-query, -q    Show the generated query')
      console.log('  --show-expected, -e Show the expected query')
      console.log(
        '  --create, -c        Create a new test case (requires --request)'
      )
      console.log(
        '  --request, -r       JSON request for creating a new test case'
      )
      console.log('  --verbose, -v       Show verbose error output')
      console.log('  --all, -a           Run all test cases')
      console.log('  --help, -h          Show help')
      console.log('\nExamples:')
      console.log(
        '  node scripts/data-view-test-cli.mjs test/data-view-queries/player-career-year.json --beautify --diff'
      )
      console.log(
        '  node scripts/data-view-test-cli.mjs test/data-view-queries/player-career-year.json --update'
      )
    }

    process.exit(exit_code)
  } catch (error) {
    console.error('\n\x1b[31mError: ' + error.message + '\x1b[0m')
    if (argv.verbose) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

// Run as CLI if this is the main module
if (is_main(import.meta.url)) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
