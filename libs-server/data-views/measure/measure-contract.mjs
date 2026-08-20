// The measure contract for the stats-from-plays factories.
//
//     value(scope) = combine(accumulate(facts in scope))
//
// A column declares a set of additive accumulators plus a pure combine applied
// strictly after accumulation, and every downstream artifact derives from that
// one declaration: the season render (`with_select`), the numerator measure
// expression (`measure_expr`), the period-CTE aggregate selector, the
// advertised `supports_output`, and the rounding. Additivity is what makes a measure evaluable at any grain --
// accumulate over the facts the grain names, then combine -- which is why
// "sum of per-period ratios" is not expressible here rather than being
// prevented by a comment on each column that discovered it.
//
//   measure: {
//     accumulators: { <name>: { aggregate, expr } },
//     combine_accumulators: 'identity' | (accumulator_sql, { divide }) => <sql fragment>,
//     decimals: <int | null>
//   }
//
// `combine_accumulators` is REQUIRED and `'identity'` requires exactly one accumulator.
// Absence is not identity: a misspelled key would otherwise fall through,
// advertise a denominator vocabulary on a ratio column, and emit wrong SQL
// with nothing throwing.
//
// `decimals` defaults to null, and to 2 for a bare distinct count, whose RATE
// render is fractional. It does not round an integral SEASON render -- a count
// has nothing to round, and rounding one would move every distinct-count
// golden while changing no value.
//
// A measure carrying a real combine also derives its RECOMBINATION -- the same
// combine applied one grain coarser, over an offset window whose CTE has
// already projected one column per accumulator. That is the law at a second
// scope rather than a second emitter: `render_combine_accumulators` stays the only place a
// combine is rendered, and "sum of per-year ratios" is unrepresentable because
// the recombination sums ACCUMULATORS and combines after.

import { render_accumulators, validate_accumulator } from './accumulator.mjs'
import {
  render_combine_accumulators,
  validate_combine_accumulators
} from './combine-accumulators.mjs'
import {
  derive_supports_output,
  denominator_units_for_subject_grain
} from './capability.mjs'

const INTEGRAL_AGGREGATES = new Set(['count', 'count_distinct'])

// The aggregations the output-aggregator registry can actually serve. `mean` is
// registered over the partition vocabulary as of the per-period summary, so all
// three are live; capability derivation offers what is SEMANTICALLY legal and
// this list is what is REACHABLE, which is why they are separate.
const SERVEABLE_AGGREGATIONS = ['rate', 'count', 'mean']

// Render a measure's value as ONE SQL fragment over whatever grain the caller's
// GROUP BY names. The accumulators aggregate the facts in that group and the
// combine runs after, so the same call produces the season render, the period-
// CTE projection and the filter comparison. It is exported because the period
// CTE has to render at query time -- the scan it projects into is built from
// the request, not from the declaration.
export const render_measure_sql = ({
  measure_name,
  accumulators,
  combine_accumulators,
  decimals = null
}) =>
  render_combine_accumulators({
    measure_name,
    combine_accumulators,
    accumulator_sql: render_accumulators({ measure_name, accumulators }),
    decimals
  })

const assert_measure = ({ stat_name, measure }) => {
  if (!measure || typeof measure !== 'object') {
    throw new Error(
      `measure-contract: ${stat_name} requires a measure object { accumulators, combine_accumulators }`
    )
  }
  const entries = Object.entries(measure.accumulators || {})
  if (entries.length === 0) {
    throw new Error(
      `measure-contract: ${stat_name} declares no accumulators; a measure requires at least one`
    )
  }
  for (const [name, accumulator] of entries) {
    validate_accumulator({ label: `${stat_name}.${name}`, accumulator })
  }
  validate_combine_accumulators({
    measure_name: stat_name,
    combine_accumulators: measure.combine_accumulators,
    accumulators: measure.accumulators
  })
}

