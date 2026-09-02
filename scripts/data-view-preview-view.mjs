#!/usr/bin/env node

import { execute_data_view_request } from '#libs-server/data-views/execute-data-view-request.mjs'
import { resolve_generated_table_state } from '#libs-server/data-views/generation/resolve-generated-table-state.mjs'
import {
  run_agent_tool,
  require_input,
  AgentToolError
} from '#libs-server/data-views/generation/agent-tool-runner.mjs'

// preview_view -- run the candidate and return a handful of rows.
//
// THE ORACLE THE SINGLE-SHOT DESIGN NEVER HAD. A view that returns zero rows or
// nonsense is visible to the agent before the user ever sees it, and a table
// state that validates is not thereby a table state that answers the question.
//
//   echo '{"table_state":{"columns":["player_name"]},"limit":5}' | \
//     NODE_ENV=sandbox node scripts/data-view-preview-view.mjs
//
// Through execute_data_view_request, so a preview contends for the SAME bounded
// admission slots as every user-facing query rather than opening its own path
// to Postgres. An agent looping on previews is otherwise a load source nothing
// accounts for.

const PREVIEW_ROW_CAP = 25

run_agent_tool({
  tool: 'preview_view',
  run: async (input) => {
    const table_state = require_input(input, 'table_state')

    // Validate FIRST. The resolver's named errors are far more useful to the
    // agent than whatever the query builder would say about an unknown
    // column_id, and an invalid candidate must not reach the admission gate at
    // all -- a preview loop over malformed states would spend real query slots
    // on states that cannot run.
    const { ok, errors } = resolve_generated_table_state({ table_state })
    if (!ok) {
      throw new AgentToolError(
        'table_state_invalid',
        `validate_table_state first: ${JSON.stringify(errors)}`
      )
    }

    const limit = Math.max(
      1,
      Math.min(Number(input.limit) || 5, PREVIEW_ROW_CAP)
    )

    const { data_view_results, data_view_metadata } =
      await execute_data_view_request({
        request_id: null,
        params: { ...table_state, offset: 0, limit },
        user_id: null,
        path: 'agent-preview',
        cache_key: null,
        // A preview must reflect the candidate as it stands right now. A cache
        // hit from an identical earlier candidate would be correct but useless:
        // the agent is using this to decide whether its LAST edit helped.
        skip_cache: true
      })

    const rows = data_view_results || []
    return {
      row_count: rows.length,
      // Stated as its own field rather than left for the agent to infer from an
      // empty array. Zero rows is the single most informative preview outcome
      // and the one an agent is likeliest to skim past.
      returned_no_rows: rows.length === 0,
      total_count: data_view_metadata?.total_count ?? null,
      rows
    }
  }
})
