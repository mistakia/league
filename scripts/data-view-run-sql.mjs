#!/usr/bin/env node

import execute_generated_sql from '#libs-server/data-views/generation/execute-generated-sql.mjs'
import {
  run_agent_tool,
  require_input,
  require_database_credential
} from '#libs-server/data-views/generation/agent-tool-runner.mjs'

// run_sql -- the sandboxed SQL path, for the long tail the registry cannot
// express.
//
// REGISTRY FIRST. This is one tool the agent chooses among, not a tier it falls
// through to: build an ordinary data view whenever the registry can express the
// request, and reach here only with evidence that it cannot. The control on
// that preference is measurement, not this comment -- every corpus view is
// registry-expressible by construction, so a query-backed answer to one is a
// reportable unnecessary reach.
//
//   echo '{"sql_text":"SELECT player.pid AS \"pid\" FROM player LIMIT 5"}' | \
//     NODE_ENV=sandbox node scripts/data-view-run-sql.mjs
//
// Under the parser, the sandbox role's GRANTs, the READ ONLY transaction, the
// EXPLAIN preflight and the row cap. skip_cache has no meaning here: this call
// carries no query_id, so there is no key that could separate it from another
// statement, and execute_generated_sql caches nothing without one.

const AGENT_ROW_CAP = 50

run_agent_tool({
  tool: 'run_sql',
  input_keys: ['sql_text', 'limit'],
  run: async (input) => {
    // The other of the two tools that open a connection. See preview_view for
    // why this is asserted here rather than at config import.
    require_database_credential()

    const sql_text = require_input(input, 'sql_text')
    const limit = Math.max(
      1,
      Math.min(Number(input.limit) || 20, AGENT_ROW_CAP)
    )

    const { data_view_results, data_view_fields, data_view_metadata } =
      await execute_generated_sql({
        sql_text,
        limit,
        // Off: the agent is exploring, and a count over an unbounded statement
        // is the one part of the wrap that can cost real time on every probe.
        calculate_total_count: false
      })

    return {
      row_count: data_view_results.length,
      returned_no_rows: data_view_results.length === 0,
      // The projected aliases and their derived types, which is what the emit
      // branch's column_annotations must reconcile against. Handing them back
      // here saves the agent guessing them from the statement it wrote.
      columns: data_view_fields.map((field) => ({
        alias: field.name,
        pg_type_name: field.pg_type_name,
        data_type: field.data_type,
        needs_annotated_data_type: Boolean(field.unbucketable)
      })),
      metadata: data_view_metadata,
      rows: data_view_results
    }
  }
})
