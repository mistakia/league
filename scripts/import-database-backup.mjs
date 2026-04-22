import fs from 'fs'
import cp from 'child_process'
import path from 'path'
import os from 'os'

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main } from '#libs-server'
import config from '#config'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-database-backup')
debug.enable('import-database-backup')

const extract_dump_objects = ({ sql_text }) => {
  const tables = new Set()
  const sequences = new Set()

  const table_re = /CREATE\s+TABLE\s+public\.("?[a-zA-Z0-9_]+"?)/gi
  const seq_re = /CREATE\s+SEQUENCE\s+public\.("?[a-zA-Z0-9_]+"?)/gi

  let m
  while ((m = table_re.exec(sql_text))) {
    tables.add(m[1].replace(/"/g, ''))
  }
  while ((m = seq_re.exec(sql_text))) {
    sequences.add(m[1].replace(/"/g, ''))
  }
  return { tables: Array.from(tables), sequences: Array.from(sequences) }
}

const drop_objects_from_dump = async ({ dump_sql_path }) => {
  const sql_text = fs.readFileSync(dump_sql_path, 'utf8')
  const { tables, sequences } = extract_dump_objects({ sql_text })

  for (const table of tables) {
    await db.raw(`DROP TABLE IF EXISTS public."${table}" CASCADE`)
  }
  for (const seq of sequences) {
    await db.raw(`DROP SEQUENCE IF EXISTS public."${seq}" CASCADE`)
  }
}

const extract_dump_constraints_and_indexes = ({ sql_text }) => {
  const constraints = []
  const indexes = []

  const constraint_re =
    /ALTER\s+TABLE\s+(?:ONLY\s+)?public\.("?[a-zA-Z0-9_]+"?)\s+ADD\s+CONSTRAINT\s+("?[a-zA-Z0-9_]+"?)/gi
  const index_re =
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?("?[a-zA-Z0-9_]+"?)\s+ON\s+public\.("?[a-zA-Z0-9_]+"?)/gi

  let m
  while ((m = constraint_re.exec(sql_text))) {
    const table = m[1].replace(/"/g, '')
    const name = m[2].replace(/"/g, '')
    constraints.push({ table, name })
  }
  while ((m = index_re.exec(sql_text))) {
    const name = m[1].replace(/"/g, '')
    const table = m[2].replace(/"/g, '')
    indexes.push({ name, table })
  }

  return { constraints, indexes }
}

const drop_conflicting_constraints_and_indexes = async ({ dump_sql_path }) => {
  const sql_text = fs.readFileSync(dump_sql_path, 'utf8')
  const { constraints, indexes } = extract_dump_constraints_and_indexes({
    sql_text
  })

  const constraint_names = Array.from(new Set(constraints.map((c) => c.name)))
  for (const con_name of constraint_names) {
    const res = await db.raw(
      `select conrelid::regclass::text as table_name, conname from pg_constraint where conname = ?`,
      [con_name]
    )
    for (const row of res.rows) {
      await db.raw(
        `alter table public."${row.table_name}" drop constraint if exists "${row.conname}" cascade`
      )
    }
  }

  const index_names = Array.from(new Set(indexes.map((i) => i.name)))
  for (const idx_name of index_names) {
    await db.raw(`drop index if exists public."${idx_name}" cascade`)
  }
}

const STORAGE_BACKUP_PATH = '/mnt/md0/backups/servers/league-production/backups'
const LOCAL_BACKUP_PATH = '/root/backups'

const select_backup_file_by_type = async ({ type }) => {
  const name_pattern = type || 'user'

  if (fs.existsSync(LOCAL_BACKUP_PATH)) {
    log('Searching local backups at %s', LOCAL_BACKUP_PATH)
    const { stdout } = cp.execSync(
      `ls -t "${LOCAL_BACKUP_PATH}"/*.tar.gz 2>/dev/null || true`,
      { encoding: 'utf8' }
    )
    const files = stdout.trim().split('\n').filter(Boolean)
    const match = files.find((f) => path.basename(f).includes(name_pattern))
    return match ? { name: path.basename(match), local_path: match } : null
  }

  log('Searching storage server backups via SSH')
  const { stdout } = cp.execSync(
    `ssh storage 'ls -t ${STORAGE_BACKUP_PATH}/*.tar.gz 2>/dev/null || true'`,
    { encoding: 'utf8' }
  )
  const files = stdout.trim().split('\n').filter(Boolean)
  const match = files.find((f) => path.basename(f).includes(name_pattern))
  if (!match) return null
  return { name: path.basename(match), remote_path: match }
}

const fetch_backup_file = ({ file }) => {
  if (file.local_path) {
    return file.local_path
  }
  const local_dest = path.join(os.tmpdir(), file.name)
  log('Downloading %s from storage via scp', file.name)
  cp.execSync(`scp storage:${file.remote_path} "${local_dest}"`, {
    stdio: 'inherit'
  })
  return local_dest
}

const find_sql_file = ({ dir }) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full_path = path.join(dir, entry.name)
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.sql'))
      return full_path
    if (entry.isDirectory()) {
      const found = find_sql_file({ dir: full_path })
      if (found) return found
    }
  }
  return null
}

const remove_if_exists = (target_path) => {
  try {
    if (fs.existsSync(target_path)) {
      const stat = fs.statSync(target_path)
      if (stat.isDirectory()) {
        fs.rmSync(target_path, { recursive: true, force: true })
      } else {
        fs.unlinkSync(target_path)
      }
    }
  } catch (_e) {}
}

const run = async ({ file_path, type = 'user' } = {}) => {
  let archive_path = file_path
  let fetched_from_remote = false
  if (!archive_path) {
    const file = await select_backup_file_by_type({ type })
    if (!file) {
      log('file not found')
      return
    }
    log(`loading ${type} dump: ${file.name}`)
    archive_path = fetch_backup_file({ file })
    fetched_from_remote = !file.local_path
  } else {
    log('using provided filepath')
  }

  const {
    host,
    port,
    user: postgres_user,
    database
  } = config.postgres.connection
  const temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbdump-'))
  let sql_file
  try {
    cp.execSync(`tar -xvzf "${archive_path}" -C "${temp_dir}"`, {
      maxBuffer: 1024 * 1024 * 100,
      stdio: 'inherit'
    })
    sql_file = find_sql_file({ dir: temp_dir })
    if (!sql_file) {
      throw new Error('no .sql file found in extracted archive')
    }

    // targeted reset: drop only objects present in the dump
    await drop_objects_from_dump({ dump_sql_path: sql_file })
    await drop_conflicting_constraints_and_indexes({ dump_sql_path: sql_file })

    const stop_flag = '-v ON_ERROR_STOP=1'
    const host_flag = host ? `-h ${host}` : ''
    const port_flag = port ? `-p ${port}` : ''
    cp.execSync(
      `psql ${host_flag} ${port_flag} -U ${postgres_user} -d ${database} ${stop_flag} -f "${sql_file}"`,
      {
        maxBuffer: 1024 * 1024 * 100,
        stdio: 'inherit'
      }
    )
    log(`imported ${sql_file} into postgres`)

    await db('users').update('phone', null)
    await db('leagues').update({
      groupme_token: null,
      groupme_id: null,
      discord_webhook_url: null
    })
  } finally {
    remove_if_exists(temp_dir)
    if (!file_path && fetched_from_remote) remove_if_exists(archive_path)
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const file_path = argv.file
    const type = argv.type || 'user'

    await run({ file_path, type })
  } catch (err) {
    error = err
    console.log(error)
  }
  await db.destroy()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
