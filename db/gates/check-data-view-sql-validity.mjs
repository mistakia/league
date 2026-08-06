// EXPLAIN-validity gate for the data-view column catalog.
//
// WHY THIS EXISTS. Nothing else in this repo ever asks Postgres whether the SQL
// the data-view builder generated will parse. The mocha suite compares generated
// SQL against committed goldens, and `scripts/update-data-view-snapshots.mjs`
// rewrites a golden from whatever the code currently emits -- so a golden
// regenerated from buggy code agrees with the buggy code and the suite goes green
// over a live 42703. The grep-shaped sweeps in the column-rename recipe have the
// complementary hole: grep proves the ABSENCE OF A STRING, not the VALIDITY OF A
// QUERY. Correlated-subquery predicates are emitted as raw SQL against a
// hash-named CTE alias (`t22c9a76f...year IN (2024,2025)`) and match no
// table-qualified pattern at all.
//
// On 2026-07-27 this gate, run ad hoc, found six defects that a fully green
// 2214-test suite and 232 goldens did not -- including an API route that had been
// returning 500 since 2025-07-16. It takes about two minutes.
//
// RUN IT PER CLUSTER on any grain-column rename, as a gate, before cutover.
//
// REACHABILITY, NOT JUST VALIDITY. The 2026-07-27 review ranked its findings by
// how broken each statement was and got the severity call inverted: an invalid
// statement on a cold seasonal path (prop settlement, dormant until the season's
// first game finalize) was ranked BLOCKER above an invalid statement on a hot
// request path (`GET /api/markets/players/:pid`, broken on every call for a
// year). Validity alone cannot make that distinction, so every finding here
// carries a reachability tier and the report sorts by it:
//
//   system_view  - the column ships in a system/default data view, so it is on a
//                  page-load path for every user. Break it and it is live now.
//   saved_view   - a real user's saved view persists this column
//                  (--saved-view-columns, produced against production; see
//                  check-saved-view-param-coverage.mjs for the production read).
//   golden       - covered by a committed data-view golden. Someone exercises it;
//                  no evidence it is user-facing.
//   catalog_only - reachable only by hand-picking it in the column browser. Cold.
//
// A catalog_only failure is still a failure and still fails the gate -- the tier
// orders triage, it does not excuse anything.
//
// ISOLATION. The :5433 container is a shared singleton and `mochaGlobalSetup`
// drops every table in whatever database it points at, so a sibling session's
// suite run and this gate would pull the schema out from under each other. This
// script therefore provisions its OWN database per run, loads
// `db/schema.postgres.sql` into it, and drops it on exit. It is safe to run
// while a sibling is running the suite.
//
// Usage:
//   yarn test:db:up
//   node db/gates/check-data-view-sql-validity.mjs              # full report
//   node db/gates/check-data-view-sql-validity.mjs --json
//   node db/gates/check-data-view-sql-validity.mjs --column player_fantasy_points_from_plays
//   node db/gates/check-data-view-sql-validity.mjs --shape plain
//   node db/gates/check-data-view-sql-validity.mjs --saved-view-columns /tmp/saved-view-columns.json
//   node db/gates/check-data-view-sql-validity.mjs --keep-database   # leave the DB for inspection
//
// Exit 0 = every generated statement is valid; 1 = at least one is invalid;
// 2 = tooling error (container down, schema load failed).

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import Knex from 'knex'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..', '..')

// The gate is meaningless against anything but a throwaway database, so it
// defaults itself onto the bundled PG16 test container rather than inheriting an
// ambient NODE_ENV that might point at production.
process.env.NODE_ENV = process.env.NODE_ENV || 'test'
process.env.LEAGUE_DB_HOST = process.env.LEAGUE_DB_HOST || '127.0.0.1'
process.env.LEAGUE_DB_PORT = process.env.LEAGUE_DB_PORT || '5433'

const REACHABILITY_TIERS = [
  'system_view',
  'saved_view',
  'golden',
  'catalog_only'
]

const SYSTEM_VIEW_SOURCES = [
  'app/core/data-views/default-data-views.js',
  'app/core/players/default-players-views.js',
  'app/core/plays-view/default-plays-views.js'
]

const GOLDEN_DIRECTORY = 'test/data-view-queries'

// Column ids are snake_case identifiers; scanning the raw source text for a
// whole-word occurrence is deliberately loose. A false POSITIVE here only
// over-states reachability (triage sees a cold column as warm, which is the safe
// direction); a false negative would under-state it, and the word-boundary match
// against a literal id makes that essentially impossible.
const collect_column_id_mentions = async ({ files, column_ids }) => {
  const mentioned = new Set()
  const id_set = new Set(column_ids)
  for (const file of files) {
    let text
    try {
      text = await fs.readFile(file, 'utf8')
    } catch {
      continue
    }
    for (const token of text.match(/[a-z][a-z0-9_]{3,}/g) || []) {
      if (id_set.has(token)) mentioned.add(token)
    }
  }
  return mentioned
}

