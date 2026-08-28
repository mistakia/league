import { get_data_view_generation_catalog } from './build-data-view-generation-catalog.mjs'

// Retrieval over the generation catalog, so a caller PULLS the columns an
// instruction is about instead of being PUSHED all 597.
//
// The corpus is the 523 hand-written prose descriptions in
// `libs-shared/data-view-fields-index.mjs`. Those are the highest-value
// prompting asset in the repo: a user names a measure by meaning ("red zone
// targets", "how often he beat the number"), and description text is the only
// thing in either registry that connects that phrasing to an id. Ids alone are
// not findable -- `player_weighted_opportunity_rating_from_plays` shares no word
// with any way a person would ask for it.
//
// Scoring is lexical IDF overlap rather than embeddings, on purpose: it needs no
// model call, no network, no index to rebuild, and it is deterministic, so a
// test can assert an exact ranking. The corpus is 597 short documents, which is
// far too small for the recall gap against a vector index to matter.
//
// A term the corpus has never seen contributes nothing, so a nonsense query
// scores zero everywhere and returns an empty list. That property is the point:
// returning a confident wrong column for a question the catalog cannot answer is
// worse than returning nothing, because the caller cannot tell the difference.

const tokenize = (text) =>
  String(text || '')
    .toLowerCase()
    // snake_case and camelCase ids both have to break into words, or a
    // description term will never meet a column id term.
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 1)

// A term matching almost every column carries no signal about which column is
// meant. `player` is in a third of the corpus; weighting by inverse document
// frequency is what stops it from outranking `interception`.
const build_index = ({ catalog }) => {
  const documents = catalog.columns.map((column) => {
    const terms = new Set([
      ...tokenize(column.column_id),
      ...tokenize(column.description)
    ])
    return { column, terms }
  })

  const document_frequency = new Map()
  for (const document of documents) {
    for (const term of document.terms) {
      document_frequency.set(term, (document_frequency.get(term) || 0) + 1)
    }
  }

  const inverse_document_frequency = new Map()
  for (const [term, frequency] of document_frequency) {
    inverse_document_frequency.set(
      term,
      Math.log(1 + documents.length / frequency)
    )
  }

  return { documents, inverse_document_frequency }
}

let cached_index = null

const get_index = ({ catalog }) => {
  if (!cached_index || cached_index.catalog !== catalog) {
    cached_index = { catalog, ...build_index({ catalog }) }
  }
  return cached_index
}

/**
 * Find the columns an instruction phrase is about.
 *
 * @param {object} params
 * @param {string} params.query - a plain-language phrase, not an id
 * @param {number} [params.limit] - how many columns to return
 * @param {number} [params.min_score_ratio] - floor, as a share of the score a
 *   column matching every query term would earn. Guards against a weak match
 *   being presented with the same confidence as a strong one.
 * @param {object} [params.catalog] - injected for tests
 * @returns {Array<{ column_id: string, description?: string, param_keys?: string[], score: number }>}
 */
export const search_columns = ({
  query,
  limit = 10,
  min_score_ratio = 0.25,
  catalog = get_data_view_generation_catalog()
} = {}) => {
  const query_terms = [...new Set(tokenize(query))]
  if (!query_terms.length) {
    return []
  }

  const { documents, inverse_document_frequency } = get_index({ catalog })

  // The mass a column would earn by matching every term the corpus recognises.
  // Terms the corpus has never seen are worth nothing to any column, so they are
  // left out of the denominator rather than making every result look weak.
  const attainable_score = query_terms.reduce(
    (total, term) => total + (inverse_document_frequency.get(term) || 0),
    0
  )

  if (!attainable_score) {
    return []
  }

  const results = []

  for (const { column, terms } of documents) {
    let score = 0
    for (const term of query_terms) {
      if (terms.has(term)) {
        score += inverse_document_frequency.get(term) || 0
      }
    }

    if (score / attainable_score < min_score_ratio) {
      continue
    }

    results.push({
      column_id: column.column_id,
      description: column.description,
      param_keys: column.param_keys,
      score: Number((score / attainable_score).toFixed(4))
    })
  }

  // Ties break on column_id so the ordering is total and a test can assert it.
  results.sort(
    (left, right) =>
      right.score - left.score || left.column_id.localeCompare(right.column_id)
  )

  return results.slice(0, limit)
}

export default search_columns
