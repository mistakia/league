// Measure-first column contract for the stats-from-plays factories.
//
// A rate-capable single-aggregate column declares its per-row measure once as
// `measure: { kind, expr, decimals }`, and this module derives every
// downstream artifact from that single source of truth: the season-total
// render (`with_select`), the numerator measure expression (`measure_expr`),
// the period-CTE aggregate selector (`aggregate`), the advertised
// `supports_output` periods, the echoed `supported_rate_types`, and the
// rate/season rounding (`decimals`). This replaces the fragile prior heuristic
// that inferred the measure by parsing the season-render string (and silently
// dropped rate types for `ROUND(SUM(...))`, `AVG(...)`, and
// `COUNT(DISTINCT ...)`).
//
// Two kinds only (closed set):
//   additive       -- season `SUM(expr)` (or `ROUND(SUM(expr), decimals)` when
//                     decimals is set); numerator `SUM(expr)`; aggregate 'sum'.
//   distinct_count -- season `COUNT(DISTINCT expr)` (always bare -- an integer
//                     count never rounds at the season grain); numerator
//                     `COUNT(DISTINCT expr)`; aggregate 'count_distinct'; rate
//                     render rounds with `decimals` (default 2, fractional
//                     per-game).
//
// `decimals` default null. When null neither season nor rate wraps in ROUND
// (preserving exact season parity for the dozens of bare-SUM integer columns
// and matching today's unrounded rate emit). When set it rounds the additive
// season render and both kinds' rate render (the rate emitters read
// column_def.decimals). distinct_count defaults decimals to 2 for its rate
// render while keeping the season render bare.

const VALID_KINDS = new Set(['additive', 'distinct_count'])

// Throws when a measure declaration is malformed: an unknown kind, or a
// missing/empty expression. Invoked inside derive_measure so any rate-capable
// column wired with a bad measure fails loudly at module load rather than
// emitting wrong SQL at query time. The broader invariant -- a column passing
// through a measure-first factory that advertises rate types MUST declare a
// measure; a column left on a raw with_select_string MUST pass
// `supported_rate_types: []` -- is enforced inside the two factories, not here,
// because the role_attributions / explicit-supports_output factories
// (defensive, fantasy-points) never call derive_measure and would be wrongly
// rejected by a global sweep.
const assert_measure_rate_capability = ({ stat_name, measure }) => {
  if (!measure || typeof measure !== 'object') {
    throw new Error(
      `measure-contract: ${stat_name} requires a measure object { kind, expr }`
    )
  }
  if (!VALID_KINDS.has(measure.kind)) {
    throw new Error(
      `measure-contract: ${stat_name} has unknown measure kind '${measure.kind}' (expected additive | distinct_count)`
    )
  }
  if (typeof measure.expr !== 'string' || measure.expr.length === 0) {
    throw new Error(
      `measure-contract: ${stat_name} measure requires a non-empty string expr`
    )
  }
}

// Translate the legacy `per_<period>` rate-type tokens into the canonical
// period names consumed by the output-aggregator registry.
export const derive_periods_from_rate_types = (rate_types) =>
  rate_types.map((t) => t.replace(/^per_/, ''))

// Convert an explicit measure declaration into the full set of column-def
// artifacts. `supported_rate_types` is supplied by the calling factory (the
// two factories advertise different default rate-type sets) and echoed back so
// the factory can spread the whole return uniformly onto the column-def.
export const derive_measure = ({ stat_name, measure, supported_rate_types }) => {
  assert_measure_rate_capability({ stat_name, measure })

  const { kind, expr } = measure
  const decimals =
    measure.decimals != null
      ? measure.decimals
      : kind === 'distinct_count'
        ? 2
        : null

  let with_select
  let aggregate
  if (kind === 'additive') {
    aggregate = 'sum'
    with_select =
      decimals != null ? `ROUND(SUM(${expr}), ${decimals})` : `SUM(${expr})`
  } else {
    // distinct_count: season render is always a bare integer count; the
    // numerator CTE emits COUNT(DISTINCT expr); the rate render rounds.
    aggregate = 'count_distinct'
    with_select = `COUNT(DISTINCT ${expr})`
  }

  // Default numerator measure_expr ignores table_name (the inner expression
  // references nfl_plays columns unambiguously, matching the prior auto-derive
  // contract). A column may still pass an explicit table-qualified measure_expr
  // override, which the factory prefers over this default.
  const measure_expr = () => expr

  const supports_output = {
    periods: [
      'game',
      'season',
      ...derive_periods_from_rate_types(supported_rate_types)
    ],
    aggregations: ['rate', 'count']
  }

  return {
    with_select,
    measure_expr,
    aggregate,
    supports_output,
    supported_rate_types,
    decimals
  }
}