const list_golden_files = async () => {
  const directory = path.join(repo_root, GOLDEN_DIRECTORY)
  const entries = await fs.readdir(directory)
  return entries
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => path.join(directory, entry))
}

const build_reachability_index = async ({ column_ids, saved_view_columns }) => {
  const system_view_mentions = await collect_column_id_mentions({
    files: SYSTEM_VIEW_SOURCES.map((file) => path.join(repo_root, file)),
    column_ids
  })
  const golden_mentions = await collect_column_id_mentions({
    files: await list_golden_files(),
    column_ids
  })
  const saved = new Set(saved_view_columns)

  const index = new Map()
  for (const column_id of column_ids) {
    if (system_view_mentions.has(column_id)) index.set(column_id, 'system_view')
    else if (saved.has(column_id)) index.set(column_id, 'saved_view')
    else if (golden_mentions.has(column_id)) index.set(column_id, 'golden')
    else index.set(column_id, 'catalog_only')
  }
  return index
}

// The two shapes the 2026-07-27 sweep ran. `year_offset` is applied to EVERY
// column, not only to those whose source carries a year dimension: a hand-crafted
// URL can inject `year_offset: [a, b]` onto any column (see
// libs-server/data-views/year-offset-range.mjs), and that is exactly how the
// add-defensive-play-by-play-with-statement defect reached production -- the
// param leaked into the inner SELECT as a column name on three tackle columns.
const SHAPES = {
  plain: () => ({}),
  year_offset_range: () => ({ year_offset: [0, 1] })
}

// The row_axes combinations the UI can produce. `week` without `year` is not
// reachable -- the week control is nested under the year one.
const ROW_AXES_SHAPES = [[], ['year'], ['year', 'week']]

