// Derive the scrubbed dev fixture from league_production.
//
// The user dump (postgres-backup.sh, `*-user.tar.gz`) is the DISASTER-RECOVERY
// artifact for the irreplaceable slice. It is complete and unscrubbed by
// design and MUST stay that way -- a scrubbed backup cannot restore the users,
// invite codes, webhooks, wagers or vendor config it redacted. The exposure was
// never the dump; it was that the SAME artifact is what a dev machine pulls.
//
// So this script produces a SECOND artifact, `*-dev.tar.gz`, and that is the
// only one a dev machine is allowed to see. It runs on the league host, which
// already holds the plaintext, so no secret crosses a new boundary.
//
// The scrub is an explicit EMITTED-COLUMN PROJECTION, not a denylist. Every
// column of every dumped table is named in dev-fixture-projection.json with a
// disposition, and a column present in the database but absent from the spec
// ABORTS the run with no artifact written. That inverts the failure direction
// of the deleted import-database-backup.mjs, whose denylist named a column that
// had been dropped, raised 42703 on its first statement, and so scrubbed
// nothing for seven months while reading as the safe path.

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { promisify } from 'util'
import { execFile as execFile_cb } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

// NOT `import { is_main } from '#libs-server'`. That barrel loads config/, which
// resolves config-<NODE_ENV>.json and throws on import when NODE_ENV is unset --
// so importing this module from a gate would crash before any check ran. The
// pure functions below are meant to be importable with no environment at all.
const is_main = (module_url) =>
  process.argv[1] && module_url === `file://${path.resolve(process.argv[1])}`

const execFile = (cmd, args, options = {}) =>
  promisify(execFile_cb)(cmd, args, {
    maxBuffer: 512 * 1024 * 1024,
    ...options
  })

const log = debug('derive-dev-fixture')
debug.enable('derive-dev-fixture')

const script_dir = path.dirname(fileURLToPath(import.meta.url))
const projection_path = path.join(script_dir, 'dev-fixture-projection.json')
const backup_script_path = path.join(script_dir, 'postgres-backup.sh')

/**
 * Read the dumped-table list from postgres-backup.sh rather than restating it.
 * The two lists drifting apart is the failure that puts an unspecced table into
 * the fixture, so there is exactly one source of truth for which tables ship.
 */
export const read_dumped_tables = async ({
  backup_script = backup_script_path
} = {}) => {
  const source = await fs.readFile(backup_script, 'utf8')
  const match = source.match(/db_user_tables="\n([\s\S]*?)"/)
  if (!match) {
    throw new Error(
      `could not locate db_user_tables in ${backup_script} -- the backup script's shape changed`
    )
  }
  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export const read_projection = async ({ spec_path = projection_path } = {}) => {
  const raw = await fs.readFile(spec_path, 'utf8')
  const parsed = JSON.parse(raw)
  if (!parsed.tables || typeof parsed.tables !== 'object') {
    throw new Error(`${spec_path} has no tables object`)
  }
  return parsed.tables
}

/**
 * Compare the projection against the live column inventory and the dumped-table
 * list. Returns a list of human-readable problems; a non-empty list must abort
 * the derivation. Split out from the emit path so the gate can exercise it
 * against a synthetic inventory without touching a database.
 */
export const find_projection_gaps = ({
  projection,
  live_columns,
  dumped_tables
}) => {
  const problems = []

  for (const table of dumped_tables) {
    const live = live_columns[table]
    if (!live) {
      // A table named for the dump that does not exist in the database. The
      // dump itself skips it silently; say so rather than inheriting the
      // silence.
      problems.push(
        `table "${table}" is in db_user_tables but does not exist in the database`
      )
      continue
    }
    if (!projection[table]) {
      problems.push(
        `table "${table}" is dumped but has no entry in the projection spec`
      )
    }
  }

  for (const table of Object.keys(projection)) {
    if (!dumped_tables.includes(table)) {
      problems.push(
        `table "${table}" is in the projection spec but is not in db_user_tables`
      )
      continue
    }
    const live = live_columns[table]
    if (!live) continue

    const specced = Object.keys(projection[table])
    // THE fail-closed direction: a column the database has that nobody has
    // adjudicated. A new secret-bearing column lands here, and stops the run.
    for (const column of live) {
      if (!specced.includes(column)) {
        problems.push(
          `${table}.${column} exists in the database but has no disposition in the projection spec`
        )
      }
    }
    // A spec entry for a column that is gone is the exact shape that made the
    // old scrub a no-op, so it is an error too, not a warning.
    for (const column of specced) {
      if (!live.includes(column)) {
        problems.push(
          `${table}.${column} is in the projection spec but no longer exists in the database`
        )
      }
    }
  }

  return problems
}

/**
 * Build the SELECT list for one table: "keep" emits the column verbatim, any
 * other disposition is a SQL expression aliased back to the column name so the
 * emitted COPY header is identical to an unscrubbed dump's.
 */
export const build_projection_select = ({ table, columns }) => {
  const names = Object.keys(columns)
  const select_list = names
    .map((column) => {
      const disposition = columns[column]
      if (disposition === 'keep') return `"${column}"`
      return `${disposition} AS "${column}"`
    })
    .join(', ')
  return `SELECT ${select_list} FROM public."${table}"`
}

const psql = async ({ db_name, db_user, db_host, args }) =>
  execFile('psql', [
    '-h',
    db_host,
    '-U',
    db_user,
    '-d',
    db_name,
    '--no-psqlrc',
    ...args
  ])

const read_live_columns = async ({ db_name, db_user, db_host, tables }) => {
  const list = tables.map((t) => `'${t}'`).join(',')
  const { stdout } = await psql({
    db_name,
    db_user,
    db_host,
    args: [
      '-At',
      '-F',
      '|',
      '-c',
      `SELECT table_name || '|' || column_name FROM information_schema.columns ` +
        `WHERE table_schema = 'public' AND table_name IN (${list}) ` +
        `ORDER BY table_name, ordinal_position`
    ]
  })
  const live_columns = {}
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const [table, column] = trimmed.split('|')
    if (!live_columns[table]) live_columns[table] = []
    live_columns[table].push(column)
  }
  return live_columns
}

