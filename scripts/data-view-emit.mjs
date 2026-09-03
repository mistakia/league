#!/usr/bin/env node

import validate_emission from '#libs-server/data-views/generation/validate-emission.mjs'
import { deliver_emission } from '#libs-server/data-views/generation/deliver-emission.mjs'
import {
  run_agent_tool,
  require_input
} from '#libs-server/data-views/generation/agent-tool-runner.mjs'

// emit -- the agent's deliverable, in either branch, under one envelope.
//
//   echo '{"emission":{"expressible":true,"explanation":"...",
//          "inexpressible_reason":"","table_state":{...}},
//          "tool_calls":["search_columns","validate_table_state"]}' | \
//     NODE_ENV=sandbox node scripts/data-view-emit.mjs
//
// A rejected emission exits NON-ZERO, unlike validate_table_state. The
// difference is what each tool is for: validating a candidate is the agent's
// working loop and its errors are the answer, while emitting is the agent
// asserting it is DONE. An emission that does not hold is a failed claim, and it
// has to read as one.

run_agent_tool({
  tool: 'emit',
  run: async (input) => {
    const { ok, branch, errors } = validate_emission({
      emission: require_input(input, 'emission'),
      tool_calls: input.tool_calls || []
    })

    if (!ok) {
      const failure = new Error(
        `emission rejected: ${errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`
      )
      failure.code = errors[0].code
      throw failure
    }

    // DELIVERY IS PART OF EMITTING, not a step after it. A validated envelope
    // that stays in the container is indistinguishable to the agent from a
    // finished job, and it was the last structural gap in the transport: the
    // job row's `result` column had no writer. Failing here means the agent
    // sees a non-zero exit and knows its deliverable did not land, rather than
    // reading "ok" over a run that produced nothing.
    const { delivered, generation_id } = await deliver_emission({
      emission: input.emission,
      tool_calls: input.tool_calls || [],
      branch
    })

    return { ok, branch, errors: [], delivered, generation_id }
  }
})
