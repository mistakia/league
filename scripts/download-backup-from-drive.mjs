import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { promisify } from 'util'
import { exec as exec_cb } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { createReadStream, createWriteStream, existsSync } from 'fs'
import readline from 'readline'

import { is_main, googleDrive, downloadFile } from '#libs-server'

// Increase maxBuffer size to handle larger outputs
const exec = (cmd, options = {}) =>
  promisify(exec_cb)(cmd, {
    maxBuffer: 100 * 1024 * 1024, // 100MB buffer
    ...options
  })

const log = debug('download-backup-from-drive')
debug.enable('download-backup-from-drive')

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .option('q', {
      describe: 'Query string to find backup file',
      type: 'string',
      demandOption: true
    })
    .option('db', {
      describe: 'Database name to import to',
      type: 'string',
      default: 'league_development'
    })
    .option('user', {
      describe: 'PostgreSQL username',
      type: 'string',
      default: 'trashman'
    })
    .option('password', {
      describe: 'PostgreSQL password (if needed)',
      type: 'string'
    })
    .option('drop', {
      describe: 'Drop and recreate the database before importing',
      type: 'boolean',
      default: false
    })
    .option('data_only', {
      describe: 'Import only data, skip schema creation',
      type: 'boolean',
      default: false
    })
    .option('clean', {
      describe: 'Truncate tables before importing data',
      type: 'boolean',
      default: false
    })
    .option('table', {
      describe: 'Import only specific tables (comma separated)',
      type: 'string'
    })
    .option('config_only', {
      describe: 'Only import the config table',
      type: 'boolean',
      default: false
    })
    .option('ignore_duplicates', {
      describe: 'Skip duplicate records during import',
      type: 'boolean',
      default: false
    })
    .option('chunk_size', {
      describe: 'Maximum rows per chunk when processing large tables',
      type: 'number',
      default: 5000
    })
    .option('update_config', {
      describe:
        'Update config table with values from backup (instead of replacing)',
      type: 'boolean',
      default: false
    }).argv
}

/**
 * Process SQL file using streaming for better memory efficiency
 */
const extract_table_data = async (
  sql_file,
  table_name,
  output_file,
  options = {}
) => {
  const { ignore_duplicates = false } = options

  log(`Extracting data for table: ${table_name} using streaming approach`)

  const rl = readline.createInterface({
    input: createReadStream(sql_file),
    crlfDelay: Infinity
  })

  let in_copy_section = false
  let copy_header = null
  const output_stream = createWriteStream(output_file, { flags: 'a' })

  for await (const line of rl) {
    // Start of the COPY section for our table
    if (line.startsWith(`COPY public.${table_name} `) && !in_copy_section) {
      in_copy_section = true

      // Modify the COPY statement if ignore_duplicates is enabled
      if (ignore_duplicates) {
        // PostgreSQL 12+ syntax supports ON CONFLICT directly in COPY
        // But for compatibility, we'll do it differently
        copy_header = line
        output_stream.write(copy_header + '\n')
      } else {
        copy_header = line
        output_stream.write(copy_header + '\n')
      }
    }
    // Inside COPY section
    else if (in_copy_section) {
      // Check for end of section
      if (line === '\\.') {
        output_stream.write(line + '\n')
        break
      }
      // Write data rows
      output_stream.write(line + '\n')
    }
  }

  output_stream.end()
  await new Promise((resolve) => output_stream.on('finish', resolve))
  log(`Finished extracting data for table: ${table_name}`)
  return true
}

/**
 * Get list of tables in the SQL file
 */
const get_tables_from_sql = async (sql_file) => {
  const { stdout } = await exec(
    `grep -o "COPY public\\.[^ ]* " "${sql_file}" | sed 's/COPY public\\.//' | sed 's/ $//'`
  )
  return stdout.split('\n').filter((table) => table.trim())
}

/**
 * Extract config table values for use with upsert commands
 */