/**
 * A per-column projection scrubs a column. It cannot scrub a VALUE that also
 * lives somewhere else, and that gap is not hypothetical: the first real run of
 * this script produced a fixture whose `leagues.discord_webhook_url` was
 * correctly redacted while the same webhook sat in two `waivers.reason` rows,
 * captured there as the error text of a failed POST. A free-text column that
 * records integration errors is a secret sink, and no column-name reasoning
 * finds it.
 *
 * So after the fixture is written, read every REAL value of every scrubbed
 * column back out of the database and confirm none of them appears anywhere in
 * the artifact. Values never touch stdout or argv -- they go into a 0600 file
 * consumed by `grep -F -f`, which is one Aho-Corasick pass over the fixture
 * regardless of needle count.
 *
 * The scan carries its own sightedness control. `grep -F -f` against a needle
 * file that is empty, unreadable or badly quoted matches NOTHING and exits 1,
 * which is indistinguishable from a clean fixture -- the precise shape of the
 * original incident. A canary known to be present is therefore appended to the
 * needle set, and the scan is only believed if the canary is found.
 */
export const assert_no_scrubbed_value_survives = async ({
  db_name,
  db_user,
  db_host,
  projection,
  emitted_tables,
  sql_path
}) => {
  const needles_path = `${sql_path}.needles`
  const canary = `COPY public.${emitted_tables[0]} (`
  const needles = new Set()

  for (const table of emitted_tables) {
    const scrubbed = Object.entries(projection[table])
      .filter(([, disposition]) => disposition !== 'keep')
      .map(([column]) => column)
    for (const column of scrubbed) {
      const expression = projection[table][column]
      // Only values the projection actually ALTERS have to disappear. A
      // partial redaction leaves most of its input intact on purpose --
      // waivers.reason strips embedded URLs and keeps the sentence -- so
      // demanding that every scrubbed column's every value vanish would report
      // the untouched rows as leaks and bury the real ones.
      //
      // Short values produce false positives against ordinary data, and a
      // secret shorter than this is not protected by redaction anyway.
      const { stdout } = await psql({
        db_name,
        db_user,
        db_host,
        args: [
          '-At',
          '-c',
          `SELECT DISTINCT "${column}"::text FROM public."${table}" ` +
            `WHERE "${column}" IS NOT NULL ` +
            `AND length("${column}"::text) >= 12 ` +
            `AND "${column}"::text IS DISTINCT FROM (${expression})::text`
        ]
      })
      for (const value of stdout.split('\n')) {
        const trimmed = value.trim()
        if (trimmed) needles.add(trimmed)
      }
    }
  }

  const needle_count = needles.size
  await fs.writeFile(needles_path, [...needles, canary].join('\n') + '\n', {
    mode: 0o600
  })

  try {
    let matches = []
    try {
      const { stdout } = await execFile('grep', [
        '-F',
        '-f',
        needles_path,
        '-o',
        sql_path
      ])
      matches = stdout.split('\n').filter(Boolean)
    } catch (error) {
      // grep exits 1 on no match at all -- which means the canary was missed.
      if (error.code !== 1) throw error
    }

    const canary_seen = matches.includes(canary)
    if (!canary_seen) {
      throw new Error(
        'leak scan is BLIND -- its canary was not found in the fixture, so a ' +
          'clean result would prove nothing. No fixture written.'
      )
    }

    const leaked = new Set(matches.filter((m) => m !== canary))
    if (leaked.size) {
      // Name the columns, never the values.
      const owners = []
      for (const table of emitted_tables) {
        for (const [column, disposition] of Object.entries(projection[table])) {
          if (disposition === 'keep') continue
          owners.push(`${table}.${column}`)
        }
      }
      throw new Error(
        `${leaked.size} scrubbed value(s) still appear in the fixture, ` +
          `duplicated outside their own column. Scrubbed columns: ` +
          `${owners.join(', ')}. Find the sink and give it a disposition. ` +
          `No fixture written.`
      )
    }

    log(
      'leak scan clean -- %d distinct scrubbed values absent, canary sighted',
      needle_count
    )
  } catch (error) {
    await fs.unlink(sql_path).catch(() => {})
    throw error
  } finally {
    await fs.unlink(needles_path).catch(() => {})
  }
}