export const derive_measure = ({ stat_name, measure, subject_grain }) => {
  assert_measure({ stat_name, measure })

  const { accumulators, combine_accumulators } = measure
  const entries = Object.entries(accumulators)
  const [sole_name, sole_accumulator] = entries.length === 1 ? entries[0] : []

  const decimals =
    measure.decimals != null
      ? measure.decimals
      : combine_accumulators === 'identity' &&
          sole_accumulator?.aggregate === 'count_distinct'
        ? 2
        : null

  // An integral value has nothing to round at the season grain, whatever its
  // rate render does.
  const value_is_integral =
    combine_accumulators === 'identity' &&
    INTEGRAL_AGGREGATES.has(sole_accumulator.aggregate)

  const accumulator_sql = render_accumulators({
    measure_name: stat_name,
    accumulators
  })

  const with_select = render_combine_accumulators({
    measure_name: stat_name,
    combine_accumulators,
    accumulator_sql,
    decimals: value_is_integral ? null : decimals
  })

  // The numerator measure expression is the accumulated fact expression, which
  // exists only where one accumulator carries the whole measure. A column with
  // a real combine supplies its own numerator handling. It ignores table_name
  // because the inner expression references `nfl_plays` columns
  // unambiguously; a column may still pass an explicit table-qualified
  // override, which the factory prefers over this default.
  const measure_expr = sole_name ? () => sole_accumulator.expr : null

  const aggregate = sole_accumulator ? sole_accumulator.aggregate : null

  // Recombination: the same combine over an offset window. The period CTE
  // projects `<stat>_<accumulator>` per accumulator (see accumulator_selects),
  // so the window sums each one and combines after -- never the reverse.
  const accumulator_names = Object.keys(accumulators)
  const is_combined = combine_accumulators !== 'identity'
  const accumulator_selects = is_combined
    ? accumulator_names.map(
        (name) => `${accumulator_sql[name]} as ${stat_name}_${name}`
      )
    : null
  const recombine = is_combined
    ? ({ table_name }) =>
        render_combine_accumulators({
          measure_name: stat_name,
          combine_accumulators,
          accumulator_sql: Object.fromEntries(
            accumulator_names.map((name) => [
              name,
              `SUM(${table_name}.${stat_name}_${name})`
            ])
          ),
          decimals
        })
    : null

  // The combined measure carried into a query-time scan. A combined value is a
  // function of SEVERAL accumulators, so there is no single `measure_expr` for
  // the period CTE to wrap in `SUM(...)`; it renders the whole combine over the
  // scan's own GROUP BY instead, which is the law at period grain. The
  // accumulator DECLARATIONS travel rather than rendered SQL, because the same
  // scan also has to be able to project the accumulators unaggregated for a
  // consumer that recombines one grain coarser (the multi-year team-play wrap).
  const combined_measure = is_combined
    ? { measure_name: stat_name, accumulators, combine_accumulators }
    : null

  // Capability is what the wire can be ASKED for, so it advertises only what
  // the output aggregator can serve -- the SERVEABLE_AGGREGATIONS rule above at
  // the measure level. Measure SHAPE does not gate it: a combined measure is
  // aggregable exactly as an additive one is, now that the period CTE projects
  // the combine itself, and `rate` and `mean` are both semantically legal on
  // one (see capability.mjs).
  // The denominator-unit vocabulary is DERIVED from the subject grain rather
  // than hand-declared per column. `supports_periods` used to carry it, and
  // 42 columns opted out with `[]` -- every one of them a combined measure,
  // opted out back when a combine could not be aggregated at all. That is no
  // longer a property of the column, so there is nothing left for a column to
  // declare.
  const capability = derive_supports_output({
    denominator_unit_periods: denominator_units_for_subject_grain(subject_grain)
  })
  const supports_output = {
    periods: capability.periods,
    aggregations: capability.aggregations.filter((aggregation) =>
      SERVEABLE_AGGREGATIONS.includes(aggregation)
    )
  }

  return {
    with_select,
    accumulator_selects,
    recombine,
    combined_measure,
    is_combined,
    measure_expr,
    aggregate,
    supports_output,
    decimals
  }
}