const extract_config_values = async (sql_file) => {
  log('Extracting config values for upsert')

  const rl = readline.createInterface({
    input: createReadStream(sql_file),
    crlfDelay: Infinity
  })

  let in_config_section = false
  const config_rows = []

  for await (const line of rl) {
    if (line.startsWith('COPY public.config ')) {
      in_config_section = true
      continue
    }

    if (in_config_section) {
      if (line === '\\.') {
        break
      }

      config_rows.push(line)
    }
  }

  return config_rows
}

/**
 * Generate upsert script for config table
 */
const generate_config_upsert = async (config_rows, output_file) => {
  log('Generating config upsert script')

  const sql_statements = ['BEGIN;']

  for (const row of config_rows) {
    const [key, value, timestamp] = row.split('\t')

    // Escape single quotes in the value
    const escaped_value = value.replace(/'/g, "''")

    // PostgreSQL upsert command
    const sql = `
INSERT INTO public.config (key, value, updated_at) 
VALUES ('${key}', '${escaped_value}', '${timestamp || 'NOW()'}')
ON CONFLICT (key) 
DO UPDATE SET value = '${escaped_value}', updated_at = '${timestamp || 'NOW()'}';`

    sql_statements.push(sql)
  }

  sql_statements.push('COMMIT;')

  await fs.writeFile(output_file, sql_statements.join('\n'))
  log(`Config upsert script written to ${output_file}`)
  return output_file
}

/**
 * Find the latest backup file on Google Drive matching the query.
 */
const find_backup_file = async ({ drive, query }) => {
  const list_params = {
    q: `"1OnikVibAJ5-1uUhEyMHBRpkFGbzUM23v" in parents and trashed=false and name contains "${query}"`,
    orderBy: 'modifiedByMeTime desc',
    pageSize: 150
  }
  log('Searching for backup files matching:', query)
  const res = await drive.files.list(list_params)
  if (!res.data.files || res.data.files.length === 0) {
    throw new Error(`No backup files found matching "${query}"`)
  }
  return res.data.files[0]
}

/**
 * Extract the SQL file from a downloaded tar.gz archive.
 */
const extract_sql_file_from_archive = async ({ downloaded_file }) => {
  log('Extracting backup file')
  const extract_dir = path.dirname(downloaded_file)
  await exec(`tar -xzf "${downloaded_file}" -C "${extract_dir}"`)
  const extracted_sql_file = downloaded_file.replace('.tar.gz', '.sql')
  if (!existsSync(extracted_sql_file)) {
    throw new Error(`Could not find extracted SQL file: ${extracted_sql_file}`)
  }
  log(`Found SQL file: ${extracted_sql_file}`)
  return extracted_sql_file
}

/**
 * Drop and recreate the database if requested.
 */
const drop_and_recreate_database = async ({
  db_name,
  db_user,
  db_password
}) => {
  log(`Dropping and recreating database: ${db_name}`)
  try {
    let drop_cmd = `dropdb -U ${db_user} ${db_name}`
    if (db_password) {
      drop_cmd = `PGPASSWORD=${db_password} ${drop_cmd}`
    }
    await exec(drop_cmd)
  } catch (error) {
    log(
      `Database ${db_name} doesn't exist or cannot be dropped, will create it`
    )
  }
  let create_cmd = `createdb -U ${db_user} ${db_name}`
  if (db_password) {
    create_cmd = `PGPASSWORD=${db_password} ${create_cmd}`
  }
  await exec(create_cmd)
}

/**
 * Handle config table upsert logic if requested.
 */
const handle_config_table_upsert = async ({
  extracted_sql_file,
  extract_dir,
  db_name,
  db_user,
  db_password,
  options,
  downloaded_file,
  file
}) => {
  log('Extracting config values for update')
  const config_rows = await extract_config_values(extracted_sql_file)
  if (config_rows.length === 0) {
    log('No config values found in backup file')
    return null
  }
  log(`Found ${config_rows.length} config values`)
  const upsert_file = path.join(extract_dir, 'config_upsert.sql')
  await generate_config_upsert(config_rows, upsert_file)
  log('Importing config values with upsert')
  let psql_command = `psql -U ${db_user} -d ${db_name}`
  if (db_password) {
    psql_command = `PGPASSWORD=${db_password} ${psql_command}`
  }
  psql_command += ` -f "${upsert_file}"`
  await exec(psql_command)
  log('Config values updated successfully')
  if (options.config_only) {
    // Clean up files
    const files_to_clean = [downloaded_file, extracted_sql_file, upsert_file]
    await exec(`rm ${files_to_clean.join(' ')}`)
    log('Cleaned up temporary files')
    return {
      success: true,
      file_name: file.name,
      db_name,
      table: 'config (upsert)'
    }
  }
  return null
}

/**
 * Prepare the SQL file for import based on options (data_only, table, ignore_duplicates).
 */
const prepare_import_file = async ({
  extracted_sql_file,
  extract_dir,
  options
}) => {
  let import_file = extracted_sql_file
  if (options.data_only) {
    log('Processing SQL file to extract only data statements')
    const temp_dir = path.join(extract_dir, 'temp_sql_parts')
    await fs.mkdir(temp_dir, { recursive: true })
    let tables = await get_tables_from_sql(extracted_sql_file)
    if (options.table) {
      const requested_tables = options.table.split(',').map((t) => t.trim())
      tables = tables.filter((table) => requested_tables.includes(table))
      log(`Filtering for tables: ${tables.join(', ')}`)
    }
    if (tables.length === 0) {
      throw new Error('No matching tables found in the SQL file')
    }
    const combined_file = path.join(
      extract_dir,
      'data_only_' + path.basename(extracted_sql_file)
    )
    await fs.writeFile(
      combined_file,
      options.ignore_duplicates
        ? 'SET session_replication_role = replica;\n\n'
        : ''
    )
    for (const table of tables) {
      const table_file = path.join(temp_dir, `${table}.sql`)
      await extract_table_data(extracted_sql_file, table, table_file)
      const table_content = await fs.readFile(table_file, 'utf8')
      await fs.appendFile(combined_file, table_content + '\n')
    }
    if (options.ignore_duplicates) {
      await fs.appendFile(
        combined_file,
        '\nSET session_replication_role = DEFAULT;\n'
      )
    }
    import_file = combined_file
    await exec(`rm -rf "${temp_dir}"`)
  } else if (options.table) {
    const filtered_file = path.join(
      extract_dir,
      'filtered_' + path.basename(extracted_sql_file)
    )
    if (options.table === 'config') {
      await exec(
        `sed -n '/CREATE TABLE public\\.config/,/^\\\\./p' "${extracted_sql_file}" > "${filtered_file}"`
      )
    } else {
      const tables = options.table.split(',').map((t) => t.trim())
      await fs.writeFile(filtered_file, '')
      for (const table of tables) {
        const table_schema = await exec(
          `sed -n '/CREATE TABLE public\\.${table}/,/^);/p' "${extracted_sql_file}"`
        )
        await fs.appendFile(filtered_file, table_schema.stdout + '\n\n')
        const table_data = await exec(
          `sed -n '/^COPY public\\.${table}/,/^\\\\./p' "${extracted_sql_file}"`
        )
        await fs.appendFile(filtered_file, table_data.stdout + '\n\n')
      }
    }
    import_file = filtered_file
  }
  return import_file
}

/**
 * Truncate tables before import if requested.
 */
const truncate_tables_if_needed = async ({
  extracted_sql_file,
  extract_dir,
  db_name,
  db_user,
  db_password,
  options
}) => {
  if (options.clean && !options.drop) {
    log('Creating script to truncate tables')
    const truncate_file = path.join(
      extract_dir,
      'truncate_' + path.basename(extracted_sql_file)
    )
    if (options.table) {
      const tables = options.table.split(',').map((t) => t.trim())
      const truncate_statements = tables
        .map((table) => `TRUNCATE TABLE public.${table};`)
        .join('\n')
      await fs.writeFile(truncate_file, truncate_statements)
    } else {
      await exec(
        `grep -o "COPY public\\.[^ ]* " "${extracted_sql_file}" | sed 's/COPY public\\./TRUNCATE TABLE public./g' | sed 's/ $/;/g' > "${truncate_file}"`
      )
    }
    log('Truncating tables before import')
    let truncate_cmd = `psql -U ${db_user} -d ${db_name} -f "${truncate_file}"`
    if (db_password) {
      truncate_cmd = `PGPASSWORD=${db_password} ${truncate_cmd}`
    }
    await exec(truncate_cmd)
  }
}

/**
 * Import the SQL file into PostgreSQL.
 */
const import_sql_file = async ({
  import_file,
  db_name,
  db_user,
  db_password,
  options
}) => {
  log(`Importing into PostgreSQL database: ${db_name}`)
  let psql_command = `psql -U ${db_user} -d ${db_name}`
  if (db_password) {
    psql_command = `PGPASSWORD=${db_password} ${psql_command}`
  }
  psql_command += ` -f "${import_file}"`
  const { stderr } = await exec(psql_command)
  if (
    stderr &&
    !options.data_only &&
    !options.ignore_duplicates &&
    !stderr.includes('SET') &&
    !stderr.includes('CREATE')
  ) {
    log('PostgreSQL import errors:', stderr)
    throw new Error('Error importing SQL file')
  }
  if ((options.data_only || options.ignore_duplicates) && stderr) {
    log('PostgreSQL import warnings (non-fatal):', stderr)
  }
  log('Successfully imported backup into PostgreSQL')
}

/**
 * Clean up temporary files.
 */
const cleanup_files = async ({ files }) => {
  await exec(`rm ${files.join(' ')}`)
  log('Cleaned up temporary files')
}

const download_backup_from_drive = async (
  query,
  db_name,
  db_user,
  db_password,
  options = {}
) => {
  try {
    log('Connecting to Google Drive')
    const drive = await googleDrive()
    const file = await find_backup_file({ drive, query })
    log(`Found backup file: ${file.name}`)
    const downloaded_file = await downloadFile({ drive, file })
    log(`Downloaded ${downloaded_file}`)
    const extracted_sql_file = await extract_sql_file_from_archive({
      downloaded_file
    })
    if (options.drop) {
      await drop_and_recreate_database({ db_name, db_user, db_password })
    }
    if (options.config_only) {
      options.table = 'config'
      options.update_config = true
    }
    if (
      options.update_config &&
      (options.table === 'config' || options.table?.includes('config'))
    ) {
      const config_result = await handle_config_table_upsert({
        extracted_sql_file,
        extract_dir: path.dirname(downloaded_file),
        db_name,
        db_user,
        db_password,
        options,
        downloaded_file,
        file
      })
      if (config_result) {
        return config_result
      }
    }
    const import_file = await prepare_import_file({
      extracted_sql_file,
      extract_dir: path.dirname(downloaded_file),
      options
    })
    await truncate_tables_if_needed({
      extracted_sql_file,
      extract_dir: path.dirname(downloaded_file),
      db_name,
      db_user,
      db_password,
      options
    })
    await import_sql_file({
      import_file,
      db_name,
      db_user,
      db_password,
      options
    })
    const files_to_clean = [downloaded_file, extracted_sql_file]
    if (import_file !== extracted_sql_file) {
      files_to_clean.push(import_file)
    }
    await cleanup_files({ files: files_to_clean })
    return {
      success: true,
      file_name: file.name,
      db_name,
      table: options.table || 'all tables'
    }
  } catch (error) {
    log('Error in download_backup_from_drive:', error)
    throw error
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const query = argv.q
    const db_name = argv.db
    const db_user = argv.user
    const db_password = argv.password

    if (!query) {
      console.log('Missing --q parameter')
      return
    }

    const options = {
      drop: argv.drop,
      data_only: argv.data_only,
      clean: argv.clean,
      table: argv.table,
      config_only: argv.config_only,
      ignore_duplicates: argv.ignore_duplicates,
      chunk_size: argv.chunk_size,
      update_config: argv.update_config
    }

    const result = await download_backup_from_drive(
      query,
      db_name,
      db_user,
      db_password,
      options
    )
    console.log(
      `Successfully imported ${result.file_name} into database ${result.db_name} (${result.table})`
    )
  } catch (err) {
    error = err
    log(error)
    console.error(`Error: ${error.message}`)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default download_backup_from_drive
