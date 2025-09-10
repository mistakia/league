#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import debug from 'debug'

import db from '#db'
import { is_main, get_data_view_results_query, format_sql } from '#libs-server'

// Ensure production environment for database connection
process.env.NODE_ENV = process.env.NODE_ENV || 'production'

const log = debug('debug-data-view')

/**
 * Parse the short URL to extract the hash
 * @param {string} short_url - Short URL in format /u/{hash}
 * @returns {string} - The extracted hash
 */
const parse_short_url = (short_url) => {
  const url_match = short_url.match(/\/u\/([a-f0-9]{32})/)
  if (!url_match) {
    throw new Error('Invalid short URL format. Expected: /u/{hash}')
  }
  return url_match[1]
}

/**
 * Look up the full URL from the database using the hash
 * @param {string} hash - The URL hash
 * @returns {Promise<string>} - The full URL
 */
const lookup_url_in_database = async (hash) => {
  const url_row = await db('urls').where('url_hash', hash).first()
  if (!url_row) {
    throw new Error(`Short URL hash not found in database: ${hash}`)
  }
  return url_row.url
}

/**
 * Parse URL parameters into table state configuration
 * @param {string} full_url - The full URL with query parameters
 * @returns {Object} - Table state configuration object
 */
const parse_url_to_table_state = (full_url) => {
  const url_obj = new URL(full_url)
  const params = new URLSearchParams(url_obj.search)

  // Initialize table state with defaults
  const table_state = {
    columns: [],
    prefix_columns: [],
    where: [],
    sort: [],
    splits: [],
    offset: 0,
    limit: 500
  }

  // Parse JSON parameters
  const json_params = ['columns', 'prefix_columns', 'where', 'sort', 'splits']

  for (const param of json_params) {
    if (params.has(param)) {
      try {
        table_state[param] = JSON.parse(params.get(param))
      } catch (error) {
        throw new Error(`Failed to parse ${param} parameter: ${error.message}`)
      }
    }
  }

  // Parse numeric parameters
  if (params.has('offset')) {
    table_state.offset = parseInt(params.get('offset'), 10) || 0
  }

  if (params.has('limit')) {
    table_state.limit = parseInt(params.get('limit'), 10) || 500
  }

  return table_state
}

/**
 * Main function to debug data view URLs
 * @param {Object} options - Command options
 * @param {string} options.short_url - The short URL to debug
 * @param {boolean} options.beautify - Whether to beautify the SQL output
 * @param {boolean} options.debug_mode - Whether to enable debug logging
 * @returns {Promise<string>} - The generated SQL query
 */
const debug_data_view = async ({
  short_url,
  beautify = false,
  debug_mode = false
}) => {
  try {
    if (debug_mode) {
      debug.enabled('debug-data-view') || debug.enabled('*')
      log('Debug mode enabled')
    }

    log('Processing short URL:', short_url)

    // Step 1: Extract hash from short URL
    const hash = parse_short_url(short_url)
    log('Extracted hash:', hash)

    // Step 2: Lookup full URL in database
    const full_url = await lookup_url_in_database(hash)
    log('Found full URL:', full_url)

    // Step 3: Parse URL to table state
    const table_state = parse_url_to_table_state(full_url)
    log('Parsed table state:', JSON.stringify(table_state, null, 2))

    // Step 4: Generate SQL using get_data_view_results_query
    const { query } = await get_data_view_results_query(table_state)
    let sql = query.toString()

    log('Generated SQL length:', sql.length)

    // Step 5: Optionally beautify SQL
    if (beautify) {
      log('Beautifying SQL...')
      sql = await format_sql(sql, { parser: 'sql' })
    }

    // Step 6: Output SQL
    console.log('\n--- Generated SQL ---\n')
    console.log(sql)

    return sql
  } catch (error) {
    console.error('Error debugging data view:', error.message)
    if (debug_mode) {
      console.error('Stack trace:', error.stack)
    }
    throw error
  }
}

/**
 * CLI entry point
 */
const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 <short_url> [options]')
    .positional('short_url', {
      describe:
        'Short data view URL (e.g., /u/4d5fbae871fd62842a6180d123988d95)',
      type: 'string',
      demandOption: true
    })
    .option('beautify', {
      alias: 'b',
      type: 'boolean',
      default: false,
      description: 'Beautify SQL output using prettier'
    })
    .option('debug', {
      alias: 'd',
      type: 'boolean',
      default: false,
      description: 'Enable debug logging'
    })
    .help()
    .alias('help', 'h')
    .example('$0 /u/abc123', 'Convert short URL to SQL')
    .example('$0 /u/abc123 --beautify', 'Convert and beautify SQL').argv

  const short_url = argv._[0] || argv.short_url

  if (!short_url) {
    console.error('Error: short_url is required')
    process.exit(1)
  }

  try {
    await debug_data_view({
      short_url,
      beautify: argv.beautify,
      debug_mode: argv.debug
    })
    process.exit(0)
  } catch (error) {
    process.exit(1)
  }
}

if (is_main(import.meta.url)) {
  main()
}

export default debug_data_view
