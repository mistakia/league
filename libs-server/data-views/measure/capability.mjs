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

// The denominator-unit vocabulary, by SUBJECT GRAIN. This is the second axis
// the fact source alone could not supply: both from-plays factories read the
// same `plays` source and differ only in whose row the value renders on, so a
// source-keyed lookup would either grant a team column the player-action units
// -- which cannot execute for a team subject -- or strip them from the player
// columns. Which units EXIST is a property of the subject: a team has plays,
// drives and series; a player has all of those PLUS their own participation and
// their own actions.
//
// `game` leads both lists because it is a unit for either subject, and the
// order is the order these have always been declared in.
//
// `player_deep_target`, `player_touch` and `player_opportunity` are in the
// player list even though the retired `supports_periods` default omitted all
// three. That omission was the divergence, not the addition: the registry has
// always registered them for `rate` and the CLIENT has always offered them, so
// a user could ask for one and get an answer the server did not admit to
// serving. They EXPLAIN cleanly, and the client/server parity spec is what
// keeps the two lists from drifting apart again.
const TEAM_DENOMINATOR_UNITS = Object.freeze([
  'game',
  'team_half',
  'team_quarter',
  'team_play',
  'team_pass_play',
  'team_rush_play',
  'team_drive',
  'team_series'
])

const PLAYER_DENOMINATOR_UNITS = Object.freeze([
  ...TEAM_DENOMINATOR_UNITS,
  'player_rush_attempt',
  'player_pass_attempt',
  'player_target',
  'player_catchable_target',
  'player_deep_target',
  'player_catchable_deep_target',
  'player_reception',
  'player_touch',
  'player_opportunity',
  'player_play',
  'player_route',
  'player_pass_play',
  'player_rush_play'
])

export const SUBJECT_GRAINS = Object.freeze(['player', 'team'])

export const denominator_units_for_subject_grain = (subject_grain) => {
  if (subject_grain === 'team') return TEAM_DENOMINATOR_UNITS
  if (subject_grain === 'player') return PLAYER_DENOMINATOR_UNITS
  throw new Error(
    `capability: unknown subject_grain '${subject_grain}' (expected ${SUBJECT_GRAINS.join(' | ')})`
  )
}

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

  // Partitions first, then denominator units, so the flat union reads in the
  // order the period lists have always been declared in.
  const periods = [
    ...new Set([...partition_periods, ...denominator_unit_periods])
  ]

  return { periods, aggregations, periods_by_aggregation }
}
