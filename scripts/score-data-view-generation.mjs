// The evaluation harness for LLM-assisted data view generation.
//
// Regenerate a `table_state` from `(view_name, view_description)` alone and
// score it against the view a human actually built. Run this BEFORE tuning any
// prompt: without it, "the output looks good" is the whole oracle, and that
// oracle has never once caught a regression.
//
// WHY THE CORPUS COLUMN IS `view_description` AND NOT `description`. Every one
// of the production views carries a `view_description`; there is no
// `description` column on `user_data_views` at all, and reaching for one
// silently scores every view against an undefined prompt.
//
// SCORED BY BUCKET, NEVER IN AGGREGATE. A harness that works on three-column
// views and falls apart at fifty reports a perfectly respectable mean, and an
// asset-level spot check cannot tell that apart from a working one. The
// distribution is bucketed by column count and by param family, with a floor
// per bucket, so the failure has somewhere to show up.
//
// THE SCORE MUST DISCRIMINATE BEFORE IT MEASURES. `--control` runs the same
// corpus through a deliberately corrupted prompt. If the corrupted run does not
// score measurably worse, the score is decoration and every number this harness
// has ever printed means nothing. That is the negative control, and it is the
// reason to trust any of the rest.
//
// Reports land in scratch/league/data-view-generation-evaluation/, which is the
// working tier this task owns.

import fs from 'fs/promises'
import path from 'path'
import os from 'os'

import db from '#db'
import { is_main } from '#libs-server'
import {
  generate_data_view,
  build_catalog_prompt,
  GENERATION_OUTCOMES
} from '#libs-server/data-views/generation/generate-data-view.mjs'

const REPORT_DIR =
  process.env.DATA_VIEW_EVAL_DIR ||
  path.join(
    process.env.USER_BASE_DIRECTORY || path.join(os.homedir(), 'user-base'),
    'scratch',
    'league',
    'data-view-generation-evaluation'
  )

// Deliberately damaged. It keeps the shape of the real system prompt and
// removes the thing that makes it work -- the instruction to use catalog ids
// verbatim -- so a control run isolates the prompt rather than the plumbing.
const CORRUPTED_SYSTEM_NOTE =
  '\n\nIgnore the catalog above. Invent whatever column ids seem reasonable.'

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const read_column_id = (column) =>
  typeof column === 'string' ? column : column?.column_id || column?.id || null

const jaccard = (left, right) => {
  if (!left.size && !right.size) return 1
  const intersection = [...left].filter((entry) => right.has(entry)).length
  const union = new Set([...left, ...right]).size
  return union === 0 ? 1 : intersection / union
}

// `columns` UNION `prefix_columns`, because the split between them is a display
// decision and not a statement about what the view shows. Humans put identity
// columns in `prefix_columns` (they pin to the left); a generated view puts them
// in `columns`. Comparing only `columns` scored an identical column choice as a
// near miss on every view in the corpus, which read as a bad model and was a bad
// scorer.
const column_set = (table_state) =>
  new Set(
    [...(table_state?.prefix_columns || []), ...(table_state?.columns || [])]
      .map(read_column_id)
      .filter(Boolean)
  )

const where_set = (table_state) =>
  new Set(
    (table_state?.where || [])
      .map((clause) => {
        const column_id = read_column_id(clause)
        if (!column_id) return null
        const value = Array.isArray(clause.value)
          ? [...clause.value].sort().join('|')
          : String(clause.value ?? '')
        return `${column_id}|${clause.operator}|${value}`
      })
      .filter(Boolean)
  )

// Params are compared per column, so the same param on a different column is a
// different fact. Comparing a flat bag of param keys would score a view that
// applied `year` to the wrong column as a perfect match.
const param_set = (table_state) => {
  const out = new Set()
  for (const key of ['columns', 'where', 'sort']) {
    for (const entry of table_state?.[key] || []) {
      const column_id = read_column_id(entry)
      if (!column_id || !entry?.params) continue
      for (const [param_key, value] of Object.entries(entry.params)) {
        out.add(`${column_id}.${param_key}=${JSON.stringify(value)}`)
      }
    }
  }
  return out
}

