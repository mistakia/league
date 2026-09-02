#!/usr/bin/env node

import fs from 'fs'
import crypto from 'crypto'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import is_main from '#libs-server/is-main.mjs'
import validate_generated_sql from '#libs-server/data-views/generation/validate-generated-sql.mjs'
import execute_generated_sql from '#libs-server/data-views/generation/execute-generated-sql.mjs'
import derive_view_from_query_result from '#libs-server/data-views/derive-view-from-query-result.mjs'

// Create a query-backed data view from a HAND-WRITTEN statement.
//
// This is what makes query-backed views ship without any LLM. The whole
// representation -- the guard, the executor, the type resolver, the deriver, the
// render path, the share link -- is exercised end to end by a human typing SQL,
// which means every one of it is validated before an agent exists to produce
// one. The generation agent's emit branch later writes the SAME row through the
// SAME validation, so it inherits a path that has already been walked by hand.
//
// The order below is the point: the statement is PARSED, then RUN, then
// RECONCILED against the annotations, and only then persisted. A row that
// reaches the table has already produced a renderable result once. Nothing here
// persists on a partial success -- the insert is the last thing that happens.

const usage = `
create-data-view-query -- persist a query-backed data view

  --sql-file <path>          file holding the SELECT statement
  --annotations-file <path>  file holding the column_annotations JSON
  --view-name <name>         name for the saved view
  --user-id <id>             owner of the saved view (omit for an ownerless view)
  --view-description <text>  optional
  --dry-run                  validate, execute and derive, but persist nothing

The annotations block is keyed by projected alias and carries ONLY what the
query cannot supply: column_title (required), header_label, fixed, size, and
data_type in the one case where the pg type of an alias has no mapping. A
data_type declared for an alias whose type IS derivable is a rejection, not a
hint -- that is the whole class of "declared type disagrees with the real one"
failure this representation deletes.
`

const read_json_file = (path_name) => {
  const raw = fs.readFileSync(path_name, 'utf8')
  try {
    return JSON.parse(raw)
  } catch (error) {
    throw new Error(`${path_name} is not valid JSON: ${error.message}`)
  }
}

export const create_data_view_query = async ({
  sql_text,
  column_annotations,
  view_name,
  view_description = null,
  user_id = null,
  dry_run = false,
  query_runner = db
}) => {
  // 1. The guard. Rejects writes, DDL, locking clauses, non-allowlisted
  //    relations and unaliased projections -- and it is the alias contract that
  //    makes reconciliation below possible at all.
  const { output_aliases } = await validate_generated_sql({ sql_text })

  // 2. Run it, with total_count off. This exists to produce field descriptors,
  //    not rows, and a count(*) over () on an unbounded statement is the one
  //    part of the wrap that can cost real time.
  const { data_view_fields, data_view_results } = await execute_generated_sql({
    sql_text,
    limit: 1,
    calculate_total_count: false,
    user_id
  })

  // 3. Reconcile. Both directions, and it throws by name on either miss.
  const { columns, table_state_seed } = derive_view_from_query_result({
    data_view_fields,
    column_annotations
  })

  const report = {
    output_aliases,
    columns,
    table_state: table_state_seed,
    sample_row_count: data_view_results.length
  }

  if (dry_run) return { ...report, query_id: null, view_id: null }

  const query_id = crypto.randomUUID()
  const view_id = crypto.randomUUID()

  // The two rows go in ONE transaction. A data_view_queries row with no view
  // referencing it is exactly what the sweep collects, so a half-applied create
  // would race the sweep and delete the statement out from under the view.
  await query_runner.transaction(async (trx) => {
    await trx('data_view_queries').insert({
      query_id,
      sql_text,
      column_annotations: JSON.stringify(column_annotations)
    })
    await trx('user_data_views').insert({
      view_id,
      view_name,
      view_description,
      table_state: JSON.stringify(table_state_seed),
      query_id,
      user_id
    })
  })

  return { ...report, query_id, view_id }
}

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .usage(usage)
    .option('sql-file', { type: 'string', demandOption: true })
    .option('annotations-file', { type: 'string', demandOption: true })
    .option('view-name', { type: 'string', demandOption: true })
    .option('view-description', { type: 'string' })
    .option('user-id', { type: 'number' })
    .option('dry-run', { type: 'boolean', default: false })
    .strict().argv

  const result = await create_data_view_query({
    sql_text: fs.readFileSync(argv['sql-file'], 'utf8'),
    column_annotations: read_json_file(argv['annotations-file']),
    view_name: argv['view-name'],
    view_description: argv['view-description'] || null,
    user_id: argv['user-id'] ?? null,
    dry_run: argv['dry-run']
  })

  // JSON on stdout, so this composes -- the agent's emit path calls the same
  // function and a human piping it to jq reads the same shape.
  console.log(JSON.stringify(result, null, 2))
}

if (is_main(import.meta.url)) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      // Non-zero with a NAMED code on stderr, never a plausible empty result on
      // stdout. A refusal that prints valid-looking JSON is indistinguishable
      // from a success to anything reading this programmatically.
      console.error(
        JSON.stringify({
          error: error.message,
          code: error.code || 'create_data_view_query_failed'
        })
      )
      process.exit(1)
    })
}
