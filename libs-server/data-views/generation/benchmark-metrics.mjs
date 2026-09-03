// Pure measurement functions for the data-view generation benchmark.
//
// Split out of scripts/data-view-benchmark-run.mjs so they can be unit-tested
// WITHOUT a database. The runner needs `#db` and a live production connection;
// none of the functions here need either, and the workflow's whole discipline
// is to measure offline before spending a real run. A pure function that can
// only be exercised by dispatching an agent is not one you will actually test.
//
// Everything in this file takes a parsed claude session transcript and answers
// "what did this run cost, and where did it go".

// Text a provider emits when it is disabled, unauthenticated or throttled.
//
// THIS IS THE ORACLE THAT IS DISTINCT FROM EXIT CODE AND STATUS, and it exists
// because a dead provider does not look dead. A disabled model answered
// `API Error: 401 Model is disabled` as its assistant TEXT, and the run around
// it reported completed, a plausible turn count and no timeout -- so without
// this check a provider outage lands in the results as a model result and gets
// compared against a real one.
export const PROVIDER_ERROR_PATTERNS = [
  /Model is disabled/i,
  /Please run \/login/i,
  /API Error: 401/i,
  /API Error: 403/i,
  /Insufficient credit/i,
  /rate.?limit exceeded/i
]

// The model name the harness stamps on a message IT generated rather than
// received -- an API failure, an interrupt, a deadline.
//
// THE SECOND SHAPE A PROVIDER OUTAGE ARRIVES IN, and the patterns above do not
// catch it. Measured 2026-09-03, on the first run after the provider came back
// from a pause: the transcript held ONE turn, carrying zero output tokens and
// no error text to match, stamped `<synthetic>`; the run reported `expired` with
// `deadline_exceeded` after a full fifteen minutes. Nothing in the row said the
// model had never answered, so a cold backend was on course to be recorded as an
// agent that failed to finish -- the exact substitution the oracle exists to
// prevent, entering through a door it was not watching.
const SYNTHETIC_MODEL = '<synthetic>'

// Content blocks that make an assistant message a real turn. Some providers
// emit EMPTY assistant messages mid-turn; counting those inflates every run on
// that provider and leaves runs on others untouched, which is the worst shape a
// measurement error can have because it looks like a real difference between
// models.
const SUBSTANTIVE_BLOCK_TYPES = ['text', 'thinking', 'tool_use']

// Scratch files the agent itself created, as opposed to league source.
//
// THIS DISTINCTION DECIDES WHERE THE NEXT ITERATION LOOKS. A source dive means
// a tool did not answer a question about the DOMAIN, and the fix is in the
// tool. An agent re-reading, folding and byte-slicing its own emission JSON to
// get it past a shell quoting problem is not that -- it is an ergonomics
// problem in how the emission is handed over, and it lives in a different part
// of the system. Measured on a real run: six of ten calls first bucketed as
// source dives were this, so collapsing them would have pointed the next
// iteration at the retrieval tools when nothing was wrong with them.
const SCRATCH_PATH_PATTERN =
  /(^|[^a-z])(\/tmp\/|tmp-[a-z-]*\.json|emission\.json)/i

/**
 * Which bucket one tool call belongs to.
 *
 * The count alone says nothing; the composition says everything. A healthy run
 * is mostly provided-tool and build.
 *
 * - `provided-tool` — one of the data-view agent scripts.
 * - `build` — validate, preview or emit: the calls that converge on an answer.
 * - `contract-read` — reading generate-data-view.mjs. One is expected.
 * - `source-dive` — any other read of league source. Each is a defect signal:
 *   the agent went looking because a tool did not answer it, or contradicted
 *   something it had been told.
 * - `self-transcript` — any reach into the session's own transcript. Should be
 *   zero; it is denied by profile and by instruction, so a nonzero count here
 *   is a containment finding rather than a cost one.
 *
 * @param {object} block - a `tool_use` content block
 * @returns {string}
 */
export const classify_tool_call = (block) => {
  const name = block?.name || ''
  const input = block?.input || {}
  const serialized = JSON.stringify(input)

  if (/\.claude-local/.test(serialized)) return 'self-transcript'

  if (name === 'Bash') {
    const command = input.command || ''
    if (
      /scripts\/data-view-(emit|validate-table-state|preview-view)\.mjs/.test(
        command
      )
    ) {
      return 'build'
    }
    if (/scripts\/data-view-[a-z-]+\.mjs/.test(command)) return 'provided-tool'
    if (/generate-data-view\.mjs/.test(command)) return 'contract-read'
    if (SCRATCH_PATH_PATTERN.test(command)) return 'scratch-io'
    return 'source-dive'
  }

  if (/generate-data-view\.mjs/.test(serialized)) return 'contract-read'
  if (SCRATCH_PATH_PATTERN.test(serialized)) return 'scratch-io'
  if (['Read', 'Grep', 'Glob', 'Search'].includes(name)) return 'source-dive'
  if (['Write', 'Edit', 'NotebookEdit'].includes(name)) return 'file-write'
  return 'other'
}

// What the identity of a row is CALLED in a result set, per row grain.
//
// Measured against real result rows rather than guessed, because the first
// version of this list was guessed and every team assertion failed with "no
// team in row" -- the key is `team_code`, which was not among the five plausible
// names. A grain whose identity cannot be found reports as a wrong answer,
// which is the same shape as a real failure and would have been read as one.
export const IDENTITY_KEY_CANDIDATES = {
  pid: ['pid', 'player_id'],
  team: ['team_code', 'team', 'nfl_team', 'team_abbreviation']
}