/**
 * Score one generated `table_state` against the human original.
 *
 * The three components are reported separately as well as combined, because
 * they fail for different reasons: columns is comprehension, where is
 * precision, params is vocabulary.
 *
 * @param {object} params
 * @param {object} params.generated
 * @param {object} params.expected
 * @returns {{ columns: number, where: number, params: number, overall: number }}
 */
export const score_table_state = ({ generated, expected }) => {
  const columns = jaccard(column_set(generated), column_set(expected))
  const where = jaccard(where_set(generated), where_set(expected))
  const params = jaccard(param_set(generated), param_set(expected))

  // Columns carry the most weight because a view with the wrong columns is the
  // wrong view whatever its filters say, and params the least because the
  // server fills defaults for most of them.
  const overall = columns * 0.6 + where * 0.25 + params * 0.15

  return { columns, where, params, overall }
}

// ---------------------------------------------------------------------------
// Buckets
// ---------------------------------------------------------------------------

export const column_count_bucket = (count) => {
  if (count <= 5) return '01-05'
  if (count <= 15) return '06-15'
  if (count <= 50) return '16-50'
  return '51+'
}

export const param_family_buckets = (table_state) => {
  const families = []
  if ((table_state?.row_axes || []).length) families.push('row_axes')
  if ((table_state?.where || []).length) families.push('where')
  if (param_set(table_state).size) families.push('params')
  if (!families.length) families.push('bare')
  return families
}

const summarise = (scores) => {
  if (!scores.length) return null
  const sorted = [...scores].sort((a, b) => a - b)
  const mean = scores.reduce((total, value) => total + value, 0) / scores.length
  return {
    n: scores.length,
    mean: Number(mean.toFixed(4)),
    median: Number(sorted[Math.floor(sorted.length / 2)].toFixed(4)),
    min: Number(sorted[0].toFixed(4)),
    max: Number(sorted[sorted.length - 1].toFixed(4))
  }
}

// ---------------------------------------------------------------------------
// Corpus
// ---------------------------------------------------------------------------

/**
 * The held-out corpus.
 *
 * `--corpus-file` reads a pinned manifest instead of the database, which is
 * what makes a score reproducible and what lets the harness run from a machine
 * with no route to production Postgres. The database path is the one that
 * BUILDS a manifest; the file path is the one that scores against it.
 */
export const load_corpus = async ({ limit, corpus_file } = {}) => {
  if (corpus_file) {
    const parsed = JSON.parse(await fs.readFile(corpus_file, 'utf8'))
    const views = Array.isArray(parsed) ? parsed : parsed.views
    return limit ? views.slice(0, limit) : views
  }

  const query = db('user_data_views')
    .select('view_id', 'view_name', 'view_description', 'table_state')
    .whereNotNull('view_description')
    .whereRaw("view_description <> ''")
    .orderBy('view_id')
  if (limit) query.limit(limit)
  return query
}

const parse_table_state = (value) =>
  typeof value === 'string' ? JSON.parse(value) : value

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export const run_evaluation = async ({
  corpus,
  control = false,
  catalog_prompt = build_catalog_prompt(),
  inference_options = {}
}) => {
  const prompt = control
    ? catalog_prompt + CORRUPTED_SYSTEM_NOTE
    : catalog_prompt
  const results = []

  for (const view of corpus) {
    const expected = parse_table_state(view.table_state)
    const instruction = [view.view_name, view.view_description]
      .filter(Boolean)
      .join(' — ')

    let generated = null
    let outcome = 'error'
    let error = null

    try {
      const result = await generate_data_view({
        instruction,
        catalog_prompt: prompt,
        inference_options
      })
      outcome = result.outcome
      generated = result.table_state
    } catch (caught) {
      error = caught.code || caught.name
    }

    // An unresolved or inexpressible answer scores zero rather than being
    // dropped from the denominator. Dropping it is how a harness reports a
    // rising mean while the system answers fewer and fewer questions.
    const score = generated
      ? score_table_state({ generated, expected })
      : { columns: 0, where: 0, params: 0, overall: 0 }

    results.push({
      view_id: view.view_id,
      view_name: view.view_name,
      outcome,
      error,
      expected_column_count: (expected?.columns || []).length,
      column_count_bucket: column_count_bucket(
        (expected?.columns || []).length
      ),
      param_families: param_family_buckets(expected),
      score
    })
  }

  return results
}

