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
 * @param {object} [params.catalog] - injected for tests
 * @returns {object}
 */
export const describe_column = ({
  column_id,
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
  const params = {}
  for (const param_key of column.param_keys || []) {
    const definition = catalog.params[param_key]
    if (definition) params[param_key] = definition
  }

  return {
    column_id: column.column_id,
    description: column.description || null,
    // How a numeric measure may aggregate to a row -- the one per-column
    // vocabulary the server holds in full.
    supports_output: column.supports_output || null,
    params,
    // Stated rather than implied: a column with no params is a legitimate
    // answer, and an agent that reads an empty object as a failed lookup will
    // waste a turn re-asking.
    has_params: Object.keys(params).length > 0
  }
}

export default describe_column
