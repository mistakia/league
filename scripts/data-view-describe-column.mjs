#!/usr/bin/env node

import describe_column from '#libs-server/data-views/generation/describe-column.mjs'
import {
  run_agent_tool,
  require_input
} from '#libs-server/data-views/generation/agent-tool-runner.mjs'

// describe_column -- the column's real parameter vocabulary, with enumerated
// values.
//
// The retired design measured param agreement at 0.009 against columns at
// 0.303: it found roughly the right columns and then got their parameters almost
// entirely wrong, because a pushed catalog cannot carry enumerated values for
// 597 columns and so carried them for none. This is the tool that fixes that,
// and it is the second half of search_columns -- which column, then what it can
// be asked.
//
//   echo '{"column_id":"player_targets_from_plays"}' | \
//     NODE_ENV=sandbox node scripts/data-view-describe-column.mjs
//
// Configuration params come back expanded; the play-by-play filter tail comes
// back as names. Pass param_keys to open one of those by name:
//
//   echo '{"column_id":"player_targets_from_plays","param_keys":["down_number"]}' | \
//     NODE_ENV=sandbox node scripts/data-view-describe-column.mjs

run_agent_tool({
  tool: 'describe_column',
  input_keys: ['column_id', 'param_keys'],
  run: async (input) =>
    describe_column({
      column_id: require_input(input, 'column_id'),
      param_keys: input.param_keys
    })
})