const generate_and_explain = async ({
  db,
  get_data_view_results_query,
  column_id,
  params,
  row_grain,
  row_axes
}) => {
  let sql
  try {
    const { query } = await get_data_view_results_query({
      columns: [Object.keys(params).length ? { column_id, params } : column_id],
      row_grain,
      row_axes
    })
    sql = query.toString()
  } catch (error) {
    return { status: 'generation_error', message: error.message }
  }

  try {
    await db.raw(`EXPLAIN ${sql}`)
    return { status: 'valid', sql }
  } catch (error) {
    return {
      status: 'invalid',
      code: error.code,
      message: error.message,
      position: error.position,
      sql
    }
  }
}

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .option('json', { type: 'boolean', default: false })
    .option('column', { type: 'string', describe: 'restrict to one column id' })
    .option('shape', {
      type: 'string',
      choices: Object.keys(SHAPES),
      describe: 'restrict to one request shape'
    })
    .option('saved-view-columns', {
      type: 'string',
      describe:
        'path to a JSON array of column ids persisted in production saved views'
    })
    .option('keep-database', { type: 'boolean', default: false })
    .parse()

  const config = (await import('#config')).default
  const base_connection = {
    ...config.postgres.connection,
    host: process.env.LEAGUE_DB_HOST,
    port: Number(process.env.LEAGUE_DB_PORT)
  }

  const gate_database = `league_sqlgate_${process.pid}_${Date.now()}`
  const admin = Knex({ client: 'pg', connection: base_connection })

  const drop_gate_database = async () => {
    if (argv.keepDatabase) {
      console.log(`\nleft database ${gate_database} in place (--keep-database)`)
      return
    }
    const cleanup = Knex({ client: 'pg', connection: base_connection })
    try {
      await cleanup.raw(`DROP DATABASE IF EXISTS ${gate_database}`)
    } finally {
      await cleanup.destroy()
    }
  }

  try {
    await admin.raw(
      `CREATE DATABASE ${gate_database} OWNER ${base_connection.user}`
    )
  } catch (error) {
    console.error(
      `TOOLING ERROR: could not provision ${gate_database} on ` +
        `${base_connection.host}:${base_connection.port} -- is \`yarn test:db:up\` running?\n` +
        error.message
    )
    await admin.destroy()
    process.exitCode = 2
    return
  } finally {
    await admin.destroy()
  }

  // #db reads LEAGUE_DB_DATABASE at import time, so the env override has to land
  // before the first import of anything that pulls in the connection.
  process.env.LEAGUE_DB_DATABASE = gate_database
  const db = (await import('#db')).default

  try {
    await db.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto')
    const schema_file =
      process.env.LEAGUE_SCHEMA_FILE ||
      path.join(repo_root, 'db/schema.postgres.sql')
    await db.raw(await fs.readFile(schema_file, 'utf8'))

    const column_definitions = (
      await import('#libs-server/data-views-column-definitions/index.mjs')
    ).default
    const derive_column_row_grains = (
      await import('#libs-server/data-views/derive-column-row-grains.mjs')
    ).default
    const { get_data_view_results_query } = await import('#libs-server')

    const all_column_ids = Object.keys(column_definitions)
    const column_ids = argv.column ? [argv.column] : all_column_ids
    if (argv.column && !column_definitions[argv.column]) {
      console.error(`TOOLING ERROR: unknown column id ${argv.column}`)
      process.exitCode = 2
      return
    }

    let saved_view_columns = []
    if (argv.savedViewColumns) {
      saved_view_columns = JSON.parse(
        await fs.readFile(argv.savedViewColumns, 'utf8')
      )
    }
    const reachability = await build_reachability_index({
      column_ids: all_column_ids,
      saved_view_columns
    })

    const shape_names = argv.shape ? [argv.shape] : Object.keys(SHAPES)
    const findings = []
    let checked = 0
    const started_at = Date.now()

    for (const column_id of column_ids) {
      const definition = column_definitions[column_id]
      // Every grain the column admits, not just one. Picking a single grain
      // (this loop preferred `player`) left the team row grain unEXPLAINed for
      // every dual-grain column, which is exactly the surface the identity
      // migration added. Asking for a grain the column does NOT admit fails in
      // the builder rather than in Postgres, so the admitted set is the honest
      // sweep space.
      const row_grains = derive_column_row_grains(definition)
      if (!row_grains.length) row_grains.push('player')
      const supports_row_axes = definition?.source?.supports_row_axes || null

      for (const row_grain_id of row_grains) {
        for (const row_axes of ROW_AXES_SHAPES) {
          // An axis the column does not declare is filtered out of the request
          // before dispatch, so generating it would EXPLAIN a shape no user can
          // reach.
          if (
            supports_row_axes &&
            row_axes.some((axis) => !supports_row_axes.includes(axis))
          ) {
            continue
          }

          for (const shape_name of shape_names) {
            checked++
            const result = await generate_and_explain({
              db,
              get_data_view_results_query,
              column_id,
              params: SHAPES[shape_name](),
              row_grain: [row_grain_id],
              row_axes
            })
            if (result.status === 'valid') continue
            findings.push({
              column_id,
              shape: shape_name,
              row_grain: row_grain_id,
              row_axes,
              reachability: reachability.get(column_id) || 'catalog_only',
              ...result
            })
          }
        }
      }
    }

    const elapsed_seconds = ((Date.now() - started_at) / 1000).toFixed(1)
    findings.sort(
      (a, b) =>
        REACHABILITY_TIERS.indexOf(a.reachability) -
          REACHABILITY_TIERS.indexOf(b.reachability) ||
        a.column_id.localeCompare(b.column_id)
    )

    if (argv.json) {
      console.log(
        JSON.stringify(
          { checked, elapsed_seconds: Number(elapsed_seconds), findings },
          null,
          2
        )
      )
    } else {
      console.log(
        `\nEXPLAINed ${checked} generated statement(s) across ` +
          `${column_ids.length} column(s) x ${shape_names.length} shape(s) in ${elapsed_seconds}s.`
      )
      for (const tier of REACHABILITY_TIERS) {
        const tier_findings = findings.filter((f) => f.reachability === tier)
        if (!tier_findings.length) continue
        console.log(`\n## ${tier} (${tier_findings.length})`)
        for (const finding of tier_findings) {
          const label =
            finding.status === 'invalid'
              ? `INVALID ${finding.code || ''}`.trim()
              : 'GENERATION ERROR'
          console.log(
            `  ${label}  ${finding.column_id} [${finding.shape}, ${finding.row_grain}, row_axes=[${finding.row_axes}]]`
          )
          console.log(`    ${finding.message.split('\n')[0]}`)
        }
      }
      if (findings.length) {
        console.log(
          `\nGATE FAIL: ${findings.length} generated statement(s) did not survive EXPLAIN.`
        )
      } else {
        console.log('\nGATE OK: every generated statement EXPLAINed cleanly.')
      }
    }

    if (findings.length) process.exitCode = 1
  } catch (error) {
    console.error(`TOOLING ERROR: ${error.message}`)
    console.error(error.stack)
    process.exitCode = 2
  } finally {
    await db.destroy()
    await drop_gate_database()
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main()
}