/**
 * Pull the identity out of one result row.
 *
 * Tolerates the positional `_0` suffix the result serializer appends, so a
 * candidate matches whether it arrives as `team_code` or `team_code_0`.
 *
 * @param {object} row
 * @param {string} identity_key
 * @returns {string|null}
 */
export const row_identity = (row, identity_key) => {
  const candidates = IDENTITY_KEY_CANDIDATES[identity_key] || [identity_key]
  for (const candidate of candidates) {
    for (const key of [candidate, `${candidate}_0`]) {
      if (row[key] !== undefined && row[key] !== null) return String(row[key])
    }
  }
  return null
}

/**
 * Everything the transcript knows about one run.
 *
 * TURNS ARE COUNTED BY DISTINCT `message.id`, never by assistant records. The
 * transcript writes roughly 2.7 records per API call, so counting records
 * inflated one measured run to 80 turns against a true 26 and 40,294 output
 * tokens against a true 12,553 -- while the authoritative `cost-state` line
 * disagreed with it the whole time. One distinct id is one API call.
 *
 * @param {object[]} records - parsed JSONL records from a claude session
 * @returns {object}
 */
export const derive_transcript_metrics = (records) => {
  const assistant_records = records.filter(
    (record) => record.type === 'assistant'
  )

  const by_message_id = new Map()
  for (const record of assistant_records) {
    const message = record.message
    if (!message?.id) continue
    if (!by_message_id.has(message.id)) {
      by_message_id.set(message.id, {
        usage: message.usage || {},
        model: message.model || null,
        blocks: [],
        text: ''
      })
    }
    const entry = by_message_id.get(message.id)
    for (const block of message.content || []) {
      entry.blocks.push(block)
      if (block.type === 'text') entry.text += `\n${block.text || ''}`
    }
  }

  const substantive = [...by_message_id.values()].filter((entry) =>
    entry.blocks.some((block) => SUBSTANTIVE_BLOCK_TYPES.includes(block.type))
  )

  let output_tokens = 0
  let input_tokens = 0
  let cache_read_tokens = 0
  let cache_creation_tokens = 0
  let tool_call_count = 0
  let assistant_text = ''
  const buckets = {}
  const tool_names = {}

  for (const entry of substantive) {
    output_tokens += entry.usage.output_tokens || 0
    input_tokens += entry.usage.input_tokens || 0
    cache_read_tokens += entry.usage.cache_read_input_tokens || 0
    cache_creation_tokens += entry.usage.cache_creation_input_tokens || 0
    assistant_text += entry.text
    for (const block of entry.blocks) {
      if (block.type !== 'tool_use') continue
      tool_call_count += 1
      const bucket = classify_tool_call(block)
      buckets[bucket] = (buckets[bucket] || 0) + 1
      tool_names[block.name] = (tool_names[block.name] || 0) + 1
    }
  }

  // Authoritative where per-message accounting is not, and written at session
  // END -- so its absence means the session is still open, not that the run was
  // free. A caller must not read a missing cost-state as a zero.
  const cost_state =
    records.find((record) => record.type === 'cost-state') || null
  const model_usage = cost_state?.modelUsage || {}
  const cost_state_output = Object.values(model_usage).reduce(
    (sum, usage) => sum + (usage.outputTokens || 0),
    0
  )

  const matched_pattern = PROVIDER_ERROR_PATTERNS.find((pattern) =>
    pattern.test(assistant_text)
  )

  // Real models the provider actually answered with, synthetic excluded.
  const models = [
    ...new Set(
      substantive
        .map((entry) => entry.model)
        .filter((model) => model && model !== SYNTHETIC_MODEL)
    )
  ]

  // A run that produced turns but never heard from a real model did not measure
  // the agent. Gated on there being turns at all, so an empty transcript still
  // reports as empty rather than as an outage.
  const never_reached_provider = substantive.length > 0 && models.length === 0

  const provider_error = matched_pattern
    ? String(matched_pattern)
    : never_reached_provider
      ? `no response from any real model: every one of the ${substantive.length} turn(s) is ${SYNTHETIC_MODEL}`
      : null

  return {
    turns: substantive.length,
    // Kept alongside the real figure so a reader can see the inflation factor
    // rather than having to know about it.
    assistant_records: assistant_records.length,
    output_tokens,
    input_tokens,
    cache_read_tokens,
    cache_creation_tokens,
    tool_call_count,
    buckets,
    tool_names,
    models,
    cost_state_present: Boolean(cost_state),
    cost_state_output_tokens: cost_state ? cost_state_output : null,
    // A gap is not automatically wrong -- title generation is a real API call
    // that never lands as an assistant record -- but a LARGE gap means an
    // unaccounted code path, so it is surfaced rather than reconciled silently.
    output_token_gap: cost_state ? cost_state_output - output_tokens : null,
    total_api_duration_ms: cost_state?.totalAPIDuration ?? null,
    total_tool_duration_ms: cost_state?.totalToolDuration ?? null,
    total_duration_ms: cost_state?.totalDuration ?? null,
    provider_error: provider_error ? String(provider_error) : null
  }
}

/**
 * Parse a session JSONL body into records, skipping unparseable lines.
 *
 * A truncated final line is normal for a session still being written, and
 * dropping it is right; dropping the whole transcript over it is not.
 *
 * @param {string} body
 * @returns {object[]}
 */
export const parse_transcript = (body) =>
  body
    .trim()
    .split('\n')
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .filter(Boolean)

export default {
  classify_tool_call,
  row_identity,
  derive_transcript_metrics,
  parse_transcript,
  PROVIDER_ERROR_PATTERNS
}
