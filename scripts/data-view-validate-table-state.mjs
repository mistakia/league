#!/usr/bin/env node

import { resolve_generated_table_state } from '#libs-server/data-views/generation/resolve-generated-table-state.mjs'
import {
  run_agent_tool,
  require_input
} from '#libs-server/data-views/generation/agent-tool-runner.mjs'

// validate_table_state -- the strict resolver, callable as often as the agent
// likes.
//
// The single-shot design got ONE repair round against this. As a tool its errors
// become a signal inside a loop instead, which is the difference between a
// generator that can converge and one that gets a second guess.
//
//   echo '{"table_state":{"columns":["player_name"]}}' | \
//     NODE_ENV=sandbox node scripts/data-view-validate-table-state.mjs
//
// NOT A NON-ZERO EXIT ON AN INVALID table_state. A rejected candidate is the
// ordinary case here and the errors ARE the answer -- exiting non-zero would
// route the agent's own working output to stderr and make it indistinguishable
// from the tool failing to run. Non-zero is reserved for the tool itself
// refusing: bad JSON, a missing key.

run_agent_tool({
  tool: 'validate_table_state',
  run: async (input) => {
    const { ok, errors, table_state } = resolve_generated_table_state({
      table_state: require_input(input, 'table_state')
    })
    return { ok, error_count: (errors || []).length, errors, table_state }
  }
})
