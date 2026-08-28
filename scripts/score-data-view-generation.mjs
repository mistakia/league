// The evaluation harness for LLM-assisted data view generation.
//
// Score a `table_state` generated from `(view_name, view_description)` alone
// against the view a human actually built. Run this BEFORE tuning anything:
// without it, "the output looks good" is the whole oracle, and that oracle has
// never once caught a regression.
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
// THE SCORE MUST DISCRIMINATE BEFORE IT MEASURES, and the control that proves
// it is a MISPAIRING, not a damaged prompt. Every generated view is scored a
// second time against a DIFFERENT human view. If a generated view scores no
// better against the request it answered than against an unrelated one, the
// score is decoration and every number this harness prints means nothing.
//
// The earlier control corrupted the prompt instead, and was vacuous: it
// appended "ignore the catalog, invent ids" to the user-side catalog block
// while the system prompt still said to use catalog ids verbatim. The model
// obeyed the system prompt, so the control run and the real run were the same
// prompt and their gap was sampling noise. A mispairing cannot be talked out of
// by any prompt, costs no second inference run, and tests the SCORE rather than
// the prompt -- which is what a negative control on a metric is for.
//
// THIS HARNESS SCORES; IT DOES NOT GENERATE. League used to be the model client
// and this driver called `generate_data_view` directly. Generation is now an
// agentic container session, so the generator lives outside this repo and the
// driver's input is a file of `table_state`s it produced. Splitting the driver
// this way rather than stubbing the call is what keeps the scorer honest: there
// is no half-wired generation path left to look like it works.
//
// Reports land in scratch/league/data-view-generation-evaluation/, which is the
// working tier this task owns.

import fs from 'fs/promises'
import path from 'path'
import os from 'os'

import { is_main } from '#libs-server'

const REPORT_DIR =
  process.env.DATA_VIEW_EVAL_DIR ||
  path.join(
    process.env.USER_BASE_DIRECTORY || path.join(os.homedir(), 'user-base'),
    'scratch',
    'league',
    'data-view-generation-evaluation'
  )

// The real run must beat the mispaired run by at least this much, or the score
// has not been shown to measure anything.
const MINIMUM_CONTROL_MARGIN = 0.05

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
 * The eval half of the pinned corpus.
 *
 * The corpus is a manifest file and nothing else, which is what makes a score
 * reproducible and what lets the harness run from a machine with no route to
 * production Postgres. The manifest carries every described production view
 * with a `split`; the `train` views are the few-shot source and are never
 * scored, because scoring a view the prompt was built from measures recall.
 * The ABOUT beside the manifest carries the query and the split rule that
 * rebuild it.
 */
export const load_corpus = async ({ limit, corpus_file }) => {
  const parsed = JSON.parse(await fs.readFile(corpus_file, 'utf8'))
  const views = (Array.isArray(parsed) ? parsed : parsed.views).filter(
    (view) => view.split !== 'train'
  )
  return limit ? views.slice(0, limit) : views
}

const parse_table_state = (value) =>
  typeof value === 'string' ? JSON.parse(value) : value

/**
 * The generation half of a run, keyed by `view_id`.
 *
 * Each record is `{ view_id, table_state, outcome, inexpressible_reason }`.
 * `table_state` is null when the generator answered nothing usable, and
 * `outcome` is whatever label the generator recorded -- this harness reports
 * the distribution and never interprets it, so the generator can change its
 * vocabulary without changing the score.
 */
