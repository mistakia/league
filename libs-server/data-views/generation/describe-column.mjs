import { get_data_view_generation_catalog } from './build-data-view-generation-catalog.mjs'
import { AgentToolError } from './agent-tool-runner.mjs'

// The second half of PULLED vocabulary. search_columns finds WHICH column an
// instruction is about; this returns what that column can actually be asked.
//
// It is the tool the retired single-shot design most needed and could not have.
// That design measured param agreement at 0.009 against columns at 0.303 --
// the model picked roughly the right columns and then got their parameters
// almost entirely wrong, because a 32k-token pushed catalog cannot carry
// enumerated values for 597 columns and so carried them for none. A tool the
// agent calls per column can.
//
// Everything here is DERIVED from the registries. Nothing is authored, which is
// what keeps it from becoming the next hand-maintained catalog that drifts from
// the code it describes.

const MAX_SUGGESTIONS = 5

// How many enumerated values a param may list before it is summarized instead.
// `nfl_week_id` alone enumerated every week of every season -- 13,566 bytes on a
// single param -- and no caller needs the full list to learn the spelling.
const MAX_ENUMERATED_VALUES = 12

const compact = (object) =>
  Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  )

// Show the shape of a long enumeration rather than the whole of it: the head
// establishes the spelling, the tail establishes the range, and value_count says
// how much was withheld. A caller that genuinely needs every value asks for the
// param by name, which returns it unsummarized.
const summarize_param_definition = (definition) => {
  const values = definition.values
  if (!Array.isArray(values) || values.length <= MAX_ENUMERATED_VALUES) {
    return definition
  }

  return {
    ...definition,
    values: [...values.slice(0, 8), ...values.slice(-2)],
    value_count: values.length,
    values_truncated: true
  }
}

// Levenshtein-free near-miss: share of the shorter id's character bigrams that
// appear in the other. Enough to catch a plural, a transposition or a dropped
// word, and cheap over 597 short strings.
const bigrams = (value) => {
  const set = new Set()
  for (let i = 0; i < value.length - 1; i++) set.add(value.slice(i, i + 2))
  return set
}

const similarity = (left, right) => {
  const left_grams = bigrams(left)
  const right_grams = bigrams(right)
  if (!left_grams.size || !right_grams.size) return 0
  let shared = 0
  for (const gram of left_grams) if (right_grams.has(gram)) shared += 1
  return shared / Math.min(left_grams.size, right_grams.size)
}

/**
 * Describe one column's real parameter vocabulary.
 *
 * @param {object} params
 * @param {string} params.column_id
 * @param {string[]} [params.param_keys] - expand ONLY these params, and expand
 *   them in full rather than summarized. This is how the play-by-play filter
 *   tail is reached: it is returned as names by default and costs a second call
 *   to open, which is the right trade when almost no question needs it.
 * @param {object} [params.catalog] - injected for tests
 * @returns {object}
 */
export const describe_column = ({
  column_id,
  param_keys: requested_param_keys = null,
  catalog = get_data_view_generation_catalog()
}) => {
  const column = catalog.columns.find(
    (candidate) => candidate.column_id === column_id
  )

  if (!column) {
    // A refusal that also POINTS somewhere. An agent that guessed an id one
    // character off would otherwise learn only that the id is wrong, and its
    // cheapest next move is to guess again; naming the near misses turns a dead
    // end into the next call. Nothing is invented -- every suggestion is a real
    // id in the catalog.
    const suggestions = catalog.columns
      .map((candidate) => ({
        column_id: candidate.column_id,
        score: similarity(column_id, candidate.column_id)
      }))
      .filter((candidate) => candidate.score > 0.5)
      .sort((left, right) => right.score - left.score)
      .slice(0, MAX_SUGGESTIONS)
      .map((candidate) => candidate.column_id)

    throw new AgentToolError(
      'unknown_column_id',
      suggestions.length
        ? `no column ${column_id}; did you mean ${suggestions.join(', ')}?`
        : `no column ${column_id}, and nothing in the catalog is close to it -- use search_columns with a plain-language phrase instead of guessing an id`
    )
  }

  // param_keys names which SHARED params the column takes; the definitions live
  // once on the catalog rather than being copied per column. Resolving them here
  // is what makes one call sufficient -- an agent that had to fetch the shared
  // block separately would either skip it or spend a turn on it.
  //
  // Only the CONFIGURATION params are expanded by default. The play-by-play
  // filter tail is returned as bare key names and expanded only when asked for
  // by name, because expanding it unconditionally is what made this tool cost
  // ~16k tokens on the columns a leaderboard actually wants.
  const requested = Array.isArray(requested_param_keys)
    ? new Set(requested_param_keys)
    : null

  const expand = (param_key) => {
    const definition = catalog.params[param_key]
    if (!definition) return null
    return requested ? definition : summarize_param_definition(definition)
  }

  const params = {}
  for (const param_key of column.param_keys || []) {
    if (requested && !requested.has(param_key)) continue
    const definition = expand(param_key)
    if (definition) params[param_key] = definition
  }

  const play_filter_param_keys = column.play_filter_param_keys || []
  const play_filters = {}
  for (const param_key of play_filter_param_keys) {
    if (!requested || !requested.has(param_key)) continue
    const definition = expand(param_key)
    if (definition) play_filters[param_key] = definition
  }

  return compact({
    column_id: column.column_id,
    description: column.description || null,
    // Which entity one row is. The instruction always implies it and the caller
    // otherwise has to infer it from the id spelling.
    grain: column.grain || null,
    // How a numeric measure may aggregate to a row -- the one per-column
    // vocabulary the server holds in full.
    supports_output: column.supports_output || null,
    // Accepted by every column and declared by none, so they cannot be reached
    // through param_keys. Repeated on each description rather than left to a
    // separate lookup: two measured runs lost their entire budget to the belief
    // that a column not listing `year` does not take one.
    scope_params: catalog.scope_params,
    params,
    // Names only. Each is a play-by-play predicate this column may be narrowed
    // by; call describe_column again with param_keys: ["<name>"] to get one
    // expanded. Ordinary season or per-game questions need none of them.
    play_filter_param_keys: play_filter_param_keys.length
      ? play_filter_param_keys
      : undefined,
    // Stated rather than implied: a column with no params is a legitimate
    // answer, and an agent that reads an empty object as a failed lookup will
    // waste a turn re-asking.
    //
    // It describes the COLUMN, not this response. Computed from the filtered
    // `params` it went false whenever the caller opened play-filter keys by
    // name -- the exact second call the tool tells them to make -- answering
    // "this column takes no params" about a column with two hundred of them.
    has_params: Boolean(
      column.param_keys?.length || play_filter_param_keys.length
    ),
    play_filters: Object.keys(play_filters).length ? play_filters : undefined
  })
}

export default describe_column
