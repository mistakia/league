// Derive what a column can be aggregated by, rather than letting each column
// hand-declare it.
//
// `period` means two different things depending on the aggregation, and the
// derivation names the distinction instead of perpetuating it:
//
//   pooled      one combine over the whole scope; `period` is a DENOMINATOR
//               UNIT (game, team_play, player_route, ...); aggregation `rate`.
//   per_period  combine per period, then reduce across periods; `period` is a
//               PARTITION OF TIME (game, season); aggregations `count`, `mean`.
//
// `game` is legitimately in both vocabularies: it is a denominator unit for a
// rate and a partition for a count or a mean.
//
// MEASURE SHAPE DOES NOT GATE EITHER FAMILY. `rate` divides by a denominator
// unit and `mean` divides by periods carrying measure rows, so they are
// different measures rather than two spellings of one -- measured on 2023 REG
// receiving yards, 366 of 482 players disagree. A column offers whichever of
// the two its fact source supports, normally both, whether or not it carries a
// combine. An earlier draft excluded them on measure shape, which would have
// stripped the whole denominator vocabulary from any column whose combine only
// applies a scale factor.
//
// `sum` is deliberately absent: it is the wire value for NO output
// aggregation, not an aggregation, and no plugin is registered for it.

export const PARTITION_PERIODS = Object.freeze(['game', 'season'])

export const PER_PERIOD_AGGREGATIONS = Object.freeze(['count', 'mean'])

// `denominator_unit_periods` is the fact source's own vocabulary, jointly
// gated by the subject grain -- a team-subject column cannot offer the
// player-action units, and a season-grain source offers no game period.
export const derive_supports_output = ({
  denominator_unit_periods = [],
  partition_periods = PARTITION_PERIODS
} = {}) => {
  const periods_by_aggregation = {
    rate: [...denominator_unit_periods],
    count: [...partition_periods],
    mean: [...partition_periods]
  }

  const aggregations = Object.entries(periods_by_aggregation)
    .filter(([, periods]) => periods.length > 0)
    .map(([aggregation]) => aggregation)

  if (aggregations.length === 0) return null

  const periods = [...new Set(Object.values(periods_by_aggregation).flat())]

  return { periods, aggregations, periods_by_aggregation }
}
