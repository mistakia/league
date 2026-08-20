// Reduces a period CTE to SUBJECT grain, so the per-period family joins the
// outer query 1:1.
//
// A period CTE is at (subject, period_key, year) grain, which is FINER than the
// outer row. Two per-period columns with different scan signatures therefore
// materialize two such CTEs, each left-joined on the subject alone, and the
// outer row set becomes the cross product of the two: a player with 17
// receiving-game rows and 17 rushing-game rows produces 289 rows to aggregate
// over. Measured on the emitted SQL, not inferred -- neither join carries a
// period predicate, because there is no period column on the outer row to carry
// one.
//
// THE FAN-OUT IS NOT TODAY A WRONG NUMBER, and it is worth being precise about
// why, because the obvious rationale is false. `COUNT(DISTINCT period_key)` is
// immune to the replication structurally, and `AVG` is immune too -- the
// multiplier is constant per outer group and a mean is invariant under uniform
// replication (tested in Postgres, against an earlier claim here that AVG
// lacked COUNT(DISTINCT)'s immunity). A bare `SUM` is the only vulnerable form
// and nothing emits one.
//
// So this exists for two other reasons. The n-squared row multiplication is a
// performance hazard the `rate` family already pays `period='aggregate'` to
// avoid, and it grows with the number of per-period columns in one view --
// which is the multi-column cost the cohort measurement flagged as the real
// risk. And AVG's immunity is CONDITIONAL on join topology where
// COUNT(DISTINCT)'s is structural, so resting `mean` on it would make a new
// aggregation correct by a property nobody declared.
//
// The outer select reads `MAX(<alias>)` rather than the bare column. The
// summary is one row per (subject, year), so MAX over it IS the value; it is
// there because a CTE column is not functionally dependent on the outer GROUP
// BY the way a grouped primary key is, and Postgres rejects the bare reference.
// It also fails SAFE: if a future change made this join N:1 after all, MAX
// repeats a value rather than inflating a total.
import crypto from 'crypto'

import db from '#db'

const h12 = (s) => crypto.createHash('md5').update(s).digest('hex').slice(0, 12)

const THRESHOLD_OPERATORS = new Set(['>=', '>', '<=', '<', '=', '<>'])

const threshold_operator_sql = (op) => {
  if (!THRESHOLD_OPERATORS.has(op)) {
    throw new Error(`per-period-summary: unsupported threshold op: ${op}`)
  }
  return op
}

export const summary_cte_name = ({ period_cte_name }) =>
  `per_period_summary_${h12(period_cte_name)}`

// One summary column per (aggregation, measure, threshold). Two columns asking
// the same question of the same measure share it; two thresholds over one
// measure get their own, which is what makes a view carrying "games over 100
// yards" beside "games over 50 yards" correct rather than collapsed.
export const summary_column_alias = ({
  aggregation,
  measure_alias,
  threshold
}) =>
  `s_${h12(JSON.stringify({ aggregation, measure_alias, threshold: threshold ?? null }))}`

// Registration is idempotent and deferred: the summary cannot be built until
// every column has registered, because its projection IS the set of questions
// the view asked.
export const register_per_period_summary = ({
  query_context,
  period_cte_name,
  is_team,
  aggregation,
  measure_alias,
  threshold = null
}) => {
  if (!query_context.per_period_summaries) {
    query_context.per_period_summaries = new Map()
  }
  const cte_name = summary_cte_name({ period_cte_name })
  let summary = query_context.per_period_summaries.get(cte_name)
  if (!summary) {
    summary = {
      period_cte_name,
      is_team,
      columns: new Map()
    }
    query_context.per_period_summaries.set(cte_name, summary)
  }

  const alias = summary_column_alias({ aggregation, measure_alias, threshold })
  if (!summary.columns.has(alias)) {
    if (aggregation === 'count') {
      if (!threshold || threshold.op == null || threshold.value == null) {
        throw new Error(
          'per-period-summary: a count column requires a threshold {op, value}'
        )
      }
      summary.columns.set(alias, {
        // DISTINCT on the period key, not COUNT(*): the period CTE is grouped
        // by it, so the two agree today -- but the distinct form is what makes
        // the count a count of PERIODS rather than of rows, which is the thing
        // the label promises.
        sql: `COUNT(DISTINCT ${period_cte_name}.period_key) FILTER (WHERE ${period_cte_name}.${measure_alias} ${threshold_operator_sql(threshold.op)} ?) AS ${alias}`,
        bindings: [threshold.value]
      })
    } else if (aggregation === 'mean') {
      summary.columns.set(alias, {
        // Divides by periods CARRYING MEASURE ROWS, which is what makes mean a
        // different measure from rate rather than a spelling of it: rate
        // divides by a denominator unit (games played), and on 2023 REG
        // receiving yards 366 of 482 players disagree between the two.
        sql: `AVG(${period_cte_name}.${measure_alias}) AS ${alias}`,
        bindings: []
      })
    } else {
      throw new Error(
        `per-period-summary: unknown per-period aggregation '${aggregation}'`
      )
    }
  }

  return { cte_name, alias }
}

// Materialize every registered summary. Must run AFTER the measure batches
// flush: a summary selects FROM its period CTE, and a non-recursive WITH
// requires the referenced CTE to be defined first.
export const flush_per_period_summaries = ({ query_context }) => {
  if (!query_context.per_period_summaries) return
  for (const [cte_name, summary] of query_context.per_period_summaries) {
    if (query_context.applied_output_ctes.has(cte_name)) continue
    const { period_cte_name, is_team, columns } = summary
    const subject_column = is_team ? 'team_code' : 'pid'
    const sub = db(period_cte_name)
      .select(`${period_cte_name}.${subject_column}`)
      .select(`${period_cte_name}.year`)
      .groupBy(`${period_cte_name}.${subject_column}`)
      .groupBy(`${period_cte_name}.year`)
    for (const { sql, bindings } of columns.values()) {
      sub.select(db.raw(sql, bindings))
    }
    query_context.players_query.withMaterialized(cte_name, sub)
    query_context.applied_output_ctes.add(cte_name)
  }
}
