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

// Light suffix folding, so a query term and an id term that differ only by
// inflection can meet. "passing yards" has to reach
// `player_pass_yards_from_plays`, whose id says `pass`: unfolded, the query term
// matches only the prose description, and first place goes to
// `player_dropped_passing_yards_from_plays` for spelling the inflection out.
//
// Deliberately not a full Porter stemmer. The corpus is 597 short ids and 523
// short descriptions in one narrow domain, where these three inflections carry
// the entire benefit and every extra rule is a fresh way to collide two measures
// that are genuinely different.
const stem = (token) => {
  if (token.length > 4 && token.endsWith('ing')) return token.slice(0, -3)
  if (token.length > 4 && token.endsWith('ed')) return token.slice(0, -2)
  if (token.length > 3 && token.endsWith('es')) return token.slice(0, -2)
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) {
    return token.slice(0, -1)
  }
  return token
}

const tokenize = (text) =>
  String(text || '')
    .toLowerCase()
    // snake_case and camelCase ids both have to break into words, or a
    // description term will never meet a column id term.
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 1)
    .map(stem)

// A term matching almost every column carries no signal about which column is
// meant. `player` is in a third of the corpus; weighting by inverse document
// frequency is what stops it from outranking `interception`.
const build_index = ({ catalog }) => {
  const documents = catalog.columns.map((column) => {
    // The id is indexed separately as well as jointly. Descriptions drive
    // RECALL -- they carry the phrasings a person actually uses -- but they vary
    // in length for reasons unrelated to relevance, so they are a bad basis for
    // ranking. The id is the opposite: terse, uniform, and authored so that the
    // canonical member of a family carries no qualifier. Ranking on the id is
    // what separates `player_receiving_yards_from_plays` from its five modified
    // siblings once every one of them has matched every query term.
    const id_terms = new Set(tokenize(column.column_id))
    const terms = new Set([...id_terms, ...tokenize(column.description)])
    return { column, terms, id_terms }
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
 * @param {'player'|'team'} [params.grain] - restrict to columns whose row is a
 *   player or a team. The four declared grains collapse to these two by prefix.
 * @param {object} [params.catalog] - injected for tests
 * @returns {{ match_count: number, returned_count: number, columns: Array<{
 *   column_id: string, description?: string, grain?: string,
 *   param_keys?: string[], score: number, id_match: number }> }}
 */
export const search_columns = ({
  query,
  limit = 10,
  min_score_ratio = 0.25,
  grain = null,
  catalog = get_data_view_generation_catalog()
} = {}) => {
  const query_terms = [...new Set(tokenize(query))]
  if (!query_terms.length) {
    return { match_count: 0, returned_count: 0, columns: [] }
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
    return { match_count: 0, returned_count: 0, columns: [] }
  }

  const results = []

  for (const { column, terms, id_terms } of documents) {
    if (grain && !String(column.grain || '').startsWith(grain)) {
      continue
    }

    let score = 0
    for (const term of query_terms) {
      if (terms.has(term)) {
        score += inverse_document_frequency.get(term) || 0
      }
    }

    if (score / attainable_score < min_score_ratio) {
      continue
    }

    // Coverage answers "did this column match the query", and it SATURATES: any
    // column matching every query term scores exactly 1. Real queries are one to
    // three content words, so saturation is the common case rather than the edge
    // one, and ordering by coverage alone left `column_id` alphabetical as the
    // real sort key -- which is why a search for "receiving yards" returned ten
    // `nfl_team_seasonlogs_*` columns and buried the player column entirely.
    //
    // `id_match` is the discriminator: the idf-weighted harmonic mean of how much
    // of the QUERY the id covers and how much of the ID the query explains. A
    // column whose id is the query plus only cheap structural terms (`player`,
    // `from`, `plays`) scores near 1; one that adds a rare qualifier the caller
    // never asked for (`dropped`, `expected`) is penalised in proportion to how
    // surprising that qualifier is. Nothing is hand-weighted -- the same idf
    // table that scores the match scores the penalty.
    let id_matched = 0
    for (const term of query_terms) {
      if (id_terms.has(term)) {
        id_matched += inverse_document_frequency.get(term) || 0
      }
    }

    let id_mass = 0
    for (const term of id_terms) {
      id_mass += inverse_document_frequency.get(term) || 0
    }

    const id_recall = id_matched / attainable_score
    const id_precision = id_mass ? id_matched / id_mass : 0
    const id_match =
      id_recall + id_precision
        ? (2 * id_recall * id_precision) / (id_recall + id_precision)
        : 0

    results.push({
      column_id: column.column_id,
      description: column.description,
      grain: column.grain,
      param_keys: column.param_keys,
      score: Number((score / attainable_score).toFixed(4)),
      id_match: Number(id_match.toFixed(4))
    })
  }

  // Lexicographic rather than blended, so `score` keeps the exact meaning every
  // existing caller and test already relies on and `id_match` only ever breaks a
  // tie it would otherwise lose to alphabetical order. column_id stays last so
  // the ordering is total and a test can assert it.
  results.sort(
    (left, right) =>
      right.score - left.score ||
      right.id_match - left.id_match ||
      left.column_id.localeCompare(right.column_id)
  )

  const columns = results.slice(0, limit)

  // match_count is the size of the WHOLE match set, not of the returned page.
  // It reported the page before, so a truncated result was indistinguishable
  // from an exhaustive one and the caller had no signal that narrowing the query
  // would help.
  return {
    match_count: results.length,
    returned_count: columns.length,
    columns
  }
}

export default search_columns