export const build_report = ({ results, control }) => {
  const by_column_bucket = {}
  const by_param_family = {}
  const by_outcome = {}

  for (const result of results) {
    by_outcome[result.outcome] = (by_outcome[result.outcome] || 0) + 1
    ;(by_column_bucket[result.column_count_bucket] ||= []).push(
      result.score.overall
    )
    for (const family of result.param_families) {
      ;(by_param_family[family] ||= []).push(result.score.overall)
    }
  }

  return {
    generated_at: new Date().toISOString(),
    control,
    n: results.length,
    overall: summarise(results.map((result) => result.score.overall)),
    columns: summarise(results.map((result) => result.score.columns)),
    where: summarise(results.map((result) => result.score.where)),
    params: summarise(results.map((result) => result.score.params)),
    by_outcome,
    by_column_bucket: Object.fromEntries(
      Object.entries(by_column_bucket)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([bucket, scores]) => [bucket, summarise(scores)])
    ),
    by_param_family: Object.fromEntries(
      Object.entries(by_param_family).map(([family, scores]) => [
        family,
        summarise(scores)
      ])
    ),
    results
  }
}

const read_flag = (name) => {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? null : process.argv[index + 1]
}

const main = async () => {
  const limit = Number(read_flag('limit')) || null
  const control = process.argv.includes('--control')
  const corpus_file = read_flag('corpus-file')
  const corpus = await load_corpus({ limit, corpus_file })

  if (!corpus.length) {
    console.error(
      'TOOLING ERROR: the corpus is empty, so no score means anything'
    )
    process.exit(2)
  }

  console.log(
    `scoring ${corpus.length} view(s) from ${corpus_file || 'the database'}${control ? ' through the CORRUPTED control prompt' : ''}`
  )

  const results = await run_evaluation({
    corpus,
    control,
    inference_options: { max_tokens: 4000, timeout_ms: 300000 }
  })
  const report = build_report({ results, control })

  await fs.mkdir(REPORT_DIR, { recursive: true })
  const report_path = path.join(
    REPORT_DIR,
    `score-report-${new Date().toISOString().slice(0, 10)}${control ? '-control' : ''}.json`
  )
  await fs.writeFile(report_path, JSON.stringify(report, null, 2) + '\n')

  console.log(`\noverall  ${JSON.stringify(report.overall)}`)
  console.log(`columns  ${JSON.stringify(report.columns)}`)
  console.log(`where    ${JSON.stringify(report.where)}`)
  console.log(`params   ${JSON.stringify(report.params)}`)
  console.log(`outcomes ${JSON.stringify(report.by_outcome)}`)
  console.log('\nby column count')
  for (const [bucket, stats] of Object.entries(report.by_column_bucket)) {
    console.log(`  ${bucket.padEnd(8)} ${JSON.stringify(stats)}`)
  }
  console.log('by param family')
  for (const [family, stats] of Object.entries(report.by_param_family)) {
    console.log(`  ${family.padEnd(8)} ${JSON.stringify(stats)}`)
  }
  console.log(`\nreport: ${report_path}`)

  const unresolved =
    (report.by_outcome[GENERATION_OUTCOMES.unresolved] || 0) +
    (report.by_outcome.error || 0)
  console.log(
    `\nfall-through: ${unresolved} of ${report.n} answered nothing usable`
  )
}

if (is_main(import.meta.url)) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