export const derive_dev_fixture = async ({
  db_name,
  db_user,
  db_host,
  output_dir,
  file_name
}) => {
  const projection = await read_projection()
  const dumped_tables = await read_dumped_tables()
  const live_columns = await read_live_columns({
    db_name,
    db_user,
    db_host,
    tables: dumped_tables
  })

  const problems = find_projection_gaps({
    projection,
    live_columns,
    dumped_tables
  })
  if (problems.length) {
    // Fail closed and write nothing. A partially-scrubbed fixture is worse
    // than no fixture, because it reads as the safe artifact.
    for (const problem of problems) log('PROJECTION GAP: %s', problem)
    throw new Error(
      `projection spec does not match the database (${problems.length} problem(s)) -- ` +
        `no fixture written. Adjudicate each column in dev-fixture-projection.json.`
    )
  }

  const emitted_tables = dumped_tables.filter((t) => live_columns[t])
  const sql_path = path.join(output_dir, `${file_name}-dev.sql`)

  // Schema first, from pg_dump, so the fixture loads into an empty database the
  // same way the user dump does.
  const table_args = emitted_tables.flatMap((t) => ['-t', t])
  const { stdout: schema_sql } = await execFile('pg_dump', [
    '-h',
    db_host,
    '-U',
    db_user,
    '-d',
    db_name,
    '--schema-only',
    '--no-owner',
    ...table_args
  ])

  const header =
    `--\n-- League SCRUBBED dev fixture -- derived by scripts/derive-dev-fixture.mjs\n` +
    `-- Source database: ${db_name}. Scrub: emitted-column projection, see\n` +
    `-- scripts/dev-fixture-projection.json. This is NOT a backup and cannot be\n` +
    `-- restored from -- the disaster-recovery artifact is the *-user.tar.gz dump.\n--\n\n`

  await fs.writeFile(sql_path, header + schema_sql + '\n')

  for (const table of emitted_tables) {
    const columns = projection[table]
    const select = build_projection_select({ table, columns })
    const column_list = Object.keys(columns)
      .map((c) => `"${c}"`)
      .join(', ')

    log('projecting %s (%d columns)', table, Object.keys(columns).length)
    const { stdout: rows } = await psql({
      db_name,
      db_user,
      db_host,
      args: ['-At', '-c', `\\copy (${select}) TO STDOUT`]
    })

    const block =
      `COPY public.${table} (${column_list}) FROM stdin;\n` +
      (rows.endsWith('\n') || rows === '' ? rows : rows + '\n') +
      `\\.\n\n`
    await fs.appendFile(sql_path, block)
  }

  await assert_no_scrubbed_value_survives({
    db_name,
    db_user,
    db_host,
    projection,
    emitted_tables,
    sql_path
  })

  const tar_path = path.join(output_dir, `${file_name}-dev.tar.gz`)
  // Same write-to-temp-and-rename discipline as postgres-backup.sh: the pull
  // job reads this directory on a timer, so a half-written archive must never
  // be visible under its real name.
  await execFile('tar', [
    '-czf',
    `${tar_path}.tmp`,
    '-C',
    output_dir,
    path.basename(sql_path)
  ])
  await fs.rename(`${tar_path}.tmp`, tar_path)
  await fs.unlink(sql_path)

  const { size } = await fs.stat(tar_path)
  if (!size) {
    throw new Error(`fixture ${tar_path} is empty`)
  }
  log('wrote %s (%d bytes, %d tables)', tar_path, size, emitted_tables.length)
  return tar_path
}

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .option('db', { type: 'string', default: 'league_production' })
    .option('user', { type: 'string', default: 'league_writer' })
    .option('host', { type: 'string', default: 'localhost' })
    .option('output_dir', { type: 'string', default: '/root/backups' })
    .option('name', {
      describe: 'Artifact basename; defaults to the checkpoint name',
      type: 'string',
      default: 'checkpoint'
    }).argv

  await derive_dev_fixture({
    db_name: argv.db,
    db_user: argv.user,
    db_host: argv.host,
    output_dir: argv.output_dir,
    file_name: argv.name
  })
}

if (is_main(import.meta.url)) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error.message)
      process.exit(1)
    })
}
