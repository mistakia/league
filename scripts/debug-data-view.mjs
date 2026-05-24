#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import debug from 'debug'

import {
  is_main,
  get_data_view_results_query,
  format_sql,
  resolve_table_state_from_short_url
} from '#libs-server'

const log = debug('debug-data-view')

const debug_data_view = async ({
  short_url,
  beautify = false,
  debug_mode = false
}) => {
  try {
    if (debug_mode) {
      debug.enable('debug-data-view')
      log('Debug mode enabled')
    }

    log('Processing short URL:', short_url)

    const {
      table_state,
      hash,
      url: full_url
    } = await resolve_table_state_from_short_url(short_url)
    log('Extracted hash:', hash)
    log('Found full URL:', full_url)

    console.log('\n--- Parsed table state ---\n')
    console.log(JSON.stringify(table_state, null, 2))

    const { query } = await get_data_view_results_query(table_state)
    let sql = query.toString()

    log('Generated SQL length:', sql.length)

    if (beautify) {
      log('Beautifying SQL...')
      sql = await format_sql(sql, { parser: 'sql', language: 'postgresql' })
    }

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
