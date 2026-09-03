#!/usr/bin/env node

import { search_columns } from '#libs-server/data-views/generation/search-columns.mjs'
import { run_agent_tool } from '#libs-server/data-views/generation/agent-tool-runner.mjs'

// search_columns -- find the columns an instruction phrase is about.
//
// Vocabulary is PULLED, not pushed. This is what replaces the 32k-token catalog
// block the retired single-shot design pasted into every prompt, and it is the
// direct answer to that design's 21% false-refusal rate: a loop that can go look
// does not have to decide from one fixed view of the registry.
//
//   echo '{"query":"red zone targets","limit":10}' | \
//     NODE_ENV=sandbox node scripts/data-view-search-columns.mjs
//
// An empty `columns` list is a real answer, not an error: a term the corpus has
// never seen scores zero everywhere, and returning a confident wrong column for
// a question the catalog cannot answer is worse than returning nothing.

run_agent_tool({
  tool: 'search_columns',
  run: async (input) => {
    const { match_count, returned_count, columns } = search_columns({
      query: input.query,
      limit: input.limit,
      min_score_ratio: input.min_score_ratio,
      grain: input.grain
    })
    return {
      query: input.query || '',
      grain: input.grain || null,
      match_count,
      returned_count,
      columns
    }
  }
})
