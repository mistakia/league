import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import debug from 'debug'

// Ensure production environment for database connection
process.env.NODE_ENV = process.env.NODE_ENV || 'production'

import db from '#db'
import { is_main, get_data_view_results_query } from '#libs-server'

const log = debug('debug-data-view')

const parse_short_url = (short_url) => {
  // Extract hash from short URL format like /u/4d5fbae871fd62842a6180d123988d95
  const url_match = short_url.match(/\/u\/([a-f0-9]{32})/)
  if (!url_match) {
    throw new Error('Invalid short URL format. Expected: /u/{hash}')
  }
  return url_match[1]
}

const lookup_url_in_database = async (hash) => {
  const url_row = await db('urls').where('id', hash).first()
  if (!url_row) {
    throw new Error(`Short URL hash not found in database: ${hash}`)
  }
  return url_row.url
}

const parse_url_to_table_state = (full_url) => {
  const url_obj = new URL(full_url)
  const params = new URLSearchParams(url_obj.search)
  
  // Convert URL search params to table state object
  const table_state = {
    columns: [],
    prefix_columns: [],
    where: [],
    sort: [],
    splits: [],
    offset: 0,
    limit: 500
  }

  // Parse columns parameter
  if (params.has('columns')) {
    try {
      table_state.columns = JSON.parse(params.get('columns'))
    } catch (error) {
      throw new Error('Failed to parse columns parameter: ' + error.message)
    }
  }

  // Parse prefix_columns parameter
  if (params.has('prefix_columns')) {
    try {
      table_state.prefix_columns = JSON.parse(params.get('prefix_columns'))
    } catch (error) {
      throw new Error('Failed to parse prefix_columns parameter: ' + error.message)
    }
  }

  // Parse where parameter
  if (params.has('where')) {
    try {
      table_state.where = JSON.parse(params.get('where'))
    } catch (error) {
      throw new Error('Failed to parse where parameter: ' + error.message)
    }
  }

  // Parse sort parameter
  if (params.has('sort')) {
    try {
      table_state.sort = JSON.parse(params.get('sort'))
    } catch (error) {
      throw new Error('Failed to parse sort parameter: ' + error.message)
    }
  }

  // Parse splits parameter
  if (params.has('splits')) {
    try {
      table_state.splits = JSON.parse(params.get('splits'))
    } catch (error) {
      throw new Error('Failed to parse splits parameter: ' + error.message)
    }
  }

  // Parse offset parameter
  if (params.has('offset')) {
    table_state.offset = parseInt(params.get('offset'), 10) || 0
  }

  // Parse limit parameter
  if (params.has('limit')) {
    table_state.limit = parseInt(params.get('limit'), 10) || 500
  }

  return table_state
}

const format_sql_with_prettier = async (sql) => {
  try {
    // Try to use prettier with SQL plugin if available
    const prettier = await import('prettier')
    const formatted = await prettier.format(sql, {
      parser: 'sql',
      plugins: ['prettier-plugin-sql']
    })
    return formatted
  } catch (error) {
    log('Prettier formatting failed, returning raw SQL:', error.message)
    return sql
  }
}

const debug_data_view = async ({ 
  short_url, 
  beautify = false, 
  debug_mode = false, 
  output_file = null 
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
      sql = await format_sql_with_prettier(sql)
    }
    
    // Step 6: Output SQL
    if (output_file) {
      const fs = await import('fs/promises')
      await fs.writeFile(output_file, sql)
      console.log(`SQL written to: ${output_file}`)
    } else {
      console.log('\n--- Generated SQL ---\n')
      console.log(sql)
    }
    
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
      describe: 'Short data view URL (e.g., /u/4d5fbae871fd62842a6180d123988d95)',
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
    .option('output-file', {
      alias: 'o',
      type: 'string',
      description: 'Write SQL to file instead of console'
    })
    .help()
    .alias('help', 'h')
    .example('$0 /u/abc123', 'Convert short URL to SQL')
    .example('$0 /u/abc123 --beautify', 'Convert and beautify SQL')
    .example('$0 /u/abc123 -o query.sql', 'Write SQL to file')
    .argv

  const short_url = argv._[0] || argv.short_url

  if (!short_url) {
    console.error('Error: short_url is required')
    process.exit(1)
  }

  try {
    await debug_data_view({
      short_url,
      beautify: argv.beautify,
      debug_mode: argv.debug,
      output_file: argv.outputFile
    })
  } catch (error) {
    process.exit(1)
  }
}

if (is_main(import.meta.url)) {
  main()
}

export default debug_data_view