export const load_generations = async ({ generated_file }) => {
  const parsed = JSON.parse(await fs.readFile(generated_file, 'utf8'))
  const records = Array.isArray(parsed) ? parsed : parsed.generations

  if (!Array.isArray(records)) {
    throw new Error(
      `TOOLING ERROR: ${generated_file} carries neither an array nor a \`generations\` array`
    )
  }

  return new Map(records.map((record) => [record.view_id, record]))
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

/**
 * Score one set of generations against the corpus they answered.
 *
 * A corpus view with no generation is NOT dropped -- it scores zero and says
 * `missing`. Dropping it is how a harness reports a rising mean while the
 * system answers fewer and fewer questions, and a generator that silently
 * skipped half the corpus would otherwise look like an improvement.
 */
export const run_evaluation = ({ corpus, generations }) => {
  const results = []

  for (const view of corpus) {
    const expected = parse_table_state(view.table_state)
    const generation = generations.get(view.view_id)
    const generated = generation?.table_state
      ? parse_table_state(generation.table_state)
      : null

    const score = generated
      ? score_table_state({ generated, expected })
      : { columns: 0, where: 0, params: 0, overall: 0 }

    results.push({
      view_id: view.view_id,
      view_name: view.view_name,
      outcome: generation ? generation.outcome || 'unlabelled' : 'missing',
      // Every view in this corpus is provably buildable -- a human built it and
      // the original is right there -- so a refusal here is always wrong, and
      // the generator's own reason is the only account of why. Over a full-corpus
      // run of the retired single-shot system it came back on 35 of 165, which
      // is not a footnote.
      inexpressible_reason: generation?.inexpressible_reason || null,
      // Both states are kept because a component score of zero is otherwise
      // undiagnosable: it reads identically whether the model emitted nothing,
      // emitted a different shape, or emitted the right answer spelled another
      // way. The `where` and `params` components sat at exactly zero across
      // every view of a whole run and no report said which.
      generated,
      expected,
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

/**
 * The negative control: score every generated view against the NEXT view's
 * human original instead of its own.
 *
 * Each generated view answered one specific request, so pairing it with a
 * different request's answer is wrong by construction. The rotation is
 * deterministic and reuses the run's existing generations, so the control costs
 * no inference. A view whose generation failed contributes zero to both sides
 * and cannot manufacture a margin.
 */
export const score_mispaired = ({ results }) =>
  results.map((result, index) => {
    const other = results[(index + 1) % results.length]
    return result.generated && other.expected
      ? score_table_state({
          generated: result.generated,
          expected: other.expected
        })
      : { columns: 0, where: 0, params: 0, overall: 0 }
  })

export const build_report = ({ results }) => {
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

  const mispaired = summarise(
    score_mispaired({ results }).map((score) => score.overall)
  )
  const paired = summarise(results.map((result) => result.score.overall))
  const margin = Number((paired.mean - mispaired.mean).toFixed(4))

  return {
    generated_at: new Date().toISOString(),
    n: results.length,
    control: {
      mispaired,
      margin,
      minimum_margin: MINIMUM_CONTROL_MARGIN,
      discriminates: margin >= MINIMUM_CONTROL_MARGIN
    },
    overall: paired,
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
  const corpus_file = read_flag('corpus-file')
  const generated_file = read_flag('generated-file')

  if (!corpus_file || !generated_file) {
    console.error(
      'TOOLING ERROR: --corpus-file <manifest> and --generated-file <generations> are both required'
    )
    process.exit(2)
  }

  const corpus = await load_corpus({ limit, corpus_file })

  if (!corpus.length) {
    console.error(
      'TOOLING ERROR: the corpus is empty, so no score means anything'
    )
    process.exit(2)
  }

  const generations = await load_generations({ generated_file })

  // A generations file that matches NO corpus view scores a flat zero, which is
  // indistinguishable from a generator that answered nothing. The likeliest
  // cause is the two files being built from different corpus snapshots, so this
  // is a tooling error rather than a result.
  const matched = corpus.filter((view) => generations.has(view.view_id)).length
  if (!matched) {
    console.error(
      `TOOLING ERROR: none of the ${corpus.length} corpus view ids appear in ${generated_file}`
    )
    process.exit(2)
  }

  console.log(
    `scoring ${corpus.length} view(s) from ${corpus_file}, ${matched} generated`
  )

  const results = run_evaluation({ corpus, generations })
  const report = build_report({ results })

  await fs.mkdir(REPORT_DIR, { recursive: true })
  const report_path = path.join(
    REPORT_DIR,
    `score-report-${new Date().toISOString().slice(0, 10)}.json`
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

  // Counted off the absence of a `table_state` rather than off any outcome
  // label, so a generator that invents a new label cannot hide a fall-through
  // from this line.
  const unusable = results.filter((result) => !result.generated).length
  console.log(
    `\nfall-through: ${unusable} of ${report.n} answered nothing usable`
  )

  // Printed last and read first. Above this line every number is conditional on
  // the score meaning something, and this is the line that says whether it does.
  const { control } = report
  console.log(
    `\nnegative control: paired ${report.overall.mean} vs mispaired ${control.mispaired.mean}, margin ${control.margin} (need ${control.minimum_margin})`
  )
  console.log(
    control.discriminates
      ? 'the score DISCRIMINATES -- the numbers above mean something'
      : 'the score DOES NOT DISCRIMINATE -- every number above is decoration, and tuning against them is tuning against noise'
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
